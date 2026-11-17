---
title: Releases and updates
description: Engine 0.9.0 and desktop 0.7.0 releases, the 0.8.0, 0.6.0, 0.5.3, 0.3.0 and older history, signed auto-update matrix, release pipeline, version pinning and rollback.
---

# Releases and updates

The current releases are:

| Product | Version | Released | Notes |
|---|---|---|---|
| Engine | `lv24-seo 0.9.0` | 2026-11-17 | Bing sitemap submit, IndexNow from sitemap, optional MCP sitemap provider, 22 CLI commands and 12 MCP tools |
| Desktop | `0.7.0` | 2026-11-17 | Bing indexing panel, Site Scan opener, per-session write secret, bundled engine 0.9.0 and `MIN_ENGINE_VERSION` 0.9.0 |

The desktop version and the engine version are independent, but the desktop pins an exact engine and refuses one below its minimum. `0.7.0` bundles `0.9.0` and requires at least `0.9.0`, so an installed `0.8.x` engine is reported as incompatible.

## Engine 0.9.0

Released on 2026-11-17. It turns Bing sitemap submission into a real gated write and lets IndexNow
read its URL list from the project sitemap and its host and key from `seo.toml`. The CLI still has
22 top-level commands; the MCP surface stays at 12 tools and the SQLite schema stays at version 4.

What changed:

- **Bing sitemap submit.** `sitemap submit --provider bing [--property SITE] [--url ABS] [--allow-write] [--confirm TOKEN]` sends the site's sitemap through the current Bing Webmaster JSON endpoint `POST .../SubmitFeed` with `{"siteUrl": …, "feedUrl": …}`. The site comes from `providers.bing.site` or `--property`, the sitemap from `--url` or `<project.base_url>/sitemap.xml`, and the key from the `bing_api_key` secret; a missing site, base URL or key fails before any network call. HTTP 401/403 map to `AUTH_INVALID`, 404 to `PROPERTY_NOT_FOUND`, 429 to `QUOTA_EXCEEDED`, 5xx to `UPSTREAM_UNAVAILABLE` and other 4xx to `INVALID_INPUT`, and the key never appears in an error. `--provider` defaults to `gsc`, so existing scripts keep the GSC plan.
- **Two-phase Bing write.** Plan and apply both need `--allow-write` and `LV24_SEO_WRITE_SECRET`; the plan contacts no provider and creates no database. Apply adds `--confirm TOKEN`, the SQLite idempotency ledger records the claim under the selected workspace, and a replay returns `status: skipped` with `reason: duplicate`. A provider failure releases the claim. Bing sitemap delete stays `WRITE_DISABLED`.
- **IndexNow from the sitemap.** `indexnow submit --from-sitemap [--sitemap-url ABS] [--url ABS …]` fetches and parses the sitemap read-only during the plan and resolves the host from `providers.bing.site`, the key from `providers.bing.indexnow_key` and the key location from `providers.bing.indexnow_key_location` or `https://<host>/<key>.txt`. A `<urlset>` is read directly; a `<sitemapindex>` is bounded to the root plus five child sitemaps and 10,000 URLs. URLs are deduplicated, explicit `--url` values are merged first, and off-host URLs are skipped. `meta.truncated`, `meta.total` and `meta.limitations` describe what was capped instead of claiming a complete inventory.
- **Sitemap-bound plan token.** Apply re-fetches the sitemap; if its URL set changed, the token is invalidated with `CONFIRM_REQUIRED` and nothing is submitted. A stable sitemap submits the refreshed merged list, capped at 10,000 URLs. A missing or mismatched key file is `INVALID_INPUT` with the exact key-file location, and a missing `providers.bing.indexnow_key` is `AUTH_REQUIRED` at plan time. IndexNow remains CLI/desktop-only: no thirteenth MCP tool is added.
- **MCP `seo_sitemap_submit`.** The tool keeps its name and the 12-tool surface. Inputs gain an optional `provider` (`gsc|bing`, default `gsc`), optional `property` and optional `sitemap_url`; for Bing the URL defaults to `<project.base_url>/sitemap.xml`. Bing apply calls the same `SeoService.submit_sitemap` path as the CLI. GSC submit and Bing delete still return `WRITE_DISABLED`.
- **Configuration and surface.** `[providers.bing]` gains the public `indexnow_key` and optional `indexnow_key_location`; the Bing Webmaster API key stays a secret and is never read from `seo.toml`. 22 top-level CLI commands (15 groups and 7 commands, no command added or removed), 12 MCP tools (10 read-class: 7 pure read-only plus 3 local-state writers; 2 gated writes), 3 resources and 3 prompts unchanged, schema version 4 and no migration. `schemas/tools.json` is regenerated because the `seo_sitemap_submit` inputs changed.

Verification recorded for this release:

| Check | Result |
|---|---|
| PyPI | `lv24-seo 0.9.0` published |
| npm | `@lv24/seo 0.9.0` published |
| MCP Registry | `io.github.LevapVeeskela/lv24-seo 0.9.0` published |
| CI | run `44038720401` green |
| Release workflow | run `44039013284` green |
| Desktop | `0.7.0` published with engine `0.9.0`; assets named `0.7.0` / `-0.7.0-` |
| Bing sitemap, configured workspace | plan → apply → `submitted` through the JSON `SubmitFeed` endpoint |
| IndexNow, configured workspace | plan returns `AUTH_REQUIRED` until the key and the hosted key file exist; nothing is submitted |

Known limits in 0.9.0:

- Bing sitemap submit needs a Bing Webmaster API key; without one the plan is `AUTH_REQUIRED` before any network call. Bing sitemap delete remains `WRITE_DISABLED`.
- IndexNow needs the public key and a live key file at `https://<host>/<key>.txt` or the configured location; a missing or mismatched key file fails with `INVALID_INPUT` and nothing is submitted.
- Sitemap discovery is bounded to the root plus five child sitemaps and 10,000 URLs; off-host URLs are skipped and the caps are reported through truncation and limitations.
- A plan token is bound to the sitemap URL set and expires after five minutes; a changed sitemap needs a fresh plan.
- GSC sitemap submit, Bing sitemap delete and Yandex recrawl remain `WRITE_DISABLED`; IndexNow has no MCP tool.
- The Bing Webmaster UI remains the authority for crawl issues and sitemap status; the API result says what Bing accepted, not how fast it recrawls.

## Desktop 0.7.0

Released on 2026-11-17. It adds the Bing indexing panel, opens the official Bing Site Scan page without
claiming a scan started, generates a per-session write secret, bundles `lv24-seo 0.9.0` and raises
`MIN_ENGINE_VERSION` to `0.9.0`, so an installed `0.8.x` engine is reported as incompatible.

What changed:

