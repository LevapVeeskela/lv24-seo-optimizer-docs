---
title: CLI reference
description: Commands, global flags, the JSON envelope, exit codes and worked examples for the lv24-seo command line.
---

# CLI reference

`lv24-seo` is the command-line surface of the engine. It treats provider data as read-only by
default, prints one machine-readable envelope with `--json`, and changes provider state only through
four explicitly gated write commands. The same executable runs on Windows, macOS and Linux.

## Command table

The table is filterable by command, group or description. Command names and flags are identical in
every locale; only the surrounding documentation is translated.

<CliTables />

Every command also accepts `--help`, which prints the authoritative flag list for the installed
version.

## Global conventions

### Output envelope

With `--json`, a command prints exactly one JSON document and nothing else:

```json
{ "ok": true, "data": {}, "meta": { "version": "0.14.0", "duration_ms": 812 }, "warnings": [] }
```

A failed command uses the same shape with `ok: false` and an `error` object instead of `data`:

```json
{ "ok": false, "error": { "code": "AUTH_REQUIRED", "message": "Google Search Console token is missing", "retryable": false, "next_action": "lv24-seo auth login --provider gsc" }, "meta": { "version": "0.14.0" }, "warnings": ["gsc: token missing"] }
```

- `data` is command-specific. `meta` always carries `version` and often adds `duration_ms`,
  `truncated`, `data_age_days`, `limitations`, `locale` or `complete`.
- `warnings` are short human-readable strings. Aggregated commands such as `stats` stay `ok: true`
  when one provider fails; the failure is counted in `coverage` and reported in `warnings`.
- Without `--json` you get a compact plain-text summary on stdout, followed by any warnings and the
  error line. Neither mode emits ANSI colour codes.
- `config show` adds `meta.redacted: true`; secret-looking keys are masked with `***`.

### Exit codes

| Code | Meaning | Error codes that map here |
|---|---|---|
| `0` | Success. The envelope is `ok: true`. | — |
| `1` | Unexpected internal failure. | `INTERNAL` |
| `2` | Usage or configuration problem. | `INVALID_INPUT`, `CONFIG_INVALID`, `CONFIRM_REQUIRED`, `WRITE_DISABLED` |
| `3` | Authentication problem. | `AUTH_REQUIRED`, `AUTH_INVALID` |
| `4` | Quota or upstream failure. | `QUOTA_EXCEEDED`, `UPSTREAM_UNAVAILABLE` |
| `5` | Partial result: truncated output in strict mode. | `TRUNCATED`, or any `ok: true` envelope with `meta.truncated` and `meta.strict` |

`WRITE_DISABLED` exits `2`, not `4`: a write was refused before any provider call. Exit `5` is a partial result, not a hard failure: the data is real, coverage is not total. Branch on the exit code and `error.code`, never on the human-readable text.

### `--strict` and exit 5

`--strict` turns truncation into a CI gate. It is available on `stats`, `gsc query`, `yandex queries`, `yandex indexing`, `yandex samples`, `yandex sitemaps`, `yandex history`, `yandex queue`, the seven `metrika` reads, `bing pages`, `bing traffic`, `bing crawl`, `bing urlinfo`, `bing children`, `bing users`, `bing sites`, `bing joins`, `bing quota`, `bing sitemaps`, `bing issues`, `crawl`, `report weekly` and `report diff`:

```bash
lv24-seo gsc query --start 2026-11-01 --end 2026-11-07 --strict --json
lv24-seo report weekly --days 7 --strict --json
```

- `meta.strict` is always set when the flag is passed, so a consumer can tell a strict run from a normal one.
- A complete response still exits `0`.
- A truncated response stays `ok: true` — the data is real — but exits `5`, and `meta.limitations` explains what is missing. If a provider set `truncated` without a limitation note, the CLI adds one.
- Without `--strict`, a truncated response exits `0` and carries no `meta.strict`.

`report diff --markdown` honours the same code: the Markdown still prints to stdout and the process exits `5` when the diff is truncated in strict mode.

### Storage failures

SQLite problems no longer surface as a generic `INTERNAL`. Three stable codes replace them:

| Code | Meaning | Retryable | What to do |
|---|---|---|---|
| `STORE_LOCKED` | Another process holds the write lock past the busy timeout | Yes | Wait for the other `lv24-seo` run, then retry; nothing was written |
| `STORE_CORRUPT` | The file is not a usable SQLite database | No | Inspect `detail.backup_path`, then move or delete the database and rerun |
| `STORE_UNAVAILABLE` | Permissions, a missing parent directory, a full disk | No | Fix the data directory, then run `lv24-seo doctor` |

A corrupt file is copied next to itself as `seo.sqlite3.corrupt-20260101T101010Z` before anything else happens; the original is never moved or deleted, and a failed copy does not hide the error. The three codes exit `1`, like `INTERNAL`; branch on `error.code`.

