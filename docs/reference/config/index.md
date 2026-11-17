---
title: Configuration reference
description: Where seo.toml lives, how precedence works, every key with its default, and how secrets, timezone and locale are handled.
---

# Configuration reference

One `seo.toml` describes one project: its site identity, the provider targets to read, crawl limits,
report settings and local storage. The schema is strict, so a misspelled key fails validation
instead of silently disabling a setting. A missing config file is not an error; the defaults describe
a runnable, read-only tool.

## Location and precedence

Value precedence, lowest to highest: built-in defaults, the selected `seo.toml`, then `LV24_SEO_*`
environment variables. `--config PATH` only selects the file; the engine looks for the explicit path
first (it must exist, otherwise `CONFIG_INVALID`), then `./seo.toml`, then the platform user config
file: `%APPDATA%\lv24-seo\config.toml` on Windows, `~/.config/lv24-seo/config.toml` on Linux, and the
equivalent platformdirs location on macOS.

`.env` files are not loaded automatically. Export the variables in the shell, the service unit or
the scheduler environment that runs the command.

### Environment variables

| Variable | Key |
|---|---|
| `LV24_SEO_DATA_DIR` | `storage.data_dir` |
| `LV24_SEO_GSC_PROPERTY` | `providers.gsc.property` |
| `LV24_SEO_YANDEX_HOST_ID` | `providers.yandex_webmaster.host_id` |
| `LV24_SEO_YANDEX_METRIKA_COUNTER` | `providers.yandex_metrika.counter` |
| `LV24_SEO_REPORT_LOCALE` | `report.locale` |
| `LV24_SEO_REPORT_TIMEZONE` | `report.timezone` |
| `LV24_SEO_SMTP_HOST` | `report.email.smtp_host` |
| `LV24_SEO_SMTP_PORT` | `report.email.smtp_port` |
| `LV24_SEO_SMTP_USER` | `report.email.smtp_user` |
| `LV24_SEO_SMTP_FROM` | `report.email.from` |
| `LV24_SEO_MAIL_TO` | `report.email.to` (comma-separated list) |
| `LV24_SEO_TELEGRAM_CHAT_ID` | `report.telegram.chat_id` |

