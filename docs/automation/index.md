---
title: Automation and delivery
description: Install cron, systemd or Task Scheduler jobs, deliver email and Telegram digests, and keep writes idempotent.
---

# Automation and delivery

There is no daemon. Scheduling is delegated to the host scheduler; the tool provides generators and a `--print` mode so nothing is written without consent. The same report pipeline runs from cron, systemd, Task Scheduler or a CI job.

Related: [Reports and diffs](/reports/), [Data sources and quotas](/providers/), [Crawl and audit](/crawl/), [MCP and agent skills](/mcp/).

## Install or preview a schedule

```bash
lv24-seo schedule install --kind weekly --cron "0 6 * * 1" --config ./seo.toml --print
lv24-seo schedule install --kind daily --cron "0 6 * * *" --config ./seo.toml
lv24-seo schedule install --kind indexing --config ./seo.toml
lv24-seo schedule print --kind indexing --target systemd --config ./seo.toml --json
lv24-seo schedule status --kind indexing --config ./seo.toml --json
```

Defaults are `weekly` at `0 6 * * 1`, `daily` at `0 6 * * *` and `indexing` at `0 4 * * *`. The generated report command is `report weekly --send --json`; the daily kind adds `--days 1 --lag-days 0`. The absolute `--config` path and the config directory as working directory are embedded, so a custom filename, a path with spaces or several configs in one folder keep working.

`schedule install` plans by default and writes only with `--allow-write`; it takes `--target auto|cron|systemd|windows` (auto-detects the host). `schedule print` renders without touching the host. `schedule status` is read-only and reports `installed`, `outdated`, `partial`, `missing` or `unknown` with per-artefact `exists`/`matches`; `schedule uninstall --allow-write` removes exactly the generated artefacts.

## Artifacts

| Target | Artifact | Location | Timezone behaviour |
|---|---|---|---|
| `cron` | Managed crontab block with `CRON_TZ=<zone>` and a `cd` prefix | Current user's crontab | `CRON_TZ` is honoured by Vixie/ISC cron; other daemons use host time |
| `systemd` | `lv24-seo-<kind>.service` and `.timer` user units | `~/.config/systemd/user` (XDG-aware) | `OnCalendar` includes the configured IANA zone |
| `windows` | UTF-16 Task Scheduler XML plus generated `.vbs` launcher | `%APPDATA%\lv24-seo\schedule` | `StartBoundary` carries the resolved UTC offset |

The cron block is delimited by `# >>> lv24-seo:<name> >>>` and `# <<< lv24-seo:<name> <<<`. Re-installing replaces every managed block for that job. A damaged block with a missing end marker is treated as extending to the next managed marker or EOF, so `schedule install` repairs the file instead of appending a duplicate job.

Only simple cron shapes (`M H * * *` and `M H * * DOW`) convert to systemd or Windows. Anything else is rejected instead of silently rescheduled. An unknown or unavailable timezone is rejected before installation.

The install result always carries a `warnings` list with the backend limits: cron may ignore `CRON_TZ`, and Windows XML encodes a fixed offset rather than an IANA zone, so a seasonal DST change needs a review. Windows uses `tzdata` (included on Windows). Systemd enables the timer with `systemctl --user daemon-reload` and `systemctl --user enable --now`.

### Windows hidden launcher

`schedule install --target windows` writes `<name>.xml` plus `<name>.vbs` (UTF-16 with a BOM) in
`%APPDATA%\lv24-seo\schedule` and registers
`C:\Windows\System32\wscript.exe //B //Nologo "<name>.vbs"`. The launcher runs the real command with
`WScript.Shell.Run(command, 0, True)`: no console window opens, the engine gets the task working
directory, the process is awaited, and `WScript.Quit` forwards the exit code. `schedule status`
lists the `task`, `xml` and `vbs` artefacts; a missing or changed launcher is `outdated` (or
`partial` when the task is not registered), and `schedule uninstall` removes both files. A task
installed by engine `0.14.0` or older keeps the console action until it is reinstalled once:
`lv24-seo schedule install --kind indexing --target windows --allow-write`. The launcher is generated
and contains no secret; `LV24_SEO_WRITE_SECRET` stays in the scheduler environment.

