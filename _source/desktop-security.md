# Security model

Status: **security contract for `0.8.0` (current release, 2026-11-17; `0.7.0` is the previous
published line).** The Rust bridge and screens are implemented in this repository. This page states the
controls the implementation must enforce and the residual risks accepted for the pre-1.0 line; where a
control is future work, the text says so.
`0.8.0` adds the gated `bing_submit` command (engine `0.10.0`) with the same write secret and
plan/apply gate, plus read-only `bing_sitemaps`, `bing_issues` and `bing_quota` commands that accept
only the active config. It does not change the secret or the write gate.
The read-only diagnostics surface adds `gsc_inspect`, `gsc_sitemaps`, `yandex_indexing`,
`yandex_sitemaps`, `yandex_queue`, `bing_pages`, `bing_traffic`, `bing_crawl`, `bing_urlinfo`,
`bing_joins`, six `metrika_*` reads and `cwv_audits`/`cwv_history`. Each has a short argument
allow-list, rejects `allowWrite`, a confirm token and every field owned by another command, and
requires the active project config. They never write provider or local state. They are implemented in `0.9.0` and require engine `0.11.0`; they are not part of the published
`0.8.0` feature set. The OAuth Connect card is implemented in `0.9.1` and requires engine `0.13.1`;
the read-only Indexing automation card is implemented in `0.9.2` and requires engine `0.13.1`; the
Connect card shows engine `0.14.0` OAuth readiness in `0.9.3` and never renders a token.
`0.7.0` added the gated `sitemap_submit` and `indexnow_submit` commands (engine `0.9.0`), one
external-URL allow-list for `open_bing_sitescan`, and a per-session in-memory write secret.
`0.6.0` added exact-process cancellation for the six long local jobs (`run_cancel`) and made
`schedule install` append `--allow-write` only after the confirmation dialog, matching engine
`0.8.0`. `0.5.0` added a native archive picker whose result is the only arbitrary
backup path
`backup restore` may read, a portfolio root that must be a dialog-picked folder, and a two-phase
restore that writes only with `--allow-write` plus the plan token. `0.4.0` added a native log-file
picker whose result is the only arbitrary log path `logs analyze` may read, a backup output folder
that must be the app export directory or a dialog-picked folder, and a task evidence payload that
rejects credential-shaped keys. `0.3.0` added a native directory picker that approves the folder for
`init`, a persisted `knownConfigs` list that lets a previously picked or created config be
re-activated, and a `core:window:allow-destroy` capability used only by the confirmed-discard close
path. `0.2.3` moved the update install into Rust, gated every config path behind the native dialog,
redacted all engine output before it reaches the webview and gave Windows drafts and backups an
owner-only DACL. `0.2.2` hardened the updater's sidecar cleanup, secret-source reporting and the
durability of configuration writes. See [`SECURITY.md`](../SECURITY.md) for reporting a
vulnerability.

## 1. Assets and adversaries

| Asset | Why it matters |
|---|---|
| Provider credentials (GSC, Yandex Webmaster, Yandex Metrika, Bing, CrUX, PSI) | grant read access to the property owner's search data |
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
  the environment variable; the UI must say so and must not offer an action that cannot work.
- `auth logout` reporting `deleted: false` is shown honestly: nothing was deleted, so nothing is
  reported as removed.
- On Linux the CLI runner inherits the session-bus and XDG runtime variables that Secret Service
  needs (`DBUS_SESSION_BUS_ADDRESS`, `XDG_RUNTIME_DIR`, `TMPDIR` and related paths) while still
  filtering unrelated host variables. This makes the OS keychain reachable from the desktop process;
  the secret value itself still travels only over stdin.
- The desktop and the CLI share one OS keychain entry per secret: service `lv24-seo`, username
  `gsc_token`, `psi_api_key`, and so on. A token entered in a terminal is visible in the desktop's
  `auth status` and a token entered in the desktop is visible to the CLI, without a copy in the
  webview or the app data directory. `LV24_SEO_*` environment variables are inherited by the CLI
  runner. The opt-in `<data-dir>/secrets.json` fallback is shared only when both surfaces use the
  same workspace/data directory.
- `seo.toml` never contains tokens, passwords or bot tokens. `config show` is redacted by the
  engine; the desktop must not “unredact” it.
- OAuth connectors never receive a token. `auth_login` returns a token-free summary (provider, flow,
  scopes, expiry, target); the engine writes the access/refresh tokens to its secret store. The card
  shows only `auth status` presence for `gsc_oauth`, `yandex_oauth` and `metrika_oauth`.
