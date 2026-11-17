---
title: MCP and agent skills
description: Twelve MCP tools, three resources, three prompts, transports, client registration and the shipped agent skills.
---

# MCP and agent skills

The MCP server exposes a small, opinionated surface: 12 tools, 3 resources and 3 prompts. The tool registry is the single source of truth; JSON schemas, CLI help and `schemas/tools.json` are generated from it and must never be edited by hand.

Related: [Reports and diffs](/reports/), [Data sources and quotas](/providers/), [Crawl and audit](/crawl/), [Automation and delivery](/automation/).

## Read-only by default

Read responses that wrap provider rows carry `truncated`, `total` when the provider reports one, `data_age_days` and `limitations[]`. A GSC final page that exactly fills the 50,000-row cap is reported as `truncated: true` with `rows_cap_50000`; a full page is not proof of complete coverage. Read tools take no `format` parameter. Responses are available as text and, when the installed MCP SDK supports it, as `structuredContent`; the text block is the fallback for older clients.

Three tools persist local state and are not advertised as read-only:

| Tool | `kind` | `writes_local_state` | `readOnlyHint` | `destructiveHint` | `idempotentHint` |
|---|---|---|---|---|---|
| `yandex_indexing_state` | read | `true` | `false` | `false` | `false` |
| `seo_crawl_site` | read | `true` | `false` | `false` | `false` |
| `seo_weekly_report` | read | `true` | `false` | `false` | `false` |

They save indexing events, crawl snapshots or weekly snapshots but never mutate provider state and need no confirm token. MCP clients that branch on `readOnlyHint` may ask for confirmation before calling them; that is intentional. The twelve tools break down as 10 read-class tools (7 pure read-only plus these 3 local-state writers) and the 2 gated writes. Both gated writes require `allow_write`, a plan and a confirm token, and the server's `LV24_SEO_WRITE_SECRET`; Bing sitemap submit and Yandex recrawl are wired, while GSC sitemap submit and Bing sitemap delete still return `WRITE_DISABLED`.

The two write tools carry `destructiveHint: true` and are opt-in: `allow_write` defaults to `false` and every call without it returns `WRITE_DISABLED` before a plan is built. They follow the same two-phase contract as the CLI, described below.

## Two-phase writes

A write is a plan followed by an apply, never a single call that guesses.

1. **Plan.** Call the tool with `allow_write=true` and no `confirm_token`. Nothing reaches the provider. The response is `ok: true` with `meta.dry_run: true` and `data.plan`, `data.plan_hash`, `data.confirm_token` and `data.ttl_seconds`.
2. **Apply.** Call the same tool again with the same arguments plus `allow_write=true`, the returned `plan_hash` and `confirm_token`. A `plan_hash` that does not match the current plan fails with `CONFIRM_REQUIRED` before anything is claimed.

The `data` object of a dry run:

```json
{
  "status": "dry_run",
  "plan": {"action": "recrawl", "target": "https:example.com:443", "summary": "queue 2 URL(s) for recrawl on https:example.com:443"},
  "plan_hash": "6f1c…",
  "confirm_token": "1794…:9ab3…",
  "ttl_seconds": 300
}
```

The token is an HMAC over the action, target, full plan hash and expiry, and lives for 300 seconds. Changing the URLs, host, property or action invalidates it. `LV24_SEO_WRITE_SECRET` must be set in the server environment; an empty secret is `WRITE_DISABLED`, never a weak default.

The server passes its workspace store to the write gate, so a replayed token returns `status: skipped` with `reason: duplicate` and the provider is called once. Without a store the apply still runs, but the response warns that replay protection is off for the token's lifetime. A provider failure releases the claim, so a genuine retry is allowed and a failed write is never recorded as sent.

The contract is implemented in the server. `seo_sitemap_submit` with `provider: "bing"` calls the same Bing `SubmitFeed` path as the CLI, and `seo_recrawl_request` calls the same Yandex recrawl path with one POST per URL and a quota cap. GSC sitemap submit and Bing sitemap delete still return `WRITE_DISABLED` even with `allow_write=true` and a secret. IndexNow remains CLI/desktop-only and has no MCP tool. Nothing is simulated.

## Tools

