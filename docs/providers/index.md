---
title: Data sources and quotas
description: Provider capability matrix, authentication, quotas, data lag, truncation and limitations for LV24 SEO Optimizer.
---

# Data sources and quotas

Every number the tool prints comes from a provider API or the built-in crawl. Each source has hard limits, and the tool reports those limits instead of pretending the data is complete. The default path uses free tiers only; no paid provider is required.

Related: [Reports and diffs](/reports/), [Crawl and audit](/crawl/), [Automation and delivery](/automation/), [MCP and agent skills](/mcp/).

## Capability matrix

| Source | Read | Write (gated) | Authentication | Free quota | Data lag |
|---|---|---|---|---|---|
| Google Search Console | Search analytics with type/filter/data-state selectors, sites, sitemaps, URL Inspection | Sitemap submit; disabled (`WRITE_DISABLED`, needs the full `webmasters` scope) | OAuth connector (Desktop app, loopback + PKCE), a service-account JSON key or a static bearer token | 1,200 QPM per site and per user; 50,000 rows/day/site/type; URL Inspection 2,000/day, 600/min | 2–3 days; `data_age_days` floors at 3 |
| Yandex Webmaster | Summary, SQI history, indexing, search URLs and events, samples, sitemaps, query history, recrawl queue, queries, diagnostics, broken links | Recrawl queue (gated; one POST per URL, capped to the remaining daily quota) | OAuth connector (`verification_code` + refresh) or a static OAuth token, scope `webmaster:hostinfo` | Free; no published global RPD/RPS; query analytics is fragile above roughly 10k requests/hour | About 4 days |
| Yandex Metrika | Organic and all-traffic sessions/users; organic pages, search phrases, devices, countries, engagement, goals and bytime | None | OAuth connector (`verification_code` + refresh) or a static OAuth token, scope `metrika:read` | 5,000 requests/day/user; 30 rps/IP; 3 parallel; `/stat/v1/data` 200 requests per 5 minutes; up to 100k rows, 20 metrics and 10 dimensions per request | Reporting API; sampling is reported |
| Bing Webmaster | Query/page stats, daily traffic, six-month crawl stats, query/page joins, URL and children details, site roles, account sites, crawl issues, quota, sitemap feeds | Sitemap submit, URL submission, IndexNow and quota-aware indexing (all gated) | One API key per user | Free; remaining daily/monthly submission quota is reported by `GetUrlSubmissionQuota`; 500 URLs per batch | Age comes from the newest dated row; empty stats are `no_rows_for_window` |
| Chrome UX Report (CrUX) | Field p75 LCP, INP, CLS and other metrics; weekly p75 history; collection period | None | API key | 150 QPM per project, cannot be raised | 28-day rolling window; `data_age_days` from `collectionPeriod.lastDate` |
| PageSpeed Insights (PSI) | Lighthouse lab category scores and up to 100 bounded audits per URL | None | API key optional; keyless works with a lower quota | About 25k requests/day | Live lab run |
| GA4 (optional) | Organic landing pages, sessions, key events | None | Google Analytics Data API credentials | Provider quota applies | Directional; thresholding can hide rows |
| Own crawl | Pages, issues, link graph, sitemap coverage | None | None | Local | Current run |
| Logs | User-agent bot triage for nginx JSON access logs; not proof of a verified crawler | None | Local file | Local | Log window |

GA4 is an optional integration point, not part of the default path. The shipped providers are GSC, Yandex Webmaster, Yandex Metrika, Bing, CrUX and PSI. Paid SERP or backlink adapters (DataForSEO, SerpApi and others) are planned or documented only; none ships in 0.14.0.

## Authentication

```bash
lv24-seo auth status --json
lv24-seo auth set --provider gsc --stdin
lv24-seo auth set --provider gsc_oauth_secret --stdin
lv24-seo auth login --provider gsc
lv24-seo auth login --provider yandex --url-only --json
lv24-seo auth logout --provider gsc
```

