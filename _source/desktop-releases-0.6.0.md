# LV24 SEO Optimizer Desktop 0.6.0

**Status: released (2026-11-16).** `0.6.0` is published on GitHub Releases for Windows x64, Linux x64
and macOS arm64/x64. The latest published line is `0.6.0`; `0.5.0` remains available for rollback and
as the previous in-app update source. See [`0.5.0.md`](0.5.0.md) for that release's notes.

| | |
|---|---|
| Desktop version | `0.6.0` (released 2026-11-16) |
| Bundled engine | `lv24-seo 0.8.0` |
| Minimum engine | `lv24-seo 0.8.0` (`MIN_ENGINE_VERSION`) |
| Contracts | generated from `lv24-seo 0.8.0` |
| Platforms | Windows x64, Linux x64, macOS arm64 and x64 |
| Auto-update | Windows NSIS, macOS `.app`, Linux AppImage (unchanged) |
| Manual-only | deb, rpm, MSI, portable ZIP (unchanged) |
| OS signing | Windows unsigned, macOS ad-hoc, Linux unsigned (unchanged) |

## New

### Cancellable background runs

- **Long jobs can be stopped.** `crawl`, `report_weekly`, `logs_analyze`, `backup_create`,
  `backup_restore` and `schedule_install` accept a stable run id supplied by the webview. The Rust
  runner registers `run id → exact child PID` before the spawn; a run id for any other command is
  rejected with `RUN_NOT_CANCELLABLE`, so short reads keep their synchronous path.
- **A window-wide banner.** The run lives in one root `RunStore`, not on a page. The app layout shows
  a persistent banner with the run kind, elapsed time, status and a **Cancel** button; leaving the
  route does not clear the run, and returning reads the same store. Every active run is listed, and
  the newest cancelled run stays until dismissed.
- **Cancel targets one process.** `run_cancel(runId)` signals only the exact child PID registered for
  that run (and its process group on Unix), after checking that the PID is still an engine image or
  one of the exact children this process tracks. It never matches a process by name. An unknown or
  already finished run returns `false`, and the UI does not claim a cancellation then.
- **A distinct cancelled state.** A cancelled run returns `RUN_CANCELLED`, not a timeout and not a
  generic parse error. The UI shows it as cancelled, separate from succeeded and failed runs.
- **Cancellation is not rollback.** Stopping the process leaves files it already wrote on disk. A
  cancelled crawl or report may leave a partial local artefact; a cancelled restore keeps the
  engine's pre-restore copy but may have replaced one database or config file, so review a **fresh
  restore plan** before retrying. There is no job queue: runs are independent child processes, and
  only the update download has progress events (`update://progress`).

### Schedule install sends the write opt-in

- Engine `0.8.0` made `schedule install` **plan-only by default**; it writes a cron entry, systemd
  user timer or Windows task only with `--allow-write`. The desktop now asks for confirmation and
  appends `--allow-write` only after the user confirms the plan it showed.
- The shell still refuses an install without `allowWrite=true` with `CONFIRM_REQUIRED` before the
  engine is spawned, so the webview cannot bypass the engine's new default. A plan-only preview and
  the print-only artifact remain available.
- An install is cancellable like the other long jobs; cancelling it can leave a partially written
  scheduler artefact, which the engine's `schedule status` reports as `partial` when run from the
  CLI.

### Engine 0.8.0

- **Google Search Console service accounts.** `providers.gsc.service_account_file` (absolute path) and
  `LV24_SEO_GSC_SERVICE_ACCOUNT_FILE` are read; a service-account JSON token stored as the `gsc_token`
  secret is also accepted. `properties` reports `token_source` and `doctor` adds a non-fatal
  `gsc_auth` check. Neither prints the key. Plain OAuth tokens keep working.
- **`cwv collect` writer.** CrUX is queried per URL and device (`phone`, `desktop`, `tablet`) and
  writes one field row per p75 with the fetch date in `report.timezone`; PSI lab rows are returned
  under `data.lab` and never persisted. `--limit` caps URLs at 50, low-traffic URLs write no row, and
  `report weekly` reads stored CWV rows through today so a collection appears in the same run.
- **`backup restore --to DIR`.** A non-destructive extraction into a new directory: no
  `--allow-write`, no confirm token and no in-place replacement. The in-place two-phase restore the
  desktop uses is unchanged.
- **`schedule status` and `schedule uninstall`.** Read-only status (`installed`, `outdated`, `partial`,
  `missing`, `unknown`) and a plan-only uninstall that removes exactly the generated artefacts with
  `--allow-write`. These are engine commands; the desktop does not add screens for them yet.
- **Richer Yandex Webmaster indicators.** `avg_click_position`, `query_id`, `extra_indicators`,
  merged indexing history series (`http_2xx` … `other`) and `site_problems` in the summary. A missing
  indicator stays absent instead of becoming zero.
- **Fixes.** Yandex Metrika `stat/v1/data` now sends the documented 1-based `offset` (the previous `0`
  was rejected with HTTP 400 on every call). CLI `--json` output is ASCII-escaped and human output
  degrades unencodable glyphs instead of aborting, so a report redirected on a legacy Windows code
  page no longer fails with `UnicodeEncodeError`.
- The engine now has **22 top-level commands** (15 groups + 7 commands, adding `cwv`). The MCP surface
  is unchanged at 12 tools, and the SQLite schema stays at version 4.

### Shell and contracts

