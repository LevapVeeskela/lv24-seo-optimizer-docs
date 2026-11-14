# Security model

Status: **security contract for `0.2.0`.** The Rust bridge and screens are implemented in this
repository. This page states the controls the implementation must enforce and the residual risks
accepted for the preview; where a control is future work, the text says so. `0.2.0` adds signed
auto-update for Windows NSIS, macOS `.app` and Linux AppImage. See [`SECURITY.md`](../SECURITY.md)
for reporting a vulnerability.

## 1. Assets and adversaries

| Asset | Why it matters |
|---|---|
| Provider credentials (GSC, Yandex, Bing, CrUX, PSI) | grant read access to the property owner's search data |
| SMTP password and Telegram bot token | can send messages and impersonate the owner |
| `seo.toml` | reveals property names, recipients, hosts and paths |
| SQLite history, reports and crawl data | contains queries, URLs and traffic that may be commercially sensitive |
| Updater private key and release artifacts | compromise would ship code to every user |
| Local filesystem | a path traversal or command injection could read or overwrite unrelated files |

Adversaries considered:

- a malicious or compromised webview page or dependency running in the webview;
- a malicious local file or `seo.toml` that tries to escape the workspace;
- a compromised provider response or report HTML;
- a network attacker against provider or update traffic;
- a malicious pull request or dependency in the supply chain;
- a user who is legitimately editing configuration but should not be able to execute arbitrary
  commands from the UI.

Out of scope: a compromised operating system or keychain, a user who intentionally runs a malicious
engine via `LV24_SEO_BIN`, and provider-side breaches.

## 2. Trust boundaries

1. **Webview → Rust.** The webview is untrusted. It can invoke only a fixed command table with
   validated arguments. It cannot pass an executable, a shell string, a raw environment map or a
   path outside the approved roots.
2. **Rust → engine.** The shell launches the exact resolved sidecar with an argv array, an absolute
   `--config`, `--json`, a bounded timeout and `cwd = config parent`. It never uses a shell.
3. **Engine → provider.** The engine owns HTTP, retries, rate limits and write gating. The desktop
   does not proxy provider traffic.
4. **Engine → disk.** The engine writes only to the configured data directory and report output
   paths. The desktop must not silently override `LV24_SEO_DATA_DIR`; doing so would change which
   database a terminal run sees.
5. **Desktop → GitHub (updates only).** The desktop requests `latest.json` and, after the user
   confirms, the signed package it names. The manifest and package are authenticated by a minisign
   signature with an embedded public key; HTTPS protects transport, and the signature is the trust
   anchor. No provider data or telemetry is sent.

## 3. Secrets never enter the webview

- Token input is a password field. The value is sent **once** over IPC and immediately piped to
  `lv24-seo auth set --provider <p> --stdin`.
- The Rust layer zeroizes its buffer after the child exits. The value is never written to a log, a
  MobX store, localStorage, the clipboard, a crash report or a support bundle.
- After saving, the UI shows only presence and source (`keychain`, `env`, `file`, `missing`) from
  `auth status --json`.
- Environment-provided secrets are read-only in the UI. Removing one from the file does not remove
  the environment variable; the UI must say so.
- On Linux the CLI runner inherits the session-bus and XDG runtime variables that Secret Service
  needs (`DBUS_SESSION_BUS_ADDRESS`, `XDG_RUNTIME_DIR`, `TMPDIR` and related paths) while still
  filtering unrelated host variables. This makes the OS keychain reachable from the desktop process;
  the secret value itself still travels only over stdin.
- `seo.toml` never contains tokens, passwords or bot tokens. `config show` is redacted by the
  engine; the desktop must not “unredact” it.
- MCP client installation may return the full merged host configuration, which can contain other
  servers' tokens. The desktop extracts and displays only its own entry and never logs or persists
  the full document.