### Configuration and flags

- `--config PATH` selects a specific `seo.toml`. The path must exist; a missing file is
  `CONFIG_INVALID`, not a silent fallback. The resolved path is absolute and normalised, so scheduler
  artifacts and relative settings do not depend on the process working directory. The same path also
  selects the workspace whose data directory holds the write ledger, so a write apply records its
  claim where the config says rather than under the shell's working directory.
- Without `--config`, the engine looks for `./seo.toml`, then the platform user config file
  (`%APPDATA%\lv24-seo\config.toml` on Windows, `~/.config/lv24-seo/config.toml` on Linux).
- `LV24_SEO_*` environment variables override values from the file. `.env` files are not loaded
  automatically; export the variables in the shell or the service unit that runs the command.
- `mcp serve` is a long-running server and takes neither `--json` nor `--config`.

`doctor --json` reports `meta.data_dir`, `meta.data_dir_source` (`config` when the effective
directory is absolute, `working directory` when it is relative) and `meta.data_dir_declared`, which is
true when the config file or `LV24_SEO_DATA_DIR` names a directory. A declared data directory is
fatal: a missing or unusable one fails the check. A relative directory is not an error by itself, but
next to a config file it adds a warning that names the config's folder.

The full key list, defaults and secret handling live in the [configuration reference](/reference/config/).

### Read-only by default and the write gate

Only `sitemap submit`, `bing submit`, `yandex recrawl`, `indexnow submit` and `indexing run --allow-write` can change provider state. They use a
two-step flow:

1. Set a long random `LV24_SEO_WRITE_SECRET`, then run the command with `--allow-write` and no
   `--confirm`. It returns the plan with `data.plan`, `data.plan_hash`, `data.confirm_token` and
   `meta.dry_run: true`, and it contacts no provider.
2. Re-run with `--allow-write --confirm TOKEN` within five minutes.

The token is an HMAC over the action, target, full plan hash and expiry, so changing any input
invalidates it. With an initialised workspace the CLI attaches the SQLite idempotency ledger, so a
replayed token returns `status: skipped` with `reason: duplicate` and the provider is called once. The
ledger is opened from the selected workspace data directory: `--config /srv/site/seo.toml` records the
claim under `/srv/site/data` even when the shell is elsewhere. Without a data directory the apply still
runs, but the envelope warns that replay protection is off for the token's five-minute lifetime; the
plan opens no ledger and creates no database.

Bing sitemap submit, Bing URL submission, IndexNow, Yandex recrawl and `indexing run --allow-write` actually write. Bing URL submission reports
`accepted`, never indexed, because `SubmitUrlbatch` has no per-URL status. GSC sitemap submit and Bing
sitemap delete return `WRITE_DISABLED` instead of pretending the provider call happened.

### Logging

Logging is opt-in. `LV24_SEO_LOG_LEVEL=INFO` (or `DEBUG`, `WARNING`, …) installs the redacting
handler in the CLI and `lv24-seo mcp serve`; an unset variable leaves the caller's logging
configuration untouched. Output is one JSON line per record when stderr is not a terminal and a
plain line otherwise. The MCP transport logs to stderr only; stdout stays the protocol. The `--json`
envelope remains the stable diagnostic interface.

### Determinism and honesty

- Dates are ISO-8601 (`2026-11-10`); timestamps are ISO-8601 UTC (`2026-11-14T12:00:00+00:00`).
- CLI field order is stable, stored snapshot payloads are key-sorted, and visible output contains no
  random identifiers. Reports and diffs are meant to be diffed between runs.
- Bounded responses carry `truncated`, `total`, `data_age_days` and `limitations[]` where they
  apply. A metric present in only one window is reported as unknown, never as zero.
- `--days` accepts `1..3660`; a larger value fails with `INVALID_INPUT` and exit `2`.
- No command prints a token, cookie or full `Authorization` header.

## Command groups

