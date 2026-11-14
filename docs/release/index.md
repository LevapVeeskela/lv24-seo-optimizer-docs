---
title: Releases and updates
description: Engine 0.5.2 changes, desktop 0.2.2 assets, signed auto-update matrix, release pipeline, version pinning and rollback.
---

# Releases and updates

The current releases are:

| Product | Version | Notes |
|---|---|---|
| Engine | `lv24-seo 0.5.2` | Bugfix release; no schema migration, no new CLI command or MCP tool |
| Desktop | `0.2.2` | Hardening patch: updater sidecar cleanup, durable writes, secrets and stale-state fixes; bundles engine 0.5.2 |

The desktop version and the engine version are independent, but the desktop pins an exact engine and refuses one below its minimum.

## Engine 0.5.2

This is a bugfix release for the 0.5.x line. It closes blockers found after 0.5.1: a relative
`storage.data_dir` in `seo.toml` followed the shell's working directory, the CLI built its write
gate without the idempotency ledger, sitemap fetch errors echoed URLs that can carry query tokens,
and GSC claimed complete data when the final page exactly filled the row cap.

No schema migration and no new CLI command or MCP tool. The JSON envelope keeps its existing keys;
`doctor` adds the additive `meta.data_dir` / `meta.data_dir_source` fields and may carry a warning.
Existing stores open unchanged, and configs that already use an absolute `data_dir` behave exactly
as before.

What changed:

- **Data-dir anchoring.** A relative `storage.data_dir` written in `seo.toml` now resolves against
  that file's parent, so `lv24-seo --config /srv/site/seo.toml` uses `/srv/site/data` from any
  working directory. `init` creates `<config dir>/data` and writes `data_dir = "./data"`. The
  built-in default (no `[storage]` block) and `LV24_SEO_DATA_DIR` stay process-scoped on purpose.
  `doctor --json` reports `meta.data_dir` and `meta.data_dir_source` (`config` or
  `working directory`), and `config show --json` reports the effective path.
- **Absolute scheduler paths.** `resolve_config_path` always returns an absolute, normalised path.
  `schedule install` and `schedule print` embed that absolute `--config` argument and use the
  config's parent as the working directory, so a job runs the same config from any scheduler
  working directory.
- **Replay-safe CLI writes.** A write command with `--confirm` opens the workspace SQLite ledger
  and passes it to `WriteGate`. A replayed token returns `status: skipped` with
  `reason: duplicate` and the provider is called exactly once. A dry run opens no ledger and
  creates no database. Without an initialised workspace the command still works, but the envelope
  warns that replay protection is off for the token's five-minute lifetime.
- **Sitemap warning redaction.** A failed sitemap fetch reports only the exception type
  (`HTTPError`, `TimeoutError`, …), never the URL or query string. The failure stays visible and
  machine-readable without leaking `?key=…` into warnings, `limitations[]` or MCP payloads.
- **GSC exact-cap honesty.** A final GSC page that exactly fills the 50,000-row cap is reported as
  `truncated: true` with `rows_cap_50000`; a smaller caller cap produces a warning that names the
  caller's row limit. A zero cap is reported as a cap, not as an empty result. A full page is not
  proof that no further row exists.
- **Opt-in redacting logging.** `LV24_SEO_LOG_LEVEL` installs the redacting handler at exactly two
  process entry points: the CLI callback and `lv24-seo mcp serve`. An unset variable leaves the
  caller's logging configuration untouched. Output is one JSON line per record when stderr is not
  a terminal (pipe, scheduler log, MCP host) and a plain line otherwise. The MCP transport logs to
  stderr only; stdout stays the protocol.
- **Smaller fixes.** A pending write claim left by a crash still has no TTL; deleting
  `data/seo.sqlite3` resets the ledger; `doctor` does not fail on a relative data directory.

Verification recorded for this release:

| Check | Result |
|---|---|
| Offline test suite | 1141 passed, 1 skipped |
| `ruff check` | Clean |
| `ruff format --check` | Clean |
| `mypy src` | Clean |
| MCP registry `--check` | Clean (no surface change) |

Known limits in 0.5.2:

- A config reached through a symlink anchors its data directory next to the link, not the target,
  because symlinks are deliberately kept. `LV24_SEO_DATA_DIR` remains a process-scoped override.
- A `pending` write claim left by a crash has no TTL; it is treated as in-flight until an operator
  releases it. This is deliberate: a false retry can duplicate a provider write.
- Without a data directory there is no replay protection; the token remains valid for its full
  five-minute window.