- The OAuth client secret is CLI-only: `lv24-seo auth set --provider gsc_oauth_secret --stdin` or
  `--provider yandex_oauth_secret --stdin`. The window has no field for it and never asks for it;
  client ids stay in `[auth.gsc]` / `[auth.yandex]` in `seo.toml`.
- A Yandex authorization code is single-use. The card sends it once as `--code`, clears it from the
  store after the exchange (success or failure) and never writes it to a log or the clipboard. The
  Google flow is handled entirely inside the engine's loopback listener.
- MCP client installation may return the full merged host configuration, which can contain other
  servers' tokens. The desktop extracts and displays only its own entry and never logs or persists
  the full document.
- The write-gate secret is separate from provider credentials. The desktop generates 32 random bytes
  at startup, keeps the 64-character hex value only in Rust memory (zeroized on drop) and passes it
  as `LV24_SEO_WRITE_SECRET` to every engine child after `env_clear()`. It is absent from argv,
  settings, logs, diagnostics and result envelopes; a new session invalidates old plan tokens. A CLI
  user who runs the engine directly sets `LV24_SEO_WRITE_SECRET` in their own environment.

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
- The engine child receives the session `LV24_SEO_WRITE_SECRET` through its environment after
  `env_clear()`, not through argv. The value is generated once per app session and never serialized.
- The consent is enforced, not implied: `settings_set` accepts a new `configPath` only when the path
  is already active or was returned by `pick_config`, which opens the native dialog and records the
  canonical path for this process. Any other value fails with `PATH_NOT_APPROVED` and the rejected
  path in `details.path`. A malicious `seo.toml` therefore cannot point `config_write` or
  `config_patch` at an arbitrary file. The webview no longer opens the config dialog itself, so it
  cannot name a config path the dialog did not produce; the dialog plugin remains available for
  folder and file pickers whose result is validated separately.
- `--out` and export paths come from a native folder picker or an approved root; they are
  canonicalized before use.
- Write flags (`--send`, `--allow-write`, confirmation tokens) are never accepted from a read
  command and require an explicit confirmation dialog naming the target. The engine's write gate
  requires `--allow-write` even for a plan, so `sitemap_submit`, `indexnow_submit` and `bing_submit`
  accept exactly two shapes: a plan with the opt-in and no token, or an apply with the opt-in and the
  token. A token without the opt-in is refused before the engine is spawned. The plan only mints a
  token; it does not call the provider. `bing_submit` additionally requires at least one explicit URL
  or the sitemap source, validates every URL, and rejects `sitemapUrl` unless `fromSitemap=true`.
- **OAuth connector arguments.** `auth_login` accepts only `provider` (`gsc`, `yandex`, `metrika`),
  `noBrowser`, `port` (`0..65535`), `code` and `urlOnly`; every other field is rejected. The shell
  refuses `allowWrite`/`confirm`, `urlOnly` for Google, `code` with `urlOnly`, and `port` for
  Yandex/Metrika before the engine is spawned. A code must be one non-empty argv element without
  whitespace or control characters.
- **One allow-listed consent opener.** `open_oauth_url` accepts only
  `https://oauth.yandex.ru/authorize?...` with a fixed scheme, host and path, a non-empty query and no
  fragment, userinfo or backslash. It is not a generic `open_url` bridge; Google's consent page is
  opened by the engine's own loopback flow and never reaches the webview.
- **Read-only Bing views.** `bing_sitemaps`, `bing_issues` and `bing_quota` are bound to the active
  config and accept no write flag, token, sitemap URL or per-URL argument. They read the same
  workspace the write gate uses and never create a ledger entry. Their rows are rendered as returned:
  quota is remaining, never used or total; a crawl-issue bitmask is decoded by the UI; no per-URL
  status is invented.
- **Read-only platform diagnostics.** The Diagnostics screen wires 18 allow-listed reads across GSC,
  Yandex Webmaster, Bing, Metrika and CWV. The shell rejects `allowWrite`, a confirm token, a raw
  provider flag and any argument owned by another command; `group`, `strategy`, `device` and
  `category` are checked against fixed sets in Rust before argv is built. Every command needs the
  active config, and the webview cannot pass `--site` to a Bing read: the site comes from
  `providers.bing.site`. The page has no write button, and an empty provider answer is labeled
  `no_rows_for_window`, `provider_returned_no_rows` or `low_traffic` rather than shown as zero.