| Group | Commands | What it touches |
|---|---|---|
| Start | `version`, `doctor`, `init`, `properties`, `stats` | Local files and the environment; `stats` reads provider KPIs without writing. |
| Authentication | `auth status`, `auth set`, `auth login`, `auth logout` | The local secret store; `login` runs the Google or Yandex OAuth connector and stores tokens in the keychain. |
| Configuration | `config show` | The effective config, with credentials redacted. |
| Google Search Console | `gsc query`, `gsc inspect`, `gsc sitemaps`, `gsc sitemap` | Read-only search analytics with filters, URL Inspection and sitemap reads. |
| Sitemap | `sitemap submit` | Gated write; Bing `SubmitFeed` is wired, GSC submit still returns `WRITE_DISABLED`. |
| Yandex Webmaster | `yandex queries`, `yandex indexing`, `yandex samples`, `yandex sitemaps`, `yandex history`, `yandex queue`, `yandex recrawl` | Read-only queries, events, samples, sitemaps, history and queue; recrawl is a gated write capped to the remaining quota. |
| Yandex Metrika | `metrika pages`, `metrika goals`, `metrika queries`, `metrika devices`, `metrika countries`, `metrika engagement`, `metrika bytime` | Read-only organic traffic views; every call applies `ym:s:lastTrafficSource=='organic'`. |
| IndexNow | `indexnow submit` | A gated write that submits explicit URLs or URLs read from the project sitemap. |
| Bing | `bing submit`, `bing pages`, `bing traffic`, `bing crawl`, `bing urlinfo`, `bing children`, `bing users`, `bing sites`, `bing joins`, `bing sitemaps`, `bing issues`, `bing quota` | `submit` is a gated `SubmitUrlbatch` write; the rest read page, traffic, crawl, URL, join, sitemap, issue and quota data. |
| Indexing | `indexing status`, `indexing run`, `indexing history` | `status` and `history` are read-only; `run` plans by default and submits within fresh provider quotas only with `--allow-write`. |
| Crawl and audit | `crawl` | Provider-independent; stores local pages and issues when a store is configured. |
| CWV | `cwv collect`, `cwv audits`, `cwv history` | `collect` persists CrUX field p75 rows; `audits` and `history` are read-only PSI/CrUX reads. |
| Reports | `report weekly`, `report diff` | `weekly` stores a local snapshot; `diff` is read-only. |
| Scheduling | `schedule print`, `schedule install`, `schedule status`, `schedule uninstall` | `print` renders only; `install` and `uninstall` plan by default and write only with `--allow-write`; `status` is read-only. |
| Logs | `logs analyze` | Reads one local nginx JSON access log; never stores or uploads it. |
| Tasks | `tasks list`, `tasks add`, `tasks update` | The workspace task ledger; `add` is idempotent and `update` follows the allowed transitions. |
| Backup | `backup create`, `backup restore` | `create` writes one portable workspace archive; `restore` plans an in-place replacement or extracts into a new directory with `--to`. |
| Portfolio | `portfolio list` | Read-only rollup of local projects below one folder; no provider call, no token read, no write. |
| Agents and MCP | `mcp serve`, `install`, `export tools`, `export skills` | Host config, generated files or a local server. |

The CLI has 25 top-level commands: 18 groups and 7 commands (`version`, `doctor`, `init`, `properties`, `stats`, `crawl`, `install`).

## Examples

### Dashboard snapshot

```bash
lv24-seo stats --days 7 --lag-days 2 --json
```

Read-only and store-free. Services always appear in the order `gsc`, `yandex_webmaster`,
`yandex_metrika`, `bing`, `crux`, `psi`; `metrics` contains only reported values, with no zero fill
and no cross-engine totals. A provider failure is isolated and increments `coverage.failed`.

### Search Console

```bash
lv24-seo gsc query --start 2026-11-01 --end 2026-11-07 --dimensions query,page --limit 100 --json
lv24-seo gsc query --start 2026-11-01 --end 2026-11-07 --type image --data-state all --filter country:equals:BLR --json
lv24-seo gsc inspect --url https://example.com/ --language en-US --json
lv24-seo gsc sitemaps --sitemap-index https://example.com/sitemap-seo.xml --json
lv24-seo gsc sitemap --path https://example.com/sitemap.xml --json
```

`--start` and `--end` are required. There is no `--days` shorthand and no `--property` override: the
property comes from `[providers.gsc]` in `seo.toml`. Dimensions are comma-separated and limited to
`query`, `page`, `country`, `device` and `date`.

`--type` accepts `web`, `image`, `video`, `news`, `discover`, `googleNews` and `webMultimodal`.
`--filter` takes `dimension:operator:expression` and may be repeated (one AND group); `--filter-list`
takes `dimension:expr1,expr2` and may be repeated. `--data-state` accepts `all`, `final` and
`hourly_all`; `--aggregation` accepts `auto`, `byPage`, `byProperty` and `byNewsShowcasePanel`;
`--search-appearance` adds a `searchAppearance equals` filter; `--branded` accepts `branded` or
`non_branded` and is rejected together with a `query` filter.

`gsc inspect` handles exactly one absolute URL. It maps the full `indexStatusResult`, rich results and
`inspectionResultLink`, and reports `one_url_per_call`, `url_inspection_quota_2000_per_day` and
`inspection_reflects_last_crawl`: it describes Google's last crawl, not a live test. `gsc sitemaps` and
`gsc sitemap --path` map type, index flag, errors, warnings and `contents[]`; the deprecated `indexed`
count is labelled, and child sitemap URLs of an index are not exposed. Sitemap submit/delete remain
`WRITE_DISABLED`.

### Yandex

