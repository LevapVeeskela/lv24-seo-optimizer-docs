---
title: CLI reference
description: Commands, global flags, the JSON envelope, exit codes and worked examples for the lv24-seo command line.
---

# CLI reference

`lv24-seo` is the command-line surface of the engine. It treats provider data as read-only by
default, prints one machine-readable envelope with `--json`, and changes provider state only through
three explicitly gated write commands. The same executable runs on Windows, macOS and Linux.

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
{ "ok": true, "data": {}, "meta": { "version": "0.5.1", "duration_ms": 812 }, "warnings": [] }
```

A failed command uses the same shape with `ok: false` and an `error` object instead of `data`:

```json
{ "ok": false, "error": { "code": "AUTH_REQUIRED", "message": "Google Search Console token is missing", "retryable": false, "next_action": "lv24-seo auth login --provider gsc" }, "meta": { "version": "0.5.1" }, "warnings": ["gsc: token missing"] }
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
| `5` | Partial result: truncated output. | `TRUNCATED` |

`WRITE_DISABLED` exits `2`, not `4`: a write was refused before any provider call. Exit `5` is
reserved for a successful envelope that is both truncated and marked `meta.strict`; no 0.5.1 flag
sets strict mode, so scripts should treat `5` as a partial result rather than a hard failure.
Branch on the exit code and `error.code`, never on the human-readable text.

### Configuration and flags

- `--config PATH` selects a specific `seo.toml`. The path must exist; a missing file is
  `CONFIG_INVALID`, not a silent fallback.
- Without `--config`, the engine looks for `./seo.toml`, then the platform user config file
  (`%APPDATA%\lv24-seo\config.toml` on Windows, `~/.config/lv24-seo/config.toml` on Linux).
- `LV24_SEO_*` environment variables override values from the file. `.env` files are not loaded
  automatically; export the variables in the shell or the service unit that runs the command.
- `mcp serve` is a long-running server and takes neither `--json` nor `--config`.

The full key list, defaults and secret handling live in the [configuration reference](/reference/config/).

### Read-only by default and the write gate

Only `sitemap submit`, `yandex recrawl` and `indexnow submit` can change provider state. They use a
two-step flow:

1. Run the command without `--confirm`. It returns a dry run with `data.plan`, `data.plan_hash`,
   `data.confirm_token` and `meta.dry_run: true`.
2. Set a long random `LV24_SEO_WRITE_SECRET` in the same shell, then re-run with
   `--allow-write --confirm TOKEN` within five minutes.

The token is an HMAC over the action, target, full plan hash and expiry, so changing any input
invalidates it. The CLI does not attach the idempotency ledger, so treat a token as single-use.
IndexNow actually submits URLs. GSC sitemap submit and Yandex recrawl currently return
`WRITE_DISABLED` instead of pretending the provider call happened.

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
| Google Search Console | `gsc query`, `sitemap submit` | Read-only queries; sitemap submit is a gated write. |
| Yandex Webmaster | `yandex queries`, `yandex indexing`, `yandex recrawl` | Read-only queries; recrawl is a gated write. |
| IndexNow | `indexnow submit` | A gated write that actually submits URLs. |
| Crawl and audit | `crawl` | Provider-independent; stores local pages and issues when a store is configured. |
| Reports | `report weekly`, `report diff` | `weekly` stores a local snapshot; `diff` is read-only. |
| Scheduling | `schedule print`, `schedule install` | `print` renders only; `install` writes host scheduler files. |
| Agents and MCP | `mcp serve`, `install`, `export tools`, `export skills` | Host config, generated files or a local server. |

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
queries per period. `yandex indexing` reports indexing history, in-search counts, diagnostics and
search-URL events for the configured `host_id`.

### Crawl

```bash
lv24-seo crawl --start https://example.com --max-urls 500 --json
```

The crawler respects `robots.txt`, follows same-host links breadth-first, runs every rule and stores
pages and issues when a store is configured. `data.sitemap_coverage` compares the sitemap with what
the crawl saw in six buckets. When it returns `complete: false`, the affected buckets are candidates,
not confirmed findings; `limitations[]` names the truncated input.

### Reports

```bash
lv24-seo report weekly --days 7 --lag-days 2 --out reports/ --json
lv24-seo report diff --markdown
```

`report weekly` builds and stores a snapshot; add `--send` to deliver through the channels enabled in
`seo.toml`. `--out` writes canonical English `report.json` and a locale-rendered `report.html`.
`report diff` compares two stored weekly snapshots, never calls a provider, and needs two runs for
different periods. `--markdown` prints only Markdown on stdout; warnings go to stderr.

### Scheduling

```bash
lv24-seo schedule print --cron "0 6 * * 1" --target systemd --json
lv24-seo schedule install --kind weekly --print
```

`print` renders the artefact without touching the host. `install` writes the cron block, systemd user
units or Task Scheduler XML, and the generated job runs `report weekly --send --json`. Only simple
cron expressions (`M H * * *` and `M H * * DOW`) convert to systemd or Windows schedules.

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

Source: `_source/engine-cli.md`, `_source/engine-mcp.md`, `_source/engine-releases-0.5.1.md`; 0.5.1 `--help` output in the engine repository.
