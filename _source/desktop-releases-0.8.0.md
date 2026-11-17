# LV24 SEO Optimizer Desktop 0.8.0

**Status: released (2026-11-17).** `0.8.0` is published on GitHub Releases for Windows x64, Linux x64
and macOS arm64/x64. The latest published line is `0.8.0`; `0.7.0` remains available for rollback and
as the previous in-app update source. See [`0.7.0.md`](0.7.0.md) for that release's notes.

| | |
|---|---|
| Desktop version | `0.8.0` (released 2026-11-17) |
| Bundled engine | `lv24-seo 0.10.0` |
| Minimum engine | `lv24-seo 0.10.0` (`MIN_ENGINE_VERSION`) |
| Contracts | generated from `lv24-seo 0.10.0` |
| Platforms | Windows x64, Linux x64, macOS arm64 and x64 (unchanged) |
| Auto-update | Windows NSIS, macOS `.app`, Linux AppImage (unchanged) |
| Manual-only | deb, rpm, MSI, portable ZIP (unchanged) |
| OS signing | Windows unsigned, macOS ad-hoc, Linux unsigned (unchanged) |

## New

### Bing URL submission

- **A real, gated URL write.** The Integrations screen adds a Bing URL submission card that builds
  `bing submit --config <path> [--url <abs> ...] [--from-sitemap] [--sitemap-url <abs>] --allow-write [--confirm <token>] --json`.
  The engine sends `SubmitUrlbatch`; only `provider: bing` is accepted and it is never emitted
  because the command group already names Bing.
- **Two phases, one reviewed plan.** Planning runs with the write opt-in but no token, reads the
  current quota and contacts no write endpoint. The card shows the URL count, the 500-URL batch
  count, the remaining quota and the engine's limitations. **Apply** sends the reviewed `--confirm`
  token. A cancelled or failed apply drops the plan and requires a fresh review.
- **URL list, sitemap or both.** URLs are entered one per line and/or read from the project sitemap
  with `--from-sitemap`. The shell merges both sources, requires at least one, accepts at most
  10,000 URLs, and rejects a relative URL, a duplicate write flag or a token without the opt-in
  before the engine starts.
- **Bounded sitemap input.** The engine reads a `<urlset>` directly and bounds a `<sitemapindex>`
  to the root plus five child sitemaps and 10,000 URLs. Explicit URLs are deduplicated first,
  off-site URLs are skipped, and `truncated`, `total` and `limitations` report every cap or skip.
- **500 URLs per batch.** The engine deduplicates client-side and calls `SubmitUrlbatch` in explicit
  500-URL batches after checking both the daily and monthly remaining quota. A batch success is
  `200 {"d": null}` with no per-URL status, so the result says **accepted**, never indexed. The
  result card reports accepted, batches and quota after the write.
- **The plan is bound to the sitemap.** Apply re-fetches the sitemap; if its URL set changed, the
  plan token is invalidated with `CONFIRM_REQUIRED` and nothing is submitted.
- **API key and site.** `providers.bing.site` is required (`CONFIG_INVALID` when missing); the
  `bing_api_key` secret is required for the write (`AUTH_REQUIRED` with a Settings hint when
  missing). The key never appears in an error or result.

### Read-only sitemap status

- **`GetFeeds` as a table.** `bing_sitemaps` builds `bing sitemaps --config <path> --json` and lists
  URL, free-form status, last crawl and URL count. The status is a provider string, not a crawl or
  index status.
- **No invented per-URL detail.** Bing exposes no per-URL sitemap errors and no paging, so the panel
  states that instead of fabricating rows. `GetFeedDetails` only expands sitemap-index children and
  is a note in the panel, not a separate screen.

### Crawl issues

- **Decoded bitmask.** `bing_issues` builds `bing issues --config <path> --json` and shows URL, HTTP
  code, in-links and the decoded issue labels: `1=301`, `2=302`, `4=4xx`, `8=5xx`, `16=robots`,
  `32=malware`, `64=important_robots`, `128=dns`, `256=timeout`. Unknown bits stay visible instead
  of being guessed.
- **No severity or date.** The provider feed has neither, so the desktop does not invent them.

### Quota card

- **Remaining, never used or total.** `bing_quota` builds `bing quota --config <path> --json` and
  shows daily and monthly remaining submissions from `GetUrlSubmissionQuota`.
- **Two separate buckets.** For a large site the monthly remaining can run out before the daily
  remaining, and Bing does not document the monthly reset. The card states both limitations.

### Engine 0.10.0

- **Bing URL submission and read-only views.** `bing submit` adds the gated `SubmitUrlbatch` write
  with a quota pre-check, bounded sitemap input and the existing write ledger. `bing quota`,
  `bing sitemaps` and `bing issues` add the read-only quota, feed and crawl-issue views; `--details`
  on `bing sitemaps` reads `GetFeedDetails` for index children.
- **Honest provider errors.** Bing returns auth failures as HTTP 400 with a numeric `ErrorCode`;
  the engine maps `3 -> AUTH_INVALID`, `14 -> PROPERTY_NOT_FOUND`, `7 -> INVALID_INPUT` and
  `4/5 -> QUOTA_EXCEEDED` and keeps only host, path, status and code. The provider message is not
  echoed.