`auth set` accepts `gsc`, `yandex`, `metrika`, `bing`, `crux`, `psi`, `smtp`, `telegram`, `gsc_oauth_secret` and `yandex_oauth_secret`. It reads the secret from stdin or a hidden prompt, stores it in the OS keychain, and prints only `{provider, stored, source}`. The value is never echoed, logged or written to `seo.toml`. If neither the keychain nor the file fallback is available, it fails with `WRITE_DISABLED`.

| Provider | Environment variable |
|---|---|
| GSC | `LV24_SEO_GSC_TOKEN` |
| Yandex Webmaster | `LV24_SEO_YANDEX_WEBMASTER_TOKEN` |
| Yandex Metrika | `LV24_SEO_YANDEX_METRIKA_TOKEN` |
| Bing | `LV24_SEO_BING_API_KEY` |
| CrUX | `LV24_SEO_CRUX_API_KEY` |
| PSI | `LV24_SEO_PSI_API_KEY` |
| SMTP | `LV24_SEO_SMTP_PASSWORD` |
| Telegram | `LV24_SEO_TELEGRAM_BOT_TOKEN` |

Resolution order is environment, then the optional keychain, then an opt-in file fallback. Environment values always win and are read-only: `auth set` and `auth logout` refuse while the matching variable is set. Unset it in the shell first.

Keychain support comes from the optional extra:

```bash
pip install "lv24-seo[secrets]"
```

Without a keychain, the headless fallback is `data/secrets.json` with mode `0600`, enabled only by `LV24_SEO_ALLOW_FILE_SECRETS=1`. Every run warns while that fallback is active, and on Windows the mode is not enforced by the filesystem.

GSC, Yandex Webmaster and Yandex Metrika can use an OAuth connector instead of a pasted token. `auth login --provider gsc` runs a Desktop-app loopback flow with S256 PKCE; `auth login --provider yandex|metrika` uses the `verification_code` redirect, and `--url-only` returns the authorization URL without a browser or a token write. Tokens are stored per provider in the keychain and refreshed within 60 seconds of expiry; a failed refresh returns `AUTH_INVALID` with the exact login command. `auth status --json` adds an `oauth` object and `doctor` adds non-fatal readiness checks with eight stable codes, so a missing client id, secret, token, scope or redirect is named before a login is attempted. The client id is public config in `[auth.gsc]`/`[auth.yandex]`; the client secret is stored with `auth set --provider gsc_oauth_secret|yandex_oauth_secret --stdin`.

GSC keeps the service-account fallback for unattended runs: the engine exchanges the signed JWT for an access token and refreshes it before expiry. A Google OAuth app in **Testing** expires refresh tokens after 7 days. Bing, IndexNow, CrUX and PSI stay API-key based because those providers have no OAuth flow. `auth status` reports presence and storage source only; it makes no API call, so presence does not prove validity or permissions.

## Quotas, lag and truncation

Provider quotas are enforced with conservative client-side token buckets before a request is sent. A 429 or an exhausted quota becomes a typed error, not a partial success. The main limits to plan around:

