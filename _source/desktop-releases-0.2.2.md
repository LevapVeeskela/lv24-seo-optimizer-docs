# LV24 SEO Optimizer Desktop 0.2.2

**Status: hardening patch release for the 0.2.x preview.**

| | |
|---|---|
| Desktop version | `0.2.2` |
| Bundled engine | `lv24-seo 0.5.2` |
| Platforms | Windows x64, Linux x64, macOS arm64 and x64 |
| Auto-update | Windows NSIS, macOS `.app`, Linux AppImage |
| Manual-only | deb, rpm, MSI, portable ZIP |
| OS signing | Windows unsigned, macOS ad-hoc, Linux unsigned |
| Updater signing | minisign/Ed25519, public key embedded in the app |

`0.2.2` is a hardening release. The updater can no longer be blocked by its own
engine sidecar, the Rust bridge writes configuration and settings durably and
privately, stale UI state is cleared instead of shown, and the bundled engine is
`lv24-seo 0.5.2`.

## Fixed

### Updater: a locked sidecar no longer breaks the NSIS install

The `0.2.1` installer could fail on Windows while `lv24-seo.exe` was still
running: the engine sidecar lives inside the installed resource directory, and a
live process keeps that file locked, so NSIS could not replace it.

Before the installer starts, the shell now calls `prepare_update`, which stops
**only the engine PIDs this app instance registered** when it spawned them.
Nothing is matched by image name, so another installed copy, a portable build, a
terminal `lv24-seo` run or an unrelated process is untouched. A short wait
(`2 s`) confirms the processes are gone.

If cleanup fails, the install is **blocked** with `UPDATE_ENGINE_BUSY` instead of
starting an installer that will fail halfway. The error is retryable: close the
run that holds the sidecar and press the button again. A failure to stop the
sidecar is never reported as success.

### Secrets: Metrika is a first-class provider, env tokens are read-only

- Yandex Metrika keeps its own auth provider (`metrika`, `yandex_metrika_token`)
  in the provider list, the Settings badge, the secret modal and the en/ru/zh
  labels. It never borrows the Webmaster token.
- The desktop and the CLI share **one OS keychain entry per provider** (service
  `lv24-seo`). A token entered with `lv24-seo auth set --provider <p> --stdin`
  in a terminal appears in the desktop's `auth status` without re-entry, and a
  token entered in the desktop is visible to the CLI.
- A token supplied through `LV24_SEO_*` is shown as **read-only** in the UI: the
  desktop cannot remove an environment variable, and it says so instead of
  offering a delete button that does nothing.
- `auth logout` reporting `deleted: false` is surfaced honestly — "nothing was
  deleted" is a result, not a success message.

### Frontend: no stale state, honest errors, parity i18n

- Workspace, report, doctor and secret state is cleared when the workspace
  changes or the engine goes offline. A previous project's report or token
  badge is never displayed against a new workspace.
- Report and export failures carry an explanation of what failed and what to do,
  instead of a bare error string.
- Actions that cannot work are disabled rather than failing on click: no
  workspace selected, engine offline, engine below the minimum version.
- Focus returns to the triggering control when a modal or panel closes.
- The en/ru/zh message catalogues are at parity; a missing key is a test
  failure, not a silent English fallback.

### Rust: durable, private, bounded file handling

- Configuration and settings writes are atomic **and fsynced**: the temp file is
  fsynced, renamed, and the parent directory is fsynced, so a power loss cannot
  leave a truncated `seo.toml` or `settings.json`.
- Temp drafts are created with mode `0600` (owner-only) and backups are written
  `0600` and fsynced. A backup never has looser permissions than the file it
  copies.
- Configuration reads are bounded (`8 MiB`); an oversized or non-regular file is
  rejected instead of being read into memory.
- Settings load per field: one malformed value no longer discards the rest of
  the settings file.
- A stale saved config path is tolerated: a workspace that was moved or deleted
  no longer blocks startup, it is reported as missing and can be re-selected.
- Windows reserved device names (`CON`, `PRN`, `AUX`, `NUL`, `COM1`–`COM9`,
  `LPT1`–`LPT9`) and trailing dots/spaces are rejected in **every** path
  component, not just the last one.
- The AppImage fallback path resolution is fixed: a build started from the
  mounted tree now finds the sidecar under
  `$APPDIR/usr/lib/<product>/engine/lv24-seo/` instead of silently dropping to
  `PATH`.
- Configuration validation `stderr` is redacted (`token = "…"`, `"apiKey": "…"`,
  `--token`/`--password`, `Bearer …`) before it reaches the UI or the logs, because the engine can
  quote a config line or an argv in a traceback.

### Engine `lv24-seo 0.5.2`

The bundled engine is a bugfix release with no schema migration and no new CLI
command or MCP tool:

- A relative `[storage].data_dir` written in `seo.toml` is anchored to that
  file's parent, so a run from another working directory cannot create a second
  database. The built-in default (no `[storage]` block) and `LV24_SEO_DATA_DIR`
  stay process-scoped on purpose; `doctor --json` reports `meta.data_dir` and
  `meta.data_dir_source`.
- Scheduler artifacts embed an absolute `--config` path, so a job runs the same
  config from any scheduler working directory.
