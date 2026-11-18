# LV24 SEO Optimizer Desktop 0.9.2

**Status: released (2026-11-18).** `0.9.2` is published on GitHub Releases for Windows x64, Linux x64
and macOS arm64/x64. The latest published line is `0.9.2`; `0.9.1` remains available for rollback and
as the previous in-app update source. See [`0.9.1.md`](0.9.1.md) for that release's notes.

| | |
|---|---|
| Desktop version | `0.9.2` (released 2026-11-18) |
| Bundled engine | `lv24-seo 0.14.0` |
| Minimum engine | `lv24-seo 0.14.0` (`MIN_ENGINE_VERSION`) |
| Contracts | generated from `lv24-seo 0.14.0` |
| Platforms | Windows x64, Linux x64, macOS arm64 and x64 (unchanged) |
| Auto-update | Windows NSIS, macOS `.app`, Linux AppImage (unchanged) |
| Manual-only | deb, rpm, MSI, portable ZIP (unchanged) |
| OS signing | Windows unsigned, macOS ad-hoc, Linux unsigned (unchanged) |

## New

### Indexing automation card

The Integrations screen gains a read-only **Indexing automation** card. It renders the engine's
`indexing status`, `indexing history` and `schedule status` output; it has no write, confirm or
`--allow-write` control.

- **Schedule.** Shows `Scheduled`/the host state and the documented cadence **Daily 04:00** (the
  scheduler job is `lv24-seo-indexing`).
- **Per provider.** Bing, Yandex, GSC and IndexNow rows with `submitted`, `indexed` (GSC only),
  `pending`, and quota: Bing daily/monthly remaining, Yandex remaining, GSC/IndexNow used/limit.
  A provider with no state shows "No data yet", never a zero.
- **Last run.** Newest `indexing history` row with status, submitted/checked counts and up to five
  `error_items` (URL + code + message).
- **History.** A compact 7/30-day day/provider table from `indexing history --limit 30`.
- **Honesty.** Every render includes `data_age_days` and `limitations`; the GSC
  `indexed_total` aggregate is labelled deprecated and kept separate from the per-URL verdict.
- **Compatibility.** If the engine answers `INVALID_COMMAND`, the card shows "Indexing status needs
  engine >= 0.13.1" and hides the tables instead of presenting empty data.
- **Bridge.** `indexing_status` (`provider`, `limit`, `live`), `indexing_history` (`limit`) and
  `schedule_status` (`kind`, `target`) are allow-listed; the Rust layer validates every value,
  rejects write flags and cross-command arguments, and uses a 120 s timeout. `--live` is the only
  provider call and a missing credential becomes a limitation, not a failure.

## Changed

- `MIN_ENGINE_VERSION` is now `0.14.0`; an older sidecar is reported as incompatible.
- The bundled onedir sidecar is `lv24-seo 0.14.0`. The Windows x64 reviewed pin records the built
  `0.14.0` executable (`33d2611c…02d0`, 14,580,661 bytes); Linux/macOS pins remain `null` and are
  covered by rebuild-aware CI checksum reports.
- Contracts (`config.schema.json`, CLI fixtures including `stats`) are regenerated from engine
  `0.14.0`.
- README and architecture docs describe the Indexing card.

## Not changed

- No new write surface. Bing URL/sitemap submit, IndexNow and Yandex recrawl keep their two-phase
  gates; GSC sitemap submit and Bing sitemap delete remain `WRITE_DISABLED`.
- MCP stays at 12 tools and the SQLite schema at version 5.
- Platform matrix, installer formats, updater and signing status are unchanged.

## Verification

Local gate on the release commit:

```bash
npm run typecheck
npm test
npm run build
npm run contract:check
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test
node scripts/verify-sidecar.mjs --root src-tauri/engine \
  --target x86_64-pc-windows-msvc --engine-version 0.14.0 --require-pinned
```

Results: 784 Vitest tests, 169 Rust tests, contracts at engine `0.14.0`, and the Windows sidecar
verified against the pinned SHA-256 (`33d2611c0766c2b1160c80c35cfd51b86f6fbb7e26a9bb508aec0a32053b02d0`,
14,580,661 bytes). The four platform bundles are built by the manual `Desktop build` workflow with
`engine_version=0.14.0`.

## Limitations

- The card is read-only: it shows the schedule state but cannot install, edit or run the job.
- `--live` reads Bing and Yandex quotas on refresh; a missing credential is shown as a limitation.
- Bing/Yandex/IndexNow do not expose a per-URL indexed count; the card shows `—`/`no_per_url_index_count`
  instead of inventing one.
- The GSC `contents[].indexed` aggregate is deprecated and can be zero.
- An engine older than `0.14.0` is reported as incompatible.