- **Bing sitemap submit.** The Integrations screen adds a sitemap submit card that builds `sitemap submit --provider bing --config <path> [--url <abs>] --allow-write [--confirm <token>] --json`. Planning sends the write opt-in but no token and only mints the plan; it does not call Bing. The card shows the action, target, summary, plan hash, TTL, payload details and limitations, and **Apply** sends the reviewed token. A missing key is `AUTH_REQUIRED` with a Settings hint.
- **IndexNow from the sitemap.** `indexnow_submit` builds `indexnow submit --from-sitemap --config <path> [--sitemap-url <abs>] --allow-write [--confirm <token>] --json`. The card reports the engine status and submitted URL count plus skipped or duplicate rows and the truncated flag. Host, key and key location come from `providers.bing.site`, `providers.bing.indexnow_key` and `providers.bing.indexnow_key_location`; a changed sitemap invalidates the plan token.
- **Bing Site Scan opener.** Bing has no public API for starting a Site Scan, so `open_bing_sitescan` only opens the hard-coded official page `https://www.bing.com/webmasters/sitescan?siteUrl=<percent-encoded>` in the default browser. The desktop does not start, poll or import a scan, and never reports that one started.
- **Per-session write secret.** At startup the shell draws 32 bytes from the OS CSPRNG, keeps the 64-character hex `LV24_SEO_WRITE_SECRET` only in Rust memory (zeroized on drop) and sets it on every engine child after `env_clear()`. It is never written to settings, argv, logs, diagnostics or the webview. Plan tokens are session-bound; a new session rejects an old token and the UI re-plans.
- **Engine 0.9.0 and contracts.** The sidecar adds Bing `SubmitFeed` with the idempotency ledger, one-click IndexNow from a bounded sitemap and the new Bing config keys. Contracts were regenerated from `lv24-seo 0.9.0`; the fixture envelopes change the version string and the `seo_sitemap_submit` input schema gains the optional `provider`. `MIN_ENGINE_VERSION` is `0.9.0` because a pre-`0.9.0` engine would answer the new commands with `CLI_INVALID_JSON`.

Verification recorded for this release:

| Check | Result |
|---|---|
| Published assets | 18 on `v0.7.0` for Windows x64, Linux x64 and macOS arm64/x64, including the Windows portable `.zip.sha256` |
| Updater manifest | `latest.json` reports `0.7.0` |
| CI | run `44041103066` green |
| Release workflow | run `44043493145` green |
| In-app update | `0.6.0 → 0.7.0` verified through the Rust updater on Windows NSIS: **Desktop 0.7.0**, **Engine 0.9.0** and engine ready |
| Workspace smoke test | a configured workspace loaded on the relaunched build without exposing query data |
| Bing sitemap submit | plan and apply from the Integrations card; the apply returned `duplicate` because the same sitemap had already been submitted from the CLI, so the ledger prevented a second provider call |
| IndexNow plan | `AUTH_REQUIRED` until `providers.bing.indexnow_key` and the hosted key file exist; no URL was submitted |
| Bing Site Scan opener | the official Bing page opened in the default browser; no API call was made and no scan was reported as started |
| Write secret | the shell generated `LV24_SEO_WRITE_SECRET` per session and passed it to every engine child; plan calls sent `allowWrite: true` |

Known limits in 0.7.0:

- The Bing Site Scan starts on the Bing page; the desktop only opens it and does not start, monitor, cancel or import a scan.
- IndexNow still needs a hosted key file, and a missing or mismatched file means nothing is submitted.
- Sitemap submit and IndexNow are provider network writes: they are not cancellable background runs, are not retried automatically and have no rollback. Review a fresh plan before retrying.
- Plan tokens are bound to the reviewed plan and the app session; a changed sitemap, a new session or an expired TTL requires a fresh plan.
- GSC sitemap submit/delete, Bing sitemap delete and Yandex recrawl remain `WRITE_DISABLED`.
- `MIN_ENGINE_VERSION` is `0.9.0`, so an `0.8.x` engine is rejected.
- Linux and macOS sidecar pins remain `null`; the release gate relies on rebuild-aware reports.

## Engine 0.8.0

Released on 2026-11-16. It adds the Core Web Vitals writer, Google Search Console service-account
authentication, richer Yandex Webmaster indicators, a non-destructive `backup restore --to`, a
scheduler lifecycle, and two provider fixes. The CLI now has 22 top-level commands; the MCP surface
stays at 12 tools and the SQLite schema stays at version 4.

What changed:

- **CWV writer.** `cwv collect --url ABS [--url ABS …] [--device phone|desktop|tablet|all] [--source crux|psi|both] [--limit 1..50]` is the writer behind the weekly `cwv` section. CrUX is queried per URL and device (`mobile` is an alias for `phone`) and every returned p75 becomes one `metric_daily` field row (`source=crux`, `scope`, `key=<absolute URL>`, `metric`, `value`, the fetch date in `report.timezone`, `accuracy=crux_field_28d`). PSI rows stay in `data.lab` and are never persisted, so a lab score cannot pollute the field series; every run with PSI reports `cwv_lab_ignored`, and PSI has no `tablet`, so `tablet` is skipped as `psi_tablet_unsupported`. CrUX is a 28-day rolling window, so `meta.data_age_days` is at least 2; a low-traffic URL is `low_traffic` and writes no row, never a zero. `--limit` caps URLs at 50 (default 10); `meta.total`, `meta.processed`, `meta.pairs_total`, `meta.pairs_processed` and `meta.calls` make the cap explicit, and a capped run sets `meta.truncated: true` with `cwv_url_cap`. CrUX needs a key (`AUTH_REQUIRED` before any call) and persistence needs a store (`CONFIG_INVALID`). `report weekly` and `seo_weekly_report` read stored CWV rows through today, so a collection appears in the same run.
- **GSC service accounts.** `providers.gsc.service_account_file` (absolute path) and `LV24_SEO_GSC_SERVICE_ACCOUNT_FILE` are read; the file wins over a stored `gsc_token`, and the environment wins over the file. A `gsc_token` that is a service-account JSON object (`type: service_account` plus `private_key`) is also accepted. The adapter signs an RS256 JWT (`iss`, `scope=webmasters.readonly`, `aud`, `iat`, `exp`), exchanges it at the key's `token_uri` with the JWT-bearer grant and refreshes it 60 seconds before expiry; a plain token keeps the historical `Authorization: Bearer` behaviour and is not refreshed. `properties` reports `token_source: service_account_file|secret|missing` and marks GSC ready; `doctor` adds a non-fatal `gsc_auth` check. Neither prints the JSON or the private key, and `auth status` still inspects only keychain, environment and file secrets. A relative, missing, unreadable or invalid file is `CONFIG_INVALID`; a rejected exchange is `AUTH_INVALID` and never echoes the body. `cryptography>=43` (Apache-2.0 OR BSD-3-Clause) is now required.
- **Richer Yandex indicators.** `yandex queries` and `yandex_query_performance` expose `avg_click_position` next to shows, clicks and position, return `query_id` when the provider sends it, and keep an unmapped indicator under `extra_indicators` instead of dropping the row; the legacy list form of `indicators` is still accepted. `yandex indexing` and `yandex_indexing_state` merge the `indexing/history` series (`HTTP_2XX` … `OTHER`, either case) into one row per date (`http_2xx` … `other`); an omitted series stays absent and unknown series are kept in `extra_indicators`. `summary.site_problems` carries severity → count next to the existing counters, and an omitted counter stays absent rather than becoming `0`.
- **Non-destructive restore.** `backup restore --file ABS --to ABS_DIR` unpacks an archive into a new directory and never touches the current workspace. The archive is re-validated exactly like the in-place plan (manifest, member set and names, sizes, every SHA-256). The target must be an absolute path that does not exist with an existing parent; an existing, non-empty or symlinked target is `INVALID_INPUT` and is never merged or overwritten. Absolute paths, `..`, backslashes and symlinks inside the archive are refused before extraction, the database passes `PRAGMA quick_check` before and after it is moved into place, and the staging directory is removed. An archive without a database yields a config-only directory with `database.in_archive: false` and an explicit warning; no empty database is invented. No `--allow-write` and no token are involved; passing either with `--to`, or `--to` with `--config`, is `INVALID_INPUT`. The two-phase in-place restore is unchanged.
- **Scheduler lifecycle.** `schedule install` is plan-only by default: it prints the cron block, the systemd user units or the Task Scheduler XML plus the command it would run, with `dry_run: true` and `installed: false`. Nothing is written until `--allow-write`; `--print` remains an alias for the default and wins over `--allow-write`. Generated jobs embed the absolute `--config` path and run from the config directory. `schedule status` is read-only and reports `installed|outdated|partial|missing|unknown` plus the expected paths and per-artefact `exists`/`matches`; `unknown` means the host scheduler could not be inspected and `matches` is then `null`. `schedule uninstall` is plan-only by default and with `--allow-write` removes exactly its own managed cron block, the two `<job>.service`/`<job>.timer` units or the named task; a second run is a no-op (`removed: false`, `state: missing`) and unrelated lines and tasks are never touched. A cron block that lost its end marker is repaired conservatively and the envelope warns.
- **Fixes.** Yandex Metrika `stat/v1/data` now sends the documented 1-based `offset`; the previous `0` was rejected with HTTP 400 on every call, which made the Metrika card look configured but empty. Pagination advances by the rows already returned. CLI `--json` output is ASCII-escaped, and human output degrades unencodable glyphs instead of aborting, so a completed report redirected on a legacy Windows code page (cp1251/cp866) no longer fails with `UnicodeEncodeError` while printing a warning.
- **Surface and schema.** 22 top-level CLI commands (15 groups and 7 commands, adding `cwv`), 12 MCP tools (10 read-class: 7 pure read-only plus 3 local-state writers; 2 gated writes still return `WRITE_DISABLED`), 3 resources and 3 prompts unchanged. The schema stays at version 4 and no migration is applied; `schemas/tools.json` is unchanged. Portfolio and restore remain CLI-only, and `schedule status`/`uninstall` have no desktop screen yet.