- **`MIN_ENGINE_VERSION` is now `0.8.0`.** An installed `0.7.x` engine is reported as incompatible.
  The desktop needs `0.8.0` for the mandatory `schedule install --allow-write` opt-in; restore,
  portfolio and CWV already required `0.7.0`.
- The committed contracts were regenerated from `lv24-seo 0.8.0`. Additive changes: `doctor` gains a
  `gsc_auth` check, `properties` gains `token_source`, and `config.schema.json` gains
  `providers.gsc.service_account_file`. The fixture envelopes only otherwise change the version
  string.
- The contract generator now pins `PYTHON_KEYRING_BACKEND` to the null backend, so a developer machine
  with real provider tokens cannot leak token presence into the committed fixtures.

## Verification

Verified on the published `v0.6.0` release.

| Check | Result |
|---|---|
| Published assets | 18 assets for Windows x64, Linux x64 and macOS arm64/x64, including the Windows portable `.zip.sha256` sidecar; the release gate recomputed it against the archive and `SHA256SUMS.txt` covers every published asset |
| Updater manifest | `latest.json` reports `0.6.0` |
| CI | run [`43966588931`](https://github.com/LevapVeeskela/lv24-seo-optimizer-desktop/actions/runs/43966588931) green |
| Release workflow | run [`43969832204`](https://github.com/LevapVeeskela/lv24-seo-optimizer-desktop/actions/runs/43969832204) green |
| In-app update (Windows) | `0.5.0 → 0.6.0` through the Rust updater: download, signature verification, install and relaunch. The relaunched UI reports Desktop `0.6.0`, Engine `0.8.0` and engine ready |
| Workspace smoke test | the real `lv24.by` workspace loaded; coverage shows 6 configured, 3 returned, 0 errors and 1 missing (Bing token missing; Yandex Webmaster and CrUX returned no data for the window) |
| Bundled engine | the sidecar answers `version --json` with `0.8.0`; `MIN_ENGINE_VERSION` is `0.8.0` |

- **Sidecar:** the Windows x64 sidecar was built from PyPI `lv24-seo 0.8.0` (Python 3.12,
  PyInstaller 6.22.3), passed the `version --json` smoke test and is pinned in
  `scripts/cli-checksums.json` (`sha256 5fb932c8…`, 14,365,502 bytes); `verify-sidecar
  --require-pinned` passes. The Linux and macOS reviewed pins remain `null`; the release workflow
  built those sidecars and the release gate required a rebuild-aware checksum report per target.
- **Engine commands:** `cwv collect`, `backup restore`, `schedule install`, `schedule status` and
  `schedule uninstall` help output loads.
- **Contracts:** regenerated with `node scripts/check-contracts.mjs --update`; the full
  `npm run contract:check` reports `contracts are up to date` and `--static` passes.
- **Gates:** `npm run typecheck`, `npm test`, `npm run build`, `npm run test:release`,
  `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, `cargo test --all-targets`,
  `cargo build --release --locked` and `node scripts/check-contracts.mjs --static` passed on the
  release commit.
- **Platform coverage:** the Windows NSIS in-app update was exercised for this line. The macOS
  `.app` and Linux AppImage update paths were not re-run for `0.6.0`; both bundles were built by the
  release workflow and passed the release gate.

## Upgrade and known limitations

- Upgrading is unchanged: Windows NSIS, macOS `.app` and Linux AppImage update in place; deb, rpm,
  MSI and the portable ZIP remain manual. `0.1.0` still needs one manual install.
- **Cancel is not rollback and there is no job queue.** A cancelled run may leave a partial report,
  crawl, backup or scheduler artefact. A cancelled in-place restore keeps the engine's pre-restore
  copy but may have replaced one file; build a fresh plan before retrying. Closing the window does
  not move a run into a queue.
- **Schedule install mutates the host.** It writes a cron entry, systemd user timer or Windows task
  only after confirmation, and only on this computer. The desktop does not manage, repair or
  uninstall the job; use the engine's `schedule status`/`schedule uninstall` from the CLI.
- **Restore is destructive and manual.** In-place restore replaces the database and config with the
  archive contents; it does not merge rows or settings. `backup restore --to` is a CLI-only
  extraction. Provider tokens are not in the archive, so re-authenticate afterwards.
- **GSC service accounts are configured outside the form.** The desktop does not add a
  `service_account_file` field; set it in `seo.toml` or the environment. The form still edits the
  property and auth mode, and the Configuration screen shows the effective redacted config.
- **CWV needs stored field rows.** `cwv collect` is a CLI command; the desktop renders the stored
  rows by template and device. Lab/Lighthouse rows are ignored, at most five templates are shown and
  no regression is calculated without a previous window.
- **Portfolio is local and bounded.** It reports local history only, inspects at most 50 sites per
  scan and never calls a provider.
- Linux and macOS sidecar pins remain `null` in `scripts/cli-checksums.json`; the release workflow
  builds those sidecars and the release gate requires a rebuild-aware checksum report per target.
- `MIN_ENGINE_VERSION` is `0.8.0`, so a `0.7.x` engine is rejected; the desktop does not silently
  downgrade commands to an older engine.
- OS packages remain unsigned (Windows, Linux) or ad-hoc signed (macOS); SmartScreen, Gatekeeper and
  antivirus warnings are possible. Verify `SHA256SUMS.txt`.
- The Windows portable ZIP and deb/rpm/MSI cannot update themselves; the UI links to the release page
  for those bundle types.