- GSC search analytics caps at 50,000 rows per day, site and search type. A final page that exactly fills the cap is reported as `truncated: true` with `rows_cap_50000`; a smaller caller cap produces a warning that names the caller's row limit. A full page is not proof that no row exists behind the cap.
- A capped GSC result omits `total` entirely. An exact row count next to `truncated: true` reads as a full answer, so only a walk that ended on a short batch reports a total.
- GSC publishes data 2–3 days behind the current date, so `data_age_days` is floored at 3. A window ending today is never presented as fresh data.
- GSC grouping is lossy. Never compare the sum of a `page`-grouped response with the sum of a `query`-grouped response, and never request both dimensions and compare with an ungrouped total.
- Yandex Webmaster exposes the top 3,000 queries per period, up to 500 per page, and has no query-by-page join. Absent rows are unknown, not zero.
- A bare `count` in a Webmaster payload is the size of that page, not a grand total, so it no longer stops pagination early and hides rows.
- A loaded Yandex host with an empty indexing or search-URL history is an empty answer with `total: 0` and the `empty_history` limitation, not `degraded_host`. Only a `404` or an explicit `HOST_NOT_LOADED` payload is degraded.
- Yandex Metrika samples by default (`accuracy=medium`). A sampled response carries the `sampled` limitation and a warning; store the accuracy flag with the value.
- Metrika `limit` is the page size, not the result size. The client walks `stat/v1/data` with `offset` until `total_rows`, a short page or a cap; one call is bounded at 10,000 rows and 100 pages, which stays inside the 200-requests-per-5-minutes quota even with a tiny caller page size. A full page with no `total_rows` is marked `truncated` instead of looking complete, and an aggregate call without dimensions is a single row that is never paged.
- Yandex recrawl reads `GET /recrawl/quota` first and caps the URL list to the remainder; one POST per URL. `202` returns `task_id` and `quota_remainder`, `409` is a benign `already_queued`, and `429` stops the loop with earlier task ids kept and the rest in `not_attempted`. There is no batch endpoint.
- Yandex sitemap add/delete is not implemented. Sitemap reads expose ids, URL/error counts, children and sources; a sitemap index's children are listed only through `--parent-id`.
- CrUX returns a 404 when a URL has too little traffic; that becomes `low_traffic`, not a zero score. `data_age_days` comes from `collectionPeriod.lastDate`; the two-day heuristic is only a fallback with `crux_period_missing`. Weekly history is bounded to 40 periods and missing p75 cells are reported as `crux_history_gaps`, never filled.
- PSI is lab data. Never average lab runs or merge them with CrUX field data. `cwv audits` returns at most 100 rows; a `runtimeError`, CAPTCHA or redirect is a warning/limitation, not a clean run.
- Bing stats have no date window in the API, so the report shows no previous-period comparison for Bing. `data_age_days` comes from the newest dated row: `Date` for query/page/traffic/crawl/join stats, `LastCrawled` (falling back to `Submitted`) for sitemap feeds and `LastCrawledDate` for URL details. `GetCrawlIssues` and `GetUserSites` have no date and report `0`, which is not proof of freshness. A 0-row stats or joins answer carries `no_rows_for_window`; a lookup or list that returns nothing carries `provider_returned_no_rows`. Neither is "zero impressions".
- GSC URL Inspection is one URL per call, at most 2,000/day/site and 600/min. It reports Google's last crawl, not a live test. A sitemap index reports per-type totals only: child sitemap URLs are not exposed, and the `indexed` count is deprecated.
- Metrika goals are queried from `providers.yandex_metrika.goals`; an empty list warns without a provider call. Metrika accepts at most 20 metrics per request, so at most five goals are queried per call; a longer list is truncated. Every `metrika` command is organic-only, and `data_age_days` describes the current window, never the older comparison window.
- IndexNow validates the key (`[A-Za-z0-9-]{8,128}`) before planning and enforces a same-host `keyLocation` directory prefix. `200` is accepted, `202` accepted-pending, `400` invalid format, `403` a missing/mismatched key file, `422` a host/key mismatch and `429` quota/spam. The key is never echoed.

Every bounded response carries the same honesty fields: `truncated`, `total`, the data-age value in days (`data_age_days`) and `limitations[]`. `rows` is the number of rows returned, not a total. `total` is present only when the provider or store can report one.

Stable limitation codes:

| Code | Meaning |
|---|---|
| `rows_cap_50000` | GSC reached the 50,000-row cap; a full final page is potentially truncated |
| `no_query_page_join` | The provider cannot join queries to pages in one dataset |
| `top_3000_queries` | Yandex query data is limited to the top 3,000 |
| `sampled` | Metrika returned sampled data |
| `low_traffic` | CrUX has too little traffic for a URL or origin |
| `degraded_host` | Yandex reports the host as not fully loaded |
| `empty_history` | A loaded Yandex host has no indexing or search-URL history for the window |
| `one_url_per_call` | URL Inspection handles one URL per call, with no batch |
| `inspection_reflects_last_crawl` | URL Inspection describes Google's last crawl, not a live test |
| `no_per_url_sitemap_errors` | Yandex or Bing does not expose per-URL sitemap error detail |
| `sitemap_index_children_not_exposed` | GSC does not expose child sitemap URLs of an index |
| `sitemap_indexed_count_deprecated` | GSC's `indexed` count is deprecated |
| `no_rows_for_window` | Bing returned no stats rows for the window; this is missing data, not zero impressions |
| `provider_returned_no_rows` | A lookup or list returned no object or rows |
| `crawl_stats_six_month_window` | Bing crawl stats always cover the six-month daily window |
| `never_crawled` | Bing's `Date(-62135596800000)` sentinel means the URL was never crawled |
| `client_side_date_filter` | Yandex reset the windowed events request; the full series was filtered locally |
| `crux_period_missing` | CrUX omitted `collectionPeriod`; the two-day age heuristic was used |
| `crux_history_gaps` | CrUX returned periods without eligible p75 values |
| `crux_url_normalized` | CrUX normalized the requested URL before querying |
| `psi_audits_cap` | The Lighthouse audit list was capped at 100 rows |
| `indexnow_accepted_pending` | IndexNow returned `202`; the engine still has to validate the key |
| `recrawl_quota_exceeded` | Yandex recrawl hit `429`; the remaining URLs are in `not_attempted` |
| `no_per_url_index_count` | The provider exposes no per-URL indexed count; `indexed_total` is `null` |
| `bing_no_per_url_index_status` | Bing `GetUrlInfo` reports crawl state, not an index verdict |
| `yandex_no_per_url_index_status` | Yandex exposes no per-URL index verdict |
| `indexnow_no_status_api` | IndexNow has no status endpoint; `200` means accepted |
| `site_scan_no_api` | Bing Site Scan has no public API; the engine does not automate it |
| `gsc_indexed_count_deprecated` | The GSC sitemap `contents[].indexed` aggregate is deprecated |
| `bing_quota_reset_undocumented` | Bing does not publish the monthly submission-quota reset |
| `quota_exhausted` | The run had no remaining provider or local quota; nothing was submitted |
| `write_secret_missing` | `LV24_SEO_WRITE_SECRET` is absent, so an apply would be refused |
| `token_expiring` | The credential is close to expiry |
| `paid_provider` | The row came from a paid adapter |
| `partial_response` | The provider returned an incomplete response |

## Google Search Console depth

**URL Inspection.** `gsc inspect --url ABS [--language en-US]` maps the full `indexStatusResult` (`verdict`, `coverageState`, `robotsTxtState`, `indexingState`, `lastCrawlTime`, `pageFetchState`, `googleCanonical`, `userCanonical`, `crawledAs`, `sitemap[]`, `referringUrls[]`), `richResultsResult` (`verdict`, `detectedItems[].items[].issues[]`) and `inspectionResultLink`. `--language` localizes human-readable states such as `coverageState`. It is a report about Google's last crawl, not a live test, and it handles one URL per call with no batch.

**Sitemaps.** `gsc sitemaps [--sitemap-index URL]` and `gsc sitemap --path URL` map `path`, `lastSubmitted`, `lastDownloaded`, `isPending`, `isSitemapsIndex`, `type`, `errors`, `warnings` and `contents[{type,submitted,indexed}]`. The deprecated `indexed` count is labelled with `indexed_deprecated: true`; a sitemap index reports per-type totals only and adds `sitemap_index_children_not_exposed` instead of inventing child URLs. Submit and delete need the full `webmasters` scope and remain `WRITE_DISABLED`; the engine signs `webmasters.readonly`.

**Search Analytics selectors.** `gsc query` forwards `--type`, repeatable `--filter dimension:operator:expression` (one AND group), repeatable `--filter-list dimension:expr1,expr2`, `--data-state`, `--aggregation`, `--search-appearance` and `--branded`. `--branded` accepts only `equals` and is rejected together with a `query` filter, as the API requires. Responses add `responseAggregationType` and the incomplete-data `metadata` (`firstIncompleteDate`/`firstIncompleteHour`) without changing the row shape. The hard caps stay: 25,000 rows per page and 50,000 rows/day/site/type.