Verification recorded for this release:

| Check | Result |
|---|---|
| PyPI | `lv24-seo 0.8.0` published |
| npm | `@lv24/seo 0.8.0` published |
| MCP Registry | `io.github.LevapVeeskela/lv24-seo 0.8.0` published |
| CI matrix | run `43962847574` green on Ubuntu, Windows and macOS |
| Release workflow | run `43964671274` green |
| Desktop | `0.6.0` published with engine `0.8.0`; assets named `0.6.0` / `-0.6.0-` |

Known limits in 0.8.0:

- `cwv collect` needs a CrUX API key and a local store; without the key it is `AUTH_REQUIRED` before any network call, and PSI alone cannot populate the weekly `cwv` section.
- PSI is lab data and is never stored; `tablet` is skipped because PSI has no such form factor.
- The CWV fetch date uses `report.timezone`, not UTC, so a collection near midnight can land on a different date than a UTC-based consumer expects.
- `schedule status` is file-level: it compares the generated artefacts with the current spec and does not ask the host scheduler whether a job is enabled, last ran or succeeded. On Windows a task edited outside `schedule install` may still show as `outdated`.
- `backup restore --to` extracts files and never merges rows or settings; tokens are not in the archive, so re-authenticate afterwards.
- Yandex indicator coverage follows what the provider returns; a missing indicator stays absent (`null`), and `extra_indicators` is not a stable schema across API versions.

## Desktop 0.6.0

Released on 2026-11-16. It adds cancellable background runs, sends the scheduler write opt-in only
after confirmation, bundles `lv24-seo 0.8.0` and raises `MIN_ENGINE_VERSION` to `0.8.0`, so an
installed `0.7.x` engine is reported as incompatible.

What changed:

- **Cancellable background runs.** `crawl`, `report_weekly`, `logs_analyze`, `backup_create`, `backup_restore` and `schedule_install` accept a stable run id from the webview. The Rust runner registers `run id → exact child PID` before the spawn; a run id for any other command is `RUN_NOT_CANCELLABLE`, so short reads keep their synchronous path. The run lives in one root `RunStore`, not on a page: the app layout shows a persistent banner with kind, elapsed time, status and **Cancel**, leaving the route does not clear it, every active run is listed, and the newest cancelled run stays until dismissed. `run_cancel(runId)` signals only the exact registered child (and its process group on Unix) after checking it is still an engine image or a tracked child; it never matches by name. An unknown or finished run returns `false`, and the UI does not claim a cancellation then. A cancelled run returns `RUN_CANCELLED`, shown separately from succeeded and failed runs.
- **Schedule install sends the opt-in.** Engine `0.8.0` made `schedule install` plan-only by default; the desktop asks for confirmation and appends `--allow-write` only after the user confirms the plan it showed. The shell still refuses an install without `allowWrite=true` with `CONFIRM_REQUIRED` before spawning the engine, so the webview cannot bypass the new default. A plan-only preview and the print-only artifact remain available, and an install is cancellable like the other long jobs.
- **Engine 0.8.0.** The sidecar adds GSC service accounts, the `cwv collect` writer, `backup restore --to`, `schedule status`/`uninstall`, richer Yandex indicators, the Metrika 1-based offset fix and the Windows JSON output fix. `properties` gains `token_source` and `doctor` gains `gsc_auth`. `MIN_ENGINE_VERSION` is `0.8.0` because the mandatory `schedule install --allow-write` opt-in needs it; restore, portfolio and CWV already required `0.7.0`.
- **Shell and contracts.** Contracts were regenerated from `lv24-seo 0.8.0`; the additive changes are the `gsc_auth` check, `properties.token_source` and `providers.gsc.service_account_file` in `config.schema.json`. The contract generator pins `PYTHON_KEYRING_BACKEND` to the null backend so a developer machine with real provider tokens cannot leak token presence into the fixtures. The desktop adds no screens for `schedule status`/`uninstall` or `cwv collect` yet.

Verification recorded for this release:

| Check | Result |
|---|---|
| Published assets | 18 on `v0.6.0` for Windows x64, Linux x64 and macOS arm64/x64, including the Windows portable `.zip.sha256` |
| Updater manifest | `latest.json` reports `0.6.0` |
| CI | run `43966588931` green |
| Release workflow | run `43969832204` green |
| In-app update | `0.5.0 → 0.6.0` verified through the Rust updater on Windows NSIS: **Desktop 0.6.0**, **Engine 0.8.0** and engine ready |
| Workspace smoke test | a real workspace loaded with the bundled engine; provider readiness and coverage were checked without exposing query data |
| Sidecars | Windows x64 pinned from PyPI `0.8.0` (`sha256 5fb932c8…`, 14,365,502 bytes); Linux and macOS rebuilt with passing rebuild-aware reports |