```bash
lv24-seo yandex queries --limit 100 --json
lv24-seo yandex indexing --date-from 2026-10-01 --date-to 2026-10-31 --json
lv24-seo yandex samples --kind events --limit 100 --json
lv24-seo yandex sitemaps --json
lv24-seo yandex history --kind sqi --json
lv24-seo yandex queue --json
```

`yandex queries` returns top rows, not a full query-by-page join: Yandex exposes at most 3,000
queries per period. It keeps `avg_click_position`, returns `query_id` when the provider sends it and
preserves an unmapped indicator under `extra_indicators` instead of dropping the row. `yandex indexing`
reports indexing history, in-search counts, diagnostics, `site_problems` and search-URL events for the
configured `host_id`, and merges the `indexing/history` series (`http_2xx` … `other`) and the
appeared/removed event series into one row per date. A date window that the provider resets is retried
unfiltered and reported as `client_side_date_filter`.

`yandex samples` pages the provider sample endpoints at 100 rows per page with honest totals.
`yandex sitemaps` lists ids, URLs, error/URL counts, children and sources; add/delete is not
implemented. `yandex history --kind sqi|in-search|queries|query` reads the SQI, pages-in-search,
all-query and per-query series. `yandex queue` reads recrawl tasks and their provider total.

`yandex recrawl --url https://example.com/page --allow-write` plans the write; `--confirm TOKEN`
applies one POST per URL, capped to the remaining daily quota. A `202` row carries `task_id` and
`quota_remainder`, `409` is `already_queued`, and a `429` stops the loop with the rest in
`not_attempted`.

### Bing and IndexNow

```bash
lv24-seo sitemap submit --provider bing --allow-write --json
lv24-seo sitemap submit --provider bing --allow-write --confirm TOKEN --json
lv24-seo bing submit --url https://example.com/page --allow-write --json
lv24-seo bing submit --url https://example.com/page --allow-write --confirm TOKEN --json
lv24-seo bing pages --json
lv24-seo bing traffic --json
lv24-seo bing crawl --json
lv24-seo bing urlinfo --url domain:example.com --json
lv24-seo bing children --url domain:example.com --page 0 --pages 2 --json
lv24-seo bing users --json
lv24-seo bing sites --json
lv24-seo bing joins --query "seo tools" --json
lv24-seo bing quota --json
lv24-seo bing sitemaps --json
lv24-seo bing issues --json
lv24-seo indexnow submit --from-sitemap --allow-write --json
lv24-seo indexnow submit --from-sitemap --allow-write --confirm TOKEN --json
```

`--provider` on `sitemap submit` defaults to `gsc`; `bing` takes the site from `providers.bing.site`
or `--property`, the sitemap from `--url` or `<project.base_url>/sitemap.xml`, and the key from the
`bing_api_key` secret. The plan needs `--allow-write` and `LV24_SEO_WRITE_SECRET` and mints the token
without calling Bing; the apply sends the reviewed token and records the claim in the idempotency
ledger. `bing submit` is the native URL write: URLs come from repeated `--url` and/or
`--from-sitemap`, the plan reports the URL count, the 500-URL batch count and the remaining quota, and
the apply calls `SubmitUrlbatch` after a daily and monthly quota pre-check. A batch success has no
per-URL status, so the result says `accepted`, never indexed, and a duplicate URL may consume quota.
`bing quota` reports `daily_remaining` and `monthly_remaining`, not totals; the monthly window can bind
first and the reset schedule is undocumented. `bing sitemaps` lists feed URL, provider status, last
crawl and URL count but no per-URL errors, while `bing issues` decodes the crawl-issue bitmask and has
no severity or date.

`bing pages`, `bing traffic`, `bing crawl` and `bing joins` are read-only stats views. An empty stats
response carries `no_rows_for_window` and is not zero impressions; `bing crawl` always carries
`crawl_stats_six_month_window`. `bing urlinfo --url URL|domain:HOST` reads URL index/crawl details; the
WCF `Date(-62135596800000)` sentinel maps to `null` and a never-crawled row carries `never_crawled`.
`bing children` walks at most 10 pages and marks a full final page `truncated` with
`children_page_cap`. `bing users` reads site roles without echoing delegated codes; `bing sites` reads
the account's verified sites. `bing joins --query|--page` selects one of the three query/page joins and
returns the same compact row shape.

`indexnow submit --from-sitemap` reads the sitemap during the plan and resolves host, key and key
location from `providers.bing.site`, `providers.bing.indexnow_key` and
`providers.bing.indexnow_key_location`. The key must be 8–128 characters from `A-Z`, `a-z`, `0-9` and
`-`; a same-host `keyLocation` directory prefix is enforced. A `<sitemapindex>` is bounded to the root
plus five child sitemaps and 10,000 URLs; explicit `--url` values are merged first and off-host URLs are
skipped. The apply re-fetches the sitemap and invalidates the token with `CONFIRM_REQUIRED` if the URL
set changed. A missing key is `AUTH_REQUIRED` at plan time. Provider statuses map `200` accepted, `202`
accepted-pending, `400` invalid format, `403` a missing/mismatched key file, `422` a host/key mismatch
and `429` quota/spam; the key is never echoed.

