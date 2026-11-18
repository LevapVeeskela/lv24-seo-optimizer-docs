# LV24 SEO Optimizer Desktop 0.9.6

**Status: released (2026-11-18).** `0.9.6` is published on GitHub Releases for Windows x64, Linux x64
and macOS arm64/x64. The latest published line is `0.9.6`; `0.9.5` remains available for rollback and
as the previous in-app update source. See [`0.9.5.md`](0.9.5.md) for that release's notes.

| | |
|---|---|
| Desktop version | `0.9.6` (released 2026-11-18) |
| Bundled engine | `lv24-seo 0.15.1` (unchanged) |
| Minimum engine | `lv24-seo 0.15.1` (`MIN_ENGINE_VERSION`, unchanged) |
| Contracts | generated from `lv24-seo 0.15.1` (unchanged) |
| Platforms | Windows x64, Linux x64, macOS arm64 and x64 (unchanged) |
| Auto-update | Windows NSIS, macOS `.app`, Linux AppImage (unchanged) |
| Manual-only | deb, rpm, MSI, portable ZIP (unchanged) |
| OS signing | Windows unsigned, macOS ad-hoc, Linux unsigned (unchanged) |

## Changed

### Clearer OAuth wording for already-connected providers

When a provider already has a working token or service account and only the optional OAuth app is
missing, the Connect card no longer shows the alarming "Not ready" badge. It shows
**"OAuth not configured (optional)"** with the explanation that the saved token/service account is
already used and OAuth is only needed for automatic token refresh. The Connect button stays disabled
until a real OAuth client is configured, so the docs example client ids cannot open a consent tab.

No engine, contract or sidecar change: `0.9.6` bundles the same `lv24-seo 0.15.1` build as `0.9.5`.

## Not changed

- The four crawl rule packs, the Indexing automation card, the hidden Windows scheduled-job launcher
  and the two-phase write gates.
- MCP stays at 12 tools and the SQLite schema at version 5.
- Platform matrix, installer formats, updater and signing status.

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
  --target x86_64-pc-windows-msvc --engine-version 0.15.1 --require-pinned
```

Results: 806 Vitest tests, the full Rust suite, contracts at engine `0.15.1`, and the Windows
sidecar verified against the pinned SHA-256
(`698c268a2fc898633644e74a0683bcb5aa06da8f22bc251a263b573691cd57f7`, 14,607,761 bytes).

## Limitations

- OAuth remains optional; a real Google Desktop client / Yandex OAuth app is still required if you
  want automatic token refresh instead of a stored token or service account.
- A syntactically valid but unregistered OAuth client id cannot be detected locally; the provider
  still answers 400.