Known limits in 0.6.0:

- Cancel is not rollback and there is no job queue. A cancelled run may leave a partial report, crawl, backup or scheduler artefact; a cancelled in-place restore keeps the pre-restore copy but may have replaced one file, so build a fresh plan before retrying.
- Schedule install mutates the host only after confirmation and only on this computer. The desktop does not manage, repair or uninstall the job; use `schedule status`/`schedule uninstall` in the CLI.
- Restore replaces the database and config and never merges; tokens are excluded, so re-authenticate. `backup restore --to` is CLI-only.
- GSC service accounts are configured outside the form: the desktop has no `service_account_file` field; set it in `seo.toml` or the environment.
- The CWV card is empty without stored field rows; `cwv collect` is a CLI command and at most five templates are shown.
- `MIN_ENGINE_VERSION` is `0.8.0`, so a `0.7.x` engine is rejected.
- Linux and macOS sidecar pins remain `null`; the release gate relies on rebuild-aware reports.

## Engine 0.7.0

Released on 2026-11-16. It adds a two-phase project restore, a read-only multi-site portfolio, Core Web Vitals
grouped by URL template and device, and schema v4 with persisted indexing events. The CLI now has 21 top-level
commands, and the MCP surface stays at 12 tools.

What changed:

- **Two-phase restore.** `backup restore --file ABS --config ABS` validates the archive and returns a plan with the
  archive and manifest hashes, the target config and data directory, the current and archived database hashes, the
  config action (`create`, `replace` or `write_alongside`) and a `confirm_token` valid for 300 seconds. Applying
  needs `--allow-write` and the token; `--allow-write` alone only plans, a token without it is `WRITE_DISABLED`, and
  a changed archive, changed workspace, expired token or replay is `CONFIRM_REQUIRED`. Before replacement the
  current database is copied to `<db>.pre-restore-<utc>` (and the config to `seo.toml.pre-restore-<utc>` when it is
  replaced), every member hash is re-verified, the restored database passes `PRAGMA quick_check` and files are
  replaced atomically. A config that does not validate is written alongside as `seo.toml.restored-<utc>`.
- **Multi-site portfolio.** `portfolio list --root ABS [--limit 1..50]` scans up to three levels below an absolute
  directory for `seo.toml`, skipping hidden, `node_modules`, `__pycache__`, `venv` and symlinked directories, and
  returns one row per site: config path, name, property, base URL, data directory, database presence, crawl runs,
  report snapshots, issue counts and last activity. It opens no provider, reads no token and writes nothing. A
  broken config or unreadable database becomes that site's `error` while the rest still scans; the scan is capped
  at 50 sites and reports the real total with `truncated: true`.
- **Schema v4 and indexing events.** Migration v4 adds `indexing_events`, keyed by
  `(provider, property_id, url, event, event_date)`. `yandex indexing` and the MCP `yandex_indexing_state` call
  persist per-URL events whenever a store exists: a replay updates `last_seen` without duplicating, `first_seen` is
  immutable, `meta.indexing_events` reports `new`, `existing`, `skipped` and `truncated`, and storage failures
  become warnings rather than a failed provider read. The weekly digest now reads these events, so `indexing_event`
  evidence no longer depends on a caller supplying rows.
- **Core Web Vitals by template.** When the store holds CrUX/PSI field rows for the compared windows,
  `report weekly` and `seo_weekly_report` add a `cwv` section grouped by normalized URL template (`/blog/{id}`) and
  device (`phone`, `desktop`, `tablet`). It shows at most five templates, regressed first, with per-metric p75,
  previous p75, delta, a regression flag and `poor_metrics`. A regression is a p75 increase of at least 5% (above
  0.01 for CLS), and a template p75 is the worst page p75 in the group, not a site-wide average. Origin aggregates,
  lab/PSI scores and rows without a URL or known device are never merged; they are reported through
  `cwv_template_missing`, `cwv_device_missing`, `cwv_lab_ignored` and `cwv_values_ignored`.
- **Surface and schema.** 21 top-level CLI commands (14 groups and 7 commands, adding `portfolio` and
  `backup restore`), 12 MCP tools (10 read-class: 7 pure read-only plus 3 local-state writers; 2 gated writes still return
  `WRITE_DISABLED`; 3 tools persist local state), 3 resources and 3 prompts unchanged. Schema version is 4; the
  migration is additive and runs on the next open. `yandex_indexing_state` now carries `writes_local_state: true`
  and `readOnlyHint: false`. Portfolio and restore are CLI-only.

Verification recorded for this release:

| Check | Result |
|---|---|
| PyPI | `lv24-seo 0.7.0` published |
| npm | `@lv24/seo 0.7.0` published |
| MCP Registry | `io.github.LevapVeeskela/lv24-seo 0.7.0` published |
| CI | Green on Linux, Windows and macOS on the release commit |

Known limits in 0.7.0:

- `portfolio list` reports local history only; it never calls a provider, so remote index status and traffic are
  absent for a site whose local store is empty.
- The portfolio scan is capped at 50 sites per run; larger agencies must scan narrower roots.
- `backup restore` replaces files and never merges rows or settings. Tokens are excluded, so re-authenticate
  afterwards; a database held open by another CLI or desktop process cannot be replaced on Windows.
- The restore token prevents accidental or stale applies; it is not access control.
- Indexing events come only from Yandex Webmaster indexing calls; rows without a URL, event name or event date are
  skipped, and each call considers at most 500 provider rows.
- The CWV section needs stored CrUX/PSI field rows and shows at most five templates. CWV and portfolio data are not
  attributed in the change digest.

## Desktop 0.5.0

Released on 2026-11-16. It adds a restore flow to the Backup page, a confirmed schedule install, a Portfolio page
and the CWV card, bundles `lv24-seo 0.7.0` and raises `MIN_ENGINE_VERSION` to `0.7.0`, so a `0.6.x` engine is
reported as incompatible.

What changed:

- **Restore UI.** The backup panel adds a restore section. The archive is chosen through the native
  `pick_backup_archive` dialog; the first call only builds a plan, and **Restore now** stays disabled until a token
  exists. Applying shows a confirmation dialog and calls the engine with `--allow-write` and the plan token. The
  plan shows the archive and manifest hashes, the target config and data directory, the current and archived
  database hashes, the config action and the token lifetime.
- **Schedule install.** The Integrations schedule card has **Preview artifact** and **Install on this host**. An
  install writes a cron entry, systemd user timer or Windows Task Scheduler task for a weekly or daily report after
  a confirmation dialog that names the config and the job kind; it touches only the local host.
- **Portfolio page.** Choose a folder through the native directory dialog; the engine scans up to three levels for
  `seo.toml` and inspects at most 50 sites. Summary counts, sorting by open issues, name, last activity or errors
  first, and filtering by name, property or path. Opening a row switches the workspace through the normal shell
  flow. The scan is read-only: no provider call, no token read, no write.
- **CWV card.** The weekly report renders the engine's `cwv` section per template and device with previous p75,
  delta and regression flag, plus truncation, the oldest evidence date, skipped rows and the engine's limitations.
