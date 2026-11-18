---
title: Quickstart
description: What LV24 SEO Optimizer is and the five-minute path from install to a first stats snapshot.
---

# Quickstart

LV24 SEO Optimizer is a free-first SEO control plane for humans and AI agents. It pulls Google Search Console, Yandex Webmaster, Yandex Metrika, Bing/IndexNow, Chrome UX Report and PageSpeed Insights into one normalized history, adds a bounded technical crawl of your own site, and turns the result into weekly reports, CLI commands, MCP tools and agent skills.

The Python package `lv24-seo` is the engine of record. The desktop app is a Tauri shell around the same engine; it does not reimplement SEO logic or provider clients. There is no paid platform in the default path, no SERP scraping and no vendor account.

## Five-minute path

Install the engine:

```bash
uv tool install lv24-seo
```

Create a workspace, check the machine and read a first snapshot:

```bash
lv24-seo init --property https://example.com
lv24-seo doctor
lv24-seo stats --days 7 --json
```

`init` writes `seo.toml` and creates `<config dir>/data`; a relative `data_dir` is anchored to the config file. `doctor` is offline: it checks Python, the config file, the effective data directory and its scope, working-directory writability and token presence, and makes no network calls. `stats` is read-only and returns one bounded envelope for the dashboard: current and previous windows, per-provider status, coverage, data age, truncation and limitations.

A `stats` envelope carries `period`, `previous_period`, `generated_at`, a `services` array and a `coverage` summary. Each service card has `provider`, `label`, `configured`, `ready`, `status`, `metrics`, `previous`, `rows`, `data_age_days`, `truncated`, `limitations`, `warnings` and `error`. `status` is one of `ok`, `no_data`, `missing_token`, `not_configured` or `error`.

`coverage.complete` is true only when every configured service is `ok`, has rows, is not truncated, and none is missing or failed. `previous` exists only for comparable current/previous windows (GSC, Yandex Webmaster and Metrika); Bing, CrUX and PSI return `null`. Metrics carry only reported values: no zero fill and no cross-engine totals.

Add a provider token when you are ready:

```bash
lv24-seo auth login --provider gsc
lv24-seo auth set --provider gsc --stdin
```

`auth set` reads the secret from stdin or a hidden prompt, never from argv. OS-keychain storage needs the optional `secrets` extra; install with `uv tool install "lv24-seo[secrets]"` or use environment variables instead. A token's presence is not proof that it is valid or has the right permissions.

## Prerequisites

- Python 3.11 or newer. `uv` can provide the interpreter, so a system Python is not required.
- Provider credentials for the sources you want: a GSC OAuth client (or service account), Yandex Webmaster/Metrika OAuth, a Bing Webmaster API key and a CrUX API key. PageSpeed Insights works without a key at a lower quota. All default sources have a free tier.
- Node.js 18 or newer only for the `npx @lv24/seo` launcher. The Python CLI does not need Node.
- Network access to the provider APIs. The tool has no telemetry and sends nothing on its own.
- For the desktop app: Windows 10/11 x64 with WebView2, Linux x64 with glibc 2.35 or newer, or macOS 13 or newer.

GSC, Yandex Webmaster and Yandex Metrika can use the OAuth connector (`auth login`), and GSC also accepts a service account (`providers.gsc.service_account_file` / `LV24_SEO_GSC_SERVICE_ACCOUNT_FILE`); a plain token keeps working. Bing, IndexNow, CrUX and PSI use API keys because those providers have no OAuth flow.

## Read-only by default

By default the tool does not change provider state. `stats`, `doctor`, `config show`, `properties`, `gsc query`, `yandex queries`, `yandex indexing`, `bing quota`, `bing sitemaps`, `bing issues` and `report diff` do not write at all. `report weekly` without `--send` only builds and stores a local snapshot; `crawl` writes only to the local SQLite store; `init` writes `seo.toml` and `data/`.

Provider writes are gated. A plan requires `--allow-write` and `LV24_SEO_WRITE_SECRET` and returns the plan and a `confirm_token` without contacting the provider; applying it requires a fresh `--confirm <token>` within five minutes. With an initialised workspace the apply uses the SQLite idempotency ledger, so replaying the same token returns `skipped` / `duplicate` and the provider is called once. Without a data directory the apply still runs, but the envelope warns that replay protection is off for the token's five-minute lifetime. Bing sitemap submit, Bing URL submission, IndexNow and Yandex recrawl really write; GSC sitemap submit and Bing sitemap delete return `WRITE_DISABLED` instead of pretending the provider path is wired.

The MCP server is read-only by default; its write tools are annotated and gated, and some provider paths still return `WRITE_DISABLED`. The desktop requires a confirmation dialog that names the exact target before it sends a report, installs a scheduler job, installs an MCP client entry or runs a provider write.

## Surfaces

| Surface | What it gives you |
|---|---|
| CLI | Every command supports `--json`, a stable envelope and documented exit codes. |
| MCP | A stdio server with 12 tools, 3 resources and 3 prompts for Claude, OpenCode, Cursor and other clients. |
| Desktop | A Tauri 2 + React shell with a workspace picker, stats dashboard, settings form, configuration outputs, reports, recommendations and signed updates. |
| Automation | cron, systemd timer and Windows Task Scheduler generators, plus SMTP and Telegram delivery. |

