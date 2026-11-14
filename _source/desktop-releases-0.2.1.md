# LV24 SEO Optimizer Desktop 0.2.1

**Status: patch release for the 0.2.0 multi-platform preview.**

| | |
|---|---|
| Desktop version | `0.2.1` |
| Bundled engine | `lv24-seo 0.5.1` |
| Platforms | Windows x64, Linux x64, macOS arm64 and x64 |
| Auto-update | Windows NSIS, macOS `.app`, Linux AppImage |
| Manual-only | deb, rpm, MSI, portable ZIP |
| OS signing | Windows unsigned, macOS ad-hoc, Linux unsigned |
| Updater signing | minisign/Ed25519, public key embedded in the app |

This patch fixes the Yandex Metrika token surface and makes the shared secret
store explicit. It is the first release that can be delivered through the
in-app updater to `0.2.0` installations.

## Fixed

### Yandex Metrika token

The engine has exposed `metrika` as a separate `auth` provider since `0.5.1`
(`yandex_metrika_token`). The desktop provider list still mapped
`providers.yandex_metrika` to the Webmaster token, so the Metrika counter had no
token badge and the secret modal could not select Metrika. `0.2.1` adds the
separate `metrika` provider to the TypeScript and Rust allow-lists, the Settings
badge, the secret modal and the en/ru/zh labels.

### One secret store with the CLI

The desktop and the CLI use the same OS keychain entry per provider: service
`lv24-seo`, username `gsc_token`, `yandex_webmaster_token`,
`yandex_metrika_token`, and so on. A token entered with
`lv24-seo auth set --provider <p> --stdin` in a terminal is visible in the
desktop's `auth status` without re-entry, and a token entered in the desktop is
visible to the CLI. `LV24_SEO_*` environment variables are inherited by the
desktop's CLI runner. The opt-in `<data-dir>/secrets.json` fallback is shared
only when both surfaces use the same workspace/data directory; it is never
copied into the webview.

The desktop bundles the engine with the `secrets` extra, so the keychain backend
is present. On Linux the CLI runner inherits the session-bus and XDG variables
Secret Service needs.

### Updater hardening carried from 0.2.0

A signature failure blocks that artifact version and the block is persisted
across restarts (localStorage). A different release version may be verified
again; the same artifact is not retried. The rest of the updater behavior is
unchanged: signed `latest.json`, `requireSignedVersion`, no downgrades, no
automatic install, explicit user confirmation, and a visible release-page
fallback.

## Assets

The asset names follow the `0.2.0` layout with `0.2.1` in the version segment:

| Asset | Platform | Use |
|---|---|---|
| `LV24.SEO.Optimizer_0.2.1_x64-setup.exe` + `.exe.sig` | Windows x64 | NSIS installer; signed updater package |
| `LV24-SEO-Optimizer_0.2.1_x64-portable.zip` | Windows x64 | Portable build; manual-only |
| `LV24.SEO.Optimizer_0.2.1_aarch64.dmg` | macOS Apple silicon | First install |
| `LV24.SEO.Optimizer_0.2.1_x64.dmg` | macOS Intel | First install |
| `LV24.SEO.Optimizer_0.2.1_aarch64.app.tar.gz` + `.sig` | macOS Apple silicon | Signed updater package |
| `LV24.SEO.Optimizer_0.2.1_x64.app.tar.gz` + `.sig` | macOS Intel | Signed updater package |
| `LV24.SEO.Optimizer_0.2.1_amd64.AppImage` + `.AppImage.sig` | Linux x64 | AppImage; signed updater package |
| `LV24.SEO.Optimizer_0.2.1_amd64.deb` | Linux x64 | Package-manager install; manual-only |
| `LV24.SEO.Optimizer-0.2.1-1.x86_64.rpm` | Linux x64 | Package-manager install; manual-only |
| `latest.json`, `SHA256SUMS.txt` | all | Updater manifest and checksums |

`latest.json` keeps the generic and bundle-specific keys for Windows, Linux and
both macOS architectures. `SHA256SUMS.txt` covers every published asset,
including signatures and `latest.json`.

## Upgrade

- **From `0.2.0`:** the in-app updater offers `0.2.1` for Windows NSIS, macOS
  `.app` and Linux AppImage. deb/rpm/MSI/portable ZIP installs are manual-only
  and the Settings panel points to the release page.
- **From `0.1.0`:** install `0.2.1` manually once. `0.1.0` has no updater,
  endpoint or public key.
- **Fresh install:** use the NSIS installer, portable ZIP, AppImage, deb, rpm or
  DMG for your platform.

## Verification

- `npm run typecheck`, `npm test` (182 tests), `npm run build`.
- `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`,
  `cargo test --all-targets` (64 tests).
- Desktop CI: web, contracts, Rust on Windows/Linux/macOS.
- Release workflow: four platform builds, expected-asset gate, merged
  `latest.json`, `SHA256SUMS.txt`, draft → upload → undraft.
- Manual keychain check: a secret stored by the bundled sidecar was visible to a
  separate `lv24-seo[secrets]` CLI process and vice versa; the test secret was
  removed afterwards.
- End-to-end Windows NSIS update: an installed `0.2.0` build detected `0.2.1`
  in the update panel, downloaded and verified the signed package, installed it
  in passive mode, relaunched, and reported `0.2.1` with engine `0.5.1` ready.

## Known limitations

- OS packages are unsigned or ad-hoc signed; SmartScreen, Gatekeeper and
  antivirus warnings remain possible. Verify `SHA256SUMS.txt`.
- The desktop has no dedicated crawl screen in `0.2.x`; crawl settings and
  findings are shown through configuration and reports.
- A signature failure must be resolved by installing a newer release manually;
  the blocked version is not offered again.
- `latest.json` is fetched from GitHub Releases. A blocked or offline GitHub
  endpoint leaves the app on its current version.

Source: `_source/desktop-releases-0.2.0.md`, `_source/desktop-release.md`,
`_source/desktop-security.md`.
