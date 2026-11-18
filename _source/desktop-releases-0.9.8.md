# LV24 SEO Optimizer Desktop 0.9.8

**Status: released (2026-11-18).** `0.9.8` is published on GitHub Releases for Windows x64, Linux x64
and macOS arm64/x64. The latest published line is `0.9.8`; `0.9.7` remains available for rollback and
as the previous in-app update source. See [`0.9.7.md`](0.9.7.md) for that release's notes.

| | |
|---|---|
| Desktop version | `0.9.8` (released 2026-11-18) |
| Bundled engine | `lv24-seo 0.15.2` (unchanged) |
| Minimum engine | `lv24-seo 0.15.2` (`MIN_ENGINE_VERSION`, unchanged) |
| Contracts | generated from `lv24-seo 0.15.2` (unchanged) |
| Platforms | Windows x64, Linux x64, macOS arm64 and x64 (unchanged) |
| Auto-update | Windows NSIS, macOS `.app`, Linux AppImage (unchanged) |
| Manual-only | deb, rpm, MSI, portable ZIP (unchanged) |
| OS signing | Windows unsigned, macOS ad-hoc, Linux unsigned (unchanged) |

## Fixed

### Connected badge actually uses the engine data-access summary

`0.9.7` bundled engine `0.15.2` but its frontend still derived Connected/Not connected from the OAuth
refresh-token entry, so saved Yandex/Metrika tokens and the GSC service account continued to show as
"Not connected". `0.9.8` includes the missing frontend patch: it reads the `access` summary from
`auth status --json` and uses it for the badge.

- Yandex Webmaster and Metrika with saved tokens show **Connected**;
- GSC with `service_account_file` shows **Connected**;
- Bing, CrUX and PSI keys are reported as data access too;
- the OAuth badge stays separate and says **"OAuth not configured (optional)"** when the provider
  already works without an OAuth app;
- an older engine without `access` keeps the previous OAuth-based fallback.

No engine, contract or sidecar change: `0.9.8` bundles the same `lv24-seo 0.15.2` build as `0.9.7`.

## Not changed

- The four crawl rule packs, the Indexing automation card, the hidden Windows scheduled-job launcher
  and the two-phase write gates.
- No new write surface; OAuth is still optional and requires a real registered app.
- MCP stays at 12 tools and the SQLite schema at version 5.

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
  --target x86_64-pc-windows-msvc --engine-version 0.15.2 --require-pinned
```

Results: 808 Vitest tests, the full Rust suite, contracts at engine `0.15.2`, and the Windows
sidecar verified against the pinned SHA-256
(`e72d38efc11fb6613a0fa557ade373f6eb5b59059fe49455095924b448d47a18`, 14,608,556 bytes).

## Limitations

- `access` reports configuration/presence, not a live provider call; an expired or revoked token is
  still discovered on the next read.
- A syntactically valid but unregistered OAuth client id cannot be detected locally.