| Tool | Inputs | Returns |
|---|---|---|
| `seo_properties` | None | Configured providers, their target, token presence and `token_source` (`service_account_file`, `secret` or `missing`) |
| `gsc_search_analytics` | `property`, `start_date`, `end_date`, `dimensions`, `limit` 1–500 (default 50) | Query, page, country or device rows with clicks, impressions, CTR and position |
| `yandex_query_stats` | `host_id`, `limit` 1–500, `order_by` `TOTAL_SHOWS` or `TOTAL_CLICKS` | Top queries with shows, clicks, position, `avg_click_position`, `query_id` and `extra_indicators` |
| `yandex_indexing_state` | None beyond the configured host | Indexing history, in-search counts, diagnostics, merged `http_2xx` … `other` series and `site_problems`; persists per-URL events in `indexing_events` (schema v4) when a workspace store exists |
| `seo_crawl_site` | `start_url`, `max_urls` 0 or 1–5000, `include_rules` | Crawl summary, issues, link graph and sitemap coverage |
| `seo_weekly_report` | `days` 1–90, `lag_days` 0–14 | Weekly report sections, including stored CWV rows read through today, plus envelope meta |
| `seo_report_diff` | `base`, `head` as `START..END` | Headline changes, issue counts, opportunity churn, limitations, Markdown |
| `seo_indexing_triage` | `max_examples` 0–20 (default 5), optional `url` | Buckets with reason, count, examples and `next_action`; with `url`, one GSC URL Inspection result in `data.inspection` |
| `seo_opportunities` | `days` 1–90 (default 28), `limit` 1–500, `min_impressions` | Ranked opportunities with evidence and `expected_gain` |
| `seo_log_analysis` | `file` (absolute path), `bot` (`googlebot`, `yandexbot`, `bingbot`, `other` or empty) | Bot rollup and crawl-waste summary for one local nginx JSON access log |
| `seo_recrawl_request` | `host_id` (default: configured host), `urls`, `allow_write` (default `false`), `plan_hash`, `confirm_token` | Two-phase gated write; one Yandex POST per URL, capped to the remaining daily quota; `202` carries `task_id`, `409` is `already_queued`, `429` reports `not_attempted` |
| `seo_sitemap_submit` | `provider` (`gsc` or `bing`, default `gsc`), `property`, `sitemap_url`, `action`, `allow_write` (default `false`), `plan_hash`, `confirm_token` | Two-phase gated write; Bing submit is wired, GSC submit and Bing delete return `WRITE_DISABLED` |

`gsc_search_analytics` defaults to the last seven full days in `report.timezone`. `seo_weekly_report` takes no property argument: the property, timezone and lag defaults come from config. `seo_opportunities` returns `expected_gain`, a prioritisation estimate, never a traffic promise.

The MCP weekly tool caps `days` at 90 and `lag_days` at 14 with a warning; values below the minimum are rejected. The CLI accepts `--days` up to 3660. Use the CLI when a longer lookback is required.

`seo_crawl_site` filters by real rule ids such as `robots-blocked`, `broken-internal-link` or `canonical-mismatch`. There is no `rules` parameter and no `--ignore-robots` flag. The returned issue list is capped at 500 with `meta.issues_shown`, `meta.issues_truncated` and `meta.issues_filtered_by`. A sitemap that fails to load reports only the exception type, never the URL or query string.

`seo_log_analysis` is the twelfth tool and the only one that needs no service, store or workspace. It reads one local nginx JSON access log of at most 100 MiB, returns the same `data`, `meta` and `warnings` as `lv24-seo logs analyze`, and is read-only: the file is opened once and nothing is uploaded or stored. Bot classes are User-Agent only, so the result is triage, not proof of crawl identity.

`yandex_indexing_state` persists provider-reported per-URL events in the `indexing_events` table when a store exists. A replay updates `last_seen` without duplicating, `first_seen` is immutable, `meta.indexing_events` reports `new`, `existing`, `skipped` and `truncated`, and at most 500 provider rows are considered per call. Storage failures become warnings, never a failed provider read. The weekly report reads these events as digest evidence. The same call merges the documented `indexing/history` series (`http_2xx` … `other`) into one row per date, keeps an unknown series under `extra_indicators`, and reports `summary.site_problems`; an omitted counter stays absent rather than becoming `0`.

`seo_sitemap_submit` gained an optional `provider` (`gsc|bing`, default `gsc`) in 0.9.0; the tool name, the 12-tool surface and the rest of its inputs are unchanged. For Bing, `property` defaults to `providers.bing.site` and `sitemap_url` to `<project.base_url>/sitemap.xml`. The plan checks the `bing_api_key` secret and returns `AUTH_REQUIRED` when it is missing, so a token that cannot be applied is never handed out. A replay returns `status: skipped` with `reason: duplicate`, and a provider failure releases the claim. Bing delete and every GSC sitemap write remain `WRITE_DISABLED`. IndexNow from a sitemap is CLI and desktop only.

