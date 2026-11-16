# LV24 SEO Optimizer Desktop 0.5.0

**Status: released (2026-11-16).** `0.5.0` is published on GitHub Releases for Windows x64, Linux x64
and macOS arm64/x64. The latest published line is `0.5.0`; `0.4.0` remains available for rollback and
as the previous in-app update source. See [`0.4.0.md`](0.4.0.md) for that release's notes.

| | |
|---|---|
| Desktop version | `0.5.0` (released 2026-11-16) |
| Bundled engine | `lv24-seo 0.7.0` |
| Minimum engine | `lv24-seo 0.7.0` (`MIN_ENGINE_VERSION`) |
| Contracts | generated from `lv24-seo 0.7.0` |
| Platforms | Windows x64, Linux x64, macOS arm64 and x64 |
| Auto-update | Windows NSIS, macOS `.app`, Linux AppImage (unchanged) |
| Manual-only | deb, rpm, MSI, portable ZIP (unchanged) |
| OS signing | Windows unsigned, macOS ad-hoc, Linux unsigned (unchanged) |

## New

### Backup: restore from an archive

- **Two-phase restore.** The backup panel adds a restore section. The archive is chosen through the
  native dialog (`pick_backup_archive`); the first call only builds a plan and writes nothing outside
  a temporary directory. The plan shows the archive and manifest hashes, the target config and data
  directory, the current and archived database hashes, the config action (`create`, `replace` or
  `write_alongside`), the plan hash and a confirmation token with its 300-second lifetime.
- **Apply only after confirmation.** The UI shows a confirmation dialog and then calls the engine
  with `--allow-write` and the plan token. `--allow-write` alone only plans; a token without it is
  `WRITE_DISABLED`; a changed archive, a changed workspace, an expired token or a replay is
  `CONFIRM_REQUIRED`. A plan without a token leaves **Restore now** disabled.
- **Safety copies.** Before replacement the current database is copied to `<db>.pre-restore-<utc>`
  (and the config to `seo.toml.pre-restore-<utc>` when it is replaced). Every member hash is
  re-verified, the restored database passes `PRAGMA quick_check`, and files are replaced atomically.
  A config that does not validate is written alongside as `seo.toml.restored-<utc>` so the existing
  config stays usable.
- **Replace, not merge.** A restore replaces files; it never merges rows or settings. Provider tokens
  are not in the archive, so re-authenticate afterwards. A database held open by another CLI or
  desktop process cannot be replaced on Windows.

### Schedule: install on this host

- The Integrations schedule card now has two modes: **Preview artifact** (render only, unchanged) and
  **Install on this host**. An install writes a cron entry, a systemd user timer or a Windows Task
  Scheduler task for a weekly or daily report, with an optional five-field cron override.
- Installing requires the confirmation dialog, names the config and the job kind, and touches only
  the local host — no remote machine, no provider. The result lists the installed files and paths;
  the print-only artifact and its copy actions remain available.

### Portfolio: one folder, many sites

- **Choose a portfolio folder** through the native directory dialog (`pick_directory`). The engine
  scans up to three levels below it for project folders that contain `seo.toml`, skipping hidden,
  `node_modules`, `__pycache__`, `venv` and symlinked directories, and inspects at most 50 sites per
  scan. A capped scan reports the real total and a limitation.
- **Per-site rows** carry the config path, name, property, base URL, data directory, database
  presence, crawl runs and last crawl, report snapshots and last report period, open/total/critical
  issues, last issue time, last activity and a per-site error. A broken config or unreadable database
  becomes that site's error; the rest of the portfolio still scans.
- **Compare and open.** Summary counts for sites, open issues and sites with errors; sort by open
  issues, name, last activity or errors first; filter by name, property or path. Opening a row
  switches the active workspace through the normal shell flow.
- **Read-only.** The scan calls no provider, reads no token and writes nothing.

### Reports: Core Web Vitals by template

- The weekly report renders the engine's `cwv` section: field p75 per normalized URL template and
  device (phone, desktop, tablet), with the previous p75, delta and regression flag. At most five
  templates are shown, regressed first.
- A regression is a p75 increase of at least 5% (above 0.01 for CLS). A template p75 is the worst
  page p75 in that group, not a site-wide average.
- The card shows truncation, the oldest evidence date, skipped rows and the engine's CWV limitations.
  Origin aggregates, lab/Lighthouse scores and rows without a URL or known device are never merged
  into a template; a report built without stored field rows keeps the empty state.

### Shell and engine

