# LV24 SEO Optimizer Desktop 0.9.3

**Status: released (2026-11-18).** `0.9.3` is published on GitHub Releases for Windows x64, Linux x64
and macOS arm64/x64. The latest published line is `0.9.3`; `0.9.2` remains available for rollback and
as the previous in-app update source. See [`0.9.2.md`](0.9.2.md) for that release's notes.

| | |
|---|---|
| Desktop version | `0.9.3` (released 2026-11-18) |
| Bundled engine | `lv24-seo 0.14.0` (unchanged) |
| Minimum engine | `lv24-seo 0.14.0` (`MIN_ENGINE_VERSION`, unchanged) |
| Contracts | generated from `lv24-seo 0.14.0` (unchanged) |
| Platforms | Windows x64, Linux x64, macOS arm64 and x64 (unchanged) |
| Auto-update | Windows NSIS, macOS `.app`, Linux AppImage (unchanged) |
| Manual-only | deb, rpm, MSI, portable ZIP (unchanged) |
| OS signing | Windows unsigned, macOS ad-hoc, Linux unsigned (unchanged) |

## New

### OAuth readiness in the Connect card

The Connect card now renders the engine's OAuth readiness report (`auth status --json`, engine
`0.14.0`). For Google Search Console, Yandex Webmaster and Metrika it shows a state chip, the engine
`detail`, the exact `next_action`, the token expiry in the local language, whether scopes were
recorded, and any limitations.

- **Ready.** `oauth_ready` is the only state rendered as success.
- **Needs action.** Client ID missing, client secret missing, sign-in required, scopes missing and
  invalid redirect use the action tone.
- **Warnings.** An expired token (with the refresh hint) and unknown scopes are warnings, not
  failures.
- **Compatibility.** A missing `oauth` object, a skipped provider or an unknown state shows a
  neutral "Readiness unavailable" notice with the engine `>= 0.14.0` hint; it is never shown as
  Ready. The existing connection rows keep working.
- **Secrets.** The card parses presence booleans and timestamps only; no token or secret value is
  read, stored or rendered.

## Changed

- README and architecture docs describe the readiness states.
- No engine, contract or sidecar change: `0.9.3` bundles the same `lv24-seo 0.14.0` build as `0.9.2`.

## Not changed

- The Indexing automation card, the Diagnostics screen and the OAuth Connect/login controls.
- No new write surface. Bing URL/sitemap submit, IndexNow and Yandex recrawl keep their two-phase
  gates; GSC sitemap submit and Bing sitemap delete remain `WRITE_DISABLED`.
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
  --target x86_64-pc-windows-msvc --engine-version 0.14.0 --require-pinned
```

Results: 804 Vitest tests, 169 Rust tests, contracts at engine `0.14.0`, and the Windows sidecar
verified against the pinned SHA-256
(`33d2611c0766c2b1160c80c35cfd51b86f6fbb7e26a9bb508aec0a32053b02d0`, 14,580,661 bytes).

## Limitations

- The card displays the engine's English `detail`/`next_action` text verbatim; only the labels,
  expiry and layout are localized.
- Readiness proves the local prerequisites are consistent, not that a provider accepted a consent
  screen. Live OAuth consent still requires a registered Google Desktop client and a Yandex OAuth
  app.
- An engine older than `0.14.0` is reported as incompatible.
