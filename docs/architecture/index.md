---
title: Architecture
description: Engine package layout, provider envelopes, storage, report snapshots, desktop FSD structure, Rust shell and sidecar resolution.
---

# Architecture

The product has one engine of record and one shell:

- `lv24-seo 0.15.2` owns provider clients, crawl, analysis, reports, storage, MCP tools,
  CLI commands, OAuth connectors, indexing automation and automation.
- The desktop app `0.9.8` is a React webview plus a Rust process shell. It renders
  screens, edits configuration and launches the bundled engine; it does not reimplement
  engine behaviour.

Both surfaces share the same SQLite history when they point at the same workspace.

## Engine layers

```text
surfaces        CLI (Typer) · MCP server · skills · automation
                          |
analysis/report  deltas · rules · digests · render · delivery
                          |
store            SQLite (WAL) · snapshots · sends ledger
                          |
providers/crawl  provider adapters · fetcher · sitemap · log ingest
                          |
core             config · http · errors · time · write gate
```

Dependencies point downward only. `providers` and `crawl` never import `report` or `cli`. Analysis depends on store models, not on provider client classes.
Adapters never mutate the database; the caller persists. `indexing.py` is the quota-aware
submission/check engine: `SeoService` builds its clients and targets, the engine reads and writes
`indexing_state`/`indexing_runs` and calls provider adapters only through the write gate.

## Engine package layout

| Package | Responsibility |
|---|---|
| `core/` | Layered config, HTTP retry/rate limiting, typed errors, envelopes, time, secret store, logging redaction, write gate |
| `providers/` | GSC, Yandex Webmaster, Yandex Metrika, Bing, CrUX, PSI, optional GA4 adapters |
| `crawl/` | Fetcher, HTML parsers, robots and sitemap handling, rule modules, link graph, log ingest |
| `analysis/` | Delta, opportunities, indexing triage, fusion and crawl rules |
| `store/` | SQLite schema, migrations, repositories, snapshot and sends ledgers |
| `report/` | Builders, locale catalogs, renderers, delivery, diff |
| `mcp/` | Server, canonical registry, resources, prompts |
| `cli/` | Typer commands and human renderers |
| `automation/` | Scheduler generators, delivery recipes, GitHub Actions recipes |

`src/lv24_seo/mcp/registry.py` is the single source of truth for tool metadata. It drives the MCP JSON schemas, CLI help, `schemas/tools.json` and the
documentation tables. Never hand-edit a generated file; regenerate it with:

```bash
python -m lv24_seo.mcp.registry --write
python -m lv24_seo.mcp.registry --check
```

There are 12 tools: ten read tools and two gated write tools. `seo_crawl_site` and `seo_weekly_report` are read tools that persist local snapshots, so the
generated schema adds `writes_local_state` and marks them `readOnlyHint: false`.

## Provider contract

Every adapter returns the same envelope, which is what makes multi-engine fusion honest:

```python
@dataclass(frozen=True)
class ProviderResult[T]:
    source: str              # gsc, yandex_webmaster, yandex_metrika, bing, crux, psi
    property_id: str         # provider property id
    fetched_at: datetime     # UTC
    data_age_days: int       # provider lag at fetch time
    rows: list[T]
    total: int | None        # total available, when the provider reports it
    truncated: bool          # True when a cap was hit
    limitations: list[str]   # machine codes such as rows_cap_50000
    warnings: list[str]      # human hints such as host_not_loaded
```

Rules:

- `truncated` is computed from the provider's own cap and evidence of more data, never
  guessed. GSC reports a final page that exactly fills the cap as `truncated: true`; a full page
  is not proof that no further row exists.
- `limitations` codes are enum-like and translated only in the report renderer.
- A degraded host is data, not an exception: empty rows, `host_not_loaded` warning and
  `degraded_host` limitation.

## Envelopes and failure model

CLI `--json` and MCP structured output use one envelope:

| Field | Meaning |
|---|---|
| `ok` | Success or typed failure |
| `data` | Payload on success |
| `error.code` | Stable machine code on failure |
| `error.message` | Human message without request bodies or tokens |
| `error.next_action` | Suggested next command |
| `error.retryable` | Whether a retry can help |
| `meta` | At least `version`; may add `truncated`, `data_age_days`, `limitations`, `sources` |
| `warnings` | Missing tokens, missing properties, degraded hosts |

Branch on `error.code`, not the exit code: several different failures share exit `2`. `PROPERTY_NOT_FOUND` has no dedicated exit code. Exit `5` is reserved for
a successful payload with `meta.truncated` and `meta.strict`; no current command sets `strict`.

Partial failure is normal. A weekly report with failing sources still returns the available sections plus `sources_failed` and `complete: false`. It never
cancels the whole run for one engine's 401/403/429/timeout. A total outage yields an explicit no-data report.

