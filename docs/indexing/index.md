---
title: Indexing automation
description: Quota-aware indexing status, runs and history in the CLI and the read-only desktop Indexing automation card, with the daily 04:00 job, write secret and honest index counts.
---

# Indexing automation

Indexing automation keeps a local queue of sitemap URLs, submits what is allowed within fresh provider
quotas and records what happened. It is a CLI and scheduler feature; the desktop `0.9.2` card renders
the same data read-only.

## What it does

- **Queue.** `indexing run` reads the project sitemap (`<project.base_url>/sitemap.xml`, root plus five
  child documents, 10,000 URLs) and merges explicit `--url` values. Off-host URLs are skipped and every
  cap is reported.
- **Priority.** Never-submitted URLs first, then URLs whose sitemap `lastmod` is newer than
  `last_submitted_at`, then URLs whose `last_checked_at` is older than `check_interval_days`. A URL
  submitted after its `lastmod` is skipped unless `--force` is set.
- **Checks and writes.** Checks are read-only: GSC URL Inspection gives a per-URL verdict and Bing
  `GetUrlInfo` gives `crawled` when a crawl date exists. Without `--allow-write` the run only checks and
  plans. With it, the engine re-reads quotas, re-validates the plan hash, mints and consumes an internal
  confirm token through the write gate and records one `indexing_runs` row per provider.
- **Daily job.** `schedule install --kind indexing` renders a daily `lv24-seo-indexing` job at **04:00**
  running `indexing run --allow-write --config <abs> --json` for cron, systemd and Windows Task
  Scheduler. The generated command never contains the secret.

```bash
lv24-seo indexing status --live --json
lv24-seo indexing status --provider bing --limit 50 --json
lv24-seo indexing run --from-sitemap --max-submit 20 --max-inspect 5 --json
lv24-seo indexing run --from-sitemap --allow-write --json
lv24-seo indexing history --limit 20 --json
lv24-seo schedule install --kind indexing --allow-write --json
```

## Quotas and caps

Caps are enforced before the provider call. An exhausted quota is `quota_exhausted` with `submitted: 0`
and `not_attempted`; zero never means "all indexed".

| Engine | Remaining quota source | Per-run bound |
|---|---|---|
| Bing | `GetUrlSubmissionQuota` daily and monthly remaining values | 500 URLs per `SubmitUrlbatch`; the plan is capped to the smaller remaining window |
| Yandex | `recrawl/quota` `quota_remainder` | One POST per URL; no batch endpoint |
| GSC | No remaining-count API; local UTC-day `quota_usage` counter | 2,000 inspections/day/site by default, `max_inspect_per_run` 20 |
| IndexNow | No status or quota API; local UTC-day counter | 1,000 submissions/day by default, 10,000 URLs per POST |

`indexing status` reports per provider `urls`, `submitted`, `crawled`, `queued`, `indexed` (sample),
`indexed_total` (GSC aggregate), `pending`, `quota` and `limitations`. `--live` reads Bing and Yandex
quotas now; without it the last recorded quota is shown with `quota_not_live`.

## Write secret and gates

`indexing run --allow-write` needs `[indexing] enabled = true` and `LV24_SEO_WRITE_SECRET` in the same
environment. A scheduled apply needs the secret in the scheduler environment (systemd drop-in, user
environment or cron export), never in the command line. `indexing status` reports only whether the
secret is present as `write_secret_present`; the value is never read into an envelope. A replayed token
is `skipped`/`duplicate`; a provider failure releases the claim.

## Honest index counts

Only GSC exposes a per-URL verdict (`PASS`/`Submitted and indexed` → `indexed`; `NEUTRAL`/`FAIL` →
`not_indexed`; anything else `unknown`). The GSC sitemap `contents[].indexed` aggregate is reported
separately as `indexed_total` and always tagged `gsc_indexed_count_deprecated`. Bing `GetUrlInfo`
yields `http_status` and `last_crawled_at`, so a crawled URL is `crawled`, not `indexed`
(`bing_no_per_url_index_status`). Yandex and IndexNow have no per-URL status; their `indexed_total` is
`null` with `no_per_url_index_count`.

**Bing Site Scan has no public API.** Every Bing entry carries `site_scan_no_api`; the desktop only
opens the official page and never claims to start, monitor or import a scan.

## Desktop Indexing automation card

Desktop `0.9.2` adds a read-only card to Integrations. It renders `indexing status`,
`indexing history` and `schedule status`; there are no write, confirm or `--allow-write` controls.

- **Schedule.** `Scheduled`/host state and the documented **Daily 04:00** cadence for `lv24-seo-indexing`.
- **Per provider.** Bing, Yandex, GSC and IndexNow rows with `submitted`, `indexed` (GSC only),
  `pending` and quota: Bing daily/monthly remaining, Yandex remaining, GSC/IndexNow used/limit. A
  provider with no state shows "No data yet", never a zero.
- **Last run and history.** The newest `indexing history` row with status, submitted/checked counts and
  up to five `error_items` (URL, code, message), plus a compact 7/30-day day/provider table from
  `indexing history --limit 30`.
- **Honesty.** Every render includes `data_age_days` and `limitations`; the deprecated GSC aggregate is
  labelled and kept separate. Bing/Yandex/IndexNow show no per-URL count instead of inventing one.
- **Compatibility.** If the engine answers `INVALID_COMMAND`, the card shows "Indexing status needs
  engine >= 0.13.1" and hides the tables. An engine older than `0.14.0` is reported as incompatible by
  the shell.
- **Bridge.** `indexing_status` (`provider`, `limit`, `live`), `indexing_history` (`limit`) and
  `schedule_status` (`kind`, `target`) are allow-listed; the Rust layer validates every value, rejects
  write flags and cross-command arguments and uses a 120 s timeout. `--live` is the only provider call;
  a missing credential becomes a limitation, not a failure.

## Configuration

`[indexing]` is disabled by default. `enabled = true` is required before an apply; without it the run is
a read-only plan. `providers` selects the engines, and `max_submit_per_run` (500), `max_inspect_per_run`
(20), `stale_days` (7), `check_interval_days` (7), `gsc_inspect_daily_limit` (2,000) and
`indexnow_daily_limit` (1,000) bound the work.

## Limits

- The desktop card is read-only: it cannot install, edit or run the job.
- `--live` reads Bing and Yandex quotas; a missing credential is a limitation.
- A large site is sampled over several runs; `meta.truncated` says so.
- Yandex recrawl can return a provider-side 5xx; the daily job retries on its next run.
- IndexNow has no status API and no published quota; the local daily cap is a conservative guard.
- GSC sitemap submit and Bing sitemap delete remain `WRITE_DISABLED`.

## Related

- [CLI reference](/reference/cli/)
- [Configuration reference](/reference/config/)
- [Automation and delivery](/automation/)
- [Desktop app](/desktop/)

Source: `_source/engine-releases-0.12.0.md`, `_source/engine-releases-0.13.1.md`, `_source/engine-releases-0.14.0.md`, `_source/desktop-releases-0.9.2.md`, `_source/desktop-releases-0.9.2-update.md`, `_source/engine-cli.md`, `_source/engine-config.md`.