### Indexing automation

```bash
lv24-seo indexing status --live --json
lv24-seo indexing status --provider bing --limit 50 --json
lv24-seo indexing run --from-sitemap --max-submit 20 --max-inspect 5 --json
lv24-seo indexing run --from-sitemap --allow-write --json
lv24-seo indexing history --limit 20 --json
```

`indexing status` is read-only. `--live` reads Bing `GetUrlSubmissionQuota` and Yandex
`recrawl/quota`; without it the last recorded quota is shown with `quota_not_live`. GSC and IndexNow
use local UTC-day counters because neither provider exposes a remaining-count endpoint. Each provider
entry carries `urls`, `submitted`, `inspected`, `indexed`, `not_indexed`, `crawled`, `queued`,
`pending`, `stale`, `quota` and `limitations`, plus `write_secret_present`.

| Engine | Remaining quota source | Per-run bound |
|---|---|---|
| Bing | `GetUrlSubmissionQuota` daily and monthly remaining values | 500 URLs per `SubmitUrlbatch`; the plan is capped to the smaller remaining window |
| Yandex | `recrawl/quota` `quota_remainder` | One POST per URL; no batch endpoint |
| GSC | No remaining-count API; local UTC-day `quota_usage` counter | 2,000 inspections/day/site by default, `max_inspect_per_run` 20 |
| IndexNow | No status or quota API; local UTC-day counter | 1,000 submissions/day by default, 10,000 URLs per POST |

`indexing run` builds a same-host queue from `<project.base_url>/sitemap.xml` (10,000 URLs and six
sitemap documents) and/or repeatable `--url`, then plans in priority order: never submitted, `lastmod`
newer than `last_submitted_at`, a check older than `check_interval_days`, then the rest. Checks are
read-only and run in both modes: GSC URL Inspection (`PASS`/`Submitted and indexed` → `indexed`;
`NEUTRAL`/`FAIL` → `not_indexed`) and Bing `GetUrlInfo` (`crawled` when a crawl date exists, otherwise
`unknown`). Without `--allow-write` nothing is submitted. With it, the engine re-reads quotas,
re-validates the plan hash, mints and consumes an internal confirm token and records one
`indexing_runs` row per provider.

Caps are enforced before the provider call: `max_submit_per_run` (default 500), Bing's remaining
daily/monthly quota, Yandex's `quota_remainder`, `max_inspect_per_run` (default 20), GSC's local
`gsc_inspect_daily_limit` (2,000) and IndexNow's local `indexnow_daily_limit` (1,000). An exhausted
quota is `quota_exhausted` with `submitted: 0` and `not_attempted`; zero never means "all indexed".
`--allow-write` requires `[indexing] enabled = true` and `LV24_SEO_WRITE_SECRET`, otherwise the
command fails with `WRITE_DISABLED`.

GSC's sitemap `contents[].indexed` aggregate is reported separately as `indexed_total` with
`gsc_indexed_count_deprecated`. Bing, Yandex and IndexNow expose no per-URL index count, so their
`indexed_total` stays `null` with `no_per_url_index_count`; Bing also carries
`site_scan_no_api`, Yandex `yandex_no_per_url_index_status` and IndexNow `indexnow_no_status_api`.

### Core Web Vitals

```bash
lv24-seo cwv collect --url https://example.com/ --url https://example.com/blog/post --device phone --source crux --category performance --json
lv24-seo cwv audits --url https://example.com/ --strategy mobile --category performance --json
lv24-seo cwv history --origin https://example.com --device phone --weeks 12 --json
```

`cwv collect` is the writer behind the weekly `cwv` section. CrUX is queried per URL and device
(`mobile` is an alias for `phone`) and each returned p75 becomes one `metric_daily` field row with
`source=crux`, `scope`, the absolute URL, the metric and the fetch date in `report.timezone`. PSI rows
stay in `data.lab` and are never persisted, and PSI has no `tablet`, so `tablet` is skipped as
`psi_tablet_unsupported`. `--limit` caps URLs at 50 (default 10); a low-traffic URL writes no row, never
a zero, and a capped run sets `meta.truncated: true` with `cwv_url_cap`. `--category` is repeatable and
selects Lighthouse categories for the PSI path. `data_age_days` comes from
`collectionPeriod.lastDate`; the two-day heuristic is only a fallback with `crux_period_missing`, and a
normalized URL adds `crux_url_normalized`. The command needs a CrUX key (`AUTH_REQUIRED` before any
call) and an initialised store (`CONFIG_INVALID`).

