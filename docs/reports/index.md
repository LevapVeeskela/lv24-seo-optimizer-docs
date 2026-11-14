---
title: Reports, diffs and delivery
description: Build weekly reports, compare stored snapshots, read limitations and deliver email or Telegram digests.
---

# Reports, diffs and delivery

The engine has two read surfaces. `stats` is a per-provider dashboard snapshot; `report weekly` composes a digest, stores it and can deliver it. Both use the same timezone-aware windows and the same honesty fields.

Related: [Data sources and quotas](/providers/), [Crawl and audit](/crawl/), [Automation and delivery](/automation/), [MCP and agent skills](/mcp/).

## `stats` versus `report weekly`

| | `stats` | `report weekly` |
|---|---|---|
| Purpose | Dashboard metrics per provider | Composed weekly digest |
| Providers | GSC, Yandex Webmaster, Metrika, Bing, CrUX, PSI, always in that order | The same providers plus stored crawl issues |
| Writes | Nothing; no SQLite store needed | Saves a weekly snapshot when a store exists |
| Delivery | Never | Only with `--send` |
| Comparison | Current and previous windows per provider | GSC headline delta, per-engine traffic, opportunities |
| Output | JSON envelope or a short text table | JSON, HTML, email or Telegram text |

```bash
lv24-seo stats --days 7 --lag-days 2 --json
lv24-seo report weekly --days 7 --lag-days 2 --out reports/
lv24-seo report weekly --days 7 --lag-days 2 --send --json
```

`stats` reports `status` as `ok`, `no_data`, `missing_token`, `not_configured` or `error`, and isolates a provider failure: the envelope stays `ok: true` while `coverage.failed` increments. `metrics` carries only reported values, with no zero fill and no cross-engine totals. `previous` exists only for comparable GSC, Yandex Webmaster and Metrika windows; Bing, CrUX and PSI return `null`.

`coverage.complete` is true only when every configured service is `ok`, has rows, is not truncated, and none is missing or failed. It is false when no provider is configured.

## Windows and limits

- `--days` is the current window length, from 1 to 3660. A larger value fails with `INVALID_INPUT` and exit code 2 instead of building an unbounded window.
- `--lag-days` shifts both windows back and accepts 0 or more. The previous window is the equally long window immediately before the current one.
- GSC data lags 2–3 days, so a Monday morning report is stable. The default is 7 days with a 2-day lag.
- Windows use `report.timezone`. Provider dates are not converted.
- MCP `seo_weekly_report` clamps `days` to 1–90 and `lag_days` to 0–14 with a warning; the CLI accepts the full 1–3660 range. Use the CLI for a longer lookback.

## What the weekly report contains

The headline compares GSC clicks, impressions, CTR and average position across two identical windows. CTR movement is expressed in percentage points (pp). When no comparable GSC window exists, the report keeps the real current values with `previous: null` and says the delta is unavailable; it never invents a baseline and never merges engines into a cross-engine total.

Per-engine numbers stay separate:

- Yandex Webmaster: the current top-query window, capped at 500 rows in the weekly digest.
- Yandex Metrika: sessions, not clicks.
- Bing, CrUX and PSI: extra engine rows when configured. CrUX is field data, PSI is lab data, and the two are never merged.

The report also contains ranked opportunities (striking distance, CTR gap, declining pages), issues by severity from the latest stored crawl, a sources section, data notes and limitations. Each opportunity carries real evidence and expected clicks, which are a prioritisation estimate, never a traffic promise.

The JSON envelope also exposes `meta.complete`, `meta.sources`, `meta.sources_failed`, `meta.sources_missing`, `meta.sources_incomplete`, `meta.data_age_days`, `meta.truncated`, `meta.limitations`, `meta.locale` and `meta.snapshot_hash`.

## Outputs and stored snapshots

```bash
lv24-seo report weekly --out reports/
```

`--out DIR` writes two files:

- `report.json` — canonical English, stable enough to diff between runs.
- `report.html` — rendered in `report.locale`.

The weekly run also saves a snapshot in `data/seo.sqlite3` when the data directory exists. `lv24-seo init` creates it; without a store the command warns that the snapshot was not saved. The default data directory is `./data` and can be changed with `[storage] data_dir` or `LV24_SEO_DATA_DIR`.

