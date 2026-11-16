# LV24 SEO Optimizer Desktop 0.4.0

**Status: released (2026-11-16).** `0.4.0` is published on GitHub Releases for Windows x64, Linux x64
and macOS arm64/x64. The latest published line is `0.4.0`; `0.3.0` remains available for rollback and
as the previous in-app update source. See [`0.3.0.md`](0.3.0.md) for that release's notes.

| | |
|---|---|
| Desktop version | `0.4.0` (released 2026-11-16) |
| Bundled engine | `lv24-seo 0.6.0` |
| Minimum engine | `lv24-seo 0.6.0` (`MIN_ENGINE_VERSION`) |
| Contracts | generated from `lv24-seo 0.6.0` |
| Platforms | Windows x64, Linux x64, macOS arm64 and x64 |
| Auto-update | Windows NSIS, macOS `.app`, Linux AppImage (unchanged) |
| Manual-only | deb, rpm, MSI, portable ZIP (unchanged) |
| OS signing | Windows unsigned, macOS ad-hoc, Linux unsigned (unchanged) |

## New

### Logs: crawl log analysis

- **One local nginx log, read-only.** The page asks the shell for a file through the native dialog
  (`pick_log_file`); `logs_analyze` reads exactly one absolute regular nginx JSON access log
  (`log_format ... escape=json`, at most 100 MiB). A path that did not come from the dialog or from
  the app's own data/export directories is rejected with `PATH_NOT_APPROVED`. The file is never
  modified, uploaded or added to the SQLite history.
- **Bot filter.** All requests, Googlebot, YandexBot, Bingbot or other crawlers. The filter narrows
  the rollup and the waste headline; the by-bot split always covers every parsed request.
- **Parse summary.** Total, parsed and skipped lines, with file size and the last run time. Blank or
  non-JSON lines are counted as skipped, not silently dropped.
- **Crawl waste.** Redirects, 4xx/5xx, assets, `/api/` calls and tracking-parameter requests are
  waste; each request counts once. The card shows wasted hits, bytes, the share of parsed requests
  and the split by bot.
- **Bot rollup table.** One row per date, bot and status class with hits, bytes, p95 request time and
  share.
- **JSON and CSV export** into the app export folder: JSON carries the full analysis, CSV the daily
  table.
- **User-Agent only.** Bots are classified by User-Agent. A spoofed UA is not a verified crawler, so
  the page labels the result as triage, not proof of crawl coverage.

### Tasks: the finding lifecycle

- **Task list.** Newest-first tasks with property, kind, state, rule, URL, created/updated time and
  stored evidence. Filters for property, kind and state, plus a row limit (up to 500). Truncation,
  data age, malformed rows, engine warnings and limitations are shown instead of hidden.
- **State changes.** A task moves between `open`, `in_progress`, `verified` and `dismissed` through
  the allowed transitions; an invalid move is refused with the allowed set, and re-applying the
  current state is a no-op.
- **Add a task.** The form requires a kind, a URL and the rule that produced the finding, with an
  optional property and an optional evidence JSON object (16 KiB cap, credential-shaped keys
  rejected). `tasks_add` is idempotent: the UI reports whether the task was created, reopened,
  already existed or was submitted with an unknown outcome.

### Backup: a portable workspace archive

- **Backup panel.** `backup create` writes one `lv24-seo-backup-<timestamp>.zip` into the app export
  folder or a folder chosen in the native directory dialog; any other existing folder is
  `PATH_NOT_APPROVED`. The source workspace is opened read-only.
- **Archive contents.** `manifest.json` (format `lv24-seo-backup` v1, engine and schema versions,
  creation time, every member with size and SHA-256, totals, bounded summary, limitations),
  a redacted `seo.toml` with `storage.data_dir` reset to `./data`, and a consistent
  `data/seo.sqlite3` copy made through the SQLite backup API. Tokens, `secrets.json`, logs, raw
  responses and caches are never included.
- **Result details.** The panel shows the archive path, size and SHA-256 (copyable), whether the
  database was included, property and snapshot counts, the latest snapshot, the secrets flag, the
  member table, and the engine's limitations and warnings.
- **Force.** Replacing an archive with the same timestamped name needs the explicit force option.
- **Restore is not implemented.** The panel says so; unpack the archive manually and keep the source
  workspace until the copy is verified.

### Reports: attributed change digest

- **Digest card.** The weekly report now renders the engine's `Attributed change digest` section:
  each material metric change is paired with a candidate cause (`new_crawl_issue`,
  `resolved_crawl_issue`, `indexing_event`, `page_state` or `unexplained`), a confidence
  (`high`, `medium`, `low`) and up to three evidence rows (rule and URL, indexing event, page field
  and value), plus the next action for that cause.