Engine 0.10.0 adds the `bing` CLI group: `bing submit` (native `SubmitUrlbatch` in 500-URL batches; accepted, never indexed), `bing quota` (daily and monthly values are remaining, not totals), `bing sitemaps` (feed status and URL count, no per-URL errors) and `bing issues` (decoded crawl-issue bitmask, no severity or date). None of them adds an MCP tool: the surface stays at 12, and `seo_sitemap_submit` still submits a sitemap, not a URL batch.

Engine 0.11.0 keeps the 12-tool surface and adds read depth without a thirteenth tool. `seo_indexing_triage` accepts an optional `url` and includes one GSC URL Inspection result in `data.inspection`; without it the tool keeps its existing inputs and the honest limitation that Google URL-level coverage is not exposed. The richer GSC Search Analytics selectors and the `gsc sitemaps`/`gsc sitemap` reads are CLI-only. `seo_recrawl_request` is wired to the Yandex recrawl queue. `schemas/tools.json` is regenerated for the new `url` input.

`cwv collect` is a CLI writer, not a thirteenth tool: the MCP surface stays at 12. `seo_weekly_report` reads whatever field rows the CLI has persisted and adds the `cwv` section grouped by URL template and device, with at most five templates. PSI lab rows are never stored, so `--source psi` alone cannot populate that section.

GSC can authenticate with a service account instead of a pasted OAuth token. Set `providers.gsc.service_account_file` (absolute path) or `LV24_SEO_GSC_SERVICE_ACCOUNT_FILE`; the file wins over a stored `gsc_token`, and the environment wins over the file. The adapter signs an RS256 JWT, exchanges it at the key's `token_uri` and refreshes it before expiry, so a long-lived MCP process survives token expiry. `seo_properties` reports `token_source`, and `doctor` adds a non-fatal `gsc_auth` check; neither prints the JSON or the private key.

## Resources

| URI | Content |
|---|---|
| `seo://config` | Effective config with secrets redacted |
| `seo://report/latest` | Last successful weekly report in this server session, as Markdown |
| `seo://docs/tools` | Generated JSON reference for the twelve tools |

Exactly three resources exist. There is no per-property baseline resource.

## Prompts

| Name | Purpose |
|---|---|
| `weekly_seo_review` | Full pipeline: report, indexing triage, opportunities, top five actions |
| `indexing_triage` | Triage only, output as a verification-first fix plan |
| `content_opportunities` | Opportunities turned into a prioritised content backlog |

The prompts use only numbers returned by the tools, name unavailable sources instead of estimating, and ask for limitations that affect the conclusion.

## Transports

```bash
lv24-seo mcp serve
lv24-seo mcp serve --transport http --port 8765
```

`stdio` is the default: a local process with credentials on the user's machine. `http` means streamable HTTP for a VPS or multi-client setup; the deprecated HTTP+SSE transport is intentionally rejected. The port must be 1–65535 and defaults to 8765.

The sync core runs serially on the event-loop thread. MCP 2 dispatches sync handlers in worker threads, so tools are registered as async owner-loop adapters and concurrent `tools/call` requests are serialized instead of racing in SQLite. The connection deliberately keeps `check_same_thread=True`.

`seo_crawl_site` is the one exception: a crawl of thousands of URLs used to block every other client for minutes. It now runs on a worker thread with its own short-lived store — a `sqlite3` connection belongs to the thread that opened it — under a hard 600-second budget. When the budget expires the client receives a retryable `UPSTREAM_UNAVAILABLE` envelope whose `next_action` suggests a smaller `max_urls`; the worker cannot be killed, so the crawl finishes in the background and closes its own connection while the server keeps serving other tools. Every other tool stays on the owner loop.

## Client registration

```bash
lv24-seo install --client claude --print
lv24-seo install --client opencode
lv24-seo install --client vscode
lv24-seo install --client cursor
```

`install` merges the server entry into the host config instead of replacing the file; `--print` shows the exact JSON and writes nothing.

