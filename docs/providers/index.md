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
| Google Search Console | Search analytics, sites, sitemaps, URL Inspection | Sitemap submit; refuses with `WRITE_DISABLED` in 0.5.1 | Bearer access token (`webmasters.readonly` for reads, `webmasters` for sitemaps) | 1,200 QPM per site and per user; 50,000 rows/day/site/type; URL Inspection 2,000/day, 600/min | 2–3 days |
| Yandex Webmaster | Summary, SQI history, indexing, search URLs and events, queries, diagnostics, broken links, sitemaps | Recrawl queue; refuses with `WRITE_DISABLED` in 0.5.1 | OAuth token, scope `webmaster:hostinfo` | Free; no published global RPD/RPS; query analytics is fragile above roughly 10k requests/hour | About 4 days |
| Yandex Metrika | Sessions, traffic sources, search phrases, landing pages, goals | None | OAuth token, scope `metrika:read` | 5,000 requests/day/user; 30 rps/IP; 3 parallel; `/stat/v1/data` 200 requests per 5 minutes; up to 100k rows, 20 metrics and 10 dimensions per request | Reporting API; sampling is reported |
| Bing Webmaster | Query stats, rank and traffic stats, crawl issues | IndexNow submit (works); sitemap submit path is not wired | One API key per user | Free; about 10k URL submits/day/domain, 500 per batch | No windowed stats in the API |
| Chrome UX Report (CrUX) | Field p75 LCP, INP and CLS | None | API key | 150 QPM per project, cannot be raised | 28-day rolling window |
| PageSpeed Insights (PSI) | Lighthouse lab diagnosis, deprecated field block | None | API key optional; keyless works with a lower quota | About 25k requests/day | Live lab run |
| GA4 (optional) | Organic landing pages, sessions, key events | None | Google Analytics Data API credentials | Provider quota applies | Directional; thresholding can hide rows |
| Own crawl | Pages, issues, link graph, sitemap coverage | None | None | Local | Current run |
| Logs | User-agent bot triage for nginx JSON access logs; not proof of a verified crawler | None | Local file | Local | Log window |

GA4 is an optional integration point, not part of the default path. The shipped providers are GSC, Yandex Webmaster, Yandex Metrika, Bing, CrUX and PSI. Paid SERP or backlink adapters (DataForSEO, SerpApi and others) are planned or documented only; none ships in 0.5.1.

## Authentication

```bash
lv24-seo auth status --json
lv24-seo auth set --provider gsc --stdin
lv24-seo auth login --provider gsc
lv24-seo auth logout --provider gsc
```

`auth set` accepts `gsc`, `yandex`, `metrika`, `bing`, `crux`, `psi`, `smtp` and `telegram`. It reads the secret from stdin or a hidden prompt, stores it in the OS keychain, and prints only `{provider, stored, source}`. The value is never echoed, logged or written to `seo.toml`. If neither the keychain nor the file fallback is available, it fails with `WRITE_DISABLED`.

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

Credentials are manually supplied access tokens and API keys. The tool does not run an OAuth handshake, refresh tokens, or exchange a service-account key for an access token. `auth status` reports presence and storage source only; it makes no API call, so presence does not prove validity or permissions.

## Quotas, lag and truncation

Provider quotas are enforced with conservative client-side token buckets before a request is sent. A 429 or an exhausted quota becomes a typed error, not a partial success. The main limits to plan around:

- GSC search analytics caps at 50,000 rows per day, site and search type. Pagination continues until a short page; `truncated` is `true` only when another row exists beyond the cap. A final page that exactly fills the cap is complete.
- GSC grouping is lossy. Never compare the sum of a `page`-grouped response with the sum of a `query`-grouped response, and never request both dimensions and compare with an ungrouped total.
- Yandex Webmaster exposes the top 3,000 queries per period, up to 500 per page, and has no query-by-page join. Absent rows are unknown, not zero.
- Yandex Metrika samples by default (`accuracy=medium`). A sampled response carries the `sampled` limitation and a warning; store the accuracy flag with the value.
- CrUX returns a 404 when a URL has too little traffic; that becomes `low_traffic`, not a zero score.
- PSI is lab data. Never average lab runs or merge them with CrUX field data.
- Bing stats have no date window in the API, so the report shows no previous-period comparison for Bing.

Every bounded response carries the same honesty fields: `truncated`, `total`, the data-age value in days (`data_age_days`) and `limitations[]`. `rows` is the number of rows returned, not a total. `total` is present only when the provider or store can report one.

Stable limitation codes:

| Code | Meaning |
|---|---|
| `rows_cap_50000` | GSC stopped at the 50,000-row cap and another row exists |
| `no_query_page_join` | The provider cannot join queries to pages in one dataset |
| `top_3000_queries` | Yandex query data is limited to the top 3,000 |
| `sampled` | Metrika returned sampled data |
| `low_traffic` | CrUX has too little traffic for a URL or origin |
| `degraded_host` | Yandex reports the host as not fully loaded |
| `one_url_per_call` | URL Inspection handles one URL per call, with no batch |
| `no_per_url_sitemap_errors` | Yandex does not expose per-URL sitemap error detail |
| `token_expiring` | The credential is close to expiry |
| `paid_provider` | The row came from a paid adapter |
| `partial_response` | The provider returned an incomplete response |

## No SERP scraping

The tool never scrapes Google or Yandex result pages, never bypasses a CAPTCHA, and never automates the Yandex Business card or review replies through a browser session. Rank and query data come from GSC and Yandex Webmaster APIs. A provider that does not expose a metric leaves it unknown.

Optional paid adapters are bring-your-own-key and off by default. They must use the same result envelope and mark rows with `paid_provider`; the default path never depends on them. Provider data is not resold or republished: reports are generated locally for the property owner.

## Timezone-aware windows

`report.timezone` is an IANA zone (default `Europe/Minsk`) used for report and `stats` windows, MCP default windows and local day boundaries. Provider data stays date-based and is not converted. An invalid zone fails config validation with `CONFIG_INVALID`; an unsupported value never falls back silently.

Scheduler generators apply the same zone where the backend supports it. Cron depends on `CRON_TZ`, systemd writes the zone into `OnCalendar`, and Task Scheduler XML carries a fixed offset with a DST warning. See [Automation and delivery](/automation/).

Source: `_source/engine-data-sources.md`, `_source/engine-cli.md`, `_source/engine-config.md`.
