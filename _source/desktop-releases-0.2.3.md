# LV24 SEO Optimizer Desktop 0.2.3

**Status: draft.** This page describes work on the `0.2.3` branch. `0.2.3` is **not released**, no
build or date is promised here, and the platform list is the intended set, not a published one.
The latest published line remains `0.2.2`; see [`0.2.2.md`](0.2.2.md).

| | |
|---|---|
| Desktop version | `0.2.3` (draft) |
| Bundled engine | `lv24-seo 0.5.2` |
| Intended platforms | Windows x64, Linux x64, macOS arm64 and x64 |
| Auto-update | Windows NSIS, macOS `.app`, Linux AppImage (unchanged) |
| Manual-only | deb, rpm, MSI, portable ZIP (unchanged) |
| OS signing | Windows unsigned, macOS ad-hoc, Linux unsigned (unchanged) |

## Fixed

### Engine output: credentials are redacted before the webview sees them

The engine quotes configuration lines and argv in tracebacks. `stderr` and every bounded output
preview now pass through `redact_secrets` before they reach the webview, a log or a diagnostics
bundle, and redaction happens **before** truncation — a 300-character preview could otherwise split
`token = "…"` and leak the fragment. A TOML syntax error is redacted the same way, because the parser
echoes the offending line.

### Paths: no remote share, no device namespace, no unapproved config

- `storage.data_dir` values that name a network share or a device namespace (`\\server\share`,
  `\\?\C:\…`, `\\.\device`, `\??\…`, `//host/share`) are rejected with `INVALID_PATH`
  (`reason: network_or_device_path`) before the value is resolved. Joining such a value to the config
  directory would hide the prefix and make the shell authenticate to the share.
- A new `configPath` is accepted only from the native `pick_config` dialog (or when it is already
  active). Any other value fails with `PATH_NOT_APPROVED`, so a workspace config cannot redirect a
  config write at an arbitrary file.
- `open_path` opens the canonical path that passed the root and extension checks instead of the raw
  request, so a symlink swapped in after validation cannot redirect the launch. On Windows the
  verbatim `\\?\` prefix is stripped before the opener receives it.
- Blocking filesystem work moved off the UI thread with a deadline (10 s for settings and path
  resolution, 30 s for exports); exceeding it returns `PATH_TIMEOUT` instead of freezing the window.

### Updates: install moved to Rust, real cancellation

- The webview no longer calls the updater plugin's `downloadAndInstall`. Its capability is narrowed
  from `updater:default` to `updater:allow-check`, so it can read the manifest but cannot start an
  install.
- `update_install(expectedVersion)` re-checks the endpoint and refuses a version that differs from
  the one the user saw (`UPDATE_VERSION_MISMATCH`), runs one install at a time
  (`UPDATE_IN_PROGRESS`), emits `update://progress` and stops tracked sidecars before the installer
  runs — also inside the command, not only in `prepare_update`.
- `update_cancel` stops a download before the installer starts and returns `UPDATE_CANCELLED`. Once
  installation has begun it returns `false` and the panel does not claim a cancellation that did not
  happen.
- On Unix the engine starts in its own process group, so a timeout kills a PyInstaller bootloader's
  interpreter child instead of leaving it to lock the engine executable.

### Windows file privacy and backup retention

- Temp drafts and backups get an explicit owner-only DACL (inheritance removed, full control to
  `OWNER RIGHTS`) before any bytes are written. A directory such as `C:\Users\Public` or a share no
  longer grants other users read access to a draft holding the same tokens as the config.
- Backup pruning only deletes names this app writes (`<config>.bak-YYYYMMDDTHHMMSSZ` or `…-<n>`). A
  hand-made `seo.toml.bak-before-experiment` is left alone.

### UI: workspace, save and accessibility state

- A moved or deleted workspace is reported as missing (`configExists: false`) with a **Choose
  config** action, instead of looking healthy and failing every stats/report call.
- The skip link moves focus to `#main-content` without the hash router treating the hash as a route
  and rendering NotFound.
- Saving keeps a revision counter: a response for an older revision never overwrites edits typed
  while the engine was writing.
- Validation is tri-state (`valid`, `invalid`, `skipped`); a call that returns no answer for the
  current draft no longer produces an "invalid" toast.
- A provider block has one explicit enable/disable toggle; editing a field no longer implies
  `present = true`, so a disabled block cannot come back on the next save.
- A route-level error boundary contains a render failure: reload action and message instead of a
  blank window.
- Recommendation titles, actions and verification text are localised in en/ru/zh, with the
  provider/source label translated per locale. Older queued tasks fall back to the stored English
  text.

## Changed

- Release scripts are covered by tests (`scripts/*.test.mjs`, `npm run test:release`): `latest.json`
  merging, the published-asset allowlist, `SHA256SUMS.txt`, the portable ZIP and its checksum, and
  schema validation.
- `latest.json` is validated against `contracts/latest.schema.json` before the draft release is
  created, so a manifest the updater plugin would reject fails the job.
- The published-asset allowlist, the checksum list and the upload list come from one tested module
  (`scripts/release-assets.mjs`). The Windows portable `-portable.zip.sha256` is now published and
  recomputed against the archive in the release gate.
- PR CI builds macOS x64 (`macos-15-intel`) as well as arm64, so an Intel regression fails on the PR
  instead of at release time.
- CI and the release workflow pin Rust `1.95.0` instead of `stable`, so the shipped binary is built
  by the reviewed compiler.
- A blocking `audit` job runs `npm audit --audit-level=high` and `cargo audit` (RustSec).

## Verification

To be completed when the release is built; nothing below is a claim that a build has shipped.

- Unit tests cover the new behaviour: Rust tests for path/UNC rejection, the owner-only draft ACL,
  backup-name matching, stderr and preview redaction, and the update gate; vitest tests for the
  update store, config store revision guard, tri-state validation, skip link, error boundary and
  recommendation copy.
- Release-script tests run with `npm run test:release`.
- Expected gates before any publication: `npm run typecheck`, `npm test`, `npm run build`,
  `npm run contract:check`, `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`,
  `cargo test --all-targets`, the `audit` job and the four-platform Rust matrix.
- The updater install path must be verified end-to-end on Windows NSIS (version re-check, cancel
  during download, tracked sidecar stopped before install), plus a macOS `.app` and Linux AppImage
  install, before the draft is undrafted.
- The portable `.zip.sha256` must match the published archive.

## Upgrade and known limitations

- Upgrading is unchanged: Windows NSIS, macOS `.app` and Linux AppImage update in place; deb, rpm,
  MSI and the portable ZIP remain manual. `0.1.0` still needs one manual install.
- OS packages remain unsigned or ad-hoc signed; SmartScreen, Gatekeeper and antivirus warnings are
  possible. Verify `SHA256SUMS.txt`.
- Config-path approval is per process. A path the user picked stays approved until the app exits; a
  later process still needs the dialog. This is consent, not a durable allow-list.
- Windows ACL hardening is best effort. If `icacls` fails, the save proceeds and the failure is
  logged, so the draft keeps the directory's inherited DACL.
- A blocking filesystem call that times out releases the UI but keeps its worker thread until the
  kernel call returns.
- Update cancellation is observed only before the installer starts. Once installation begins there
  is no rollback.
- The updater can stop only sidecars it started itself. An engine launched from a terminal, another
  installed copy or a portable build is untouched and can still hold a locked file.
