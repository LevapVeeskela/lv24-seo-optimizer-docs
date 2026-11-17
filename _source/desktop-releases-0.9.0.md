# LV24 SEO Optimizer Desktop 0.9.0

**Status: released (2026-11-17).** `0.9.0` is published on GitHub Releases for Windows x64, Linux x64
and macOS arm64/x64. The latest published line is `0.9.0`; `0.8.0` remains available for rollback and
as the previous in-app update source. See [`0.8.0.md`](0.8.0.md) for that release's notes.

| | |
|---|---|
| Desktop version | `0.9.0` (released 2026-11-17) |
| Bundled engine | `lv24-seo 0.11.0` |
| Minimum engine | `lv24-seo 0.11.0` (`MIN_ENGINE_VERSION`) |
| Contracts | generated from `lv24-seo 0.11.0` |
| Platforms | Windows x64, Linux x64, macOS arm64 and x64 (unchanged) |
| Auto-update | Windows NSIS, macOS `.app`, Linux AppImage (unchanged) |
| Manual-only | deb, rpm, MSI, portable ZIP (unchanged) |
| OS signing | Windows unsigned, macOS ad-hoc, Linux unsigned (unchanged) |

## New

### Read-only Diagnostics screen

The sidebar gains **Diagnostics** (`/diagnostics`) with five tabs. Every command is read-only and
runs through the fixed `cli_run` allow-list; the screen has no write buttons, no confirm tokens and
no `--allow-write` path.

- **Google.** `gsc_inspect` inspects exactly one absolute URL and shows verdict, coverage state,
  robots/indexing state, last crawl, fetch state, Google/user canonical, `crawledAs`, referring URLs,
  rich-result issues and the inspection link. `gsc_sitemaps` lists submitted sitemaps with type,
  index flag, errors, warnings and per-content submitted counts. GSC's deprecated `indexed` count is
  labelled as such; child sitemap URLs of an index are not exposed.
- **Yandex.** `yandex_indexing` shows appeared/removed events and indexing HTTP buckets for a date
  window. `yandex_sitemaps` lists sitemap ids, URL/error counts and last access. `yandex_queue`
  lists recrawl tasks with the provider total. A provider reset or an empty answer is shown as
  `client_side_date_filter` / `provider_returned_no_rows`, not as zero data.
- **Bing.** `bing_pages`, `bing_traffic`, `bing_crawl`, `bing_urlinfo` and `bing_joins` expose page
  stats, daily clicks/impressions, six-month crawl buckets, URL index/crawl details and the
  query/page joins. Empty stats render `no_rows_for_window`; lookups render
  `provider_returned_no_rows`. The `Date(-62135596800000)` sentinel is shown as “never”, not 0001.
- **Metrika.** `metrika_pages`, `metrika_goals`, `metrika_devices`, `metrika_countries`,
  `metrika_engagement` and `metrika_bytime` are organic-only
  (`ym:s:lastTrafficSource=='organic'`). The tab shows `meta.organic_only`, sampling fields
  (`sample_share`, `sample_size`, `sample_space`, `data_lag`, `contains_sensitive_data`,
  `total_rows_rounded`) and every limitation.
- **Core Web Vitals.** `cwv_audits` lists bounded Lighthouse audits with score, display value and
  savings; `cwv_history` lists weekly CrUX p75 rows with collection periods. A low-traffic URL shows
  the explicit `low_traffic` empty state instead of a blank table.

### Honest report chrome

Every tab renders the engine's `total`, `truncated`, `data_age_days` and `limitations` (or states
that no limitations were reported). Provider empties are explicit states, never zeros. The panels do
not auto-retry reads.

### Bridge hardening

The Rust bridge adds 18 allow-listed command ids and rejects, before spawning the engine:

- write flags (`allowWrite`, `confirm`) and tokens on every diagnostics command;
- unknown `group`, `strategy`, `device` or `category` values;
- arguments that belong to a different command;
- a `--site` override for Bing reads (the target stays `providers.bing.site`).

The webview cannot pass an executable, a shell string or an arbitrary flag. Diagnostics commands are
config-required and non-cancellable, like the other short reads.

## Changed

- `MIN_ENGINE_VERSION` is now `0.11.0`; an installed `0.10.x` sidecar is reported as incompatible
  instead of failing with `CLI_INVALID_JSON`.
- The bundled onedir sidecar is `lv24-seo 0.11.0`. The Windows x64 reviewed pin records the built
  `0.11.0` executable; Linux/macOS pins remain `null` and are covered by rebuild-aware CI checksum
  reports.
- Contracts (`config.schema.json`, CLI fixtures including `stats`) are regenerated from engine
  `0.11.0`.
- The desktop README, architecture and security docs describe the diagnostics surface and the
  read-only allow-list.

## Not changed

- No new write surface: Bing URL submission, Bing sitemap submit and IndexNow keep their existing
  two-phase gates. GSC sitemap submit and Bing sitemap delete remain `WRITE_DISABLED`.
- MCP stays at 12 tools and the SQLite schema at version 4.
- Platform matrix, installer formats, updater and signing status are unchanged.

## Verification

Local quality gate on the release commit:

```bash
npm run typecheck
npm test
npm run build
npm run contract:check
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test
node scripts/verify-sidecar.mjs --root src-tauri/engine \
  --target x86_64-pc-windows-msvc --engine-version 0.11.0 --require-pinned
```

Results: 742 Vitest tests passed, 163 Rust tests passed, contracts up to date at engine `0.11.0`,
and the Windows sidecar verified against the pinned SHA-256 (`db02d1b3…`, 14,478,498 bytes).

The four platform bundles are built by the manual `Desktop build` workflow with
`engine_version=0.11.0`; the workflow requires a sidecar checksum report per shipped target and
publishes `latest.json` and `SHA256SUMS.txt`.

## Limitations

- Metrika goals are shown as totals only; the desktop does not expose the engine's optional
  `--dimension page|source` selector.
- CWV history “all devices” omits the device filter instead of inventing a combined row.
- Bing reads use `providers.bing.site`; the desktop has no `--site` override.
- Bing Site Scan still has no public API: the Integrations card only opens the official page and
  cannot import a scan report.
- An engine older than `0.11.0` is reported as incompatible. Update the engine or install the
  bundled sidecar.