- **External URL allow-list.** `open_bing_sitescan` is the only command that opens a remote URL. It
  accepts only an absolute `https://` site URL, rejects whitespace, control characters, userinfo and
  malformed hosts, and percent-encodes the value with the RFC 3986 unreserved set. The destination is
  hard-coded as `https://www.bing.com/webmasters/sitescan?siteUrl=<encoded>` and checked again before
  the opener is called, so the value cannot add a host, path, extra parameter or fragment. The
  webview cannot pass a destination URL. Bing has no public API for starting a Site Scan; the UI
  never claims that the desktop started one.
- A timeout or dropped child handle kills the exact child process handle/PID. It never uses a
  wildcard process name; several LV24 applications can run concurrently. On Unix the engine is
  started in its own process group so a PyInstaller bootloader's interpreter child is killed with it
  instead of surviving and locking the engine executable.
- `run_cancel` cancels one long engine call by its stable run id and signals only the exact child
  PID registered for that run (and its process group on Unix), after checking that the PID is still
  an engine image or one of the exact children this process tracks. It never matches a process by
  name and returns `false` for a run that already finished. A cancelled run is reported as
  `RUN_CANCELLED`, distinct from a timeout. The update download is the only other cancellable
  operation (section 8).
- Blocking filesystem work (config/settings writes, export writes, `open_path` resolution) runs on a
  blocking task with a deadline: 10 s for settings and path resolution, 30 s for exports. A call that
  exceeds it returns `PATH_TIMEOUT` instead of freezing the window. The timed-out task cannot be
  aborted, so its thread lives until the kernel call returns; the UI is free either way.

## 5. Configuration files

- Reads and writes are limited to the approved workspace. The desktop opens the file the engine
  would actually use, not a guessed path. A stale saved config path is tolerated: a moved or deleted
  workspace is reported as missing (`configExists: false`) with a **Choose config** action instead of
  blocking startup or showing a generic stats error.
- Reads are bounded (`8 MiB`); an oversized or non-regular file is rejected instead of read.
- Writes are atomic: temp file in the same directory, validation, backup, rename. A failed
  validation leaves the original mtime and contents unchanged.
- Writes are durable: the temp file is fsynced before the rename and the parent directory is
  fsynced after it, so a crash or power loss cannot leave a truncated `seo.toml`.
- Temp drafts and backups are private on every platform. On Unix that is mode `0600`. On Windows a
  new file inherits its directory's DACL, which under a share or `C:\Users\Public` can grant other
  users read access to a draft that holds the same tokens as the config, so the shell removes
  inheritance and grants full control to `OWNER RIGHTS` (`S-1-3-4`) **before** any bytes are
  written. `icacls` is invoked through `Command::arg`, never a shell string, and a rejected ACL is
  logged and tolerated so it cannot block saving the user's configuration.
- Backups are timestamped and capped at five. Retention deletes only names this app writes
  (`<config>.bak-YYYYMMDDTHHMMSSZ` or `…-<n>`); a user file such as
  `seo.toml.bak-before-experiment` shares the prefix but is never pruned.
- `storage.data_dir` is rejected before it is resolved when it names a network share or a device
  namespace: `\\server\share`, `\\?\C:\…`, `\\.\device`, `\??\…` and `//host/share` return
  `INVALID_PATH` with `reason: network_or_device_path`. The check is string-based because joining the
  value to the config directory would hide the prefix. Otherwise resolving it would perform an
  outbound SMB authentication (NetNTLM leakage) and could block the UI for the SMB timeout. The same
  check runs when the engine reports a data directory, so a share written by another tool is never
  surfaced.
- Windows reserved device names (`CON`, `PRN`, `AUX`, `NUL`, `COM1`–`COM9`, `LPT1`–`LPT9`) and
  trailing dots or spaces are rejected in every path component, not only the last one.
- Settings load per field: one malformed value does not discard the rest of the settings file.
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
form-action 'none';
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
  are rejected. Resolution runs off the UI thread with a 10 s deadline (`PATH_TIMEOUT`), and the
  opener receives the **canonical** path that passed the check, not the raw request: a symlink or an
  executable handler swapped in after validation cannot redirect the launch. On Windows the verbatim
  `\\?\C:\…` prefix is stripped before the path is handed to the opener, because shell-execution APIs
  reject it; the path is not re-resolved. The opened file runs outside the app's CSP and is not
  sandboxed by the desktop; it is local content the user chose to open.
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
  not use it unless the user sets it explicitly; the shell records the source as `env`. The current
  UI shows the engine version, not a separate path/source panel.

## 8. Updates

- Auto-update is **enabled** in the committed config. The updater endpoint is
  `https://github.com/LevapVeeskela/lv24-seo-optimizer-desktop/releases/latest/download/latest.json`;
  the public minisign key is embedded in `src-tauri/tauri.conf.json`.
