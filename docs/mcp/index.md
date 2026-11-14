---
title: MCP and agent skills
description: Eleven MCP tools, three resources, three prompts, transports, client registration and the shipped agent skills.
---

# MCP and agent skills

The MCP server exposes a small, opinionated surface: 11 tools, 3 resources and 3 prompts. The tool registry is the single source of truth; JSON schemas, CLI help and `schemas/tools.json` are generated from it and must never be edited by hand.

Related: [Reports and diffs](/reports/), [Data sources and quotas](/providers/), [Crawl and audit](/crawl/), [Automation and delivery](/automation/).

## Read-only by default

Read responses that wrap provider rows carry `truncated`, `total` when the provider reports one, `data_age_days` and `limitations[]`. A GSC final page that exactly fills the 50,000-row cap is reported as `truncated: true` with `rows_cap_50000`; a full page is not proof of complete coverage. Read tools take no `format` parameter. Responses are available as text and, when the installed MCP SDK supports it, as `structuredContent`; the text block is the fallback for older clients.

Two tools persist local state and are no longer advertised as read-only:

| Tool | `kind` | `writes_local_state` | `readOnlyHint` | `destructiveHint` | `idempotentHint` |
|---|---|---|---|---|---|
| `seo_crawl_site` | read | `true` | `false` | `false` | `false` |
| `seo_weekly_report` | read | `true` | `false` | `false` | `false` |

They save crawl or weekly snapshots but never mutate provider state and need no confirm token. MCP clients that branch on `readOnlyHint` may ask for confirmation before calling them; that is intentional.

The two write tools carry `destructiveHint: true` and require `allow_write=true`. In 0.5.2 their provider handlers are not wired, so they return `WRITE_DISABLED` instead of pretending. The CLI write path has the additional dry-run and HMAC confirm-token flow described in [Automation and delivery](/automation/).

## Tools

| Tool | Inputs | Returns |
|---|---|---|
| `seo_properties` | None | Configured providers, their target and token presence |
| `gsc_search_analytics` | `property`, `start_date`, `end_date`, `dimensions`, `limit` 1–500 (default 50) | Query, page, country or device rows with clicks, impressions, CTR and position |
| `yandex_query_stats` | `host_id`, `limit` 1–500, `order_by` `TOTAL_SHOWS` or `TOTAL_CLICKS` | Top queries with shows, clicks and position |
| `yandex_indexing_state` | None beyond the configured host | Indexing history, in-search counts and diagnostics |
| `seo_crawl_site` | `start_url`, `max_urls` 0 or 1–5000, `include_rules` | Crawl summary, issues, link graph and sitemap coverage |
| `seo_weekly_report` | `days` 1–90, `lag_days` 0–14 | Weekly report sections plus envelope meta |
| `seo_report_diff` | `base`, `head` as `START..END` | Headline changes, issue counts, opportunity churn, limitations, Markdown |
| `seo_indexing_triage` | None | Buckets with reason, count, examples and `next_action` |
| `seo_opportunities` | `days` 1–90 (default 28), `limit` 1–500, `min_impressions` | Ranked opportunities with evidence and `expected_gain` |
| `seo_recrawl_request` | `host_id`, `urls`, `allow_write` | Gated; returns `WRITE_DISABLED` in 0.5.2 |
| `seo_sitemap_submit` | `property`, `sitemap_url`, `action`, `allow_write` | Gated; returns `WRITE_DISABLED` in 0.5.2 |

`gsc_search_analytics` defaults to the last seven full days in `report.timezone`. `seo_weekly_report` takes no property argument: the property, timezone and lag defaults come from config. `seo_opportunities` returns `expected_gain`, a prioritisation estimate, never a traffic promise.

The MCP weekly tool caps `days` at 90 and `lag_days` at 14 with a warning; values below the minimum are rejected. The CLI accepts `--days` up to 3660. Use the CLI when a longer lookback is required.

`seo_crawl_site` filters by real rule ids such as `robots-blocked`, `broken-internal-link` or `canonical-mismatch`. There is no `rules` parameter and no `--ignore-robots` flag. The returned issue list is capped at 500 with `meta.issues_shown`, `meta.issues_truncated` and `meta.issues_filtered_by`. A sitemap that fails to load reports only the exception type, never the URL or query string.

## Resources

| URI | Content |
|---|---|
| `seo://config` | Effective config with secrets redacted |
| `seo://report/latest` | Last successful weekly report in this server session, as Markdown |
| `seo://docs/tools` | Generated JSON reference for the eleven tools |

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

Codes: `AUTH_REQUIRED`, `AUTH_INVALID`, `PROPERTY_NOT_FOUND`, `QUOTA_EXCEEDED`, `UPSTREAM_UNAVAILABLE`, `TRUNCATED`, `WRITE_DISABLED`, `CONFIRM_REQUIRED`, `INVALID_INPUT`. Errors carry a code and a `next_action`, never a traceback or a token.

## Example agent prompts

- **Weekly review.** Use `seo_weekly_report` for the configured property for the last 7 days, then `seo_indexing_triage` and `seo_opportunities`. Give the top five actions ranked by impact and list every limitation that affects the conclusion.
- **Indexing triage.** Run `seo_indexing_triage`. For each non-empty bucket, report the reason, the exact count, two example URLs and the proposed `next_action`, then say how the fix will be verified.
- **Technical audit.** Crawl up to 500 URLs with `seo_crawl_site` and summarise critical and high issues by rule id. Do not describe an unvisited URL as broken.
- **Write request.** Prepare a recrawl plan for these URLs and show the quota first. Do not write anything until I approve the plan.

Source: `_source/engine-mcp.md`, `_source/engine-skills.md`, `_source/engine-cli.md`, `_source/engine-releases-0.5.2.md`.
