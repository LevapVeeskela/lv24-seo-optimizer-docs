---
title: Releases and updates
description: Engine 0.5.1 changes, desktop 0.2.0 assets, signed auto-update matrix, release pipeline, version pinning and rollback.
---

# Releases and updates

The current releases are:

| Product | Version | Notes |
|---|---|---|
| Engine | `lv24-seo 0.5.1` | Bugfix release; no schema migration, no new CLI command or MCP tool |
| Desktop | `0.2.0` | First multi-platform build; bundles engine 0.5.1 |

The desktop version and the engine version are independent, but the desktop pins an exact engine and refuses one below its minimum.

## Engine 0.5.1

This is a bugfix release for the 0.5.x line. It closes release blockers found after 0.5.0: a provider failure could permanently mark a write as a duplicate,
crawl text was retained without a bound, MCP annotations claimed two local-state tools were read-only, and several documented limits were not actually
reachable.

What changed:

- **Write-gate retries.** An apply claims the idempotency slot as `pending`, runs the
  provider call, then promotes it to `sent`. If the provider raises, the pending claim is
  released before the original exception is re-raised, so a retry with the same plan is
  allowed. A completed or in-flight claim is still a duplicate.
- **Crawl text bound.** `PageData.text` retains at most 20,000 characters, while
  `word_count` still uses the full visible text. Link extraction, JSON-LD, hreflang and
  word counting still read the full document.
- **MCP annotations.** `seo_crawl_site` and `seo_weekly_report` persist local snapshots,
  so they are `writes_local_state: true` and `readOnlyHint: false`. They still never
  mutate provider state and need no confirm token.
- **Reachable limits.** Sitemap discovery uses a per-request body budget, so the
  documented 50 MB per-document cap is reachable; ordinary pages keep the 5 MB cap and
  the 50,000-URL protocol cap is unchanged. `stats` and `report weekly` reject `--days`
  above 3,660 with `INVALID_INPUT`.
- **Weekly builder failures.** The builder signature is checked once before the call. A
  `TypeError` inside a compatible builder is no longer swallowed; the command returns
  `INTERNAL` and persists no snapshot.
- **GSC truncation.** A final page that exactly fills the 50,000-row cap is complete,
  not truncated. `rows_cap_50000` is reported only when another row exists.
- **Smaller fixes.** The Windows npm launcher ignores `.cmd` shims; MCP default windows
  use `report.timezone`; multi-dimension metric keys are JSON-encoded; negative store
  limits clamp to zero; `report diff --markdown` writes warnings to stderr; scheduler
  install repairs damaged managed blocks; `auth status` includes Yandex Metrika.

Verification recorded for this release:

| Check | Result |
|---|---|
| Offline test suite | 1114 passed, 1 skipped (1115 collected) |
| `ruff check` | Clean |
| `ruff format --check` | Clean |
| `mypy src` | Clean |

New regression tests cover write-gate release and retry, the 20k text cap with exact `word_count`, MCP annotations, the 50 MB sitemap budget, `--days`
rejection, builder signature mismatch versus an internal `TypeError`, GSC exact-cap truncation, the Windows `.cmd` launcher case, configured-timezone windows,
metric-key collisions, negative limits, stderr warnings, scheduler block repair and Metrika auth.

Known limits in 0.5.1:

- A `pending` write claim left by a crash has no TTL; it is treated as in-flight until
  an operator releases it. This is deliberate: a false retry can duplicate a provider
  write.
- The crawl text cap is a retention bound, not a parsing bound.
- The 50 MB sitemap budget applies per document; a sitemap index can spend it on several
  children, bounded by the 20-document limit.
- MCP clients that branch on `readOnlyHint` may now ask for confirmation before
  `seo_crawl_site` or `seo_weekly_report`.

## Desktop 0.2.0 assets

`0.2.0` is the first multi-platform release. GitHub replaces spaces in asset names with dots; the release page is authoritative for the exact Linux file names.