## Yandex Webmaster depth

**Events and indexing.** `yandex indexing --date-from/--date-to` merges the appeared/removed event series with the indexing HTTP series per date. The events endpoint returns `indicators{APPEARED_IN_SEARCH,REMOVED_FROM_SEARCH}`, not an `events` list; reading the wrong shape used to report `empty_history` and drop real data. When the endpoint resets the connection on a date window, the client retries unfiltered, filters locally and warns `client_side_date_filter`.

**Samples and sitemaps.** `yandex samples --kind indexing|events [--limit] [--offset]` pages the provider sample endpoints at 100 rows per page with honest `total` and `truncated`. A provider that disconnects the samples endpoint is an upstream error, never an empty list. `yandex sitemaps [--id] [--parent-id] [--limit] [--from]` returns `sitemap_id`, `sitemap_url`, `last_access_date`, `errors_count`, `urls_count`, `children_count`, `sources[]` and `sitemap_type`; add/delete is not implemented.

**History and queue.** `yandex history --kind sqi|in-search|queries|query [--query-id]` reads SQI points, pages-in-search, all-query and per-query series. The query history calls send the four documented `query_indicator` parameters; without them Yandex returns an empty `indicators` object. `yandex queue [--id]` reads recrawl tasks with the provider `count` as `meta.total`.

**Recrawl.** `yandex recrawl --url ... --allow-write` plans and `--confirm TOKEN` applies one provider POST per URL. The remaining daily quota is read first and the list is capped to it; `202` rows carry `task_id` and `quota_remainder`, `409` rows are `already_queued`, and `429` keeps earlier task ids, lists the rest under `not_attempted` and sets `truncated: true` with `recrawl_quota_exceeded`.

## Bing Webmaster depth

`bing pages` reads `GetPageStats` (`page`, clicks, impressions, click/impression position, date); `bing traffic` reads daily `GetRankAndTrafficStats` since 2023-03-24; `bing crawl` reads the six-month `GetCrawlStats` window and always carries `crawl_stats_six_month_window`; `bing joins --query|--page` selects one of the three query/page joins and returns one compact row shape (`query`, `page`, clicks, impressions, positions, date). All are read-only, sorted as Bing returns them, and use ISO-8601 UTC dates.

`bing urlinfo --url URL|domain:HOST` reads `GetUrlInfo` (`anchor_count`, `discovery_date`, `document_size`, `http_status`, `is_page`, `last_crawled_date`, `total_child_url_count`). The WCF `Date(-62135596800000)` sentinel maps to `null` and a never-crawled row carries `never_crawled`. `bing children` reads one page per `GetChildrenUrlInfo` POST, walks at most 10 pages and marks a full final page `truncated` with `children_page_cap`. `bing users` reads `GetSiteRoles` and never echoes delegated verification codes; `bing sites` reads account-scoped `GetUserSites` and works without `providers.bing.site`.

Bing statistics have no date window, so an empty answer is `no_rows_for_window`, not a zero-impression row. A lookup or list that returns nothing is `provider_returned_no_rows`. A zero row count is never presented as a traffic drop.

## Yandex Metrika organic reads

The `metrika` group adds `pages`, `goals`, `queries`, `devices`, `countries`, `engagement` and `bytime`. All seven are read-only, use the configured counter (`providers.yandex_metrika.counter`) and apply `filters=ym:s:lastTrafficSource=='organic'`; `meta.organic_only` is `true`. `stats` and `report weekly` expose `organic_visits`/`organic_users` and keep all traffic explicit as `all_visits`/`all_users`; the two are never merged or labelled SEO traffic.