- A site with exactly 50,000 GSC rows and nothing behind the cap is also reported truncated. That
  is deliberate: a full page is not proof that no further row exists.
- Logging remains opt-in. The redaction rules cover sensitive keys, known token prefixes and opaque
  long values, not every provider-specific secret shape.

## Desktop 0.2.2 assets

`0.2.2` is a hardening patch on the `0.2.x` preview. It fixes the updater failure caused by a locked
engine sidecar, makes the Rust bridge write configuration and settings durably and privately,
clears stale UI state, and bundles `lv24-seo 0.5.2`.

| Asset | Platform | Purpose |
|---|---|---|
| `LV24.SEO.Optimizer_0.2.2_x64-setup.exe` + `.exe.sig` | Windows x64 | NSIS per-user installer; signed updater package |
| `LV24-SEO-Optimizer_0.2.2_x64-portable.zip` | Windows x64 | Portable build; manual-only |
| `LV24.SEO.Optimizer_0.2.2_aarch64.dmg` | macOS Apple silicon | First install |
| `LV24.SEO.Optimizer_0.2.2_x64.dmg` | macOS Intel | First install |
| `LV24.SEO.Optimizer_0.2.2_aarch64.app.tar.gz` + `.sig` | macOS Apple silicon | Signed updater package |
| `LV24.SEO.Optimizer_0.2.2_x64.app.tar.gz` + `.sig` | macOS Intel | Signed updater package |
| `LV24.SEO.Optimizer_0.2.2_amd64.AppImage` + `.AppImage.sig` | Linux x64 | AppImage; signed updater package |
| `LV24.SEO.Optimizer_0.2.2_amd64.deb`, `LV24.SEO.Optimizer-0.2.2-1.x86_64.rpm` | Linux x64 | Package-manager installs; manual-only |
| `latest.json` | All | Signed updater manifest |
| `SHA256SUMS.txt` | All | SHA-256 for every published asset |

The Windows installer requires Windows 10/11 x64 and the WebView2 runtime; the NSIS installer can fetch it, the portable ZIP cannot. Linux bundles are built on
Ubuntu 22.04 with a glibc 2.35 baseline and are x64 only. macOS requires macOS 13 or later; use the `aarch64` DMG on Apple silicon and the `x64` DMG on Intel.

### Updater sidecar cleanup

The engine sidecar lives inside the installed resource directory, so a running `lv24-seo` process
keeps the file locked and the NSIS installer cannot replace it. Before the installer starts, the
shell calls `prepare_update`, which stops **only the engine PIDs this app instance registered** when
it spawned them. Nothing is matched by image name, so another installed copy, a portable build, a
terminal `lv24-seo` run or an unrelated process is untouched. A short wait (2 s) confirms the
processes are gone.

If cleanup fails, the install is blocked with `UPDATE_ENGINE_BUSY` instead of starting an installer
that will fail halfway. The error is retryable: close the run that holds the sidecar and press the
button again.

### Secrets and configuration

- Yandex Metrika keeps its own auth provider (`metrika`, `yandex_metrika_token`) in the provider
  list, the Settings badge, the secret modal and the en/ru/zh labels. It never borrows the
  Webmaster token.
- The desktop and the CLI share **one OS keychain entry per provider** (service `lv24-seo`). A token
  entered with `lv24-seo auth set --provider <p> --stdin` in a terminal appears in the desktop's
  `auth status` without re-entry, and a token entered in the desktop is visible to the CLI.
- A token supplied through `LV24_SEO_*` is shown as **read-only** in the UI: the desktop cannot
  remove an environment variable, and it says so instead of offering a delete button that does
  nothing. `auth logout` reporting `deleted: false` is surfaced honestly.
- Workspace, report, doctor and secret state is cleared when the workspace changes or the engine
  goes offline. Actions that cannot work are disabled rather than failing on click. The en/ru/zh
  message catalogues are at parity; a missing key is a test failure.
- Configuration and settings writes are atomic **and fsynced** (file and parent directory). Temp
  drafts and backups are mode `0600`; config reads are bounded at 8 MiB; settings load per field;
  Windows reserved device names and trailing dots/spaces are rejected in every path component.
  Configuration-validation stderr is redacted before it reaches the UI or a log.

## Auto-update matrix

