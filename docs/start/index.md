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

`init` writes `seo.toml` and `data/` in the current directory. `doctor` is offline: it checks Python, the config file, the data directory and token presence, and makes no network calls. `stats` is read-only and returns one bounded envelope for the dashboard: current and previous windows, per-provider status, coverage, data age, truncation and limitations.

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
- Provider credentials for the sources you want: a GSC OAuth access token, Yandex Webmaster OAuth, Yandex Metrika, a Bing Webmaster API key and a CrUX API key. PageSpeed Insights works without a key at a lower quota. All default sources have a free tier.
- Node.js 18 or newer only for the `npx @lv24/seo` launcher. The Python CLI does not need Node.
- Network access to the provider APIs. The tool has no telemetry and sends nothing on its own.
- For the desktop app: Windows 10/11 x64 with WebView2, Linux x64 with glibc 2.35 or newer, or macOS 13 or newer.

GSC uses a manually supplied OAuth access token today; a service-account flow is planned, not shipped. Yandex, Bing and the other adapters also use manually supplied tokens or keys.

## Read-only by default

By default the tool does not change provider state. `stats`, `doctor`, `config show`, `properties`, `gsc query`, `yandex queries`, `yandex indexing` and `report diff` do not write at all. `report weekly` without `--send` only builds and stores a local snapshot; `crawl` writes only to the local SQLite store; `init` writes `seo.toml` and `data/`.

Provider writes are gated. A dry run returns a plan and a `confirm_token`; applying it requires `--allow-write` and a fresh `--confirm <token>` within five minutes, plus `LV24_SEO_WRITE_SECRET` in the environment. IndexNow really submits URLs. GSC sitemap submit and Yandex recrawl currently return `WRITE_DISABLED` instead of pretending the provider path is wired.

The MCP server is read-only by default; its write tools are annotated and gated, and some provider paths still return `WRITE_DISABLED`. The desktop requires a confirmation dialog that names the exact target before it sends a report, installs a scheduler job, installs an MCP client entry or runs a provider write.

## Surfaces

| Surface | What it gives you |
|---|---|
| CLI | Every command supports `--json`, a stable envelope and documented exit codes. |
| MCP | A stdio server with 11 tools, 3 resources and 3 prompts for Claude, OpenCode, Cursor and other clients. |
| Desktop | A Tauri 2 + React shell with a workspace picker, stats dashboard, settings form, configuration outputs, reports, recommendations and signed updates. |
| Automation | cron, systemd timer and Windows Task Scheduler generators, plus SMTP and Telegram delivery. |

The CLI envelope is `{ok, data, meta, warnings}`. `meta.complete` is `false` when inputs are missing, capped or sampled, and `meta.limitations` explains what to read before trusting a number. The same honesty rules apply to MCP payloads and reports.

## Optional desktop

The desktop is a preview at `0.2.1` and bundles `lv24-seo 0.5.1`. It is useful when you do not want to remember flags: choose `seo.toml` in Settings, read the dashboard, edit configuration through a validated form, open the weekly HTML report, and copy a bounded recommendation as a Markdown prompt for an agent. Windows NSIS, macOS `.app` and Linux AppImage can auto-update; portable ZIP, deb and rpm are manual-only.

## Status and limits

The engine is beta `0.5.1`; the desktop is a `0.2.1` preview. Known gaps before 1.0:

- GSC supports a manually supplied OAuth access token today; a service-account flow is planned.
- GSC sitemap submit and Yandex recrawl return `WRITE_DISABLED`; IndexNow really submits.
- `storage.raw_retention_days` is reserved; no raw archives are written yet.
- The desktop has no separate Crawl screen and no job progress or cancel in `0.2.1`.
- `report indexing`, `report opportunities` and `report history` are planned, not shipped.

Unknown values stay unknown instead of being filled in. That is deliberate: a bounded answer with explicit limitations is more useful than a clean-looking number with no coverage.

## Where to go next

- [Install](/install/) — engine, npm launcher, desktop packages, tokens and uninstall.
- [Desktop app](/desktop/) — what the shell adds, update behavior and troubleshooting.
- [CLI reference](/reference/cli/) — commands, envelopes and exit codes.
- [Config reference](/reference/config/) — `seo.toml`, precedence, locale and secrets.
- [Data sources](/providers/) — what each provider can and cannot return.
- [Reports and diffs](/reports/) — weekly reports, delivery and snapshot diffs.
- [Security and privacy](/security/) — token handling, write gates and the desktop trust boundary.

Source: `_source/engine-README.md`, `_source/engine-cli.md`, `_source/desktop-README.md`.