`cwv audits` returns at most 100 Lighthouse audit rows (`psi_audits_cap`) with score, display value, a
plain-text description and savings; item arrays are never included. A `runtimeError`, CAPTCHA or a
different `finalUrl` becomes a warning/limitation instead of a clean run. Nothing is persisted.

`cwv history` reads weekly CrUX p75 periods, newest last, with `first_date`/`last_date`, an optional
canonical device and the available metrics. `--weeks` is 1..40. Missing p75 cells become
`crux_history_gaps` and are never filled; fewer periods than requested adds `crux_history_short`.
History is read-only and not persisted.

### Yandex Metrika

```bash
lv24-seo metrika pages --days 7 --lag-days 2 --limit 100 --json
lv24-seo metrika goals --days 7 --dimension page --json
lv24-seo metrika queries --days 7 --json
lv24-seo metrika devices --days 7 --json
lv24-seo metrika countries --days 7 --json
lv24-seo metrika engagement --days 7 --json
lv24-seo metrika bytime --days 7 --group day --json
```

All seven commands are read-only and use `providers.yandex_metrika.counter`. Every call applies
`filters=ym:s:lastTrafficSource=='organic'`; `meta.organic_only` is `true` and `meta.filters` repeats
the expression. `pages` returns organic landing pages with visits/users, bounce rate, average visit
duration, page depth and pageviews. `goals` reads goal ids from `providers.yandex_metrika.goals` and
queries reaches, visits, users and conversion rate, optionally by `page` or `source`; an empty list
warns without a provider call, and more than five goals are truncated at Metrika's 20-metric cap.
`queries` always states that Google withholds search phrases and Metrika hides phrases with fewer than
10 users. Sampling fields (`sampled`, `sample_share`, `sample_size`, `sample_space`, `data_lag`,
`contains_sensitive_data`, `total_rows_rounded`) are carried into meta and limitations; only
`sampled=false` is exact.

### Crawl

```bash
lv24-seo crawl --start https://example.com --max-urls 500 --json
```

The crawler respects `robots.txt`, follows same-host links breadth-first, runs every rule and stores
pages and issues when a store is configured. `data.sitemap_coverage` compares the sitemap with what
the crawl saw in six buckets. When it returns `complete: false`, the affected buckets are candidates,
not confirmed findings; `limitations[]` names the truncated input.

### Logs, tasks and backup

```bash
lv24-seo logs analyze --file /var/log/nginx/access.log --json
lv24-seo tasks list --state open --limit 200 --json
lv24-seo tasks add --kind issue --url https://example.com/page --rule broken-internal-link --json
lv24-seo tasks update TASK_ID --state verified --json
lv24-seo backup create --out /srv/backups --json
lv24-seo backup restore --file /srv/backups/lv24-seo-backup-20261116T120000Z.zip --config /srv/site/seo.toml --json
lv24-seo backup restore --file /srv/backups/lv24-seo-backup-20261116T120000Z.zip --to /srv/restored --json
lv24-seo portfolio list --root /srv/sites --limit 50 --json
```

`logs analyze` reads exactly one absolute nginx JSON access log of at most 100 MiB and returns
`bot_daily` rows plus a `crawl_waste` summary; the file is opened read-only and nothing is stored.
`tasks add` is idempotent per `(kind, property_id, url, rule_id)` and reports `created`, `existing` or
`reopened`; `tasks update` accepts only the documented transitions and `tasks list` is bounded.
`backup create` writes `lv24-seo-backup-YYYYMMDDTHHMMSSZ.zip` with a manifest, a redacted `seo.toml`
and a consistent database copy; tokens, logs and caches are excluded. `backup restore` first validates
and returns a plan with a 300-second `confirm_token`; applying needs `--allow-write` and the token, and
the current database is copied to `<db>.pre-restore-<utc>` before replacement. `backup restore --to DIR`
instead re-validates the archive and extracts it into a new directory: no token and no `--allow-write`
are involved, the target must be an absolute path that does not exist, and zip-slip or link escapes are
refused before extraction. `portfolio list` scans up
to three levels below an absolute folder for `seo.toml`, inspects at most 50 sites, and reports local
crawl, report and issue counts newest-activity first.

### Reports

```bash
lv24-seo report weekly --days 7 --lag-days 2 --out reports/ --json
lv24-seo report diff --markdown
```

`report weekly` builds and stores a snapshot; add `--send` to deliver through the channels enabled in
`seo.toml`. `--out` writes canonical English `report.json` and a locale-rendered `report.html`.
When two comparable GSC windows and stored crawl evidence exist, the report adds an `Attributed change
digest` section that pairs each material change with a candidate cause, a confidence and up to three
evidence rows; without evidence the item stays `unexplained` with a limitation.
`report diff` compares two stored weekly snapshots, never calls a provider, and needs two runs for
different periods. `--markdown` prints only Markdown on stdout; warnings go to stderr.