- **Shell and engine.** New allow-listed commands `backup_restore`, `portfolio_list` and `schedule_install`, all
  argument-validated in the shell; `pick_backup_archive` is new, and `pick_directory` also approves the portfolio
  root and the backup output folder. Contracts were regenerated from `lv24-seo 0.7.0`.

Verification recorded for this release:

| Check | Result |
|---|---|
| Published assets | 18 on `v0.5.0`, including the Windows portable `.zip.sha256` |
| CI | Green for Linux x64, Windows x64 and macOS arm64 + x64 on the release commit |
| In-app update | `0.4.0 → 0.5.0` verified through the Rust updater on Windows NSIS: **Desktop 0.5.0**, **Engine 0.7.0** and engine ready |
| Sidecars | Windows x64 pinned from PyPI `0.7.0`; Linux and macOS rebuilt with passing rebuild-aware reports |

Known limits in 0.5.0:

- Restore replaces the database and config; it never merges, and the pre-restore copies are the only rollback.
- Schedule install mutates the host; removing or repairing the job is manual.
- The CWV card is empty without CrUX/PSI field rows that carry a URL and a device.
- Portfolio reports local history only and inspects at most 50 sites per scan.
- No cancel and no background runs: a restore, schedule install, portfolio scan or report build runs to completion.
- `MIN_ENGINE_VERSION` is `0.7.0`, so a `0.6.x` engine is rejected.

## Engine 0.6.0

Released on 2026-11-16. It adds local nginx log analysis, an attributed change digest in the weekly report, a finding/task
lifecycle with schema v3, a portable project backup and the twelfth MCP tool. The CLI now has 20 top-level commands.

What changed:

- **Log analysis.** `logs analyze --file ABS [--bot …]` reads exactly one local nginx JSON access log of at most 100 MiB
  and returns `bot_daily` rows (hits, bytes, p95 request time per date, bot and status class) plus a `crawl_waste`
  summary with the by-bot split. Redirects, errors, assets, `/api/` calls and tracking-parameter requests count as waste,
  each request once. The path must be absolute and a regular file; globs, UNC/device paths and larger files fail with
  `INVALID_INPUT` before anything is read. The file is opened read-only once and nothing is uploaded or stored.
- **12th MCP tool.** `seo_log_analysis(file, bot="")` is read-only (`readOnlyHint: true`, `writes_local_state: false`),
  needs no service, store or workspace, and returns the same `data`, `meta` and `warnings` as the CLI.
- **Attributed change digest.** When the two GSC windows are comparable and the store holds crawl issues or pages, the
  weekly report adds an `Attributed change digest` section: each material change gets a candidate cause
  (`new_crawl_issue`, `resolved_crawl_issue`, `indexing_event`, `page_state`, `unexplained`), a confidence, up to three
  evidence rows and a `next_action`. With no matching evidence the item stays `unexplained` with a limitation; items are
  capped at 8 and evidence at 3 per item.
- **Task lifecycle (schema v3).** `tasks list`, `tasks add` and `tasks update` manage findings keyed by
  `(kind, property_id, url, rule_id)` with states `open`, `in_progress`, `verified` and `dismissed`. `add` is idempotent
  and reports `created`, `existing` or `reopened`; a verified finding observed again reopens, a dismissed one stays
  dismissed. Only the documented transitions are accepted, `list` is newest-first and bounded (1–1000, default 200), and
  `--payload` rejects credential-shaped keys. The migration is additive.
- **Portable backup.** `backup create --out ABS [--force]` writes `lv24-seo-backup-YYYYMMDDTHHMMSSZ.zip` with
  `manifest.json` (sizes and SHA-256 per member), a redacted `seo.toml` with `storage.data_dir` reset to `./data`, and a
  consistent `data/seo.sqlite3` copy made through the SQLite backup API. Secrets, tokens, logs and caches are never
  included; the source is read-only and the archive is written atomically. Restore is not implemented.
- **Surface and schema.** 20 top-level CLI commands (13 groups and 7 commands), 12 MCP tools (10 read-class, including
  `seo_log_analysis`, plus 2 gated writes that still return `WRITE_DISABLED`), 3 resources and 3 prompts unchanged.
  Schema version is 3; `ReportSection` gained optional `total`, `truncated` and `data_age` fields, and a concurrent first
  open retries the WAL switch instead of failing on `SQLITE_BUSY`.

Verification recorded for this release:

| Check | Result |
|---|---|
| PyPI | `lv24-seo 0.6.0` published |
| npm | `@lv24/seo 0.6.0` published |
| MCP Registry | `io.github.LevapVeeskela/lv24-seo 0.6.0` published |
| CI | Green on Linux, Windows and macOS |

Known limits in 0.6.0:

- Bot detection is User-Agent only: a spoofed UA is not a verified crawler and non-search crawlers are `other`.
- Log analysis accepts one file of at most 100 MiB; there is no rotation, glob, remote fetch or persisted log history.
- `backup create` has no restore command; the manifest is the contract for a manual restore, and tokens are excluded.
- Tasks are CLI-only; no MCP tool or report section consumes them yet.
- The digest explains GSC headline deltas only; Yandex, Metrika, Bing, CrUX and PSI are not attributed, and indexing
  events appear only when a caller supplies them.

## Desktop 0.4.0

Released on 2026-11-16. It adds Logs, Tasks and Backup pages and the report digest card, bundles `lv24-seo 0.6.0` and
raises `MIN_ENGINE_VERSION` to `0.6.0`, so a `0.5.x` engine is reported as incompatible.

What changed:

- **Logs page.** A native `pick_log_file` dialog selects one nginx JSON access log (at most 100 MiB); the shell rejects a
  path that did not come from the dialog or the app's own data/export directories with `PATH_NOT_APPROVED`. The page shows
  a bot filter, parse summary (total, parsed, skipped), crawl waste with the by-bot split, a bot rollup table and JSON/CSV
  export. Bots are User-Agent only and the page labels the result as triage.
- **Tasks page.** Newest-first tasks with property, kind, state, rule, URL, timestamps and stored evidence; filters and a
  row limit up to 500. State changes follow the allowed transitions, an invalid move is refused with the allowed set, and
  the add form is idempotent with a 16 KiB evidence cap and credential-shaped keys rejected.
- **Backup page.** `backup create` writes the archive into the app export folder or a folder chosen in the native
  directory dialog; the panel shows the path, size, SHA-256, database inclusion, property and snapshot counts, the member
  table and the engine's limitations. Restore is not implemented and the panel says so.
- **Digest card.** The weekly report renders the engine's attributed change digest with cause, confidence, up to three
  evidence rows and the next action, plus `showing N of M`, the oldest evidence date and skipped rows.
- **Shell and engine.** New allow-listed commands `logs_analyze`, `tasks_list`, `tasks_add`, `tasks_update` and
  `backup_create`, all argument-validated in the shell; `pick_directory` now also approves the backup output folder.
  Contracts were regenerated from `lv24-seo 0.6.0`.

Verification recorded for this release:

