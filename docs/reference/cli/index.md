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
{ "ok": true, "data": {}, "meta": { "version": "0.10.0", "duration_ms": 812 }, "warnings": [] }
```

A failed command uses the same shape with `ok: false` and an `error` object instead of `data`:

```json
{ "ok": false, "error": { "code": "AUTH_REQUIRED", "message": "Google Search Console token is missing", "retryable": false, "next_action": "lv24-seo auth login --provider gsc" }, "meta": { "version": "0.10.0" }, "warnings": ["gsc: token missing"] }
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

`--strict` turns truncation into a CI gate. It is available on `stats`, `gsc query`, `yandex queries`, `yandex indexing`, `crawl`, `report weekly` and `report diff`:

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

Only `sitemap submit`, `bing submit`, `yandex recrawl` and `indexnow submit` can change provider state. They use a
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

Bing sitemap submit, Bing URL submission and IndexNow actually write. Bing URL submission reports
`accepted`, never indexed, because `SubmitUrlbatch` has no per-URL status. GSC sitemap submit, Bing
sitemap delete and Yandex recrawl return `WRITE_DISABLED` instead of pretending the provider call happened.

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
| Authentication | `auth status`, `auth set`, `auth login`, `auth logout` | The local secret store; `login` only prints instructions. |
| Configuration | `config show` | The effective config, with credentials redacted. |
| Google Search Console | `gsc query` | Read-only search analytics. |
| Sitemap | `sitemap submit` | Gated write; Bing `SubmitFeed` is wired, GSC submit still returns `WRITE_DISABLED`. |
| Yandex Webmaster | `yandex queries`, `yandex indexing`, `yandex recrawl` | Read-only queries; recrawl is a gated write. `queries` keeps `avg_click_position`, `query_id` and `extra_indicators`; `indexing` merges the history series and reports `site_problems`. |
| IndexNow | `indexnow submit` | A gated write that submits explicit URLs or URLs read from the project sitemap. |
| Bing | `bing submit`, `bing sitemaps`, `bing issues`, `bing quota` | `submit` is a gated `SubmitUrlbatch` write; the other three read quota, sitemap feeds and crawl issues. |
| Crawl and audit | `crawl` | Provider-independent; stores local pages and issues when a store is configured. |
| CWV | `cwv collect` | Queries CrUX per URL and device and persists field p75 rows; PSI lab rows are returned but never stored. |
| Reports | `report weekly`, `report diff` | `weekly` stores a local snapshot; `diff` is read-only. |
| Scheduling | `schedule print`, `schedule install`, `schedule status`, `schedule uninstall` | `print` renders only; `install` and `uninstall` plan by default and write only with `--allow-write`; `status` is read-only. |
| Logs | `logs analyze` | Reads one local nginx JSON access log; never stores or uploads it. |
| Tasks | `tasks list`, `tasks add`, `tasks update` | The workspace task ledger; `add` is idempotent and `update` follows the allowed transitions. |
| Backup | `backup create`, `backup restore` | `create` writes one portable workspace archive; `restore` plans an in-place replacement or extracts into a new directory with `--to`. |
| Portfolio | `portfolio list` | Read-only rollup of local projects below one folder; no provider call, no token read, no write. |
| Agents and MCP | `mcp serve`, `install`, `export tools`, `export skills` | Host config, generated files or a local server. |