| Asset | Platform | Purpose |
|---|---|---|
| `LV24.SEO.Optimizer_0.2.0_x64-setup.exe` + `.exe.sig` | Windows x64 | NSIS per-user installer; signed updater package |
| `LV24-SEO-Optimizer_0.2.0_x64-portable.zip` | Windows x64 | Portable build; manual-only |
| `LV24.SEO.Optimizer_0.2.0_aarch64.dmg` | macOS Apple silicon | First install |
| `LV24.SEO.Optimizer_0.2.0_x64.dmg` | macOS Intel | First install |
| `LV24.SEO.Optimizer_0.2.0_aarch64.app.tar.gz` + `.sig` | macOS Apple silicon | Signed updater package |
| `LV24.SEO.Optimizer_0.2.0_x64.app.tar.gz` + `.sig` | macOS Intel | Signed updater package |
| `*_amd64.AppImage` + `.AppImage.sig` | Linux x64 | AppImage; signed updater package |
| `*_amd64.deb`, `LV24.SEO.Optimizer-0.2.0-1.x86_64.rpm` | Linux x64 | Package-manager installs; manual-only |
| `latest.json` | All | Signed updater manifest |
| `SHA256SUMS.txt` | All | SHA-256 for every published asset |

The Windows installer requires Windows 10/11 x64 and the WebView2 runtime; the NSIS installer can fetch it, the portable ZIP cannot. Linux bundles are built on
Ubuntu 22.04 with a glibc 2.35 baseline and are x64 only. macOS requires macOS 13 or later; use the `aarch64` DMG on Apple silicon and the `x64` DMG on Intel.

## Auto-update matrix

| Bundle | In-app update | What happens |
|---|---|---|
| Windows NSIS | Yes | Downloads the signed setup `.exe`, runs it in passive mode, relaunches |
| macOS `.app` | Yes | Downloads the signed `.app.tar.gz`, replaces the app, relaunches |
| Linux AppImage | Yes | Downloads the signed AppImage, replaces it, relaunches |
| Windows portable ZIP | No | Settings points to the release page; download and extract a new ZIP |
| Linux deb | No | Settings points to the release page; upgrade with the package manager |
| Linux rpm | No | Settings points to the release page; upgrade with the package manager |
| MSI | No | No MSI is produced; an MSI install is treated as manual |
| Unknown bundle | No | Settings points to the release page |

Manual-only is deliberate. A deb or rpm install is owned by the package database; an MSI is not produced by this project, and the NSIS updater package cannot
replace it; a portable ZIP has no installer to replace and may live on removable media. The desktop reports the installed bundle type and disables the in-app
installer for those cases. It does not pretend that a manual package was updated.

## Release pipeline

The desktop workflow is manual and owner-gated. It has no push, pull-request or tag triggers. The owner starts **Actions → Desktop build → Run workflow** and
approves the `desktop-release` environment; a non-owner run is skipped.

| Input | Default | Meaning |
|---|---|---|
| `engine_version` | `0.5.1` | Exact engine bundled in the sidecar |
| `signed` | `false` | Request OS signing/notarization; not configured in this zero-spend repository |
| `publish` | `false` | Create a GitHub release after every matrix build passes |
| `tag` | Empty | `vX.Y.Z` release tag; required when `publish=true` |

The default matches the `0.2.0` pin. The release gate rejects a manifest mismatch if a different version is passed.

| Runner | Target | Bundles |
|---|---|---|
| `windows-latest` | `x86_64-pc-windows-msvc` | NSIS |
| `ubuntu-22.04` | `x86_64-unknown-linux-gnu` | AppImage, deb, rpm |
| `macos-15` | `aarch64-apple-darwin` | DMG + app |
| `macos-15-intel` | `x86_64-apple-darwin` | DMG + app |

All runners are standard GitHub-hosted runners. No larger runner, paid minute, paid storage or paid signing service is used. Build artifacts are retained for 7
days; the GitHub release is the durable distribution channel.

## Sidecar pin and checksums

The release sidecar is a PyInstaller **onedir** tree, built on the matching host; PyInstaller does not cross-compile. The engine, Python, Pydantic, Typer and
PyInstaller versions are pinned in `scripts/cli-checksums.json`. `0.2.0` pins engine `0.5.1`, Python `3.12`, Pydantic `2.14.3`, Typer `0.29.0` and PyInstaller
`6.22.3`.

PyInstaller onedir output is not byte-reproducible. The checksum policy is therefore split:

- **Local release build — strict.** `scripts/verify-sidecar.mjs` must match the committed
  SHA-256 and size; `--write` updates the pin after review. A `null` pin means “not
  reviewed yet”, not “verified”.
- **CI rebuild — rebuild-aware.** The build job runs the verifier with `--no-hash` and
  records the actual SHA-256 in `release/sidecar-checksums-<target>.json`.
- **Release gate — report-based.** The release job requires a valid report for every
  shipped target: matching target name, `hashPolicy: "rebuild"`, `ok: true`, a 64-hex
  hash, a positive size and the exact engine version.