`metrika pages` returns organic landing pages with visits/users, bounce rate, average visit duration, page depth and pageviews, sorted by visits. `metrika goals` queries the configured goal ids with reaches, visits, users and conversion rate, optionally by `page` or `source`; an empty list warns and makes no call, and more than five goals are truncated at Metrika's 20-metric cap. `metrika queries` always states that Google withholds search phrases and Metrika hides phrases with fewer than 10 users.

Sampling is never presented as exact: `sampled`, `sample_share`, `sample_size`, `sample_space`, `data_lag`, `contains_sensitive_data` and `total_rows_rounded` are carried into meta and limitations, and only `sampled=false` is treated as exact. `data_age_days` reflects the current window; the previous comparison window is older by design and never inflates it.

## CrUX history and PSI audits

`cwv history (--url ABS | --origin ABS) [--device phone|desktop|tablet] [--weeks 1..40]` reads CrUX `queryHistoryRecord` weekly p75 periods, newest last. Each row has `first_date`/`last_date`, an optional canonical device and the metrics `lcp`, `inp`, `cls`, `fcp`, `ttfb`, `fid` when present. Missing p75 cells become `crux_history_gaps` and are never filled; fewer periods than requested adds `crux_history_short`; non-CWV metrics are filtered and named. History is read-only and not persisted.

`cwv audits --url ABS [--strategy mobile|desktop] [--category ...]` returns up to 100 Lighthouse audit rows with `id`, `title`, `score`, `display_value`, a plain-text description (HTML stripped), `details_type`, `overall_savings_ms`, `overall_savings_bytes` and `items_count`. Item arrays are never returned; `meta.total`, `meta.truncated` and `psi_audits_cap` state the bound. A `runtimeError`, CAPTCHA or `finalUrl` that differs from the request becomes `psi_runtime_error`, `psi_captcha` or `psi_final_url_differs`; an HTTP 200 run with a runtime error is not reported as clean.

## IndexNow key and status rules

The key must be 8–128 characters from `A-Z`, `a-z`, `0-9` and `-`; it is validated before the plan and never echoed. When `keyLocation` is set, every URL must be on the same host and under that key file's directory prefix; the dry run fails with `INVALID_INPUT` instead of discovering the mismatch at apply time.

Provider statuses are actionable: `200` accepted, `202` accepted-pending (warning plus `indexnow_accepted_pending`, never "indexed"), `400` invalid format (`INVALID_INPUT`), `403` key file missing or mismatched (`AUTH_INVALID` with the exact expected key URL), `422` host/key mismatch (`INVALID_INPUT`) and `429` spam/quota (`QUOTA_EXCEEDED`, retryable). Error messages keep the host, path and status; the key appears only inside the public key-file URL the operator must publish.

## Indexing automation

`indexing status|run|history` keeps one local queue per provider and URL (`indexing_state`, schema v5) and plans submissions and checks inside fresh quotas. `indexing run` reads the project sitemap by default (root plus five child documents, 10,000 URLs) and merges explicit `--url` values; off-host URLs are skipped and every cap is reported.

| Provider | Submission path | Quota source | Per-URL index check | Honest limits |
|---|---|---|---|---|
| Bing | `SubmitUrlbatch`, 500 URLs per call | `GetUrlSubmissionQuota`: `daily_remaining` / `monthly_remaining` (remaining, not totals) | `GetUrlInfo` gives `http_status` and `last_crawled_date` only | `bing_no_per_url_index_status`, `no_per_url_index_count`, `site_scan_no_api`, `bing_quota_reset_undocumented` |
| Yandex | `recrawl/queue`, one URL per request | `recrawl/quota`: `daily_quota` / `quota_remainder` | none | `yandex_no_per_url_index_status`, `no_per_url_index_count`, `one_url_per_call` |
| IndexNow | one POST, 10,000 URLs maximum | local UTC-day counter capped by `[indexing].indexnow_daily_limit` (default 1,000) | none | `indexnow_no_status_api`, `no_per_url_index_count`; `200` is accepted, never indexed |
| GSC | not used for submission | local UTC-day counter capped by `[indexing].gsc_inspect_daily_limit` (default 2,000) | URL Inspection: `PASS` / `Submitted and indexed` → `indexed`; `NEUTRAL` / `FAIL` → `not_indexed`; anything else `unknown` | `gsc_indexed_count_deprecated` for the separate sitemap aggregate |