| Bundle | In-app update | What happens |
|---|---|---|
| Windows NSIS | Yes | Downloads the signed setup `.exe`, stops tracked sidecar PIDs, runs the installer in passive mode, relaunches |
| macOS `.app` | Yes | Downloads the signed `.app.tar.gz`, replaces the app, relaunches |
| Linux AppImage | Yes | Downloads the signed AppImage, replaces it, relaunches |
| Windows portable ZIP | No | Settings points to the release page; download and extract a new ZIP |
| Linux deb | No | Settings points to the release page; upgrade with the package manager |
| Linux rpm | No | Settings points to the release page; upgrade with the package manager |
| MSI | No | No MSI is produced; an MSI install is treated as manual |
| Unknown bundle | No | Settings points to the release page |

Manual-only is deliberate. A deb or rpm install is owned by the package database; an MSI is not produced by this project, and the NSIS updater package cannot
replace it; a portable ZIP has no installer to replace and may live on removable media. The desktop reports the installed bundle type and disables the in-app
installer for those cases. It does not pretend that a manual package was updated.

The Windows NSIS path was verified end-to-end for `0.2.0 → 0.2.1`. The next in-app update is
`0.2.1 → 0.2.2`, which also exercises the sidecar cleanup path. `0.2.2` can update directly from
`0.2.0`; `0.1.0` has no updater and needs one manual install.

## Release pipeline

The desktop workflow is manual and owner-gated. It has no push, pull-request or tag triggers. The owner starts **Actions → Desktop build → Run workflow** and
approves the `desktop-release` environment; a non-owner run is skipped.

| Input | Default | Meaning |
|---|---|---|
| `engine_version` | `0.5.2` | Exact engine bundled in the sidecar |
| `signed` | `false` | Request OS signing/notarization; not configured in this zero-spend repository |
| `publish` | `false` | Create a GitHub release after every matrix build passes |
| `tag` | Empty | `vX.Y.Z` release tag; required when `publish=true` |

The default matches the `0.2.2` pin. The release gate rejects a manifest mismatch if a different version is passed.

| Runner | Target | Bundles |
|---|---|---|
| `windows-latest` | `x86_64-pc-windows-msvc` | NSIS |
| `ubuntu-22.04` | `x86_64-unknown-linux-gnu` | AppImage, deb, rpm |
| `macos-15` | `aarch64-apple-darwin` | DMG + app |
| `macos-15-intel` | `x86_64-apple-darwin` | DMG + app |

All runners are standard GitHub-hosted runners. No larger runner, paid minute, paid storage or paid signing service is used. Build artifacts are retained for 7
days; the GitHub release is the durable distribution channel.

## Sidecar pin and checksums

The release sidecar is a PyInstaller **onedir** tree, built on the matching host; PyInstaller does not cross-compile. The engine, Python, Pydantic, Typer and
PyInstaller versions are pinned in `scripts/cli-checksums.json`. `0.2.2` pins engine `0.5.2`, Python `3.12`, Pydantic `2.14.3`, Typer `0.29.0` and PyInstaller
`6.22.3`.

PyInstaller onedir output is not byte-reproducible. The checksum policy is therefore split:

- **Local release build — strict.** `scripts/verify-sidecar.mjs` must match the committed
  SHA-256 and size; `--write` updates the pin after review. A `null` pin means “not
  reviewed yet”, not “verified”.
- **CI rebuild — rebuild-aware.** The build job runs the verifier with `--no-hash` and
  records the actual SHA-256 in `release/sidecar-checksums-<target>.json`.
- **Release gate — report-based.** The release job requires a valid report for every
  shipped target: matching target name, `hashPolicy: "rebuild"`, `ok: true`, a 64-hex
  hash, a positive size and the exact engine version.

For `0.5.2`, Windows x64 has a reviewed local pin; the Linux and macOS targets remain `null` until
the `0.5.2` sidecar is rebuilt and reviewed on a matching host. The `0.5.1` Windows pin did not
carry over because the executable changes with the engine.
The checksum reports are CI evidence, not release assets. `SHA256SUMS.txt` covers the installers,
updater packages, signatures and `latest.json`; the sidecar executable is inside those packages and
is not listed separately. Users who install manually verify the downloaded asset against
`SHA256SUMS.txt`.

```bash
node scripts/verify-sidecar.mjs \
  --root src-tauri/engine \
  --target x86_64-pc-windows-msvc \
  --engine-version 0.5.2
```

## `latest.json`, signing and publishing

Updater signatures use a free Ed25519/minisign key, separate from OS code signing. The public key is embedded in the app; the private key is a repository secret
passed only to the build step. `requireSignedVersion` is enabled, so the announced version is bound to the signed package. The updater accepts only a version
greater than the running one, so it cannot downgrade.