| Check | Result |
|---|---|
| Published assets | 18 on `v0.4.0`, including the Windows portable `.zip.sha256` |
| CI | Green for Linux x64, Windows x64 and macOS arm64 + x64 on the release commit |
| In-app update | `0.3.0 → 0.4.0` verified through the Rust updater on Windows NSIS: **Desktop 0.4.0**, **Engine 0.6.0** and engine ready |

Known limits in 0.4.0:

- Backup restore is not implemented; unpack the archive manually and keep the source workspace until verified.
- Bot triage is User-Agent only; there is no reverse-DNS or published-IP check.
- No cancel and no background runs: a crawl, log analysis, report build, task refresh or backup runs to completion.
- One log file at a time, at most 100 MiB; no rotation or persisted log history.
- The digest is evidence-based triage, not causal proof.

## Engine 0.5.3

Released on 2026-11-16. It makes agent writes two-phase, moves the crawl off the MCP event loop, adds a CI-facing
`--strict` exit code, and replaces generic storage failures with typed codes. No schema migration and no new CLI command
or MCP tool: the surface stays at eleven tools, and the changes are inputs, exit codes and error codes.

What changed:

- **Two-phase MCP writes.** `seo_recrawl_request` and `seo_sitemap_submit` take `allow_write` (default `false`), `plan_hash` and
  `confirm_token`. A call without a token is a dry run that returns the plan, its hash and a 300-second token; an apply must echo
  the hash and token. A mismatched hash fails with `CONFIRM_REQUIRED`, a replay returns `status: skipped` with
  `reason: duplicate`, and a provider failure releases the claim so a retry is allowed. `LV24_SEO_WRITE_SECRET` is required;
  an empty secret is `WRITE_DISABLED`. The shipped `SeoService` still has no recrawl or sitemap write adapter, so both tools
  return `WRITE_DISABLED` even with `allow_write=true` — the contract is in place, the provider call is not.
- **Crawl off the event loop.** `seo_crawl_site` runs on a worker thread with its own short-lived store and a hard 600-second
  budget. After the budget the client gets a retryable `UPSTREAM_UNAVAILABLE` naming a smaller `max_urls`; the worker finishes in
  the background and the server keeps answering other tools. Every other tool stays serialized on the owner loop.
- **`--strict` and exit 5.** `stats`, `gsc query`, `yandex queries`, `yandex indexing`, `crawl`, `report weekly` and `report diff`
  accept `--strict`. `meta.strict` is always set; a truncated response stays `ok: true` but exits `5`, and `meta.limitations`
  explains what is missing. Without the flag, truncation still exits `0`. `report diff --markdown` honours the same code.
- **The write ledger follows `--config`.** A write apply opens the idempotency ledger from the selected workspace data directory,
  so `--config /srv/site/seo.toml` records the claim under `/srv/site/data` even when the shell is elsewhere. Previously the ledger
  was resolved from the working directory, which silently disabled replay protection.
- **Typed storage errors.** `STORE_LOCKED` (retryable), `STORE_CORRUPT` (with `detail.backup_path`) and `STORE_UNAVAILABLE`
  replace the generic `INTERNAL` envelope. A corrupt file is copied next to itself before anything else happens; the original is
  never moved or deleted. The three codes exit `1`, like `INTERNAL`.
- **Honest provider data.** A capped GSC result omits `total` instead of pairing an exact count with `truncated: true`, and
  `data_age_days` is floored at the documented 3-day lag. Metrika `limit` is a page size: the client walks `offset` up to 10,000
  rows and 100 pages, marks a full page with no `total_rows` as truncated, and never pages an aggregate call. Bing derives
  `data_age_days` from the newest row date instead of a hardcoded zero. A loaded Yandex host with an empty history returns
  `total: 0` with `empty_history` instead of `degraded_host`, and a bare Webmaster `count` is no longer mistaken for a grand total.
- **Sitemap scope.** A `<loc>` outside the sitemap's own origins (seed origin plus the final origin of each document read) is
  dropped and reported once as `off_origin_loc`, so an index can never walk a reader to another site.
- **`doctor` treats a declared data directory as fatal.** When the config file or `LV24_SEO_DATA_DIR` names a directory, a missing
  or unusable one fails the check; `meta.data_dir_declared` reports which case applies.
- **Smaller fixes.** A crontab with an unterminated managed block is repaired conservatively: only lines that look like lv24-seo
  entries are removed, and a warning asks the operator to review `crontab -l`. A crawl honours one `429` `Retry-After` instead of
  treating a throttle as a page answer.

Verification recorded for this release:

| Check | Result |
|---|---|
| PyPI | `lv24-seo 0.5.3` wheel and sdist published |
| npm | `@lv24/seo 0.5.3` published with the `latest` tag |
| MCP Registry | `io.github.LevapVeeskela/lv24-seo 0.5.3` published |
| Release workflow | Green on the tagged commit: verify, build, PyPI, npm and MCP Registry jobs |
| Tests | 1,205 offline tests passed, including the installed-wheel CLI envelope contract; Ubuntu, Windows and macOS CI passed |

Known limits in 0.5.3:

- The engine service still exposes no recrawl or sitemap write handler: CLI applies and every MCP write call return
  `WRITE_DISABLED` and nothing is sent. Only IndexNow reaches a provider.
- Metrika walks stop at 10,000 rows and 100 pages per call; a larger table is truncated and says so.
- Bing reports `data_age_days: 0` for an empty or undated feed; that is not evidence of freshness.
- `STORE_LOCKED`, `STORE_CORRUPT` and `STORE_UNAVAILABLE` have no dedicated CLI exit code; they exit `1` and must be read
  from `error.code`.
- `--strict` is not available on write commands; a dry run exits `0` when the plan is valid.
- `doctor` treats an unusable declared data directory as fatal, so a deliberately absent directory now fails the check
  instead of warning.

## Desktop 0.3.0

Released on 2026-11-16. It turns the shell into a working surface for the whole workflow: onboarding without a
terminal, a crawl screen, report comparison and export, a safer settings save flow, integration snippets and an
honest run status. It bundles `lv24-seo 0.5.3` (unchanged from `0.2.3`) and keeps `MIN_ENGINE_VERSION` at `0.5.2`.

What changed:

- **Onboarding without the terminal.** A three-step project wizard (folder, site, review) runs `lv24-seo init`
  through the shell, shows the exact config and data paths before creating anything, and offers **Open existing
  seo.toml** instead of overwriting a folder that already has one. `knownConfigs` in `settings.json` remembers up to
  20 canonical config paths so a previous workspace can be re-activated after a restart; the shell still validates
  them, so the list is a convenience, not a permission bypass. A header site chip opens up to 8 recent workspaces
  and marks a moved or deleted config as missing.
- **Properties panel.** The dashboard renders `lv24-seo properties`: configured providers, their target and token
  presence (`present`, `missing`, `not required`, `unknown`) with a link to the matching settings section.
- **Crawl screen.** A bounded `lv24-seo crawl --json` run with summary counters, a truncated badge, engine warnings
  and limitations; issue filters for severity, rule and free-text search with facets from the result; a table capped
  at 500 rendered rows while the JSON and CSV export contains every returned row. Switching workspace resets the
  screen.