The CLI has 23 top-level commands: 16 groups and 7 commands (`version`, `doctor`, `init`, `properties`, `stats`, `crawl`, `install`).

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
```

`--start` and `--end` are required. There is no `--days` shorthand and no `--property` override: the
property comes from `[providers.gsc]` in `seo.toml`. Dimensions are comma-separated and limited to
`query`, `page`, `country`, `device` and `date`.

### Yandex

```bash
lv24-seo yandex queries --limit 100 --json
lv24-seo yandex indexing --json
```

`yandex queries` returns top rows, not a full query-by-page join: Yandex exposes at most 3,000
queries per period. It keeps `avg_click_position`, returns `query_id` when the provider sends it and
preserves an unmapped indicator under `extra_indicators` instead of dropping the row. `yandex indexing`
reports indexing history, in-search counts, diagnostics, `site_problems` and search-URL events for the
configured `host_id`, and merges the `indexing/history` series (`http_2xx` … `other`) into one row per
date.

### Bing and IndexNow

```bash
lv24-seo sitemap submit --provider bing --allow-write --json
lv24-seo sitemap submit --provider bing --allow-write --confirm TOKEN --json
lv24-seo bing submit --url https://example.com/page --allow-write --json
lv24-seo bing submit --url https://example.com/page --allow-write --confirm TOKEN --json
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
no severity or date. `indexnow submit --from-sitemap` reads the sitemap during the plan and resolves
host, key and key location from `providers.bing.site`, `providers.bing.indexnow_key` and
`providers.bing.indexnow_key_location`. A `<sitemapindex>` is bounded to the root plus five child
sitemaps and 10,000 URLs; explicit `--url` values are merged first and off-host URLs are skipped. The
apply re-fetches the sitemap and invalidates the token with `CONFIRM_REQUIRED` if the URL set changed.
A missing key is `AUTH_REQUIRED` at plan time, and a missing or mismatched key file is `INVALID_INPUT`
on apply.

### Core Web Vitals

```bash
lv24-seo cwv collect --url https://example.com/ --url https://example.com/blog/post --device phone --source crux --json
```

`cwv collect` is the writer behind the weekly `cwv` section. CrUX is queried per URL and device
(`mobile` is an alias for `phone`) and each returned p75 becomes one `metric_daily` field row with
`source=crux`, `scope`, the absolute URL, the metric and the fetch date in `report.timezone`. PSI rows
stay in `data.lab` and are never persisted, and PSI has no `tablet`, so `tablet` is skipped as
`psi_tablet_unsupported`. `--limit` caps URLs at 50 (default 10); a low-traffic URL writes no row, never
a zero, and a capped run sets `meta.truncated: true` with `cwv_url_cap`. The command needs a CrUX key
(`AUTH_REQUIRED` before any call) and an initialised store (`CONFIG_INVALID`).

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
lv24-seo schedule print --cron "0 6 * * 1" --target systemd --json
lv24-seo schedule install --kind weekly --json
lv24-seo schedule install --kind weekly --allow-write --json
lv24-seo schedule status --json
lv24-seo schedule uninstall --kind weekly --allow-write --json
```

`print` renders the artefact without touching the host. `install` is plan-only by default: it prints the
cron block, systemd user units or Task Scheduler XML plus the command it would run, with `dry_run: true`
and `installed: false`, and writes only with `--allow-write` (`--print` stays an alias for the plan and
wins over `--allow-write`). `status` is read-only and reports `installed`, `outdated`, `partial`,
`missing` or `unknown` with per-artefact `exists`/`matches`. `uninstall` is plan-only by default and
removes exactly the generated artefacts with `--allow-write`; unrelated cron lines and tasks are never
touched. The generated job runs `report weekly --send --json`. Only simple cron expressions
(`M H * * *` and `M H * * DOW`) convert to systemd or Windows schedules.

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
```

`auth set` reads the secret from stdin or a hidden prompt and stores it in the OS keychain, or in the
opt-in `0600` file fallback. It prints only `{provider, stored, source}`. `auth status` reports
presence and source (`env`, `keyring`, `file`, `missing`), never a value.

GSC can also use a service account. Set `providers.gsc.service_account_file` to an absolute path or
export `LV24_SEO_GSC_SERVICE_ACCOUNT_FILE`; the file wins over a stored `gsc_token`, and the
environment wins over the file. A `gsc_token` that is a service-account JSON object is accepted too.
The engine signs an RS256 JWT, exchanges it at the key's `token_uri` and refreshes it before expiry.
`properties` reports `token_source: service_account_file|secret|missing`, and `doctor` adds a
non-fatal `gsc_auth` check; neither prints the JSON or the private key.

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

Source: `_source/engine-cli.md`, `_source/engine-mcp.md`, `_source/engine-releases-0.5.2.md`, `_source/engine-releases-0.5.3.md`, `_source/engine-releases-0.6.0.md`, `_source/engine-releases-0.7.0.md`, `_source/engine-releases-0.8.0.md`, `_source/engine-releases-0.9.0.md`, `_source/engine-releases-0.10.0.md`; 0.10.0 `--help` output in the engine repository.