The CLI envelope is `{ok, data, meta, warnings}`. `meta.complete` is `false` when inputs are missing, capped or sampled, and `meta.limitations` explains what to read before trusting a number. The same honesty rules apply to MCP payloads and reports.

## Optional desktop

The desktop is at `0.9.6` and bundles `lv24-seo 0.15.1`; it requires engine `0.15.1` or newer, so an installed `0.15.0` engine is incompatible. It is useful when you do not want to remember flags: create or choose a `seo.toml` in the app, connect GSC, Yandex Webmaster or Metrika with the OAuth Connect card, read the dashboard, edit configuration through a validated form, run a bounded crawl, analyse an nginx log, triage tasks, create or restore a portable backup, scan a folder of sites in the portfolio, compare and export weekly reports with the attributed digest and CWV card, read GSC inspection/sitemaps, Yandex events/sitemaps/queue, Bing pages/traffic/crawl/URL/joins, organic Metrika pages/goals/dimensions and CWV audits/history in the read-only Diagnostics screen, submit Bing URLs or a sitemap, read Bing quota, sitemap feeds and crawl issues, run IndexNow, open the official Bing Site Scan page, and copy a bounded recommendation as a Markdown prompt for an agent. Indexing automation is CLI and scheduler only; the `0.9.6` card renders the same status, history and schedule data read-only. Long engine jobs run in the background with a window-wide banner and a **Cancel** button; provider writes are not cancellable. Windows NSIS, macOS `.app` and Linux AppImage can auto-update; portable ZIP, deb and rpm are manual-only. The updater stops only the sidecar PIDs it started and blocks with `UPDATE_ENGINE_BUSY` if one cannot be stopped.

## Status and limits

The engine is `0.15.1`; the desktop is `0.9.6`. Known gaps before 1.0:

- GSC, Yandex Webmaster and Metrika can use OAuth connectors; GSC keeps the service-account fallback, and a Google app in Testing expires refresh tokens after 7 days. A static token is still accepted but is not refreshed.
- GSC sitemap submit and Bing sitemap delete return `WRITE_DISABLED`; Bing sitemap submit, Bing URL submission, IndexNow, Yandex recrawl and `indexing run --allow-write` really write and need their provider keys or quota.
- Only GSC exposes a per-URL index verdict. Bing, Yandex and IndexNow report `indexed_total: null` with `no_per_url_index_count`, and the GSC sitemap `indexed` aggregate is deprecated.
- A scheduled indexing apply needs `[indexing] enabled=true` and `LV24_SEO_WRITE_SECRET` in the scheduler environment; the generated command never contains the secret.
- Bing URL submission reports `accepted`, never indexed; quota values are remaining, not totals, and the monthly window can bind first. `bing sitemaps` has no per-URL errors and `bing issues` has no severity or date.
- Bing stats and joins return `no_rows_for_window` rather than zero impressions, and URL Inspection is one URL per call, not a live test.
- The desktop opens the official Bing Site Scan page but does not start, monitor or import a scan.
- `storage.raw_retention_days` is reserved; no raw archives are written yet.
- The desktop has crawl, logs, tasks, backup, restore, schedule install, portfolio, Bing indexing and read-only Diagnostics screens. Long engine calls run in the background with a window-wide banner and a **Cancel** button, but cancel is not rollback and there is no job queue; provider writes are not cancellable.
- `cwv collect`, `backup restore --to` and `schedule status`/`uninstall` are CLI-only; the desktop renders stored CWV rows, plans in-place restores and installs scheduler jobs after confirmation.
- `report indexing`, `report opportunities` and `report history` are planned, not shipped.
- Logging is opt-in: set `LV24_SEO_LOG_LEVEL` to install the redacting handler in the CLI and `mcp serve`. The `--json` envelope remains the stable diagnostic interface.

Unknown values stay unknown instead of being filled in. That is deliberate: a bounded answer with explicit limitations is more useful than a clean-looking number with no coverage.

## Where to go next

- [Install](/install/) — engine, npm launcher, desktop packages, tokens and uninstall.
- [Desktop app](/desktop/) — what the shell adds, update behavior and troubleshooting.
- [CLI reference](/reference/cli/) — commands, envelopes and exit codes.
- [Config reference](/reference/config/) — `seo.toml`, precedence, locale and secrets.
- [Data sources](/providers/) — what each provider can and cannot return.
- [Reports and diffs](/reports/) — weekly reports, delivery and snapshot diffs.
- [Security and privacy](/security/) — token handling, write gates and the desktop trust boundary.

Source: `_source/engine-README.md`, `_source/engine-cli.md`, `_source/engine-auth.md`, `_source/engine-releases-0.15.1.md`, `_source/engine-releases-0.15.0.md`, `_source/engine-releases-0.14.1.md`, `_source/engine-releases-0.14.0.md`, `_source/engine-releases-0.13.1.md`, `_source/engine-releases-0.13.0.md`, `_source/engine-releases-0.12.2.md`, `_source/engine-releases-0.12.0.md`, `_source/engine-releases-0.11.0.md`, `_source/desktop-README.md`, `_source/desktop-releases-0.9.6.md`, `_source/desktop-releases-0.9.5.md`, `_source/desktop-releases-0.9.4.md`, `_source/desktop-releases-0.9.3.md`, `_source/desktop-releases-0.9.1.md`.