- CLI write actions use the workspace SQLite idempotency ledger: a replayed
  `confirm_token` returns `status: skipped` with `reason: duplicate` instead of
  calling the provider twice. Without an initialised workspace the envelope warns
  that replay protection is off for the token's five-minute lifetime.
- Sitemap fetch failures report the exception type only, so a URL carrying a
  query token cannot leak into warnings, `limitations[]` or MCP payloads.
- A GSC final page that exactly fills the 50,000-row cap is reported as
  `truncated: true`; a full page is not proof that no further row exists.
- Redacting logging is opt-in through `LV24_SEO_LOG_LEVEL` and installed only at
  the CLI and `mcp serve` entry points, so an embedding host keeps its own
  logging configuration.

`MIN_ENGINE_VERSION` is `0.5.2`. The shell marks an older engine as incompatible
and shows a notice; commands are not silently migrated to it. This is an
advisory gate in the backend — `shell_status` reports compatibility and the UI
surfaces it — not a hard per-call backend block.

## Assets

The asset names follow the `0.2.1` layout with `0.2.2` in the version segment:

| Asset | Platform | Use |
|---|---|---|
| `LV24.SEO.Optimizer_0.2.2_x64-setup.exe` + `.exe.sig` | Windows x64 | NSIS installer; signed updater package |
| `LV24-SEO-Optimizer_0.2.2_x64-portable.zip` | Windows x64 | Portable build; manual-only |
| `LV24.SEO.Optimizer_0.2.2_aarch64.dmg` | macOS Apple silicon | First install |
| `LV24.SEO.Optimizer_0.2.2_x64.dmg` | macOS Intel | First install |
| `LV24.SEO.Optimizer_0.2.2_aarch64.app.tar.gz` + `.sig` | macOS Apple silicon | Signed updater package |
| `LV24.SEO.Optimizer_0.2.2_x64.app.tar.gz` + `.sig` | macOS Intel | Signed updater package |
| `LV24.SEO.Optimizer_0.2.2_amd64.AppImage` + `.AppImage.sig` | Linux x64 | AppImage; signed updater package |
| `LV24.SEO.Optimizer_0.2.2_amd64.deb` | Linux x64 | Package-manager install; manual-only |
| `LV24.SEO.Optimizer-0.2.2-1.x86_64.rpm` | Linux x64 | Package-manager install; manual-only |
| `latest.json`, `SHA256SUMS.txt` | all | Updater manifest and checksums |

`SHA256SUMS.txt` covers every published asset, including updater signatures and
`latest.json`. `latest.json` keeps the generic and bundle-specific keys for
Windows, Linux and both macOS architectures.

## Upgrade

- **From `0.2.1`:** the in-app updater offers `0.2.2` for Windows NSIS, macOS
  `.app` and Linux AppImage. This is the next in-app update after the verified
  `0.2.0 → 0.2.1` run. The updater matrix is unchanged.
- **From `0.2.0`:** update to `0.2.2` directly; the updater accepts any version
  greater than the running one.
- **From `0.1.0`:** install `0.2.2` manually once. `0.1.0` has no updater,
  endpoint or public key.
- **Fresh install:** use the NSIS installer, portable ZIP, AppImage, deb, rpm or
  DMG for your platform.

The updater still never installs on its own, refuses downgrades, and disables
the install button while a configuration draft is unsaved. deb, rpm, MSI and the
portable ZIP remain manual-only.

## Verification

- `npm run typecheck`, `npm test` (213 tests), `npm run build`.
- `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`,
  `cargo test --all-targets` (96 tests).
- Relative-link check across `README.md`, `SECURITY.md` and `docs/`.
- Desktop CI: web, contracts, Rust on Windows/Linux/macOS.
- Release workflow: four platform builds, expected-asset gate, merged
  `latest.json`, `SHA256SUMS.txt`, draft → upload → undraft.
- Manual keychain behaviour is unchanged since the `0.2.1` check, where a secret
  stored by the bundled sidecar was visible to a separate `lv24-seo[secrets]` CLI
  process and vice versa.
- Manual Windows check: an installed `0.2.1` build detected `0.2.2`, downloaded
  and verified the signed package, installed it in passive mode, relaunched, and
  reported `0.2.2` with engine `0.5.2` ready.

## Known limitations

- OS packages are unsigned or ad-hoc signed; SmartScreen, Gatekeeper and
  antivirus warnings remain possible. Verify `SHA256SUMS.txt`.
- The updater can only stop sidecars it started itself. An engine launched from a
  terminal or another app copy is not killed; if it holds the installed sidecar
  open, the install is blocked with `UPDATE_ENGINE_BUSY` and must be retried
  after that run exits.
- The `0.2.1 → 0.2.2` update runs the old `0.2.1` updater, which does not have
  the new cleanup step. If a sidecar is active during that first update, retry
  after it exits or install `0.2.2` manually. `0.2.2 → later` uses the tracked
  PID cleanup.
- The desktop has no dedicated crawl screen in `0.2.x`; crawl settings and
  findings are shown through configuration and reports.
- A signature failure must be resolved by installing a newer release manually;
  the blocked version is not offered again.
- `latest.json` is fetched from GitHub Releases. A blocked or offline GitHub
  endpoint leaves the app on its current version.
