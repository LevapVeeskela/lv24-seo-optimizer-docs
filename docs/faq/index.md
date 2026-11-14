---
title: FAQ
description: Short answers about cost, tokens, data storage, MCP, the desktop app, unsigned builds and reporting.
---

# FAQ

## Is the tool really free?

Yes, for the default path. Google Search Console, Yandex Webmaster, Yandex Metrika, Bing, CrUX and
PageSpeed Insights all have free tiers, and no required dependency needs a card on file. Optional
paid SERP and backlink adapters are documented but not shipped; if one is added later, it uses your
own key and stays off by default. See [Data sources and quotas](/providers/).

## Do I need a token for every provider?

Only for the providers you configure. GSC, Yandex Webmaster, Yandex Metrika, Bing and CrUX need a
token or API key; PSI works without a key. `lv24-seo auth status --json` shows presence and source,
never a value. See [Configuration reference](/reference/config/).

## Does it scrape Google or Yandex?

No. Query, rank and indexing data comes from provider APIs. The project never scrapes SERPs, solves
CAPTCHAs or automates Yandex Business. See [Data sources and quotas](/providers/).

## Where is my data stored?

In the local SQLite database under `storage.data_dir` (`data/seo.sqlite3` by default), plus report
files you request with `--out`. A relative `data_dir` written in `seo.toml` is anchored to that file,
so the same config uses the same database from any working directory; the built-in default and
`LV24_SEO_DATA_DIR` remain process-scoped. There is no telemetry endpoint. Data leaves the machine
only through provider API calls and the delivery channels you enable. See
[Security and privacy](/security/).

## CLI or MCP — which should I use?

Both sit on the same engine and return the same data. The CLI is for terminals, cron and CI. The MCP
server exposes 11 tools to coding agents over stdio or streamable HTTP. See
[MCP and agent skills](/mcp/).

## Desktop app or CLI?

The desktop app wraps the same engine as a PyInstaller sidecar and adds a dashboard, settings forms
and a recommendations page. The CLI remains the scriptable surface, and both read the same
`seo.toml` and data directory. See [Desktop app](/desktop/).

## Does the desktop app update itself?

Yes, for Windows NSIS, macOS `.app` and Linux AppImage: the app checks `latest.json`, verifies a
minisign signature and installs only after you confirm. deb, rpm and the portable ZIP are
manual-only. Before the installer starts, the app stops only the engine sidecar PIDs it started; if
one cannot be stopped, the update is blocked with `UPDATE_ENGINE_BUSY` and can be retried after that
run exits. The 0.1.0 build predates the updater and needs one manual upgrade. See
[Releases and update](/release/).

## Why are the builds unsigned?

OS code signing needs paid certificates and notarization, which this project does not buy. Windows
and Linux packages are unsigned; macOS is ad-hoc signed. Updater payloads are separately
minisign-signed, which protects updates but does not make the installer trusted by the OS. Verify
`SHA256SUMS.txt` before running an installer. See [Security and privacy](/security/).

## Windows SmartScreen blocks the installer. What should I do?

SmartScreen, Smart App Control or antivirus may warn because the installer has no Authenticode
signature. Download only from the release page, verify the SHA-256 against `SHA256SUMS.txt`, and let
Windows run this specific app only if you accept the risk. Keep SmartScreen and antivirus enabled.
See [Install](/install/).

## macOS refuses to open the app. What now?

The app is ad-hoc signed, so Gatekeeper warns on first launch. Open it once through System Settings →
Privacy & Security → Open Anyway, or right-click the app and choose Open. Do not disable Gatekeeper.
See [Install](/install/).

## How are tokens stored on Linux?

Through the OS Secret Service keychain when the engine's `secrets` extra is installed; the desktop
passes the session-bus and XDG runtime variables the keychain needs. Without a keychain, set
`LV24_SEO_ALLOW_FILE_SECRETS=1` to use the `0600` file fallback, which prints a warning on every run.
See [Configuration reference](/reference/config/).

## Can I track several sites?

Not in one config: one `seo.toml` describes one project and one set of provider targets. Run one
config per site and pass `--config path/to/seo.toml`; the desktop works with one selected config at a
time. See [Configuration reference](/reference/config/).

## Why do Yandex and GSC numbers differ?

They measure different things. GSC returns up to 50,000 rows per day with 2–3 days of latency.
Yandex returns at most 3,000 queries per period, has no query-by-page join and lags about four days.
The tool never sums across engines or fills missing rows with zero. See
[Data sources and quotas](/providers/).

## How do I change the report language?

Set `report.locale` to `ru`, `en` or `zh` (default `ru`). It controls email, Telegram, the CLI human
summary and the HTML written by `report weekly --out`. JSON envelopes, snapshots, `report.json` and
`report diff` stay canonical English. See [Configuration reference](/reference/config/).

## How long is data kept?

Snapshots and crawl rows stay in SQLite until you delete the data directory; one snapshot is kept
per kind, property and period. `storage.raw_retention_days` is reserved and currently a no-op
because no raw archives are written. Back up the database before upgrading. See
[Security and privacy](/security/).

## Why is my weekly report incomplete?

Providers lag and cap data. Check `data_age_days`, `truncated`, `limitations[]` and `warnings[]` in
the envelope, and raise `--lag-days` if the newest days are still filling. A GSC final page that
exactly fills the 50,000-row cap is reported as truncated, not complete. `report diff` also needs
two stored weekly runs. See [Troubleshooting](/troubleshooting/).

## Can I get logs?

Yes, but logging is opt-in. Set `LV24_SEO_LOG_LEVEL=INFO` (or `DEBUG`, `WARNING`, …) for the CLI or
`lv24-seo mcp serve`; the redacting handler is installed only at those entry points. When stderr is
not a terminal, each record is one JSON line. The `--json` envelope remains the stable diagnostic
interface. See [Configuration reference](/reference/config/).

## Can I run it in CI?

Yes. Use `--json` with exit codes, and `report diff --markdown` for a pull-request comment or job
summary; warnings go to stderr so stdout stays valid Markdown. Keep tokens in CI secrets, never in
`seo.toml`. See [CLI reference](/reference/cli/).

## How do I contribute?

Open an issue first, branch from `main`, keep one area per change, and run the full gate before a
pull request:

```bash
uv sync --extra dev
uv run ruff check . && uv run ruff format --check . && uv run mypy src && uv run pytest -q
```

See the [contributing guide](https://github.com/LevapVeeskela/lv24-seo-optimizer/blob/main/CONTRIBUTING.md)
for accepted changes and the commit format.

## Where do I report bugs?

Engine, CLI and MCP issues: [lv24-seo-optimizer issues](https://github.com/LevapVeeskela/lv24-seo-optimizer/issues).
Desktop app issues: [lv24-seo-optimizer-desktop issues](https://github.com/LevapVeeskela/lv24-seo-optimizer-desktop/issues).
Include the `lv24-seo version` output, the exact command, the `--json` envelope and the exit code.
Redact tokens and customer data.

## Is any telemetry sent?

No. There is no telemetry endpoint and no `[privacy]` section to disable. The tool sends data only to
the providers you query and the delivery channels you enable; the desktop contacts GitHub only for
update metadata.

Source: `_source/engine-cli.md`, `_source/engine-config.md`, `_source/engine-data-sources.md`, `_source/engine-security.md`, `_source/engine-releases-0.5.2.md`, `_source/desktop-README.md`, `_source/desktop-security.md`, `_source/desktop-releases-0.2.2.md`.