## Indexing automation job

Installing the indexing job is the explicit automation opt-in. It renders a job named
`lv24-seo-indexing` at `0 4 * * *` (daily, in the configured timezone) whose command is
`lv24-seo indexing run --allow-write --config <absolute path> --json`. `--allow-write` is embedded
because installing the job is the opt-in; the engine still re-reads provider quotas, verifies the plan
hash, skips URLs whose `last_submitted_at` is newer than their `lastmod`, and records one
`indexing_runs` row per provider. `[indexing] enabled = true` is still required, so a job installed
before the config is enabled only plans.

**The write secret is not in the command line.** `LV24_SEO_WRITE_SECRET` must be present in the
environment the scheduler starts the job in:

- **systemd user unit:** add a drop-in that survives reinstall, for example
  `%h/.config/systemd/user/lv24-seo-indexing.service.d/secret.conf` with `[Service]` and
  `EnvironmentFile=%h/.config/lv24-seo/write.env`, and a `0600` env file containing
  `LV24_SEO_WRITE_SECRET=<value>`; then run `systemctl --user daemon-reload`. A hand-edited unit is
  reported as `outdated` and replaced on reinstall, so the drop-in is safer.
- **Windows Task Scheduler:** set the variable once in the user environment
  (`setx LV24_SEO_WRITE_SECRET "<value>"`) and start a new session so the task inherits it. The XML
  carries no secret.
- **cron:** export the variable above the managed block or source a `0600` env file from a wrapper
  script; do not put the value on the `lv24-seo` command line.

`indexing status` reports `write_secret_present: false` and `write_secret_missing` when the variable
is absent, so a missing secret is visible before the next scheduled apply fails with
`WRITE_DISABLED`.

## Recommended cadence

| Job | When | Why |
|---|---|---|
| `report weekly --send` | Monday 06:00 | GSC data has 2–3 days of lag; Monday is stable |
| `crawl --start URL` | Weekly, after the report | Keeps crawl evidence close to the reporting window |
| `indexing run --allow-write` | Daily 04:00 | Checks due URLs and submits within fresh quotas; needs `[indexing] enabled=true` and the write secret in the scheduler environment |
| `auth status` | Weekly | Confirms presence and source of every provider token |
| CrUX field data | Weekly | 28-day rolling window; daily polling adds nothing |

Keep one schedule per period. Delivery is at-least-once, so two overlapping schedules can send the same report twice even with the ledger.

## Email and Telegram

Email uses SMTP on port 587 with STARTTLS and a verifying TLS context. The login never runs after a TLS failure. The message is `multipart/alternative`: the product HTML template plus the same content as 78-column plain text, with a localized subject of at most 78 characters.

The template is a 600px card with inline CSS and no external images, stylesheets, scripts, tracking pixels or remote fonts. Unknown KPI values render as the localized "No data" text, never `0`. Metrika is shown as sessions, not clicks. An empty issues section says no issue data was provided instead of claiming the site is clean. Limitations and warnings are deduplicated; provider prose stays in its original language and is labelled when the report is localized. The footer carries the property id, the UTC generation time and "generated by lv24-seo".

Telegram sends the same 78-column localized text through the Bot API `sendMessage` method. HTTP 4xx/5xx responses, timeouts and malformed answers are `failed`, never recorded as sent.

Only email and Telegram channels exist. There are no Resend or Brevo adapters and no `--channel github`.

Configure delivery in `seo.toml` under `[report.email]` and `[report.telegram]`. SMTP passwords and the Telegram bot token come from `auth set --provider smtp|telegram`, never from the config file. `--send` is required; the generated schedule already includes it.

## Idempotency

Report delivery is idempotent through the `sends` ledger, unique on `(kind, property, period, channel, content_hash)`. The hash covers the headline and sections plus the normalized render locale; `generated_at` and diagnostics are excluded. English omits the locale from the hash so upgrading does not re-send an already delivered English period.