## Storage and migrations

SQLite runs in WAL mode. `data/seo.sqlite3` is git-ignored. A relative `storage.data_dir` written in `seo.toml` is anchored to the
config file's parent; the built-in default and `LV24_SEO_DATA_DIR` stay process-scoped. `doctor --json` reports `meta.data_dir` and
`meta.data_dir_source`, and `config show --json` reports the effective path. The main tables are:

| Table | Purpose |
|---|---|
| `properties` | Configured sites and provider ids |
| `metric_daily` | True per-day rows only, keyed by date |
| `metric_windows` | Window aggregates with their real `[start, end]` |
| `pages` | URL inventory and index state |
| `issues` | Crawl and provider findings with lifecycle state |
| `snapshots` | Report diff base: canonical JSON, gzipped |
| `sends` | Delivery ledger and idempotency claims |
| `runs` | Every executed crawl, report or provider operation |
| `indexing_state` | Local queue position per provider/URL: `last_submitted_at`, `last_checked_at`, `submit_status`, `index_status`, `next_check_at` (schema v5) |
| `indexing_runs` | One row per provider per indexing run: planned, submitted, checked, skipped, quota before/after and status (schema v5) |
| `quota_usage` | Local UTC-day counters for GSC inspection and IndexNow (schema v5) |
| `schema_migrations` | Append-only migration ledger |

Daily rows and window aggregates live in different tables by construction, so overlapping windows never overwrite each other. A single-dimension key is stored
raw; multi-dimension keys are JSON-encoded, so a value containing `|` cannot collide.

Schema changes are numbered migrations in `store/db.py`, recorded in `schema_migrations`. User rows are never deleted by an upgrade. Migration 2 labels
pre-migration GSC daily rows with `accuracy=legacy_unknown_granularity`; their original window cannot be recovered. Normal daily reads exclude them, and callers
may inspect them explicitly with `include_legacy=True`. Migration 5 adds `indexing_state`, `indexing_runs` and `quota_usage`; a fresh database records versions 1..5. All migrations are additive.

There are no on-disk raw provider archives. Snapshots are gzipped canonical JSON inside the `snapshots` table. `raw_retention_days` is a reserved setting;
pruning logs that it has no effect.

## Report snapshots and delivery

`report/builders.py` produces a `Report` dataclass that is JSON-serialisable and canonical English. `Report.to_dict()` has no locale field, so snapshots, report
diff and MCP payloads do not change with the display language. `report/i18n.py` is presentation-only: locale catalogs (`en`, `ru`, `zh`), plural rules and
number, percent, position and date formatting. An unknown locale falls back to English; an invalid numeric or date value renders as empty text, never as `0`.

The weekly email is a 600px inline-CSS template with KPI cards, top opportunities, issue severities, merged sources, data notes and a footer. It has no external
images, stylesheets, scripts or tracking pixels. Delivery uses a verifying TLS context, a normalized transport result and a semantic content hash that includes
the render locale. A locale change re-sends the same period once; rebuilding it in the same language does not.

Report diff reads two stored weekly snapshots, by default the second newest and the newest. Metrics present in only one snapshot are unknown, not zero.
`report diff` is read-only and makes no provider calls.

## Desktop frontend

Feature-Sliced Design, dependencies pointing downward:

```text
app/        root store, providers, router, layout, styles
pages/      dashboard, reports, settings, configuration, recommendations, not-found
features/   save-config, secret-set, update, agent-task
entities/   config, engine, report, stats, recommendation, update
shared/     CLI transport, desktop settings/files, i18n, UI primitives, formatting
```

There is no `widgets/` layer in `0.3.0`. The header, navigation and update badge live in `app/layout` and `features/update`; a widget layer is added only when a
slice is genuinely reused across pages.

Each slice exposes one public API and never imports another slice's internals. The envelope parser and error mapping live in `shared`; screens never parse raw
process output. The UI locale (`en`, `ru`, `zh`) is independent from `report.locale`. Machine codes are never translated; unknown codes are shown raw.

State is scoped to the current workspace: changing the workspace or losing the engine clears report, stats, doctor and secret state instead of showing
the previous project's data. Actions that cannot succeed are disabled, not left to fail on click. The en/ru/zh catalogues are at parity; a missing key is
a test failure.

MobX stores hold the root state, engine status, configuration draft, report data, recommendations and updater state. `UpdateStore` performs a silent startup
check with a 30-second timeout, a manual check from Settings, and an install only after an explicit click. It disables in-app installation for portable, deb,
rpm, MSI and unknown bundle types.

## Rust shell and sidecar