Priority is never-submitted URLs first, then URLs whose sitemap `lastmod` is newer than `last_submitted_at`, then URLs whose `last_checked_at` is older than `check_interval_days`. A URL submitted after its `lastmod` is skipped unless `--force` is set. Without `--allow-write` the command only checks and plans; with it the engine re-reads quotas, verifies the plan hash, consumes an internal confirm token and records one `indexing_runs` row per provider. A replayed confirm token returns `skipped`/`duplicate` and adds no queue entry or run row.

Index counts stay honest: GSC URL Inspection is the only per-URL verdict. The GSC sitemap `contents[].indexed` aggregate is reported separately as `indexed_total` and always tagged `gsc_indexed_count_deprecated`. Bing, Yandex and IndexNow report `indexed_total: null` with `no_per_url_index_count`; a zero is never rendered as "all indexed". Bing Site Scan has no public API (`site_scan_no_api`).

A scheduled apply needs `[indexing] enabled = true` **and** `LV24_SEO_WRITE_SECRET` in the environment the host scheduler starts the job in. The generated `lv24-seo-indexing` command contains `--allow-write` but never the secret; `indexing status` reports `write_secret_present` and `write_secret_missing` before the next apply fails. See [Automation and delivery](/automation/).

On 2026-11-17, `indexing status --live` against `lv24.by` reported Bing 99 daily / 1399 monthly remaining, Yandex 150, GSC 0/2000 used, IndexNow 0/1000 and `write_secret_present: true`. The first run submitted 5 Bing and 5 IndexNow URLs and checked 15 GSC URLs (3 indexed); the Yandex POST returned HTTP 504 provider-side and is retried by the daily job.

## Sitemap scope

A sitemap `<loc>` is fetched only when its origin is in scope: the seed sitemap origin plus the final origin of every document actually read. A redirect to a CDN mirror therefore stays in scope, while a loc pointing at an unrelated host does not. Rejected locs are dropped and reported once as `off_origin_loc`, so a reader without an external scoped fetcher still never follows a sitemap to another site. The same origin check applies to child sitemaps in an index.

## No SERP scraping

The tool never scrapes Google or Yandex result pages, never bypasses a CAPTCHA, and never automates the Yandex Business card or review replies through a browser session. Rank and query data come from GSC and Yandex Webmaster APIs. A provider that does not expose a metric leaves it unknown.

Optional paid adapters are bring-your-own-key and off by default. They must use the same result envelope and mark rows with `paid_provider`; the default path never depends on them. Provider data is not resold or republished: reports are generated locally for the property owner.

## Timezone-aware windows

`report.timezone` is an IANA zone (default `Europe/Minsk`) used for report and `stats` windows, MCP default windows and local day boundaries. Provider data stays date-based and is not converted. An invalid zone fails config validation with `CONFIG_INVALID`; an unsupported value never falls back silently.

Scheduler generators apply the same zone where the backend supports it. Cron depends on `CRON_TZ`, systemd writes the zone into `OnCalendar`, and Task Scheduler XML carries a fixed offset with a DST warning. See [Automation and delivery](/automation/).

Source: `_source/engine-data-sources.md`, `_source/engine-cli.md`, `_source/engine-config.md`, `_source/engine-auth.md`, `_source/engine-auth-google.md`, `_source/engine-auth-yandex.md`, `_source/engine-releases-0.14.0.md`, `_source/engine-releases-0.13.1.md`, `_source/engine-releases-0.13.0.md`, `_source/engine-releases-0.12.2.md`, `_source/engine-releases-0.12.0.md`, `_source/engine-releases-0.11.0.md`, `_source/engine-releases-0.10.0.md`, `_source/engine-releases-0.5.3.md`.