### Scheduling

```bash
lv24-seo schedule print --kind weekly --cron "0 6 * * 1" --target systemd --json
lv24-seo schedule install --kind weekly --json
lv24-seo schedule install --kind weekly --allow-write --json
lv24-seo schedule install --kind indexing --json
lv24-seo schedule install --kind indexing --allow-write --json
lv24-seo schedule status --kind indexing --json
lv24-seo schedule uninstall --kind weekly --allow-write --json
```

`print` renders the artefact without touching the host. `install` is plan-only by default: it prints the
cron block, systemd user units or Task Scheduler XML plus the command it would run, with `dry_run: true`
and `installed: false`, and writes only with `--allow-write` (`--print` stays an alias for the plan and
wins over `--allow-write`). `status` is read-only and reports `installed`, `outdated`, `partial`,
`missing` or `unknown` with per-artefact `exists`/`matches`. `uninstall` is plan-only by default and
removes exactly the generated artefacts with `--allow-write`; unrelated cron lines and tasks are never
touched. `--kind` accepts `weekly`, `daily` and `indexing`. The report jobs run
`report weekly --send --json`; the `indexing` job is named `lv24-seo-indexing`, runs daily at `04:00`,
and calls `indexing run --allow-write --config <absolute path> --json`. It still needs
`[indexing] enabled = true` and `LV24_SEO_WRITE_SECRET` in the scheduler environment; the generated
command never contains the secret. Only simple cron expressions (`M H * * *` and `M H * * DOW`)
convert to systemd or Windows schedules.

### MCP and agent clients

```bash
lv24-seo install --client cursor --print
lv24-seo mcp serve --transport http --port 8765
```

`install` merges the `lv24-seo` server entry into the host config instead of replacing the file;
`--print` shows the exact JSON. `mcp serve` defaults to stdio and accepts streamable HTTP with
`--transport http`.

### Authentication

```bash
lv24-seo auth status --json
lv24-seo auth set --provider gsc --stdin
lv24-seo auth set --provider gsc_oauth_secret --stdin
lv24-seo auth login --provider gsc
lv24-seo auth login --provider yandex --no-browser
lv24-seo auth login --provider yandex --code <code>
lv24-seo auth login --provider yandex --url-only --json
```

`auth set` reads the secret from stdin or a hidden prompt and stores it in the OS keychain, or in the
opt-in `0600` file fallback. It prints only `{provider, stored, source}`. `auth status` reports
presence and source (`env`, `keyring`, `file`, `missing`), never a value.

### OAuth connectors

`auth login` authorizes Google Search Console, Yandex Webmaster or Yandex Metrika with OAuth instead
of a pasted token. It needs a client id in `[auth.gsc]` or `[auth.yandex]` (or
`LV24_SEO_GSC_CLIENT_ID` / `LV24_SEO_YANDEX_CLIENT_ID`) and a client secret stored with
`auth set --provider gsc_oauth_secret|yandex_oauth_secret --stdin`. Client secrets never belong in
`seo.toml`.

- **Google Search Console.** `auth login --provider gsc` uses a Desktop-app client, binds
  `127.0.0.1` on an ephemeral port, opens the consent page and exchanges the code with S256 PKCE and
  a random `state`. `--no-browser` prints the URL and waits; `--port 8123` pins the callback; `--code`
  reuses the stored PKCE verifier and needs `--port` or `[auth.gsc].redirect_uri` to repeat the
  redirect exactly. Access token, refresh token and expiry are stored in the keychain and refreshed
  within 60 seconds of expiry.
- **Yandex Webmaster and Metrika.** `auth login --provider yandex|metrika` uses the
  `https://oauth.yandex.ru/verification_code` redirect: approve access, copy the short code, pass it
  with `--code`, or let the interactive prompt read it. One app can carry `webmaster:hostinfo` and
  `metrika:read`, but the engines keep separate token slots. `--url-only` is Yandex-only and returns
  `{provider, flow, authorization_url, scopes, target}` without opening a browser, prompting,
  exchanging a code or writing a token; the desktop shows the URL and completes the grant with a
  second `--code` call.
- **Precedence and fallbacks.** GSC picks an OAuth grant, then the service-account file, then the
  static `gsc_token`. Yandex keeps the static `yandex_webmaster_token` / `yandex_metrika_token` path
  and refreshes when a refresh token and expiry are stored. Bing, IndexNow, CrUX and PSI have no
  OAuth connector by design.
- **Testing-mode caveat.** A Google OAuth app in **Testing** issues refresh tokens that expire after
  7 days, so a daily job stops with `invalid_grant` after a week. Publish the app, re-login weekly or
  use a service account for unattended runs.

### Placeholder client ids