Unsupported `LV24_SEO_*` variables are ignored for forward compatibility. Secret variables are
listed under [Secrets](#secrets); they are resolved by the secret store, not by this config model.

`LV24_SEO_LOG_LEVEL` is not a config key. Set it to `DEBUG`, `INFO`, `WARNING`, … to opt the process
into redacting logging. The CLI and `lv24-seo mcp serve` install the handler; an unset variable leaves
the caller's logging configuration untouched. Output is one JSON line per record when stderr is not a
terminal (pipe, scheduler log, MCP host) and a plain line otherwise.

## Key reference

Every key below is optional. An absent provider block means "not configured", not a failure.

### `[project]`

| Key | Type | Default | Notes |
|---|---|---|---|
| `name` | string | `""` | Human label for the workspace. |
| `base_url` | string | `""` | Default seed for `crawl` when `--start` is omitted. |
| `default_property` | string | `""` | GSC property suggested by `init` and shown by `properties`. GSC queries use `providers.gsc.property`. |

### `[providers.gsc]`

| Key | Type | Default | Notes |
|---|---|---|---|
| `property` | string | `""` | `sc-domain:example.com` or `https://example.com/`. |
| `auth` | string | `"keychain"` | Reserved label. Accepted but ignored: credentials resolve from environment, then the OS keychain, then the opt-in file fallback. |

### `[providers.yandex_webmaster]`

| Key | Type | Default | Notes |
|---|---|---|---|
| `host_id` | string | `""` | Exact Yandex host id, for example `https:example.com:443`. Never guess it; read it from the Webmaster API or UI. |

### `[providers.yandex_metrika]`

| Key | Type | Default | Notes |
|---|---|---|---|
| `counter` | string | `""` | Metrika counter id. An unquoted integer in TOML is normalised to a string. |
| `goals` | list of integers | `[]` | Goal ids that count as conversions. |

### `[providers.bing]`

| Key | Type | Default | Notes |
|---|---|---|---|
| `site` | string | `""` | Site URL as registered in Bing Webmaster Tools. |
| `indexnow_key` | string | `""` | Public IndexNow key and key-file name; safe to keep in `seo.toml`. |
| `indexnow_key_location` | string | `""` | Optional absolute URL of the hosted key file; defaults to `https://<host>/<key>.txt`. |

### `[providers.crux]`

| Key | Type | Default | Notes |
|---|---|---|---|
| `origin` | string | `""` | Origin queried for field data, for example `https://example.com`. |

### `[providers.psi]`

| Key | Type | Default | Notes |
|---|---|---|---|
| `strategy` | `mobile` or `desktop` | `"mobile"` | Lighthouse strategy. |
| `urls` | list of strings | `[]` | Pages checked by PageSpeed Insights. At most five are checked; lab scores come from the first URL. |

There is no `providers.ga4` block in the current strict schema. Adding one fails validation; GA4 is
documented as an optional future source, not a configurable provider yet.

### `[crawl]`

| Key | Type | Default | Notes |
|---|---|---|---|
| `max_urls` | integer ≥ 1 | `500` | URL budget for one crawl. |
| `concurrency` | integer ≥ 1 | `4` | Reserved. The crawler is serial today, so this has no effect. |
| `respect_robots` | boolean | `true` | Honour `robots.txt` and `Crawl-delay`. |
| `user_agent` | string | `"lv24-seo/0.1"` | User-Agent sent by the crawler. |

### `[report]`

| Key | Type | Default | Notes |
|---|---|---|---|
| `locale` | `ru`, `en` or `zh` | `"ru"` | Language of rendered human output. Presentation only. |
| `timezone` | IANA zone name | `"Europe/Minsk"` | Zone used for report and `stats` windows, MCP default windows and local day boundaries. |
| `week_start` | `monday` or `sunday` | `"monday"` | Reserved. Weekly windows are day-based, so this currently has no effect. |
| `thresholds` | inline table | see below | Movement thresholds used by reports and the `only_on_change` gate. |

`thresholds` accepts `clicks_pct` (default `10.0`), `impressions_pct` (default `15.0`) and
`position_abs` (default `1.5`).

### `[report.email]` and `[report.telegram]` (delivery)

There is no separate `[delivery]` table. Delivery is configured on the two channel blocks, and both
are disabled by default.

| Key | Type | Default | Notes |
|---|---|---|---|
| `email.enabled` | boolean | `false` | Deliver the weekly report by email. |
| `email.to` | list of strings | `[]` | Recipients. |
| `email.from` | string | `""` | Envelope sender. |
| `email.only_on_change` | boolean | `true` | Skip a send when the period has no material change. |
| `email.smtp_host` | string | `""` | SMTP host. |
| `email.smtp_port` | integer 1–65535 | `587` | SMTP port. |
| `email.smtp_user` | string | `""` | SMTP user. The password comes from the secret store. |
| `telegram.enabled` | boolean | `false` | Deliver the weekly report to Telegram. |
| `telegram.chat_id` | string | `""` | Target chat id. |
| `telegram.severity` | `critical` or `all` | `"critical"` | Which findings trigger a Telegram message. |

There are no `report.email.locale` or `report.telegram.locale` keys. Set `report.locale` once; it is
the single source of truth for every rendered surface.

### `[storage]`

| Key | Type | Default | Notes |
|---|---|---|---|
| `data_dir` | path | `"data"` | Local directory for `seo.sqlite3` and engine state. A relative value written in the file resolves against the config file's parent; the built-in default resolves against the working directory. `LV24_SEO_DATA_DIR` overrides the file and stays process-scoped. |
| `raw_retention_days` | integer ≥ 0 | `90` | Reserved. No raw archives are written, so pruning is a logged no-op. |

### `[indexing]`

Quota-aware submission and index-check automation is disabled by default. `enabled = true` is
required before `lv24-seo indexing run --allow-write` applies anything; without it the run is a
read-only plan. `providers` selects the engines that participate; a provider that is not configured
is reported as `not_configured`, never guessed.

| Key | Default | Meaning |
|---|---|---|
| `enabled` | `false` | Explicit opt-in for provider submissions. |
| `providers` | `["bing", "yandex", "gsc", "indexnow"]` | Engines included in `--provider all`. |
| `max_submit_per_run` | `500` | Global submission cap for one run. |
| `max_inspect_per_run` | `20` | GSC URL Inspection / Bing `GetUrlInfo` checks per run. |
| `stale_days` | `7` | `indexing status` marks state older than this as `stale`. |
| `check_interval_days` | `7` | Re-check cadence; also sets `next_check_at`. |
| `gsc_inspect_daily_limit` | `2000` | Local UTC-day cap (GSC exposes no remaining count). |
| `indexnow_daily_limit` | `1000` | Local UTC-day cap for IndexNow submissions. |

The engine still enforces provider caps at run time: Bing's remaining daily/monthly quota, Yandex's
`quota_remainder`, 500 URLs per Bing batch and one URL per Yandex request. A scheduled
`lv24-seo indexing run --allow-write` also needs `LV24_SEO_WRITE_SECRET` in the host scheduler's
environment; see [Automation and delivery](/automation/).

## Data directory

`storage.data_dir` has three scopes:

| Value | Resolved against |
|---|---|
| Relative value written in `seo.toml` (`data_dir = "./data"`) | the config file's parent |
| Built-in default (no `[storage]` block) | the process working directory |
| `LV24_SEO_DATA_DIR` | used as given; a relative value resolves against the process working directory. The environment always wins over the file |

A config that pins a relative directory is self-contained: `--config /srv/site/seo.toml` uses
`/srv/site/data` from any working directory. `lv24-seo init` creates `<config dir>/data` and writes
`data_dir = "./data"`. Paths are made absolute with `os.path.abspath` (`~` expanded, `..` normalised);
symlinks are deliberately not resolved, so a config reached through a link anchors its data directory
next to the link. The SQLite store is `<data_dir>/seo.sqlite3`.

`lv24-seo doctor --json` makes the scope visible: `meta.data_dir` is the effective directory,
`meta.data_dir_source` is `config` when it is absolute (pinned by the file or an absolute
`LV24_SEO_DATA_DIR`) and `working directory` when it is relative, and a relative directory with a
config file present adds a warning that names the config's folder. A relative directory still works,
but running the same config from two directories reads two different databases. Set an absolute path
to pin it. `lv24-seo config show --json` reports the same effective path.

The opt-in `<data_dir>/secrets.json` fallback follows the same directory; the desktop app and the CLI
share it only when they resolve the same data directory.

## Secrets

Secrets never belong in `seo.toml`, logs, reports or test fixtures. Resolution order is environment,
then the OS keychain, then an explicitly enabled file fallback.

| Source | How to use it |
|---|---|
| OS keychain | `lv24-seo auth set --provider <name> --stdin`. Requires the optional `secrets` extra (`pip install "lv24-seo[secrets]"`). |
| Environment | Export the provider variable listed below. Environment values are read-only and always win. |
| File fallback | Set `LV24_SEO_ALLOW_FILE_SECRETS=1` and store `data/secrets.json` with `0600` permissions. On Windows the file relies on directory and file ACLs. Every run prints a warning. |

| Provider | `auth set --provider` | Environment variable |
|---|---|---|
| Google Search Console | `gsc` | `LV24_SEO_GSC_TOKEN` |
| Yandex Webmaster | `yandex` | `LV24_SEO_YANDEX_WEBMASTER_TOKEN` |
| Yandex Metrika | `metrika` | `LV24_SEO_YANDEX_METRIKA_TOKEN` |
| Bing Webmaster | `bing` | `LV24_SEO_BING_API_KEY` |
| Chrome UX Report | `crux` | `LV24_SEO_CRUX_API_KEY` |
| PageSpeed Insights | `psi` | `LV24_SEO_PSI_API_KEY` |
| SMTP | `smtp` | `LV24_SEO_SMTP_PASSWORD` |
| Telegram | `telegram` | `LV24_SEO_TELEGRAM_BOT_TOKEN` |

Gated writes also need `LV24_SEO_WRITE_SECRET`, a long random value kept in the same shell as the
apply command. A scheduled `indexing run --allow-write` needs it in the scheduler environment, not on
the command line; the generated crontab/unit/XML never contains the value. `auth status` reports
presence and source, never a value, and does not verify permissions or make a network call. `auth
login` prints manual instructions only.

## Timezone and locale

`report.timezone` must be a valid IANA zone. It is used for report and `stats` windows, MCP default
windows (`gsc_search_analytics`, `seo_opportunities`, `seo_weekly_report`) and local day boundaries.
An unknown zone fails validation with `CONFIG_INVALID`; there is no silent UTC fallback. Provider
data stays date-based and is not converted between zones.

`report.locale` accepts `ru`, `en` and `zh`; the default is `ru`. It selects the language and the
number, percent, position, date and plural formatting of the weekly email, Telegram messages, the CLI
human summary and the HTML written by `report weekly --out`. JSON envelopes, MCP payloads, stored
snapshots, `report.json` and `report diff` stay canonical English, and machine codes are never
translated. An unsupported locale fails validation instead of falling back silently.

## Validation and redaction

- Unknown keys, invalid TOML, a missing explicit `--config` path, an invalid timezone or locale, and
  an out-of-range SMTP port all fail with `CONFIG_INVALID` and exit `2`.
- `lv24-seo config show --json` prints the effective config with `meta.redacted: true`. Any key whose
  name looks like a credential (`token`, `secret`, `password`, `api_key`, `authorization`) is masked
  with `***`.
- `lv24-seo doctor` checks Python, platform, config readability, working-directory writability, the
  effective data directory and its scope, and token presence. It makes no network calls. A relative
  directory is reported with `meta.data_dir_source: "working directory"` and a warning; it is not a
  failure.

## Minimal example

```toml
[project]
name = "example.com"
base_url = "https://example.com"

[providers.gsc]
property = "sc-domain:example.com"
```

This is enough for `doctor`, `properties`, `gsc query` and `report weekly`, provided the GSC token is
available to the secret store.

## Full example

Based on the commented template written by `lv24-seo init`, with example values:

```toml
# lv24-seo workspace configuration (generated by `lv24-seo init`).
# Secrets never belong here: use `lv24-seo auth set` or the matching LV24_SEO_* variable.

[project]
name = "example.com"
base_url = "https://example.com"
default_property = "sc-domain:example.com"

[providers.gsc]
property = "sc-domain:example.com"
auth = "keychain"

[providers.yandex_webmaster]
host_id = "https:example.com:443"

[providers.yandex_metrika]
counter = "123456"
goals = [1, 2]

[providers.bing]
site = "https://example.com"
indexnow_key = "abc12345"
indexnow_key_location = "https://example.com/abc12345.txt"

[providers.crux]
origin = "https://example.com"

[providers.psi]
strategy = "mobile"
urls = ["https://example.com/", "https://example.com/pricing"]

[report]
locale = "ru"
timezone = "Europe/Minsk"
week_start = "monday"
thresholds = { clicks_pct = 10, impressions_pct = 15, position_abs = 1.5 }

[report.email]
enabled = false
to = ["owner@example.com"]
from = "seo@example.com"
only_on_change = true
smtp_host = "smtp.example.com"
smtp_port = 587
smtp_user = "seo@example.com"

[report.telegram]
enabled = false
chat_id = "123456789"
severity = "critical"

[crawl]
max_urls = 500
concurrency = 4
respect_robots = true
user_agent = "lv24-seo/0.1"

[storage]
data_dir = "./data"      # relative to this file; absolute values and LV24_SEO_DATA_DIR are used as-is
raw_retention_days = 90

[indexing]
enabled = false          # explicit opt-in for provider submissions
providers = ["bing", "yandex", "gsc", "indexnow"]
max_submit_per_run = 500
max_inspect_per_run = 20
stale_days = 7
check_interval_days = 7
gsc_inspect_daily_limit = 2000
indexnow_daily_limit = 1000
```

Delivery stays off until `enabled = true` is set on a channel. Keep the SMTP password and the
Telegram bot token in the secret store, not in this file.

## Related

- [CLI reference](/reference/cli/)
- [Security and privacy](/security/)
- [Automation and delivery](/automation/)
- [Troubleshooting](/troubleshooting/)

Source: `_source/engine-config.md`, `_source/engine-data-sources.md`, `_source/engine-releases-0.12.0.md`, `_source/engine-releases-0.5.2.md`; 0.12.2 config model in the engine repository.