The engine's own secret sources are documented in
[`docs/configuration.md`](configuration.md#5-secrets). Keychain support requires the engine's
`secrets` extra; without it, the engine falls back to environment variables and an explicitly
opt-in file. The desktop must show which source is active.

## 4. Command execution

- The command table is fixed in Rust. Each entry has an id, a read/write class, an argument schema
  and a timeout.
- Arguments are validated by type, length, enum and allowed characters. Free-form text is passed as
  a single argv element, never interpolated into a command line.
- `--config` must be absolute, canonicalized, and selected through the native dialog (or persisted in
  desktop settings). Canonicalization rejects symlink escapes and control characters; the selected
  project is the consent boundary, not a global directory allow-list.
- `--out` and export paths come from a native folder picker or an approved root; they are
  canonicalized before use.
- Write flags (`--send`, `--allow-write`, confirmation tokens) are never accepted from a read
  command and require an explicit confirmation dialog naming the target.
- A timeout or dropped child handle kills the exact child process handle/PID. It never uses a
  wildcard process name; several LV24 applications can run concurrently. There is no user-facing
  cancel button in `0.2.0`.

## 5. Configuration files

- Reads and writes are limited to the approved workspace. The desktop opens the file the engine
  would actually use, not a guessed path.
- Writes are atomic: temp file in the same directory, validation, backup, rename. A failed
  validation leaves the original mtime and contents unchanged.
- Backups are timestamped and capped at five. They inherit restrictive permissions.
- Source TOML is displayed read-only with secret-looking values redacted. There is no raw editor;
  edits go through the validated Settings form and a field-level patch.
- Environment overrides are displayed as names and status only. The UI explains that the desktop's
  own process environment may differ from a terminal's environment.

## 6. Webview hardening

Production CSP (the scaffold's `src-tauri/tauri.conf.json` is the starting point):

```
default-src 'self';
base-uri 'self';
object-src 'none';
frame-ancestors 'none';
img-src 'self' asset: http://asset.localhost data:;
style-src 'self' 'unsafe-inline';
font-src 'self';
connect-src ipc: http://ipc.localhost
```

- No remote scripts, styles, fonts, images or connect targets.
- `withGlobalTauri` is false; the UI uses the typed `@tauri-apps/api` imports.
- The development CSP is limited to the Vite origin and is not used in production.
- Report HTML is **not embedded** in the app webview. The Reports screen calls `open_path`, which
  validates an absolute path, requires it to resolve under the app config/data/log/export dirs or the
  selected project's config/data dirs, and enforces an extension allow-list (`html`, `htm`, `json`,
  `md`, `txt`, `csv`, `toml`, `log`, `sqlite`, `sqlite3`, `db`, `pdf`, images) before handing the
  file to the OS default handler, normally the browser. `secrets.json` and macOS application bundles
  are rejected. The opened file runs outside the app's CSP and is not sandboxed by the desktop; it is
  local content the user chose to open.
- The desktop does not render provider HTML or arbitrary remote content in the main webview.

## 7. Sidecar integrity

- Release builds use a PyInstaller **onedir** tree under the app's resources. Onefile is rejected
  because it extracts on every call and is unsuitable for macOS signing.
- `scripts/build-sidecar.py` pins the engine version and PyInstaller version, uses explicit
  `--collect-submodules`/`--collect-data`/`--add-data` flags and disables UPX.
- `scripts/verify-sidecar.mjs` checks the executable exists, runs `version --json`, requires the
  pinned version and compares SHA-256 with `scripts/cli-checksums.json` when a hash is pinned.
- The checksum policy is rebuild-aware. PyInstaller onedir output is not byte-reproducible, so CI
  runs the verifier with `--no-hash` and records the actual SHA-256 in
  `sidecar-checksums-<target>.json`. The release gate requires a valid report for every shipped
  target (`hashPolicy: "rebuild"`, `ok: true`, 64-hex hash, positive size, exact engine version).
  A `null` pin means “not reviewed yet”, not “verified”.
- Sidecar checksum reports are CI evidence, not release assets. The published `SHA256SUMS.txt`
  covers the installers, updater packages, signatures and `latest.json`; the sidecar executable is
  inside those packages and is not listed separately.
- The runtime does not re-hash the sidecar on every launch. The updater signature authenticates the
  package that contains the sidecar; users who install manually must verify the downloaded asset
  against `SHA256SUMS.txt`.
- `LV24_SEO_BIN` is a deliberate escape hatch for development and advanced users. Release builds do
  not use it unless the user sets it explicitly, and the UI labels the engine as external.

## 8. Updates

- Auto-update is **enabled** in the committed config. The updater endpoint is
  `https://github.com/LevapVeeskela/lv24-seo-optimizer-desktop/releases/latest/download/latest.json`;
  the public minisign key is embedded in `src-tauri/tauri.conf.json`.
- `requireSignedVersion` is enabled. The updater verifies the package signature and binds the
  announced version to the signed package. A signature failure blocks that artifact and points to
  the release page; it is never downgraded to an offline warning or retried automatically.
- The updater only accepts a version greater than the running one, so it cannot downgrade. It never
  downloads or installs on its own; the user presses **Download and install**. An unsaved
  configuration draft disables the install button.
- The private key (`TAURI_SIGNING_PRIVATE_KEY`, optionally with
  `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`) is passed only to the release build step. It is never
  committed, logged, shipped or given to the staging, `latest.json`, checksum or upload steps.
- `publish=true` requires the key. A build-only run without the key produces no updater artifacts.
  Local builds without the key use `--no-sign` or a config override with
  `createUpdaterArtifacts: false`.
- Windows NSIS, macOS `.app` and Linux AppImage update in place. deb, rpm, MSI and the portable ZIP
  are manual-only: the UI disables the in-app installer for those bundle types and links to the
  release page.
- `0.1.0` has no updater, endpoint or public key. Its users must install `0.2.0` manually once;
  auto-update works from `0.2.0` onward.
- OS code signing/notarization is separate. The default build is unsigned; see section 11.

## 9. No telemetry and diagnostics

- The desktop has no analytics, crash-reporting endpoint or “phone home” call.
- Provider calls are made by the engine, only when the user runs a command.
- The diagnostics bundle is user-triggered and contains versions, paths, doctor checks, redacted
  effective config, environment variable **names**, and recent non-secret job errors. It is never
  uploaded automatically.
- Logs redact secret-looking keys and bounded stderr. Users are told to review a bundle before
  sharing it.

## 10. Write and destructive actions

These require an explicit confirmation naming the target and action:

| Action | Engine behavior |
|---|---|
| Send weekly report | SMTP/Telegram delivery, at-least-once |
| Install scheduler job | writes a host cron/systemd/Task Scheduler entry |
| Install MCP client entry | merges host client configuration |
| Export skills/tools | writes files to a chosen directory |
| IndexNow submit | network write, idempotency ledger |
| Sitemap submit | currently `WRITE_DISABLED` in the engine |
| Yandex recrawl | currently `WRITE_DISABLED` in the engine |

`WRITE_DISABLED` and `CONFIRM_REQUIRED` are shown honestly. The desktop never fakes success, never
retries a write automatically and never turns a disabled engine path into a UI action.

## 11. Unsigned builds

The project does not buy code-signing certificates or notarization:

- **macOS:** ad-hoc signature only (`signingIdentity: "-"`). Gatekeeper warns on first launch; the
  documented flow is System Settings → Privacy & Security → Open Anyway. Do not tell users to
  disable Gatekeeper globally.
- **Windows:** no Authenticode signature. SmartScreen, Smart App Control or antivirus may warn or
  block. Publish SHA-256 checksums and explain how to verify them.
- **Linux:** AppImage/deb/rpm are unsigned packages; checksum verification and distribution policy
  apply.

The release notes and README must state this. A “signed” build is only claimed when the owner has
actually configured a certificate and the workflow produced a verifiable signature. Do not add a
paid certificate, notarization or paid runner without explicit owner approval.

## 12. Supply chain

- CI uses standard GitHub-hosted runners and public-repository free minutes only.
- Dependencies are pinned by `package-lock.json`, `Cargo.lock` and the engine/PyInstaller versions
  in `scripts/cli-checksums.json`.
- Dependabot proposes updates; a human reviews and CI runs on the pull request.
- Contract fixtures are generated from a pinned engine and contain no credentials or customer data.
- `gitleaks` or an equivalent secret scan should run locally and in review; a detected secret is
  rotated, not just deleted from the latest commit.
- Release artifacts are checksummed before publication. The release job is owner-gated and manual;
  there are no push/tag triggers. The updater private key is scoped to the build step.
- `SHA256SUMS.txt` covers every published asset, including updater signatures and `latest.json`.
  Sidecar checksum reports stay in CI as rebuild-aware evidence and are not published.

## 13. Residual risks

- Provider credentials can be valid but lack permissions; presence is not proof of access.
- HTTP rate limiting in the engine is process-local and cannot guarantee account-wide quotas.
- Delivery is at-least-once, not exactly-once; a crash after remote acceptance can duplicate a
  message.
- A user-supplied `LV24_SEO_BIN` is trusted by definition. The UI labels it, but cannot sandbox it.
- Unsigned OS packages can be tampered with between download and execution; `SHA256SUMS.txt`
  reduces but does not eliminate that risk. The updater signature authenticates updates, not the
  first manual download.
- The updater depends on GitHub and the embedded public key. A compromised GitHub release account or
  a stolen updater private key is a high-impact supply-chain risk; the private key is therefore
  build-step-only and rotating it requires a manual release with the new public key.
- deb, rpm, MSI and portable ZIP installs are manual by design; a user can run an older package
  without the updater's no-downgrade check.
- A compromised OS keychain or a malicious local process with the same user privileges is outside
  the desktop's control.

## 14. Reviewer checklist

- [ ] No secret value can reach the webview, a log, a fixture or a support bundle.
- [ ] Every engine call uses an argv array and an absolute, user-selected config path.
- [ ] No `eval`, shell string, arbitrary executable or unrestricted path.
- [ ] CSP is production-safe, and report HTML opens externally through `open_path` (approved root
      plus extension allow-list) instead of being embedded in the webview.
- [ ] Write actions require confirmation and preserve engine `WRITE_DISABLED` semantics.
- [ ] A timeout kills only the exact child process; no wildcard process cleanup exists.
- [ ] Sidecar version is verified before release, and the rebuild-aware checksum report exists for
      every shipped target.
- [ ] Updater signatures verify, `requireSignedVersion` is on, downgrades are refused and the
      private key reaches only the build step.
- [ ] Manual-only bundle types disable the in-app installer and link to the release page.
- [ ] Unsigned-build warnings are present in the README and release notes.
- [ ] New dependencies are free-tier compatible and reviewed.