`only_on_change` skips a send when the content hash was already delivered (`already_sent`). The material gate skips it when no change reaches `report.thresholds` (`no_material_change`). The gate runs before the locale hash, so a pure locale switch can still be suppressed when the period has no material change.

Delivery is at-least-once per channel. An ambiguous transport result is reported `failed` and never recorded, so the next run may deliver a duplicate. SMTP and the Bot API offer no exactly-once primitive after a process crash. The database serializes delivery attempts and may block other writers up to the transport timeout.

## Write gates

Provider writes are separate from report delivery. The CLI uses a dry run followed by an explicit apply:

1. Run the write command with `--allow-write` and `LV24_SEO_WRITE_SECRET` set. Without the secret the gate refuses with `WRITE_DISABLED`.
2. Review the plan, `plan_hash` and `confirm_token`. The token is an HMAC over the action, target, plan hash and expiry, valid for 300 seconds.
3. Apply with the same flags plus `--confirm <token>`. A changed plan, wrong secret, malformed token or expired token fails with `CONFIRM_REQUIRED`.

The gate supports a pending-to-sent idempotency claim. With an initialised workspace the CLI attaches the SQLite ledger, so a failed provider call releases the claim and a retry is allowed; a completed or in-flight claim is a duplicate and returns `skipped`. Without a data directory the apply still runs, but the envelope warns that replay protection is off for the token's five-minute lifetime. A dry run opens no ledger and creates no database. A crash can leave a pending claim with no TTL, which is treated as in-flight until an operator releases it.

In 0.14.1, IndexNow, Bing sitemap submit, Bing URL submission, Yandex recrawl and `indexing run --allow-write` actually submit; GSC sitemap submit and Bing sitemap delete refuse with `WRITE_DISABLED` instead of pretending. MCP write tools require `allow_write=true`; `seo_sitemap_submit` for Bing and `seo_recrawl_request` are wired, while GSC submit and Bing delete return `WRITE_DISABLED`. Indexing automation has no MCP tool: it is CLI and scheduler only. The desktop `0.9.4` card renders the same status, history and schedule data read-only; see [Indexing automation](/indexing/).

## GitHub Actions

The product repository ships a weekly workflow recipe at `examples/github-actions/seo-weekly.yml`. Copy it into your site repository, not into the tool repository.

```yaml
on:
  schedule:
    - cron: "0 6 * * 1"
  workflow_dispatch:
permissions:
  contents: read
```

The recipe uses a standard `ubuntu-latest` runner, a single job, a 15-minute timeout, a `concurrency` group and short artifact retention. On a public repository with standard runners this costs $0. A private repository consumes included or billed Actions minutes and storage; larger runners, matrices and paid add-ons are out of scope for the zero-spend path.

The job restores `data/seo.sqlite3` (plus `-wal` and `-shm`) with `actions/cache`, creates the data directory, and runs:

```bash
uvx --from lv24-seo lv24-seo report weekly --send --json
```

Provider and delivery credentials come from repository secrets. Non-secret identifiers stay in the committed `seo.toml`. GitHub cron is always UTC, so convert the intended local time explicitly.

## Timezone

`report.timezone` is an IANA zone (default `Europe/Minsk`). It drives report and `stats` windows, MCP default windows and local day boundaries. Provider data stays date-based and is not converted.

Scheduler backends apply the zone where they can and report a warning where they cannot. An invalid zone fails config validation with `CONFIG_INVALID`; it is never silently replaced. Review Windows tasks after a DST transition, and confirm that the installed cron daemon supports `CRON_TZ` before relying on it.

Source: `_source/engine-scheduling.md`, `_source/engine-cli.md`, `_source/engine-config.md`, `_source/engine-auth.md`, `_source/engine-releases-0.14.1.md`, `_source/engine-releases-0.14.0.md`, `_source/engine-releases-0.13.1.md`, `_source/engine-releases-0.13.0.md`, `_source/engine-releases-0.12.2.md`, `_source/engine-releases-0.12.0.md`, `_source/engine-releases-0.11.0.md`.