| Client | Config path |
|---|---|
| Claude | `%APPDATA%\Claude\claude_desktop_config.json` on Windows, `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS, `~/.config/Claude/claude_desktop_config.json` on Linux |
| OpenCode | `~/.config/opencode/opencode.json` |
| Cursor | `~/.cursor/mcp.json` |
| VS Code | `%APPDATA%\Code\User\mcp.json` on Windows, `~/Library/Application Support/Code/User/mcp.json` on macOS, `~/.config/Code/User/mcp.json` on Linux |

The Claude and Cursor fragment uses `mcpServers`; OpenCode uses `mcp` with `type: local` and a command array; VS Code uses `servers` with `type: stdio`. The canonical stdio fragment is:

```json
{
  "mcpServers": {
    "lv24-seo": {
      "command": "uvx",
      "args": ["--from", "lv24-seo", "lv24-seo", "mcp", "serve"]
    }
  }
}
```

## Exporting contracts and skills

```bash
lv24-seo export tools --out schemas/tools.json
lv24-seo export skills --out ./skills
lv24-seo export skills --out ~/.claude/skills
lv24-seo export skills --out .opencode/skills
```

`export tools` writes the generated registry for agents that do not speak MCP and call the CLI with `--json`. `export skills` copies the packaged skills and `manifest.json`; it works from the wheel, not only from a checkout.

The shipped skills are:

| Skill | Trigger | Tools |
|---|---|---|
| `seo-weekly` | "How is SEO?", "Why did traffic drop?", weekly report request | `seo_weekly_report`, `gsc_search_analytics`, `yandex_query_stats`, `seo_opportunities`, `seo_indexing_triage` |
| `seo-indexing-triage` | Pages missing from Google or Yandex, sitemap errors, sudden exclusions | `seo_indexing_triage`, `gsc_search_analytics`, `seo_crawl_site`, `yandex_indexing_state`, `seo_recrawl_request` |
| `seo-technical-audit` | Before a release, after a deploy, after a migration | `seo_crawl_site`, `gsc_search_analytics`, `yandex_indexing_state`, `seo_sitemap_submit` |

A skill is a folder with `SKILL.md` and optional references, scripts and assets. The body follows a fixed structure: when to use and when not, inputs you need, a recipe of ordered tool calls, a decision tree, an output contract, and hard rules. The description is the trigger; it must contain the words a user or a router model would use.

Mirrors such as `.claude/skills/<name>` and `.opencode/skills/<name>` are planned, not shipped. Use `export skills` to install the canonical set.

`manifest.json` stores the schema hash of `schemas/tools.json`. CI fails when a tool is renamed or its inputs change without a skill bump.

## Error contract

```json
{
  "isError": true,
  "code": "QUOTA_EXCEEDED",
  "message": "Yandex recrawl quota is 12/day, 40 requested",
  "next_action": "split the batch or wait until 00:00 MSK",
  "retryable": false
}
```

Codes: `AUTH_REQUIRED`, `AUTH_INVALID`, `PROPERTY_NOT_FOUND`, `QUOTA_EXCEEDED`, `UPSTREAM_UNAVAILABLE`, `TRUNCATED`, `WRITE_DISABLED`, `CONFIRM_REQUIRED`, `INVALID_INPUT`, `CONFIG_INVALID`, `INTERNAL`, `STORE_LOCKED`, `STORE_CORRUPT`, `STORE_UNAVAILABLE`. Errors carry a code and a `next_action`, never a traceback or a token. A `STORE_LOCKED` failure is retryable; `STORE_CORRUPT` names the preserved backup copy in `detail.backup_path`.

## Example agent prompts

- **Weekly review.** Use `seo_weekly_report` for the configured property for the last 7 days, then `seo_indexing_triage` and `seo_opportunities`. Give the top five actions ranked by impact and list every limitation that affects the conclusion.
- **Indexing triage.** Run `seo_indexing_triage`. For each non-empty bucket, report the reason, the exact count, two example URLs and the proposed `next_action`, then say how the fix will be verified.
- **Technical audit.** Crawl up to 500 URLs with `seo_crawl_site` and summarise critical and high issues by rule id. Do not describe an unvisited URL as broken.
- **Write request.** Prepare a recrawl plan for these URLs and show the quota first. Do not write anything until I approve the plan.

Source: `_source/engine-mcp.md`, `_source/engine-skills.md`, `_source/engine-cli.md`, `_source/engine-releases-0.11.0.md`, `_source/engine-releases-0.10.0.md`, `_source/engine-releases-0.9.0.md`, `_source/engine-releases-0.8.0.md`, `_source/engine-releases-0.7.0.md`, `_source/engine-releases-0.6.0.md`, `_source/engine-releases-0.5.3.md`.