`scripts/stage-release-assets.mjs` flattens and normalizes bundle names and writes per-platform `updater-<platform>.json` metadata.
`scripts/merge-latest-json.mjs` merges them into `latest.json`:

- required generic keys: `windows-x86_64`, `linux-x86_64`, `darwin-aarch64`,
  `darwin-x86_64`;
- bundle aliases the updater probes: `windows-x86_64-nsis`, `linux-x86_64-appimage`,
  `darwin-aarch64-app`, `darwin-x86_64-app`;
- optional `linux-x86_64-deb` and `linux-x86_64-rpm` only when Tauri produced those
  signatures;
- every URL points under `releases/download/<tag>/`;
- every signature is checked against the `.sig` file on disk;
- every referenced asset must exist;
- notes come from `docs/releases/<version>.md` when present.

The release is created as a **draft** first. Assets are uploaded while it is a draft, with `latest.json` last, then the job publishes with
`gh release edit --draft=false` and verifies the remote asset names. `releases/latest/download/latest.json` only resolves to a published release, so users never see a partially
uploaded manifest. A rerun reuses an existing draft, clears its assets and refuses to overwrite a published release.

## Version pinning

The desktop version must agree in `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, the Git tag and the release title. The engine pin lives
in `scripts/cli-checksums.json`; the workflow passes `engine_version` explicitly and the release gate requires it to match the manifest.

`MIN_ENGINE_VERSION` in `src-tauri/src/commands.rs` is `0.5.2` in the current source. The shell accepts an engine at least that new and marks an older one
offline with a notice. A newer engine passes the gate but is not the release-tested pin. A development build may use `LV24_SEO_BIN` with another version; the UI
labels it external and still checks the minimum. A `PATH` engine is used only when `LV24_SEO_ALLOW_PATH_ENGINE=1`.

## One-time 0.1.0 upgrade

`0.1.0` has no updater, endpoint or public key. It cannot discover or install `0.2.2`. Download and install `0.2.2` manually once (NSIS installer or portable
ZIP on Windows). After that, the `0.2.2` installation can auto-update to later releases when it uses an auto-update-capable bundle.

## Earlier releases

- **Desktop 0.2.1** fixed the Yandex Metrika token surface and made the shared CLI/desktop keychain
  explicit. It was the first release delivered through the in-app updater from `0.2.0`.
- **Desktop 0.2.0** was the first multi-platform release: Windows NSIS and portable ZIP, Linux
  AppImage/deb/rpm, macOS DMG and signed updater packages.
- **Engine 0.5.1** fixed write-gate retries, bounded crawl text, MCP annotations and reachable
  limits. It treated an exact-cap final GSC page as complete; `0.5.2` reverses that decision and
  treats a full final page as potentially truncated.

## Rollback

There is no automatic downgrade. A rollback is a manual install of an older release.

| Failure | Response |
|---|---|
| Bad installer but valid app | Publish a fixed patch; do not overwrite assets under the same tag |
| Bad `latest.json` | Publish a fixed patch; the draft gate prevents a partial manifest from being visible |
| Compromised updater key | Rotate the key, ship a manual release with the new public key; auto-update cannot bridge the rotation |
| Engine regression | Pin the previous engine version, rebuild and publish a patch |
| Need an older desktop build | Install it manually; the updater refuses downgrades |

Do not move or reuse a published tag. Keep the previous release assets available for rollback. If the endpoint must be disabled, ship a manual release and
document it.

## Verifying a download

`SHA256SUMS.txt` covers every published asset. Verify the files you intend to install:

```bash
sha256sum -c SHA256SUMS.txt --ignore-missing
```

On macOS, `shasum -a 256 -c SHA256SUMS.txt` is available in the base system. On Windows, compare `Get-FileHash <file> -Algorithm SHA256` with the matching line.
Do not run a file whose hash does not match.

By default, OS packages are unsigned (Windows, Linux) or ad-hoc signed (macOS). The updater signature authenticates updates, not the first manual download.
SmartScreen and Gatekeeper warnings are expected; verify the checksum and use the documented **More info → Run anyway** or **Open Anyway** flow. Do not disable
those protections system-wide.

See [Security and privacy](/security/) for updater trust and [Architecture](/architecture/) for the sidecar layout.

Source: `_source/engine-releases-0.5.2.md`, `_source/desktop-releases-0.2.2.md`, `_source/desktop-releases-0.2.1.md`, `_source/desktop-releases-0.2.0.md`, `_source/desktop-release.md`, `_source/desktop-security.md`.