- **Report comparison and export.** Compares the two newest stored weekly snapshots without calling a provider:
  headline deltas, issues added/resolved/unchanged, opportunities and limitations added or lifted, with a
  **not comparable** label instead of a silent diff. JSON uses the documented `lv24-seo.report/v1` payload; CSV is
  flat (`section,metric,value,delta`). The HTML report is unchanged.
- **Settings save workflow.** A sticky save bar with dirty state, changed-field count, validation errors and
  warnings, and the last backup; **Ctrl+S / Cmd+S** saves from anywhere; **Only changed** filters the form to fields
  that differ from `seo.toml`. An app-wide draft guard asks before discarding unsaved edits when leaving Settings,
  switching workspace, reloading or closing the window, and says so if it cannot install the close guard.
- **Recommendations.** Search across title, action, query and page; sort by report order or severity; bulk **Queue
  all visible** and **Export all visible**, with partial-export counts stated instead of silently ignored.
- **Integrations.** MCP snippets for Claude Desktop, OpenCode, VS Code and Cursor in JSON, plus a TOML form for
  TOML-based hosts such as Codex CLI; snippets contain no tokens. Scheduled runs are **print-only**: the screen
  renders the `lv24-seo schedule print` artifact and never installs a cron entry, unit or task.
- **Reporting window and run status.** A per-workspace window of 7, 28 or 90 days and a provider lag of 2 or 3 days,
  saved per `seo.toml` path, shared by stats and the weekly report. Runs show live elapsed time, the last duration and
  timestamp, truncation and limitation badges, and an explicit note that `0.3.0` has no cancel button.
- **Shell and security.** New allow-listed commands `init`, `schedule_print` (active config only) and
  `pick_directory` (a native dialog whose result is approved for `init`), persisted and validated `knownConfigs`,
  and a `core:window:allow-destroy` capability used only by the confirmed-discard close path.

Verification recorded for this release:

| Check | Result |
|---|---|
| Published assets | 18 on `v0.3.0`, including the Windows portable `.zip.sha256` |
| CI | Green for Linux x64, Windows x64 and macOS arm64 + x64 on the release commit |
| In-app update | `0.2.3 → 0.3.0` verified through the new Rust updater on Windows NSIS: **Desktop 0.3.0**, **Engine 0.5.3** and engine ready |
| Engine | `lv24-seo 0.5.3` unchanged; the contracts and the reviewed Windows sidecar pin are the same as `0.2.3` |

Known limits in 0.3.0:

- No cancel and no background runs: a crawl, report build or stats refresh runs to completion, and leaving the screen
  does not move it to a queue.
- Scheduled runs are print-only; no scheduler job is installed and no MCP client config is edited.
- The desktop performs no provider write.
- Config-path approval is per process plus the persisted `knownConfigs` list; a path outside both still needs the
  native dialog.
- Windows ACL hardening is best effort, and OS packages remain unsigned or ad-hoc signed.

## Desktop 0.2.3

Released on 2026-11-16. It moves the update download into Rust, makes the config path a dialog-approved capability, rejects
network paths before they are opened, and fixes UI state that could misreport a save or a workspace. It bundles
`lv24-seo 0.5.3` and keeps `MIN_ENGINE_VERSION` at `0.5.2`, so an installed `0.5.2` engine is still accepted.

What changed:

- **Updater moved into Rust.** The webview capability list contains `updater:allow-check` only. `update_install` re-checks the
  endpoint, refuses a version that differs from the one the panel announced (`UPDATE_VERSION_MISMATCH`), downloads, verifies the
  signature and starts the installer; progress arrives as `update://progress`. `update_cancel` drops the download before the
  installer starts and returns `UPDATE_CANCELLED`; once installation has begun the panel stays as it is instead of claiming a
  cancellation that did not happen.
- **Dialog-approved config path.** `pick_config` records the file the native dialog returned; `settings_set` accepts only the active
  path or an approved one and rejects anything else with `PATH_NOT_APPROVED`. A UNC share, `\\?\` device or `\\.\` device in
  `storage.data_dir` is rejected with `INVALID_PATH` and `detail.reason: network_or_device_path` before it is resolved.
- **Redaction and timeouts.** Engine stderr is redacted before it reaches the webview, a log or a diagnostics bundle, and redaction
  runs before the 300-character preview is truncated. A TOML parser error is redacted too. A helper task over its budget fails with
  `PATH_TIMEOUT` instead of hanging the screen.
- **Workspace and UI state.** `shell_status` reports `configExists`; a moved or deleted config shows a workspace-missing banner with
  **Choose config** instead of a generic stats error. Provider blocks have an explicit enable toggle that is the only writer of
  `providers.<id>.present`. Validation is tri-state (`valid`, `invalid`, `skipped`), so a double click or a workspace switch no
  longer reports a valid draft as invalid. The skip link keeps the hash route intact, and a route-level error boundary contains a
  render failure and offers a reload.
- **Release pipeline.** Pull-request CI runs the release-script tests; the Rust matrix includes the Intel macOS runner the release
  uses; Rust is pinned to `1.95.0`. `latest.json` is validated against `contracts/latest.schema.json` before the draft is created.
  One tested allowlist drives the checksum file and the upload list, and the Windows portable ZIP ships with a `.sha256` sidecar that
  the release gate recomputes and compares.

### Desktop 0.2.3 assets

`0.2.3` publishes 18 assets: the installers, the signed updater packages, the Windows portable ZIP and its `.sha256`
sidecar, `latest.json` and `SHA256SUMS.txt`.

| Asset | Platform | Purpose |
|---|---|---|
| `LV24.SEO.Optimizer_0.2.3_x64-setup.exe` + `.exe.sig` | Windows x64 | NSIS per-user installer; signed updater package |
| `LV24-SEO-Optimizer_0.2.3_x64-portable.zip` + `.zip.sha256` | Windows x64 | Portable build; manual-only, checksum verified by the release gate |
| `LV24.SEO.Optimizer_0.2.3_aarch64.dmg` | macOS Apple silicon | First install |
| `LV24.SEO.Optimizer_0.2.3_x64.dmg` | macOS Intel | First install |
| `LV24.SEO.Optimizer_0.2.3_aarch64.app.tar.gz` + `.sig` | macOS Apple silicon | Signed updater package |
| `LV24.SEO.Optimizer_0.2.3_x64.app.tar.gz` + `.sig` | macOS Intel | Signed updater package |
| `LV24.SEO.Optimizer_0.2.3_amd64.AppImage` + `.AppImage.sig` | Linux x64 | AppImage; signed updater package |
| `LV24.SEO.Optimizer_0.2.3_amd64.deb`, `LV24.SEO.Optimizer-0.2.3-1.x86_64.rpm` | Linux x64 | Package-manager installs; manual-only |
| `latest.json` | All | Signed updater manifest |
| `SHA256SUMS.txt` | All | SHA-256 for every published asset |

### Desktop 0.2.3 verification

| Check | Result |
|---|---|
| Published assets | 18 on `v0.2.3`, including the Windows portable `.zip.sha256` recomputed against the archive; `SHA256SUMS.txt` covers every published asset |
| CI | Green for Linux x64, Windows x64 and macOS arm64 + x64 on the release commit |
| In-app update | `0.2.2 → 0.2.3` verified end-to-end on Windows NSIS: download, signature verification, passive install and relaunch; the UI reports **Desktop 0.2.3**, **Engine 0.5.3** and engine ready |
| Sidecars | Linux and macOS sidecars rebuilt by the release workflow with passing rebuild-aware checksum reports; Windows x64 pinned from PyPI `0.5.3` (`sha256 24b51f43…`, 14,175,608 bytes) |

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

The Windows NSIS path has now been verified end-to-end eight times: `0.2.0 → 0.2.1`, `0.2.1 → 0.2.2`,
`0.2.2 → 0.2.3`, `0.2.3 → 0.3.0`, `0.3.0 → 0.4.0`, `0.4.0 → 0.5.0`, `0.5.0 → 0.6.0` and `0.6.0 → 0.7.0`.
For the eighth run, an installed `0.6.0` build updated through the Rust updater, downloaded and
verified the signed package, installed it, relaunched, and reported **Desktop 0.7.0** with
**Engine 0.9.0** and the engine ready; the Integrations screen shows the Bing indexing panel.
Any `0.2.x` install with the in-app updater can jump straight to `0.7.0`; `0.1.0` has no
updater and needs one manual install.

The `0.2.1 → 0.2.2` update runs the old `0.2.1` updater, which does not include the new tracked-PID
cleanup. If a sidecar is active during that first update, retry after it exits or install `0.2.2`
manually. `0.2.2 → 0.2.3` and later updates use the tracked-PID cleanup and block with
`UPDATE_ENGINE_BUSY` if a tracked sidecar cannot be stopped.

## Release pipeline

The desktop workflow is manual and owner-gated. It has no push, pull-request or tag triggers. The owner starts **Actions → Desktop build → Run workflow** and
approves the `desktop-release` environment; a non-owner run is skipped.

| Input | Default | Meaning |
|---|---|---|
| `engine_version` | `0.9.0` | Exact engine bundled in the sidecar |
| `signed` | `false` | Request OS signing/notarization; not configured in this zero-spend repository |
| `publish` | `false` | Create a GitHub release after every matrix build passes |
| `tag` | Empty | `vX.Y.Z` release tag; required when `publish=true` |

The default matches the `0.7.0` pin. The release gate rejects a manifest mismatch if a different version is passed.

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
PyInstaller versions are pinned in `scripts/cli-checksums.json`. `0.7.0` pins engine `0.9.0` (up from `0.8.0`), Python `3.12`, Pydantic `2.14.3`, Typer `0.29.0` and PyInstaller
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

For `0.9.0`, Windows x64 has a reviewed local pin; Linux and macOS were rebuilt by the release workflow
with passing rebuild-aware checksum reports, and their reviewed pins remain `null` until a local build is
reviewed on those hosts. The `0.8.0` Windows pin did not carry over because the executable changes with
the engine.
The checksum reports are CI evidence, not release assets. `SHA256SUMS.txt` covers the installers,
updater packages, signatures and `latest.json`; the sidecar executable is inside those packages and
is not listed separately. Users who install manually verify the downloaded asset against
`SHA256SUMS.txt`.

```bash
node scripts/verify-sidecar.mjs \
  --root src-tauri/engine \
  --target x86_64-pc-windows-msvc \
  --engine-version 0.9.0
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