- New allow-listed CLI commands: `backup_restore` (two-phase), `portfolio_list` and
  `schedule_install`, all argument-validated in the shell before the engine sees them.
- New `pick_backup_archive` command; `pick_directory` also approves the portfolio root and the backup
  output folder. `backup_restore` reads only an archive approved this way.
- The bundled engine moves to `lv24-seo 0.7.0`: `backup restore`, `portfolio list`, schema v4 with
  `indexing_events`, the CWV report section and stored indexing evidence in the change digest. The
  CLI now has 21 top-level commands; the MCP surface stays at 12 tools, and portfolio/restore are
  CLI-only.
- **`MIN_ENGINE_VERSION` is now `0.7.0`.** An installed `0.6.x` engine is reported as incompatible;
  restore, portfolio and CWV need 0.7.0.
- The committed contracts were regenerated from `lv24-seo 0.7.0`; the only fixture change is the
  version string.

## Verification

- **Published:** 18 assets on the `v0.5.0` GitHub release for Windows x64, Linux x64 and macOS
  arm64/x64, including the Windows portable `.zip.sha256` sidecar; the release gate recomputed it
  against the archive and `SHA256SUMS.txt` covers every published asset.
- **CI:** green for Linux x64, Windows x64 and macOS arm64 + x64 on the release commit.
- **In-app update:** `0.4.0 → 0.5.0` was verified on Windows through the Rust updater — download,
  signature verification, install and relaunch. The relaunched UI reports Desktop `0.5.0`,
  Engine `0.7.0` and engine ready, and the Portfolio page loads.
- **Sidecars:** the Linux and macOS sidecars were built by the release workflow and their
  rebuild-aware checksum reports passed the release gate. The Windows x64 sidecar was built from PyPI
  `lv24-seo 0.7.0` (Python 3.12, PyInstaller 6.22.3), passed the `version --json` smoke test and is
  pinned in `scripts/cli-checksums.json` (`sha256 420e578e…`, 14,326,863 bytes); `verify-sidecar
  --require-pinned` passes. The Linux and macOS reviewed pins remain `null`.
- **Engine commands:** the built sidecar answers `version --json` with `0.7.0` and its
  `backup restore`, `portfolio list` and `schedule install` help output loads.
- **Contracts:** regenerated with `node scripts/check-contracts.mjs --update`; the full
  `npm run contract:check` reports `contracts are up to date` and `--static` passes.
- **Gates:** `npm run typecheck`, `npm test`, `npm run build`, `npm run test:release`,
  `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, `cargo test --all-targets`,
  `cargo build --release --locked` and `node scripts/check-contracts.mjs --static` passed on the
  release commit.

## Upgrade and known limitations

- Upgrading is unchanged: Windows NSIS, macOS `.app` and Linux AppImage update in place; deb, rpm,
  MSI and the portable ZIP remain manual. `0.1.0` still needs one manual install.
- **Restore is destructive and manual.** It replaces the database and config with the archive
  contents; it does not merge rows or settings. The pre-restore copies are the only rollback, and a
  database held open by another process cannot be replaced on Windows. Tokens are excluded, so
  re-authenticate after restoring.
- **Schedule install mutates the host.** It writes a cron entry, systemd user timer or Windows task
  only after confirmation, and only on this computer. Removing or repairing the job is manual; the
  desktop does not manage or uninstall it.
- **CWV needs stored field rows.** The card is empty without CrUX/PSI field rows that carry a URL and
  a device. Lab/Lighthouse rows are ignored, at most five templates are shown, and no regression is
  calculated without a previous window.
- **Portfolio is local and bounded.** It reports local history only, inspects at most 50 sites per
  scan and never calls a provider. Opening a row goes through the normal shell activation, so a
  config the app has not picked or created earlier still needs the native dialog.
- **No cancel and no background runs in `0.5.0`.** A restore, schedule install, portfolio scan or
  report build runs to completion; the UI cannot stop it, and leaving the screen does not move the
  run to a background queue.
- Linux and macOS sidecar pins remain `null` in `scripts/cli-checksums.json`; the release workflow
  builds those sidecars and the release gate requires a rebuild-aware checksum report per target.
- `MIN_ENGINE_VERSION` is `0.7.0`, so a `0.6.x` engine is rejected; the desktop does not silently
  downgrade commands to an older engine.
- OS packages remain unsigned (Windows, Linux) or ad-hoc signed (macOS); SmartScreen, Gatekeeper and
  antivirus warnings are possible. Verify `SHA256SUMS.txt`.
- The Windows portable ZIP and deb/rpm/MSI cannot update themselves; the UI links to the release page
  for those bundle types.