- **No surface growth.** The CLI has 23 top-level commands, the MCP surface stays at 12 tools (Bing
  URL submission, quota, sitemap and issue views are CLI/desktop-only) and the SQLite schema stays
  at version 4.

### Shell and contracts

- **`MIN_ENGINE_VERSION` is now `0.10.0`.** An engine `0.10.1` or newer passes; `0.9.0` and older is
  reported as incompatible. The desktop needs `0.10.0` for `bing submit`, `bing sitemaps`,
  `bing issues` and `bing quota`; an older engine would answer `CLI_INVALID_JSON`.
- The committed contracts were regenerated from `lv24-seo 0.10.0`. Only the fixture version strings
  change; no command surface is added to the fixtures. The full and `--static` contract checks pass.
- `scripts/cli-checksums.json` pins engine `0.10.0` with source
  `https://pypi.org/project/lv24-seo/0.10.0/`; the workflow default `engine_version` is `0.10.0`.

## Verification

Verified on the published `v0.8.0` release.

| Check | Result |
|---|---|
| Published assets | 18 assets for Windows x64, Linux x64 and macOS arm64/x64, including the Windows portable `.zip.sha256` sidecar; `SHA256SUMS.txt` covers every published asset |
| Updater manifest | `latest.json` reports `0.8.0` |
| CI | run [`44070978027`](https://github.com/LevapVeeskela/lv24-seo-optimizer-desktop/actions/runs/44070978027) green |
| Release workflow | run [`44074365838`](https://github.com/LevapVeeskela/lv24-seo-optimizer-desktop/actions/runs/44074365838) green |
| In-app update (Windows) | `0.7.0 → 0.8.0` through the Rust updater: download, signature verification, install and relaunch. The relaunched UI reports Desktop `0.8.0`, Engine `0.10.0` and engine ready |
| Workspace smoke test | the real `lv24.by` workspace loaded on the relaunched build |
| Bing URL submission | plan with 1 URL produced 1 batch; the apply reported **accepted**, not indexed |
| Sitemaps card | `https://lv24.by/sitemap.xml` with Status `Success` and 3416 URLs |
| Crawl issues card | 0 issues returned for `lv24.by` |
| Quota card | 99 daily and 1399 monthly submissions remaining |
| Bing Site Scan opener | opened the official page in the default browser only; no scan was reported as started |
| Bundled engine | the bundled sidecar is `lv24-seo 0.10.0`; `MIN_ENGINE_VERSION` is `0.10.0` |
| Build gates | `npm run typecheck`, `npm test`, `npm run build`, `npm run test:release`, `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, `cargo test --all-targets` and `cargo build --release --locked` passed on the release commit |
| Contracts | regenerated with `node scripts/check-contracts.mjs --update`; full check reports up to date and `--static` passes at engine `0.10.0` |
| Sidecar | built from PyPI `lv24-seo 0.10.0` (Python 3.12, PyInstaller 6.22.3), `version --json` smoke test passed |
| Sidecar pin | Windows x64 `sha256 cabd4b8b9c28110dd7bcb09045391e3ca706b3c339c7154256ab16c57139b065`, 14,394,303 bytes; strict `verify-sidecar.mjs --require-pinned` passes |

- **Engine commands:** the bundled `bing submit --help`, `bing sitemaps --help`, `bing issues --help`
  and `bing quota --help` load; no live Bing request is made by the tests.
- **Platform coverage:** the Windows NSIS in-app update is the verified path for this line. The
  macOS `.app` and Linux AppImage update paths are exercised by the release workflow and should be
  re-checked on a machine with the previous release installed.

## Upgrade and known limitations

- Upgrading is unchanged: Windows NSIS, macOS `.app` and Linux AppImage update in place; deb, rpm,
  MSI and the portable ZIP remain manual. `0.1.0` still needs one manual install.
- **No `--site` override in the desktop.** The target comes from `providers.bing.site` in the active
  `seo.toml`; the shell does not accept a per-run site argument.
- **The read-only views do not auto-retry.** A failed quota, sitemap or issue load shows the engine
  error and a manual retry; nothing is polled in the background.
- **Writes are not cancellable and have no rollback.** Bing URL submission is a provider network
  write, not a cancellable background run; a failed apply is not retried automatically and cannot
  be undone. Review a fresh plan before retrying. A replayed token is `skipped`/`duplicate` through
  the write ledger, but Bing does not document submit idempotency and a duplicate URL may consume
  quota.
- **Accepted is not indexed.** Bing returns no per-URL status for `SubmitUrlbatch`; the result only
  confirms that Bing accepted the batch.
- **`GetFeedDetails` is a note, not a screen.** The desktop does not call `--details`; it explains
  that index children are expanded only on the engine side.
- **Quota reset is undocumented.** The card shows remaining counts; the monthly window can bind
  first and Bing does not publish a monthly reset schedule.
- Linux and macOS sidecar pins remain `null`; the release workflow builds those sidecars and the
  release gate requires a rebuild-aware checksum report per target.
- OS packages remain unsigned (Windows, Linux) or ad-hoc signed (macOS); SmartScreen, Gatekeeper and
  antivirus warnings are possible. Verify `SHA256SUMS.txt`.