`MIN_ENGINE_VERSION` in `src-tauri/src/commands.rs` is `0.9.0` in the current source. The `0.7.0` bundle ships engine `0.9.0`,
so the minimum matches the bundled engine and a `0.8.x` engine is reported as incompatible. The shell accepts an engine at least that new and marks an older one
offline with a notice. A newer engine passes the gate but is not the release-tested pin. A development build may use `LV24_SEO_BIN` with another version; the UI
labels it external and still checks the minimum. A `PATH` engine is used only when `LV24_SEO_ALLOW_PATH_ENGINE=1`.

## One-time 0.1.0 upgrade

`0.1.0` has no updater, endpoint or public key. It cannot discover or install `0.7.0`. Download and install `0.7.0` manually once (NSIS installer or portable
ZIP on Windows). After that, the `0.7.0` installation can auto-update to later releases when it uses an auto-update-capable bundle.

## Earlier releases

- **Desktop 0.7.0** added the Bing indexing panel (sitemap plan/apply, IndexNow from the sitemap, Site Scan opener)
  and the per-session write secret, bundled engine `0.9.0` and raised `MIN_ENGINE_VERSION` to `0.9.0`.
- **Engine 0.9.0** made Bing sitemap submit a gated `SubmitFeed` write, added one-click IndexNow from a bounded
  sitemap and the optional MCP `provider` input, and kept 22 CLI commands and 12 tools.
- **Desktop 0.5.0** added the restore flow, a confirmed schedule install, the Portfolio page and the CWV card,
  bundled engine `0.7.0` and raised `MIN_ENGINE_VERSION` to `0.7.0`.
- **Engine 0.7.0** added two-phase restore, the read-only portfolio, CWV by URL template and device, schema v4
  with `indexing_events`, and 21 CLI commands.
- **Desktop 0.4.0** added the Logs, Tasks and Backup pages and the report digest card, bundled engine `0.6.0`
  and raised `MIN_ENGINE_VERSION` to `0.6.0`.
- **Engine 0.6.0** added local nginx log analysis and the twelfth MCP tool, the attributed change digest,
  the task lifecycle with schema v3, a portable backup and 20 CLI commands.
- **Desktop 0.3.0** added the project wizard, crawl screen, report comparison and export, settings save workflow,
  integrations, per-workspace reporting window and run status.
- **Engine 0.5.3** made MCP writes two-phase, moved the crawl off the event loop, added `--strict` exit `5`, typed
  store errors and honest GSC/Metrika/Bing/Yandex data.
- **Desktop 0.2.3** moved the update install into Rust with real cancellation, made the config path a
  dialog-approved capability, rejected network and device paths and redacted engine output before the webview.
- **Desktop 0.2.2** fixed the locked-sidecar updater failure, made configuration writes durable and private, cleared stale
  UI state and bundled engine `0.5.2`.
- **Engine 0.5.2** anchored a relative `storage.data_dir` to the config file, attached the write ledger to CLI applies,
  redacted sitemap fetch errors and reported an exact-cap GSC page as truncated.
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

Source: `_source/engine-releases-0.9.0.md`, `_source/engine-releases-0.8.0.md`, `_source/engine-releases-0.7.0.md`, `_source/engine-releases-0.6.0.md`, `_source/engine-releases-0.5.3.md`, `_source/engine-releases-0.5.2.md`, `_source/desktop-releases-0.7.0.md`, `_source/desktop-releases-0.6.0.md`, `_source/desktop-releases-0.5.0.md`, `_source/desktop-releases-0.4.0.md`, `_source/desktop-releases-0.3.0.md`, `_source/desktop-releases-0.2.3.md`, `_source/desktop-releases-0.2.2.md`, `_source/desktop-releases-0.2.1.md`, `_source/desktop-releases-0.2.0.md`, `_source/desktop-release.md`, `_source/desktop-security.md`.
