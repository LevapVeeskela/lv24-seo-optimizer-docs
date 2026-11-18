# LV24 SEO Optimizer Desktop 0.9.5

**Status: released (2026-11-18).** `0.9.5` is published on GitHub Releases for Windows x64, Linux x64
and macOS arm64/x64. The latest published line is `0.9.5`; `0.9.4` remains available for rollback and
as the previous in-app update source. See [`0.9.4.md`](0.9.4.md) for that release's notes.

| | |
|---|---|
| Desktop version | `0.9.5` (released 2026-11-18) |
| Bundled engine | `lv24-seo 0.15.1` |
| Minimum engine | `lv24-seo 0.15.1` (`MIN_ENGINE_VERSION`) |
| Contracts | generated from `lv24-seo 0.15.1` |
| Platforms | Windows x64, Linux x64, macOS arm64 and x64 (unchanged) |
| Auto-update | Windows NSIS, macOS `.app`, Linux AppImage (unchanged) |
| Manual-only | deb, rpm, MSI, portable ZIP (unchanged) |
| OS signing | Windows unsigned, macOS ad-hoc, Linux unsigned (unchanged) |

## Changed

### Four new crawl rule packs

`0.9.5` bundles engine `0.15.1`, which adds the audit rules that were missing from the crawl report:

- **`security-headers`** — HSTS, CSP (`unsafe-inline`/`unsafe-eval`), X-Frame-Options,
  X-Content-Type-Options, Referrer-Policy, Permissions-Policy and cookie flags.
- **`tls-certificate`** — expiry, protocol version, SAN/CN hostname match and weak ciphers, using
  TLS facts captured by the crawler.
- **`schema-required`** — required properties for Product, Offer, BreadcrumbList, FAQPage, Recipe,
  JobPosting, VideoObject, LocalBusiness, Course and SoftwareApplication.
- **`a11y-basics`** — input labels, button/link accessible names, `<main>`, skip link and heading
  order.

The rule set grows from 30 to 34 and is discovered automatically; the existing report and
Diagnostics screens render the new issue IDs without a UI change.

- `MIN_ENGINE_VERSION` is now `0.15.1`; an older sidecar is reported as incompatible.
- The bundled onedir sidecar is `lv24-seo 0.15.1`; contracts are regenerated from `0.15.1`.

### Placeholder OAuth client ids

Engine `0.15.1` rejects the documented example client ids
(`0123456789abcdef0123456789abcdef`, `1234567890-abc.apps.googleusercontent.com`,
`your-*-client-id`) with `CONFIG_INVALID` before a consent URL is built. The Connect card also
disables **Connect** while the provider readiness is `oauth_client_missing`,
`oauth_client_secret_missing` or `oauth_redirect_invalid`, and ignores a second **Open** click while
the first is still in flight, so a misconfigured setup cannot spawn repeated consent tabs.

## Not changed

- The read-only Indexing automation card, the Connect card readiness states and the hidden Windows
  scheduled-job launcher from `0.9.4`.
- No new write surface; the two-phase write gates and the write secret are unchanged.
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

Results: the full Vitest and Rust suites, contracts at engine `0.15.1`, and the Windows sidecar
verified against the pinned SHA-256
(`cd70636a4f490c3ab592fb3b16ac2456d9cf9e57f08c676e05b84110ff361922`, 14,607,761 bytes). The four
platform bundles are built by the manual `Desktop build` workflow with `engine_version=0.15.1`.

## Limitations

- The new rules are heuristics, not a full security or WCAG conformance audit; see the engine
  `0.15.1` release notes for the exact bounds.
- Existing scheduled tasks from `0.9.3` or older still need one reinstall to pick up the hidden
  launcher.