Snapshots are keyed by kind, property and period. They feed `report diff`; the sends ledger lives in the same SQLite file. MCP keeps the latest report in memory for `seo://report/latest`. `report.json`, `--json` envelopes and `report diff --markdown` stay canonical English even when the display locale is Russian or Chinese; machine codes are never translated.

## Reading `truncated` and `limitations`

Before drawing a conclusion, check the envelope in this order:

1. `ok` and `meta.complete` — did every configured source return usable rows?
2. `meta.truncated` — did a provider cap the data?
3. `meta.data_age_days` — how old is the window relative to the fetch?
4. `meta.limitations[]` and `warnings[]` — what is unknown or approximated?

A metric present in only one window is unknown, not zero. A truncated response is not complete. A provider failure does not fail the report: the email names the missing source, the envelope sets `complete: false`, and the remaining engines still return their data.

## Localization

`report.locale` accepts `ru`, `en` and `zh`; the default is `ru`. It controls the weekly email subject, HTML and plain text, the CLI human summary, the HTML written by `--out`, and Telegram messages, including number, percent, position, date and plural formatting.

Locale is presentation-only. JSON envelopes, MCP payloads, stored snapshots and `report diff` remain canonical English. An unsupported locale fails config validation with `CONFIG_INVALID` instead of falling back silently.

## Email and Telegram

Email uses SMTP on port 587 with STARTTLS and a verifying TLS context. The login runs only after TLS succeeds. The message is `multipart/alternative`: the product HTML template plus the same content as 78-column plain text, with a single-line localized subject of at most 78 characters.

The template is a 600px card with inline CSS, a dark header and a text wordmark. It has no external images, stylesheets, scripts, tracking pixels or remote fonts. Unknown KPI values render as the localized "No data" text, never `0` and never an em dash. Metrika is shown as sessions, not clicks. An empty issues section says no issue data was provided instead of claiming the site is clean. Limitations and warnings are kept and deduplicated; provider prose stays in its original language and is labelled as original when the report is localized. The footer carries the exact property id, the UTC generation time and "generated by lv24-seo".

Telegram sends the same 78-column localized text through the Bot API `sendMessage` method. HTTP 4xx/5xx responses, transport timeouts and malformed Bot API answers are reported as `failed` and never recorded as sent.

Only email and Telegram channels exist. There are no Resend or Brevo adapters and no `--channel github`; provider-sent GitHub issues are not implemented.

## Idempotency and delivery guarantees

The `sends` ledger is unique on `(kind, property, period, channel, content_hash)`. The hash covers the headline and sections plus the normalized render locale, while `generated_at` and diagnostics are excluded. English omits the locale from the hash so an upgrade does not re-send an already delivered English period.

`only_on_change` skips a send when the content hash was already delivered (`already_sent`). The material gate skips it when no change field reaches `report.thresholds` (`no_material_change`). The material gate runs before the locale hash, so a pure locale switch can still be suppressed when the period has no material change; it is delivered once the gate passes or the gate is disabled.

Delivery is at-least-once per channel. An ambiguous transport result is reported `failed` and never recorded, so the next run may deliver a duplicate. Concurrent runs de-duplicate through the SQLite transaction around check, send and journal; SMTP and the Bot API offer no exactly-once primitive after a process crash. Keep one schedule per period.

## Comparing stored snapshots

```bash
lv24-seo report diff --json
lv24-seo report diff --base 2026-11-02..2026-11-08 --head 2026-11-09..2026-11-15 --markdown
```

`report diff` compares two stored weekly snapshots without calling any provider. The default is the two newest periods. It reports headline metric changes, issue counts per severity, opportunities added, resolved or unchanged, and limitations added or lifted.

A metric present in only one snapshot is listed in `unknown_metrics`, never as zero. `comparable` and `meta.complete` are false when either snapshot had no headline comparison or the period lengths differ. `--markdown` prints only GitHub-flavoured Markdown, with warnings on stderr, so stdout stays valid for a PR comment or CI summary. The Markdown diff lists at most 20 opportunities per group and states how many more exist.

The command needs `lv24-seo init` and two `report weekly` runs for different periods. Without a store it fails with `CONFIG_INVALID`; with fewer than two snapshots it fails with `INVALID_INPUT`. Both carry a `next_action`.

Source: `_source/engine-cli.md`, `_source/engine-scheduling.md`, `_source/engine-releases-0.5.1.md`.