The checksum reports are CI evidence, not release assets. `SHA256SUMS.txt` covers the installers, updater packages, signatures and `latest.json`; the sidecar
executable is inside those packages and is not listed separately. Users who install manually verify the downloaded asset against `SHA256SUMS.txt`.

```bash
node scripts/verify-sidecar.mjs \
  --root src-tauri/engine \
  --target x86_64-pc-windows-msvc \
  --engine-version 0.5.1
```

## `latest.json`, signing and publishing

Updater signatures use a free Ed25519/minisign key, separate from OS code signing. The public key is embedded in the app; the private key is a repository secret
passed only to the build step. `requireSignedVersion` is enabled, so the announced version is bound to the signed package. The updater accepts only a version
greater than the running one, so it cannot downgrade.

`scripts/stage-release-assets.mjs` flattens and normalizes bundle names and writes per-platform `updater-<platform>.json` metadata.
`scripts/merge-latest-json.mjs` merges them into `latest.json`:

- required generic keys: `windows-x86_64`, `linux-x86_64`, `darwin-aarch64`,
  `darwin-x86_64`;
- bundle aliases the updater probes: `windows-x86_64-nsis`, `linux-x86_64-appimage`,
  `darwin-aarch64-app`, `darwin-x86_64-app`;
- optional `linux-x86_64-deb` and `linux-x86_64-rpm` only when Tauri produced those
  signatures;
- every URL points under `releases/download/<tag>/`;
- every signature is checked against the `.sig` file on disk;
- every referenced asset must exist;
- notes come from `docs/releases/<version>.md` when present.

The release is created as a **draft** first. Assets are uploaded while it is a draft, with `latest.json` last, then the job publishes with
`gh release edit --draft=false` and verifies the remote asset names. `releases/latest/download/latest.json` only resolves to a published release, so users never see a partially
uploaded manifest. A rerun reuses an existing draft, clears its assets and refuses to overwrite a published release.

## Version pinning

The desktop version must agree in `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, the Git tag and the release title. The engine pin lives
in `scripts/cli-checksums.json`; the workflow passes `engine_version` explicitly and the release gate requires it to match the manifest.

`MIN_ENGINE_VERSION` in `src-tauri/src/commands.rs` is `0.5.1` in the current source. The shell accepts an engine at least that new and marks an older one
offline with a notice. A newer engine passes the gate but is not the release-tested pin. A development build may use `LV24_SEO_BIN` with another version; the UI
labels it external and still checks the minimum. A `PATH` engine is used only when `LV24_SEO_ALLOW_PATH_ENGINE=1`.

## One-time 0.1.0 upgrade

`0.1.0` has no updater, endpoint or public key. It cannot discover or install `0.2.0`. Download and install `0.2.0` manually once (NSIS installer or portable
ZIP on Windows). After that, the `0.2.0` installation can auto-update to later releases when it uses an auto-update-capable bundle.

## Rollback

There is no automatic downgrade. A rollback is a manual install of an older release.

| Failure | Response |
|---|---|
| Bad installer but valid app | Publish a fixed patch; do not overwrite assets under the same tag |
| Bad `latest.json` | Publish a fixed patch; the draft gate prevents a partial manifest from being visible |
| Compromised updater key | Rotate the key, ship a manual release with the new public key; auto-update cannot bridge the rotation |
| Engine regression | Pin the previous engine version, rebuild and publish a patch |
| Need an older desktop build | Install it manually; the updater refuses downgrades |

Do not move or reuse a published tag. Keep the previous release assets available for rollback. If the endpoint must be disabled, ship a manual release and
document it.

## Verifying a download

`SHA256SUMS.txt` covers every published asset. Verify the files you intend to install:

```bash
sha256sum -c SHA256SUMS.txt --ignore-missing
```

On macOS, `shasum -a 256 -c SHA256SUMS.txt` is available in the base system. On Windows, compare `Get-FileHash <file> -Algorithm SHA256` with the matching line.
Do not run a file whose hash does not match.

By default, OS packages are unsigned (Windows, Linux) or ad-hoc signed (macOS). The updater signature authenticates updates, not the first manual download.
SmartScreen and Gatekeeper warnings are expected; verify the checksum and use the documented **More info → Run anyway** or **Open Anyway** flow. Do not disable
those protections system-wide.

See [Security and privacy](/security/) for updater trust and [Architecture](/architecture/) for the sidecar layout.

Source: `_source/engine-releases-0.5.1.md`, `_source/desktop-releases-0.2.0.md`, `_source/desktop-release.md`, `_source/desktop-security.md`.