- **Honest gaps.** No matching evidence stays `unexplained` with a limitation; the card shows
  truncation (`showing N of M`), the oldest evidence date and skipped rows. The section is absent
  when the two GSC windows are not comparable.

### Shell and engine

- New allow-listed CLI commands: `logs_analyze`, `tasks_list`, `tasks_add`, `tasks_update` and
  `backup_create`, all argument-validated in the shell before the engine sees them.
- New `pick_log_file` command; `pick_directory` now also approves the backup output folder.
- The bundled engine moves to `lv24-seo 0.6.0`: `logs analyze`, the attributed digest, the task
  lifecycle (schema v3, additive migration) and `backup create`, plus the 12th MCP tool
  `seo_log_analysis`. The CLI now has 20 top-level commands and the MCP surface 12 tools.
- **`MIN_ENGINE_VERSION` is now `0.6.0`.** An installed `0.5.x` engine is reported as incompatible
  and the desktop refuses to run commands against it. A development build must use `0.6.0` or newer
  via `LV24_SEO_BIN`.
- The committed contracts were regenerated from `lv24-seo 0.6.0`; the only fixture change is the
  version string.

## Verification

- **Published:** 18 assets on the `v0.4.0` GitHub release for Windows x64, Linux x64 and macOS
  arm64/x64, including the Windows portable `.zip.sha256` sidecar; the release gate recomputed it
  against the archive and `SHA256SUMS.txt` covers every published asset.
- **CI:** green for Linux x64, Windows x64 and macOS arm64 + x64 on the release commit.
- **In-app update:** `0.3.0 → 0.4.0` was verified on Windows through the Rust updater — download,
  signature verification, install and relaunch. The relaunched UI reports Desktop `0.4.0`,
  Engine `0.6.0` and engine ready, and the Logs page loads.
- **Sidecars:** the Linux and macOS sidecars were built by the release workflow and their
  rebuild-aware checksum reports passed the release gate. The Windows x64 sidecar was built from PyPI
  `lv24-seo 0.6.0` (Python 3.12, PyInstaller 6.22.3), passed the `version --json` smoke test and is
  pinned in `scripts/cli-checksums.json` (`sha256 b9fbcdb1…`, 14,255,928 bytes); `verify-sidecar
  --require-pinned` passes. The Linux and macOS reviewed pins remain `null`.
- **Engine commands:** the built sidecar answers `version --json` with `0.6.0` and its
  `logs analyze`, `tasks list` and `backup create` help output loads.
- **Contracts:** regenerated with `node scripts/check-contracts.mjs --update`; the full
  `npm run contract:check` reports `contracts are up to date` and `--static` passes.
- **Gates:** `npm run typecheck`, `npm test`, `npm run build`, `npm run test:release`,
  `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, `cargo test --all-targets`,
  `cargo build --release --locked` and `node scripts/check-contracts.mjs --static` passed on the
  release commit.

## Upgrade and known limitations

- Upgrading is unchanged: Windows NSIS, macOS `.app` and Linux AppImage update in place; deb, rpm,
  MSI and the portable ZIP remain manual. `0.1.0` still needs one manual install.
- **Backup restore is not implemented in `0.4.0`.** Only archive creation ships; restoring is a
  manual unzip.
- **Bot triage is User-Agent only.** Spoofed UAs are not detected, there is no reverse-DNS or
  published-IP check, and non-search crawlers are reported as `other`.
- **No cancel and no background runs in `0.4.0`.** A crawl, log analysis, report build, task refresh
  or backup runs to completion; the UI shows elapsed time where the shared run status is used but
  cannot stop it, and leaving the screen does not move the run to a background queue.
- **One log file at a time**, at most 100 MiB. There is no rotation, glob, remote fetch or persisted
  log history; trends across files must be computed outside the app.
- The digest is evidence-based triage, not causal proof. `indexing_event` appears only when the
  engine is given those rows, and items without evidence stay `unexplained`.
- Linux and macOS sidecar pins remain `null` in `scripts/cli-checksums.json`; the release workflow
  builds those sidecars and the release gate requires a rebuild-aware checksum report per target.
- `MIN_ENGINE_VERSION` is `0.6.0`, so a `0.5.x` engine is rejected; the desktop does not silently
  downgrade commands to an older engine.
- OS packages remain unsigned (Windows, Linux) or ad-hoc signed (macOS); SmartScreen, Gatekeeper and
  antivirus warnings are possible. Verify `SHA256SUMS.txt`.
- The Windows portable ZIP and deb/rpm/MSI cannot update themselves; the UI links to the release page
  for those bundle types.
