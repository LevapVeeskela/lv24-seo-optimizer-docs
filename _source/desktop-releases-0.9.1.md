# LV24 SEO Optimizer Desktop 0.9.1

**Status: released (2026-11-18).** `0.9.1` is published on GitHub Releases for Windows x64, Linux x64
and macOS arm64/x64. The latest published line is `0.9.1`; `0.9.0` remains available for rollback and
as the previous in-app update source. See [`0.9.0.md`](0.9.0.md) for that release's notes.

| | |
|---|---|
| Desktop version | `0.9.1` (released 2026-11-18) |
| Bundled engine | `lv24-seo 0.13.1` |
| Minimum engine | `lv24-seo 0.13.1` (`MIN_ENGINE_VERSION`) |
| Contracts | generated from `lv24-seo 0.13.1` |
| Platforms | Windows x64, Linux x64, macOS arm64 and x64 (unchanged) |
| Auto-update | Windows NSIS, macOS `.app`, Linux AppImage (unchanged) |
| Manual-only | deb, rpm, MSI, portable ZIP (unchanged) |
| OS signing | Windows unsigned, macOS ad-hoc, Linux unsigned (unchanged) |

## New

### OAuth Connect card

The Integrations screen gains a **Connectors** card for Google Search Console, Yandex Webmaster and
Yandex Metrika. Tokens are stored by the engine in the OS keychain; the desktop never receives,
renders or logs one.

- **Google Search Console.** **Connect** runs the engine's `auth login --provider gsc`. The engine
  opens the system browser, starts a `127.0.0.1` loopback callback with S256 PKCE and waits for
  consent; the card shows a "complete the sign-in in your browser" hint and refreshes `auth status`
  on success. A missing client id/secret shows the engine's `next_action` and the auth guide instead
  of a generic failure.
- **Yandex Webmaster / Metrika.** **Connect** calls `auth login --provider yandex|metrika --url-only`
  and shows the authorization URL with an **Open Yandex** button. After approving access, the user
  pastes the code from `https://oauth.yandex.ru/verification_code` and clicks **Finish**; the code
  is cleared from state after the exchange. The two engines use separate token slots.
- **Status.** The card reads `auth status` (`gsc_oauth`, `yandex_oauth`, `metrika_oauth`) and shows
  `Connected` / `Not connected` / `Not checked`. The client secret is configured once through
  `lv24-seo auth set --provider gsc_oauth_secret|yandex_oauth_secret --stdin`; the UI has no secret
  field.
- **Bridge hardening.** `auth_login` is allow-listed with `provider`, `noBrowser`, `port`, `code` and
  `urlOnly`. The Rust layer rejects write flags, cross-provider combinations and invalid ports/codes
  before spawning the engine. `open_oauth_url` accepts only
  `https://oauth.yandex.ru/authorize?...`; it is not a generic URL opener.
- **No write controls.** The card has no `--allow-write`, confirm token or provider write path.

## Changed

- `MIN_ENGINE_VERSION` is now `0.13.1`; an older sidecar is reported as incompatible instead of
  failing with a typed command error.
- The bundled onedir sidecar is `lv24-seo 0.13.1`. The Windows x64 reviewed pin records the built
  `0.13.1` executable; Linux/macOS pins remain `null` and are covered by rebuild-aware CI checksum
  reports.
- Contracts (`config.schema.json`, CLI fixtures including `stats`) are regenerated from engine
  `0.13.1`.
- README, architecture and security docs describe the Connectors card and the OAuth token rules.

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
  --target x86_64-pc-windows-msvc --engine-version 0.13.1 --require-pinned
```

Results: 763 Vitest tests, 167 Rust tests, contracts at engine `0.13.1`, and the Windows sidecar
verified against the pinned SHA-256 (`0b02b8a0…`, 14,567,729 bytes). The four platform bundles are
built by the manual `Desktop build` workflow with `engine_version=0.13.1`; it requires a sidecar
checksum report per shipped target and publishes `latest.json` and `SHA256SUMS.txt`.

## Limitations

- **Live OAuth consent is not yet verified**: no Google Cloud Desktop client or Yandex OAuth app was
  registered at release time. The card shows the engine's setup error until a real client id/secret
  is configured. Registration steps are in the engine's `docs/auth-google.md` and
  `docs/auth-yandex.md`.
- Google OAuth apps in **Testing** issue refresh tokens that expire after 7 days; the service account
  remains the unattended GSC path. A public app needs Google verification for
  `webmasters.readonly`.
- The Yandex `verification_code` flow cannot verify `state` across the separate URL-only and code
  steps; the code is short-lived and the client secret is still required.
- Bing Webmaster, IndexNow, CrUX and PSI remain key-based; the card does not offer OAuth for them.
