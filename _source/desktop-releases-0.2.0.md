# LV24 SEO Optimizer Desktop 0.2.0

**Status: multi-platform preview. OS builds are unsigned; auto-update packages are signed.**

| | |
|---|---|
| Desktop version | `0.2.0` |
| Bundled engine | `lv24-seo 0.5.1` (PyInstaller onedir sidecar) |
| Platforms | Windows x64, Linux x64, macOS arm64 and x64 |
| Auto-update | Windows NSIS, macOS `.app`, Linux AppImage |
| Manual-only | deb, rpm, MSI, portable ZIP |
| OS signing | Windows unsigned, macOS ad-hoc, Linux unsigned |
| Updater signing | minisign/Ed25519, public key embedded in the app |

This release adds Linux and macOS installers, signed in-app updates for the bundle types that can
replace themselves, and a one-time manual upgrade path for `0.1.0` users. The engine pin moves from
`lv24-seo 0.5.0` to `0.5.1`; see [Engine 0.5.1](#engine-051) for the fixes that matter to the desktop.

## What's new

- **Windows, Linux and macOS builds.** NSIS and portable ZIP on Windows, AppImage/deb/rpm on Linux,
  and DMG plus `.app.tar.gz` on macOS arm64 and x64.
- **Signed auto-update.** Windows NSIS, macOS `.app` and Linux AppImage check a signed
  `latest.json`, verify the package with the embedded minisign key and install only after the user
  confirms. The updater never installs on its own and never accepts an older version.
- **Honest manual-only cases.** deb, rpm, MSI and the portable ZIP cannot replace the running
  installation. The Settings screen disables the in-app installer for those bundle types and points
  to the release page.
- **One-time 0.1.0 upgrade.** `0.1.0` has no updater. Install `0.2.0` manually once; auto-update
  works from `0.2.0` onward.
- **Linux keyring fix.** The CLI runner now inherits the session-bus and XDG runtime variables that
  Secret Service needs, so the OS keychain works in the desktop process. Secret values still arrive
  only through stdin; no token is passed as an argument or stored in the webview.
- **Engine 0.5.1.** A bugfix release with no schema migration and no new CLI command or MCP tool.
  Desktop-relevant fixes include the write-gate claim lifecycle, crawl text retention, the
  `--days` cap for `stats` and `report weekly`, GSC's final-50,000-row truncation flag, Yandex
  Metrika in `auth status`, and MCP local-state annotations.

## Assets

| Asset | Platform | Purpose |
|---|---|---|
| `LV24.SEO.Optimizer_0.2.0_x64-setup.exe` + `.exe.sig` | Windows x64 | NSIS per-user installer; signed updater package |
| `LV24-SEO-Optimizer_0.2.0_x64-portable.zip` | Windows x64 | portable build; manual-only |
| `LV24.SEO.Optimizer_0.2.0_aarch64.dmg` | macOS Apple silicon | first install |
| `LV24.SEO.Optimizer_0.2.0_x64.dmg` | macOS Intel | first install |
| `LV24.SEO.Optimizer_0.2.0_aarch64.app.tar.gz` + `.sig` | macOS Apple silicon | signed updater package |
| `LV24.SEO.Optimizer_0.2.0_x64.app.tar.gz` + `.sig` | macOS Intel | signed updater package |
| Tauri Linux names: `*_amd64.AppImage` + `.AppImage.sig` | Linux x64 | AppImage; signed updater package |
| Tauri Linux names: `*_amd64.deb`, `*_amd64.rpm` | Linux x64 | package-manager installs; manual-only |
| `latest.json` | all | signed updater manifest |
| `SHA256SUMS.txt` | all | SHA-256 for every published asset |

GitHub replaces spaces in asset names with dots. The release page is authoritative for the exact
Linux file names; `SHA256SUMS.txt` lists every published file under the name GitHub stores.

## Install

### Windows x64

Requires Windows 10/11 x64 and the Microsoft Edge WebView2 runtime. WebView2 ships with Windows 11
and most updated Windows 10 systems. The NSIS installer can fetch it when missing; the portable ZIP
cannot.

**NSIS installer (auto-update capable):**

1. Download `LV24.SEO.Optimizer_0.2.0_x64-setup.exe`, its `.exe.sig` and `SHA256SUMS.txt`.
2. Verify the checksum (see [Verify the download](#verify-the-download)).
3. Run the installer. It installs for the current user, so no administrator prompt is expected, and
   adds a Start menu entry.
4. If SmartScreen appears, choose **More info → Run anyway**. The build is unsigned; see
   [Unsigned builds](#unsigned-builds).
5. Launch **LV24 SEO Optimizer**, open **Settings**, and select your `seo.toml`.
6. Uninstall through **Windows Settings → Apps → LV24 SEO Optimizer → Uninstall**.

**Portable ZIP (manual-only):**

1. Download `LV24-SEO-Optimizer_0.2.0_x64-portable.zip` and `SHA256SUMS.txt`.
2. Verify the checksum.
3. Extract the **whole** `LV24 SEO Optimizer` folder. Do not run the executable from inside the ZIP.
4. Run `lv24-seo-desktop.exe`. Keep the `lv24-seo\` folder next to it: the shell resolves
   `lv24-seo\lv24-seo.exe` as its engine.
5. There is no installer and no Start menu entry. To remove it, delete the extracted folder.

"Portable" means no installer. The app still writes its own preferences to the per-user app config
folder for `by.lv24.seo.desktop` under `%APPDATA%`; project data stays where `seo.toml` points. The
portable layout is detected as manual-only, so the Settings update panel points to the release page
instead of offering an in-app install.

### Linux x64

The Linux bundles are built on Ubuntu 22.04 (glibc 2.35 baseline) and are x64 only. Newer
distributions normally work; older ones may not. There is no Linux arm64 build.

**AppImage (auto-update capable):**

```bash
chmod +x ./*_amd64.AppImage
./*_amd64.AppImage
```

If the AppImage refuses to start because FUSE 2 is missing, install `libfuse2` with your
distribution's package manager or use the deb/rpm package.

**deb (manual-only):**

```bash
sudo apt install ./*_amd64.deb
# or: sudo dpkg -i ./*_amd64.deb
```

**rpm (manual-only):**

```bash
sudo dnf install ./*_amd64.rpm
# or: sudo rpm -i ./*_amd64.rpm
```

The exact file names may differ slightly; use the names on the release page and in
`SHA256SUMS.txt`.

### macOS (arm64 and x64)

Requires macOS 13 or later. Use the `aarch64` DMG on Apple silicon and the `x64` DMG on Intel.

1. Download the matching DMG and `SHA256SUMS.txt`.
2. Verify the checksum.
3. Open the DMG and drag **LV24 SEO Optimizer** to **Applications**.
4. On first launch, Gatekeeper warns because the build is ad-hoc signed. Use **System Settings →
   Privacy & Security → Open Anyway**, or right-click the app → **Open**.
5. Open **Settings** and select your `seo.toml`.

The DMG is the first-install package. Auto-update uses the signed `.app.tar.gz` package for the
matching architecture.

## Auto-update

The updater checks
`https://github.com/LevapVeeskela/lv24-seo-optimizer-desktop/releases/latest/download/latest.json`
once at startup (silently, with a 30-second timeout) and when you press **Check for updates** in
Settings. An offline or failed silent check is quiet; it does not turn the app into an error screen.

When a newer release exists, the panel shows the version and release notes. Nothing is downloaded or
installed until you press **Download and install**. If the configuration form has an unsaved draft,
the install button is disabled until you save or discard it.

The updater verifies the package with the minisign/Ed25519 public key embedded in the app.
`requireSignedVersion` is enabled, so the announced version is bound to the signed package. A
signature failure blocks that artifact, marks the error as non-retryable and points to the release
page; the same artifact is not retried. The updater only accepts a version greater than the running
one, so it cannot downgrade the app.

| Bundle | In-app update | What happens |
|---|---|---|
| Windows NSIS | yes | downloads the signed setup `.exe`, runs it in passive mode, relaunches |
| macOS `.app` | yes | downloads the signed `.app.tar.gz`, replaces the app, relaunches |
| Linux AppImage | yes | downloads the signed AppImage, replaces it, relaunches |
| Windows portable ZIP | no | Settings points to the release page; download and extract a new ZIP |
| Linux deb | no | Settings points to the release page; upgrade with the package manager |
| Linux rpm | no | Settings points to the release page; upgrade with the package manager |
| MSI | no | no MSI is produced; an MSI install is treated as manual |
| Unknown bundle type | no | Settings points to the release page |

### Upgrading from 0.1.0

`0.1.0` has no updater, no endpoint and no public key. It cannot discover or install `0.2.0`.
Download and install `0.2.0` manually once (NSIS installer or portable ZIP on Windows). After that,
the `0.2.0` installation can auto-update to later releases when it uses an auto-update-capable
bundle.

### Manual-only is deliberate

deb, rpm, MSI and the portable ZIP cannot safely replace the running installation:

- a deb/rpm install is owned by the distribution's package database;
- an MSI install is not produced by this project, and the NSIS updater package cannot replace it;
- a portable ZIP has no installer to replace and may live on removable media.

The desktop reports the installed bundle type from the shell and disables the in-app installer for
those cases. It does not pretend that a manual package was updated.

## Verify the download

`SHA256SUMS.txt` covers every published asset: installers, portable ZIP, DMGs, `.app.tar.gz`,
AppImage, deb, rpm, updater signatures and `latest.json`. It does not cover internal CI files such as
`build-info-*.json` or `sidecar-checksums-*.json`; those are build evidence, not release assets.

Windows PowerShell:

```powershell
$sums = Get-Content .\SHA256SUMS.txt
foreach ($line in $sums) {
  if (-not $line.Trim()) { continue }
  $expected, $file = $line -split '\s+', 2
  if (-not (Test-Path ".\$file")) { "SKIP $file (not downloaded)"; continue }
  $actual = (Get-FileHash ".\$file" -Algorithm SHA256).Hash
  if ($actual -eq $expected) { "OK   $file" } else { "FAIL $file" }
}
```

macOS and Linux:

```bash
# Download every asset you intend to install, then:
sha256sum -c SHA256SUMS.txt --ignore-missing

# macOS (shasum is part of the base system):
shasum -a 256 -c SHA256SUMS.txt
```

`Get-FileHash` prints uppercase hex and PowerShell string comparison is case-insensitive, so the
lowercase hashes in `SHA256SUMS.txt` match. **Do not run a file whose hash does not match.**

The sidecar checksum policy is rebuild-aware: the committed pin in `scripts/cli-checksums.json`
records the reviewed local build where one exists, and CI records the actual SHA-256 of the sidecar
it built. PyInstaller onedir output is not byte-reproducible, so a CI rebuild will not equal the
reviewed pin. The release gate requires a valid checksum report for every shipped target, but those
reports are not published. Use `SHA256SUMS.txt` for the files you download; use the report only as
CI evidence when investigating a build.

## Engine 0.5.1

`lv24-seo 0.5.1` is a bugfix release. It has no schema migration and adds no CLI command or MCP
tool. Desktop-relevant changes:

- the write gate stores a claim as `pending`, promotes it to `sent` only after the provider
  confirms, and releases it when the provider raises, so a retry after a failure is not mistaken
  for a duplicate;
- stored crawl page text is capped at 20,000 characters while `word_count` stays exact;
- `--days` is capped at 3,660 for `stats` and `report weekly`, and larger values fail with
  `INVALID_INPUT`;
- a GSC batch that exactly fills 50,000 rows is no longer marked truncated;
- `auth status` includes Yandex Metrika;
- MCP tools that write local snapshots report `readOnlyHint: false` and
  `writes_local_state: true`.

The desktop release bundles `0.5.1` and is tested with it. The shell's minimum-version gate is
`MIN_ENGINE_VERSION` in `src-tauri/src/commands.rs`; an engine older than that gate is marked
offline with a notice instead of being run. A separately installed `0.5.0` engine may pass the
current gate, but it is not the release-tested pin.

## Unsigned builds

None of the OS packages has a paid code-signing signature:

- **Windows:** no Authenticode signature. SmartScreen, Smart App Control or antivirus software may
  warn or block the installer. Verify the SHA-256 checksum published with the release.
- **macOS:** ad-hoc signature only. Gatekeeper warns on first launch. Use **System Settings →
  Privacy & Security → Open Anyway**, or right-click → **Open**. There is no notarization because it
  requires a paid Apple Developer account, which this project does not use.
- **Linux:** AppImage, deb and rpm are unsigned packages. Verify checksums and follow your
  distribution's package policy.

Do not disable Gatekeeper or SmartScreen system-wide. If your environment requires a signed build,
build from source and sign it with your own certificate. The updater signature is separate from OS
code signing and does not make Windows or Linux packages look trusted to the OS.

## Known limitations

- **0.1.0 cannot auto-update.** Install `0.2.0` manually once; auto-update works from `0.2.0`
  onward.
- **deb, rpm, MSI and the portable ZIP are manual-only.** The Settings panel disables the in-app
  installer and links to the release page.
- **No Windows arm64 and no Linux arm64 build.** Windows x64, Linux x64, macOS arm64 and macOS x64
  are the shipped targets.
- **macOS 13+ and glibc 2.35+.** The Linux bundles are built on Ubuntu 22.04; older distributions
  may not run them.
- **No downgrades.** The updater only installs a newer version. Rolling back requires a manual
  install of an older release.
- **Unsigned OS packages.** SmartScreen and Gatekeeper warnings are expected; see above.
- **Updater needs GitHub access.** A blocked or offline GitHub endpoint leaves the app on its
  current version. The silent startup check stays quiet.
- **External engines are version-gated, not bundled.** A separately installed engine can be used
  through `LV24_SEO_BIN`; the UI labels it as external and checks the minimum version.
- **Unsaved configuration drafts are session-only.** Settings and Configuration share one in-memory
  draft; save before closing the app.
- **No job progress or cancel.** Long engine calls show a busy state without a percentage and there
  is no cancel button yet. Wait for the call to finish.
- **English recommendation text.** Recommendation titles, actions and verification steps come from
  the engine and stay in English; only the surrounding UI is translated (en/ru/zh).
- **Preview scope.** This is a `0.x` build: configuration output, updater behavior and UI details
  may change before 1.0.

## Data and privacy

The desktop uploads nothing on its own except the updater's request for `latest.json` (and the
signed package download when you confirm an update). Reports, snapshots, crawl data and the SQLite
database stay in the paths configured in `seo.toml`. Diagnostics are user-triggered and redacted.
Provider calls are made by the engine with the user's own credentials.

## Reporting problems

Open an issue at
<https://github.com/LevapVeeskela/lv24-seo-optimizer-desktop/issues> and include the desktop and
engine versions from the Configuration screen, the operating system, the install method (NSIS,
portable ZIP, AppImage, deb, rpm, DMG) and the exact command or screen that failed. Do not paste
tokens, `seo.toml` secrets or customer queries. Security issues go through
[`SECURITY.md`](../../SECURITY.md), not a public issue.