| Module | Responsibility |
|---|---|
| `commands.rs` | Fixed Tauri commands, engine status, `MIN_ENGINE_VERSION`, `prepare_update` |
| `cli.rs` | Argv construction, stdin bridge, environment filter, timeouts, bounded output |
| `config.rs` | `toml_edit` patches, validation, durable atomic replace, `0600` backups, bounded reads |
| `paths.rs` | Config/data/log/export roots, path allow-lists, sidecar resolution |
| `settings.rs` | UI locale, window bounds, selected config path |
| `error.rs` | Typed errors crossing the IPC boundary |

The release sidecar is a PyInstaller **onedir** tree. Onefile is rejected because it extracts on every call, starts slowly and is unsuitable for macOS signing.
The tree is mapped into Tauri resources as `engine/lv24-seo/`; the shell resolves, in order:

1. `LV24_SEO_BIN` (absolute only);
2. `<resource_dir>/engine/lv24-seo/lv24-seo[.exe]` (`bundled`);
3. `<resource_dir>/lv24-seo/lv24-seo[.exe]` (`bundled-flat`);
4. the Linux AppImage tree `$APPDIR/usr/lib/<product>/engine/lv24-seo/` (`appimage`);
5. a sibling `lv24-seo/` next to the app (`sibling`);
6. `PATH`, only when `LV24_SEO_ALLOW_PATH_ENGINE=1`.

Nothing is downloaded automatically. The shell runs `lv24-seo version --json`, records the path, source and version, and compares it with `MIN_ENGINE_VERSION`
(`0.15.2` in the current source). An older engine is marked `compatible: false`; the UI treats it as offline and shows a notice. A newer engine passes the gate
but is not the release-tested pin. Desktop `0.9.0` added 18 read-only diagnostics command ids to the same allow-list; `0.9.1` added the `auth_login` and `open_oauth_url` bridge commands; `0.9.2` adds `indexing_status`, `indexing_history` and `schedule_status`. All are argument-validated, config-required and non-cancellable.

## Data flow

- **CLI:** parse args → build one `composition.Workspace` (config plus shared SQLite) →
  run one service operation → close storage. A write apply with `--confirm` attaches the SQLite
  idempotency ledger; a store-less apply warns that replay protection is off for the token's
  five-minute lifetime.
- **MCP:** tools call the same services through the same composition root. The SDK runs
  handlers in worker threads, but the `sqlite3` connection is bound to its creating
  thread, so every tool is registered through an `async` adapter. Calls run on the
  event-loop thread, one at a time; concurrent `tools/call` requests are serial.
- **Desktop:** the webview invokes a fixed Tauri command; Rust validates arguments,
  launches the sidecar with an argv array and `--json`, parses one envelope and returns
  a typed result. One workspace is active at a time. There is no local HTTP API.

Without `init`, CLI and MCP run store-less with an explicit warning. The desktop still needs a selected `seo.toml`; it does not invent a data directory or
silently override `LV24_SEO_DATA_DIR`.

## Portability

Windows, macOS and Linux are supported targets:

- Windows requires the WebView2 runtime; the NSIS installer can fetch it, the portable
  ZIP cannot. The shell launches with `CREATE_NO_WINDOW` and sets `PYTHONUTF8=1` and
  `PYTHONIOENCODING=utf-8` so non-ASCII paths survive code pages.
- macOS requires macOS 13 or later. Builds are ad-hoc signed, not notarized.
- Linux bundles are built on Ubuntu 22.04 with a glibc 2.35 baseline. AppImage may need
  FUSE 2; deb and rpm are manual-only.
- Shipped targets are Windows x64, Linux x64, macOS arm64 and macOS x64. There is no
  Windows arm64 or Linux arm64 build.

See [Security and privacy](/security/) for the controls and [Releases and updates](/release/) for packaging.

Source: `_source/engine-architecture.md`, `_source/desktop-architecture.md`, `_source/engine-auth.md`, `_source/engine-releases-0.15.2.md`, `_source/engine-releases-0.15.1.md`, `_source/engine-releases-0.15.0.md`, `_source/engine-releases-0.14.1.md`, `_source/engine-releases-0.14.0.md`, `_source/engine-releases-0.13.1.md`, `_source/engine-releases-0.13.0.md`, `_source/engine-releases-0.12.2.md`, `_source/engine-releases-0.12.0.md`, `_source/engine-releases-0.11.0.md`, `_source/engine-releases-0.5.3.md`, `_source/desktop-releases-0.9.8.md`, `_source/desktop-releases-0.9.7.md`, `_source/desktop-releases-0.9.6.md`, `_source/desktop-releases-0.9.5.md`, `_source/desktop-releases-0.9.4.md`, `_source/desktop-releases-0.9.3.md`, `_source/desktop-releases-0.9.2.md`, `_source/desktop-releases-0.9.1.md`, `_source/desktop-releases-0.2.2.md`, `_source/desktop-release.md`.