The example ids in this guide (`0123456789abcdef0123456789abcdef`, `1234567890-abc.apps.googleusercontent.com`, `your-*-client-id`) are not registered provider apps. Engine `0.15.1` rejects them with `CONFIG_INVALID` before a consent URL is built, and `yandex_oauth.authorization_url()` enforces the same guard for every caller. Register a real Google Desktop client or Yandex OAuth app and use the id it shows; `auth status` and `doctor` report a placeholder as `oauth_client_missing`. Desktop `0.9.8` disables **Connect** while readiness is `oauth_client_missing`, `oauth_client_secret_missing` or `oauth_redirect_invalid`.

### OAuth readiness diagnostics

`auth status --json` adds an `oauth` object for `gsc`, `yandex` and `metrika` with `state`, `detail`,
`client_id_present`, `client_secret_present`, `access_token_present`, `refresh_token_present`,
`expires_at`, `scopes_recorded`, `next_action` and `limitations`. `doctor --json` adds `gsc_oauth`,
`yandex_oauth` and `metrika_oauth` checks with `id`, `ok`, `detail`, `code` and `next_action`; they
are non-fatal and never print a token. Both surfaces are offline.

| Code | Meaning | Fix |
|---|---|---|
| `oauth_client_missing` | Client id is empty or a documented placeholder | Register an app and set `[auth.gsc].client_id` or `[auth.yandex].client_id` |
| `oauth_client_secret_missing` | Client id is set but the secret is absent | `auth set --provider gsc_oauth_secret\|yandex_oauth_secret --stdin` |
| `oauth_token_missing` | Client id and secret exist, but no access or refresh token | `auth login --provider gsc\|yandex\|metrika` |
| `oauth_token_expired` | Stored expiry is in the past; says whether refresh is available | Run a read command, or log in again when no refresh token exists |
| `oauth_scope_missing` | Recorded scopes do not include the configured scopes | Log in again and grant the scope, or remove it from `[auth.*].scopes` |
| `oauth_scope_unknown` | No scopes were recorded; a warning, never a false pass | Run a login or refresh once |
| `oauth_redirect_invalid` | Google redirect is not loopback, or Yandex is not `verification_code` | Clear `[auth.*].redirect_uri` or set a valid value |
| `oauth_ready` | Client id, secret, token, scopes and redirect check out | Nothing to do |

Precedence is redirect, client id, client secret, token, then scope. Granted scopes are stored in
`gsc_token_scopes`, `yandex_token_scopes` and `yandex_metrika_token_scopes` (in `OAUTH_SECRET_NAMES`,
not the stable `SECRET_NAMES` tuple); `auth logout` deletes them.

`--json` output carries `provider`, `flow`, `scopes`, `expires_at`, `target` and `next`; it never
carries a token. A failed refresh returns `AUTH_INVALID` with the exact `auth login` next action.

GSC can also use a service account. Set `providers.gsc.service_account_file` to an absolute path or
export `LV24_SEO_GSC_SERVICE_ACCOUNT_FILE`; the file wins over a stored `gsc_token`, and the
environment wins over the file. A `gsc_token` that is a service-account JSON object is accepted too.
The engine signs an RS256 JWT, exchanges it at the key's `token_uri` and refreshes it before expiry.
`properties` reports `token_source: oauth_refresh_token|service_account_file|secret|missing`, and
`doctor` adds a non-fatal `gsc_auth` check; neither prints the JSON or the private key.

### Export

```bash
lv24-seo export tools --out schemas/tools.json
lv24-seo export skills --out skills/
```

`export tools` writes the generated MCP registry for non-MCP agents; `export skills` copies the
packaged `SKILL.md` files and their manifest. Both write local files only.

## Related

- [Configuration reference](/reference/config/)
- [Data sources and quotas](/providers/)
- [MCP and agent skills](/mcp/)
- [Troubleshooting](/troubleshooting/)

Source: `_source/engine-cli.md`, `_source/engine-auth.md`, `_source/engine-auth-google.md`, `_source/engine-auth-yandex.md`, `_source/engine-releases-0.15.2.md`, `_source/engine-releases-0.15.1.md`, `_source/engine-releases-0.15.0.md`, `_source/engine-releases-0.14.0.md`, `_source/engine-releases-0.13.1.md`, `_source/engine-releases-0.13.0.md`, `_source/engine-mcp.md`, `_source/engine-releases-0.12.2.md`, `_source/engine-releases-0.12.0.md`, `_source/engine-releases-0.11.0.md`, `_source/engine-releases-0.10.0.md`, `_source/engine-releases-0.9.0.md`, `_source/engine-releases-0.8.0.md`, `_source/engine-releases-0.7.0.md`, `_source/engine-releases-0.6.0.md`, `_source/engine-releases-0.5.3.md`; 0.14.0 `--help` output in the engine repository.