- The webview holds only `updater:allow-check`. It can read the manifest but cannot call the plugin's
  `downloadAndInstall`, so it cannot bypass the pre-install cleanup or the version re-check. Install
  runs in Rust through `update_install(expectedVersion)`; the capability list no longer contains
  `updater:default`.
- `update_install` re-checks the endpoint, and if the announced version differs from the one the user
  saw it fails with `UPDATE_VERSION_MISMATCH` (details carry `announced` and `expected`) instead of
  silently installing a different release. A second install while one is downloading or installing
  fails with `UPDATE_IN_PROGRESS`. Download progress is emitted as `update://progress`.
- Cancellation is real: `update_cancel` sets a flag that a running download polls every 100 ms, drops
  the download future (closing the HTTP stream) and returns `UPDATE_CANCELLED`; the installer never
  starts. Once the installer has started, `update_cancel` returns `false` and the UI says the update
  cannot be undone rather than pretending the click cancelled it.
- `requireSignedVersion` is enabled. The updater verifies the package signature and binds the
  announced version to the signed package. A signature failure blocks that artifact and points to
  the release page; it is never downgraded to an offline warning or retried automatically.
- The updater only accepts a version greater than the running one, so it cannot downgrade. It never
  downloads or installs on its own; the user presses **Download and install**. An unsaved
  configuration draft disables the install button.
- Immediately before the installer starts, the shell stops the engine sidecar PIDs **this app
  instance registered**. The sidecar lives inside the installed resource directory, so a live
  process keeps it locked and breaks the NSIS update. Only exact tracked PIDs are stopped; nothing
  is matched by image name, so another installed copy, a portable build or a terminal run is
  untouched. `update_install` repeats the stop itself (defense in depth) because the webview could
  skip `prepare_update`. A cleanup failure blocks the install with `UPDATE_ENGINE_BUSY` instead of
  launching an installer that will fail halfway.
- The private key (`TAURI_SIGNING_PRIVATE_KEY`, optionally with
  `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`) is passed only to the release build step. It is never
  committed, logged, shipped or given to the staging, `latest.json`, checksum or upload steps.
- `publish=true` requires the key. A build-only run without the key produces no updater artifacts.
  Local builds without the key use `--no-sign` or a config override with
  `createUpdaterArtifacts: false`.
- Windows NSIS, macOS `.app` and Linux AppImage update in place. deb, rpm, MSI and the portable ZIP
  are manual-only: the UI disables the in-app installer for those bundle types and links to the
  release page.
- `0.1.0` has no updater, endpoint or public key. Its users must install `0.8.0` manually once;
  auto-update works from `0.2.0` onward.
- OS code signing/notarization is separate. The default build is unsigned; see section 11.

## 9. No telemetry and diagnostics

- The desktop has no analytics, crash-reporting endpoint or “phone home” call.
- Provider calls are made by the engine, only when the user runs a command.
- The diagnostics bundle is user-triggered and contains versions, paths, doctor checks, redacted
  effective config, environment variable **names**, and recent non-secret command errors. It is never
  uploaded automatically.
- Logs redact secret-looking keys and bounded stderr. Users are told to review a bundle before
  sharing it.
- **Every** engine `stderr` and every bounded output preview passes through `redact_secrets` before
  it reaches the webview, a log or a diagnostics bundle — not only the configuration-validation path.
  TOML/JSON credential assignments (`token = "…"`, `"apiKey": "…"`), `--token`/`--password` argv and
  `Bearer` values are rewritten to `***`. Paths, URLs and engine messages are preserved so
  diagnostics stay useful.
- A TOML syntax error is redacted before it is returned as `syntaxError`: the parser quotes the
  offending line, which can be a token the user pasted before the error was fixed.
- Redaction happens **before** truncation. A preview cut at 300 characters could split `token = "…"`
  so the pattern no longer matches; redacting first is what keeps the fragment out of the webview.
  The engine can quote a config line or an argv in a traceback, so this path must not carry a
  credential.

## 10. Write and destructive actions

These require an explicit confirmation naming the target and action:

| Action | Engine behavior |
|---|---|
| Send weekly report | SMTP/Telegram delivery, at-least-once |
| Install scheduler job | writes a host cron/systemd/Task Scheduler entry |
| Install MCP client entry | merges host client configuration |
| Export skills/tools | writes files to a chosen directory |
| IndexNow submit | network write to Bing/IndexNow; two-phase plan token and idempotency ledger |
| Bing sitemap submit | network write to Bing Webmaster; two-phase plan token and idempotency ledger |
| Bing URL submission | network write to Bing Webmaster; two-phase plan token and idempotency ledger; success means accepted, not indexed |
| Bing sitemap/issue/quota views | read-only Bing Webmaster calls; no write flag, token or provider mutation |
| Bing Site Scan | no public API; opens the official Bing page only and never reports a started scan |
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
- A blocking `audit` job runs `npm audit --audit-level=high` and `cargo audit` (RustSec) on every pull
  request. Both workflows install Rust `1.95.0` instead of `stable`, so the shipped binary is built by
  the reviewed compiler and a new compiler cannot change it between runs; the pin is bumped
  deliberately in the release that reviews the toolchain.
