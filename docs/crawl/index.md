---
title: Crawl and technical audit
description: Run a robots-respecting crawl, discover sitemaps, inspect the link graph and read rule violations without overstating coverage.
---

# Crawl and technical audit

The crawl is the tool's own evidence. It uses a serial `httpx` fetcher over the standard-library HTML parser, respects `robots.txt`, follows same-origin links breadth-first, runs every rule and stores pages and issues in SQLite when a store is configured.

Related: [Data sources and quotas](/providers/), [Reports and diffs](/reports/), [Automation and delivery](/automation/), [MCP and agent skills](/mcp/).

## Run a crawl

```bash
lv24-seo crawl --start https://example.com/ --max-urls 500 --json
```

`--start` defaults to `project.base_url`. `--max-urls` defaults to `[crawl] max_urls` (500) and must be at least 1. The CLI has no separate upper cap; MCP `seo_crawl_site` clamps a request above 5,000 URLs and says so in a warning.

The crawl is serial and polite. `concurrency` in `seo.toml` is reserved for a future worker pool and has no effect today. `Crawl-delay` from `robots.txt` sets the pacing between requests.

The seed and every redirect hop are checked against the start origin (scheme, host and port) and against `robots.txt` before the request is sent. An off-origin or disallowed hop is never requested and is reported as `robots_blocked` with a coverage note. The one exception is `robots.txt` itself, whose redirects are followed as RFC 9309 requires, still under the SSRF policy and the redirect cap.

## Limits and budgets

| Limit | Value |
|---|---|
| Ordinary page body | 5 MB per page |
| Sitemap document body | 50 MB per document |
| URLs per sitemap | 50,000 protocol cap |
| Sitemap documents | 20 per crawl |
| Sitemap index depth | 2 |
| Redirects per request | 5 |
| Request budget | `1 + max_urls × (max_redirects + 1)` |
| Retained page text | 20,000 characters |
| MCP issue list | 500 issues per response |

The request budget is reported as `summary.request_count` and `summary.request_budget`. When it is exhausted, the crawl stops with a note instead of silently spending more requests. For 500 URLs and 5 redirects the budget is 3,001 requests.

Retained page text is capped at 20,000 characters, but `word_count` is computed from the full visible text and stays exact. The cap is a retention bound, not a parsing bound: link extraction, JSON-LD, hreflang and word counting still use the full document. No current rule reads the retained text.

## robots.txt and SSRF

`robots.txt` follows RFC 9309 longest-match semantics: the most specific rule wins, and `Allow` wins a tie. A 5xx or network failure defers the crawl instead of failing open. A missing `robots.txt` is not an error.

Loopback, private and link-local addresses are refused by default, and DNS is re-resolved on every redirect hop so a host cannot rebind into the private network. A local audit must opt in explicitly with `allow_private` in the fetcher; there is no default that quietly permits private targets.

## Sitemap discovery

Discovery starts from `Sitemap:` lines in `robots.txt` plus the standard `/sitemap.xml`. A missing standard sitemap is normal and is not reported as an error. Every candidate, index child and sitemap redirect must stay on the start origin; an off-origin target is skipped and noted.

Sitemap documents get the 50 MB body budget and the 50,000-URL protocol cap. A sitemap index may read up to 20 documents to depth 2. Sitemap-only URLs are added to the crawl frontier, so a crawl can start from a sitemap even when the home page links to little.

## Sitemap coverage

`crawl` returns `data.sitemap_coverage`: what the site advertises compared with what the crawl actually saw. Six buckets:

| Bucket | Meaning |
|---|---|
| `unlinked` | In the sitemap, fetched OK, but no crawled page links to it |
| `missing_from_sitemap` | Crawled, 200, indexable HTML that the sitemap omits |
| `not_ok` | In the sitemap but answered non-200 or redirected |
| `noindex` | In the sitemap but marked `noindex` |
| `blocked` | In the sitemap but outside crawl scope (robots or another origin) |
| `unvisited` | In the sitemap but never fetched; status unknown, not broken |

`counts` are exact. Each `buckets` list is capped at 50 URLs. `complete` is false and `limitations[]` names the buckets that are only candidates when the crawl or sitemap inventory was truncated, a sitemap failed to load, or URLs went unvisited. With no sitemap at all, the diff is empty and says "empty, not clean" instead of flagging every page as missing.

A network failure during a fetch lands in `unvisited`, not in `blocked` and not in `not_ok`: no status was observed, so the URL's state is unknown.

## Link graph

`data.graph` is a deterministic summary of the internal link graph:

- `nodes` — pages fetched successfully with status 200.
- `edges` — unique normalized internal source-to-target pairs, excluding self-links.
- `orphans` — nodes with no inbound links and no path from the start URL.
- `broken` — internal targets that were fetched and answered 4xx/5xx.
- `failed` — internal targets that were requested but produced no status.
- `unvisited` — internal targets that were never fetched, for example because the URL budget ran out.

`unvisited` is unknown, never broken. A redirect that lands on a healthy page is a node, not a finding. `/a` and `/a/` stay distinct until a fetch proves otherwise, so the graph never merges them before an HTTP check.

## Rules

Rules are pure functions of the crawl context: no network, no clock, no filesystem. Each module lives in `crawl/rules/rule_<slug>.py` and exposes a `RULE` object; discovery is automatic. The runner stamps the rule id and severity, so a buggy rule cannot mislabel its own findings.

| Severity | Rule ids |
|---|---|
| `critical` | `noindex-on-200`, `robots-blocked`, `server-error`, `sitemap-url-noindex` |
| `high` | `broken-internal-link`, `canonical-mismatch`, `client-error`, `hreflang-not-reciprocal`, `hreflang-target-not-ok`, `jsonld-event-required`, `jsonld-required`, `mixed-content`, `redirect-chain`, `sitemap-url-not-ok`, `soft-404`, `title-duplicate`, `title-missing` |
| `medium` | `canonical-missing`, `h1-missing`, `hreflang-missing-x-default`, `html-lang-missing`, `html-lang-mismatch`, `image-alt-missing`, `meta-description-duplicate`, `meta-description-missing`, `thin-content` |
| `low` | `jsonld-organization-duplicate`, `h1-multiple`, `jsonld-organization`, `title-length` |

Two heuristics are worth knowing:

- `thin-content` flags article-like URLs with fewer than 200 words, unless the page has more than 20 internal links and looks like a listing page.
- `soft-404` flags a 200 page whose title contains "not found", "404" or the Russian "не найдена", or a non-root HTML page with fewer than 30 words.

Rules report what the crawl observed. They do not claim that an unvisited URL is broken, and they do not replace a manual review of business intent.

## Stored pages and issues

`lv24-seo init` creates the data directory. When it exists, `crawl` opens `data/seo.sqlite3` and stores pages and issues under the crawl property id. The weekly report reads the latest stored issues for its issues section; a crawl without a store still returns the full JSON payload but persists nothing.

The CLI prints a short human summary without `--json`. With `--json`, the envelope contains `summary`, `issues`, `graph`, `errors`, `blocked` and `sitemap_coverage`. MCP `seo_crawl_site` filters issues by `include_rules`, caps the returned list at 500 and reports `issues_shown`, `issues_truncated` and `issues_filtered_by` in `meta`.

Source: `_source/engine-data-sources.md`, `_source/engine-cli.md`, `_source/engine-releases-0.5.1.md`.