- Dependabot proposes updates; a human reviews and CI runs on the pull request.
- Contract fixtures are generated from a pinned engine and contain no credentials or customer data.
- `gitleaks` or an equivalent secret scan should run locally and in review; a detected secret is
  rotated, not just deleted from the latest commit.
- Release artifacts are checksummed before publication. The release job is owner-gated and manual;
  there are no push/tag triggers. The updater private key is scoped to the build step.
- The published-asset allowlist, `SHA256SUMS.txt` and the upload list come from one module
  (`scripts/release-assets.mjs`) with tests, so an asset cannot be checksummed but silently dropped
  from the release. The Windows portable `.zip.sha256` is a published asset and the release gate
  recomputes it against the archive.
- The merged `latest.json` is validated against `contracts/latest.schema.json` before the draft is
  created; a manifest the updater plugin would reject fails the job.
- `SHA256SUMS.txt` covers every other published asset, including updater signatures and `latest.json`.
  Sidecar checksum reports stay in CI as rebuild-aware evidence and are not published.

## 13. Residual risks

- Provider credentials can be valid but lack permissions; presence is not proof of access.
- HTTP rate limiting in the engine is process-local and cannot guarantee account-wide quotas.
- Delivery is at-least-once, not exactly-once; a crash after remote acceptance can duplicate a
  message.
- A user-supplied `LV24_SEO_BIN` is trusted by definition. The shell records it as source `env`, but
  cannot sandbox it; the current UI shows the version, not the source label.
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
- Config-path approval is per process: a path the user picked stays approved until the app exits. It
  is consent, not a durable allow-list, so a later process still needs the dialog.
- ACL hardening is best effort. If `icacls` fails (an unusual filesystem or a policy that blocks it),
  the save proceeds and the failure is logged; the draft then has the directory's inherited DACL.
- A blocking filesystem call that exceeds its deadline keeps its worker thread until the kernel call
  returns. The UI is released, but the thread is not reclaimable.
- The updater's cancellation is observed before the installer starts. Once installation begins there
  is no rollback, and the UI says so instead of offering a cancel that cannot work.

## 14. Reviewer checklist

- [ ] No secret value can reach the webview, a log, a fixture or a support bundle.
- [ ] Every engine call uses an argv array and an absolute, user-selected config path.
- [ ] No `eval`, shell string, arbitrary executable or unrestricted path.
- [ ] A new `configPath` can only come from `pick_config` (or the active path); `PATH_NOT_APPROVED`
      is what a hand-crafted `settings_set` receives.
- [ ] Every engine `stderr` and output preview is redacted before truncation and before IPC.
- [ ] `storage.data_dir` rejects UNC, verbatim and device references with `INVALID_PATH`.
- [ ] Windows temp drafts and backups carry an explicit owner-only DACL, not the directory's.
- [ ] Backup retention matches only app-written `…bak-<stamp>` names.
- [ ] CSP is production-safe, and report HTML opens externally through `open_path` (approved root
      plus extension allow-list) instead of being embedded in the webview.
- [ ] `open_bing_sitescan` opens only the hard-coded Bing Site Scan page, accepts only an absolute
      https site URL and never claims a scan was started.
- [ ] Write actions require confirmation and preserve engine `WRITE_DISABLED` semantics.
- [ ] Bing read-only views reject write flags and tokens; quota is labeled remaining, and submission
      success is described as accepted, not indexed.
- [ ] A timeout kills only the exact child process; no wildcard process cleanup exists.
- [ ] Sidecar version is verified before release, and the rebuild-aware checksum report exists for
      every shipped target.
- [ ] Updater signatures verify, `requireSignedVersion` is on, downgrades are refused and the
      private key reaches only the build step.
- [ ] The webview holds `updater:allow-check` only; install goes through `update_install` with a
      version re-check, and cancellation cannot be claimed after installation started.
- [ ] Manual-only bundle types disable the in-app installer and link to the release page.
- [ ] Unsigned-build warnings are present in the README and release notes.
- [ ] New dependencies are free-tier compatible and reviewed.
