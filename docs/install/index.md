---
title: Install
description: Install the lv24-seo engine with uv, pipx, pip or npx, set up tokens, install the desktop app and uninstall cleanly.
---

# Install

There are two install paths: the Python engine (`lv24-seo`) and the optional desktop shell. The npm package is a launcher for the same engine, not a second implementation.

| Path | Best for | Command |
|---|---|---|
| uv | Most users; isolated tool install | `uv tool install "lv24-seo[secrets]"` |
| pipx | Existing pipx workflow | `pipx install "lv24-seo[secrets]"` |
| pip | A project virtual environment | `pip install "lv24-seo[secrets]"` |
| npx | Node users who want no global install | `npx @lv24/seo doctor --json` |
| Desktop | A GUI over the same engine | See [Desktop app](/desktop/) |

## Engine

The engine requires Python 3.11 or newer. `uv` can download the interpreter, so a system Python is optional. The `[secrets]` extra enables OS-keychain storage; without it, `auth set` cannot use the keychain and you must use environment variables or the opt-in file fallback.

Pick one installer. With uv:

```bash
uv tool install "lv24-seo[secrets]"
```

With pipx:

```bash
pipx install "lv24-seo[secrets]"
```

With pip in a virtual environment:

```bash
pip install "lv24-seo[secrets]"
```

With the npm launcher, which installs nothing globally:

```bash
npx @lv24/seo doctor --json
```

If you do not want keychain support, install `lv24-seo` without the extra. The npm launcher requires Node.js 18 or newer and either `uv` or an installed `lv24-seo` binary. It forwards every argument to the pinned Python package; it contains no SEO logic. The first `npx` run may take a few seconds while uv resolves and caches the package.

Open a new terminal after `uv tool install` if the `lv24-seo` command is not found, so the tool bin directory is on `PATH`.

## Verify

```bash
lv24-seo version --json
lv24-seo doctor
```

`version --json` returns the package name and version in the standard envelope. `doctor` checks Python, the config file, the effective data directory and its scope (`meta.data_dir`, `meta.data_dir_source`), working-directory writability and token presence. It makes no network calls, so a passing `doctor` does not prove that a provider token is valid.

## Create a workspace

```bash
lv24-seo init --property https://example.com
```

`init` writes a commented `seo.toml`, creates `<config dir>/data` and writes `data_dir = "./data"`, so the workspace is self-contained. It refuses to overwrite an existing `seo.toml` unless you pass `--force`. One `seo.toml` describes one project and one set of provider targets. For several sites, keep several config files and pass `--config path/to/seo.toml`.

Edit `seo.toml` to set the GSC property, Yandex host id, Metrika counter, Bing site, CrUX origin and PSI URLs. `lv24-seo config show --json` prints the effective config with secret-looking values redacted.

## Tokens

```bash
lv24-seo auth login --provider gsc
lv24-seo auth set --provider gsc --stdin
lv24-seo auth status --json
```

`auth login` runs the provider OAuth connector when a client id is configured: GSC uses a Desktop-app loopback callback with S256 PKCE, and Yandex Webmaster/Metrika use the `verification_code` redirect. `--no-browser` prints the URL, `--code` completes an out-of-band flow, and the Yandex-only `--url-only` returns the authorization URL without writing a token (the desktop uses it for the Connect card). Without a client id, `auth login` prints the manual token steps. `auth set` reads the secret from stdin or a hidden prompt and stores it in the OS keychain, or in the `0600` file fallback when explicitly allowed; OAuth client secrets use `gsc_oauth_secret` or `yandex_oauth_secret`. Never put a token in argv, a shell history, a repository file or a screenshot. `auth status` reports presence and source only; it never prints the value and does not verify permissions.

Supported provider names are `gsc`, `yandex`, `metrika`, `bing`, `crux`, `psi`, `smtp`, `telegram`, `gsc_oauth_secret` and `yandex_oauth_secret`. Without the `secrets` extra, use provider-specific `LV24_SEO_*` environment variables, for example `LV24_SEO_YANDEX_WEBMASTER_TOKEN`. The headless fallback is `LV24_SEO_ALLOW_FILE_SECRETS=1` plus `data/secrets.json` with `0600` permissions; the engine warns on every run in that mode.

GSC also accepts a service account. Set `providers.gsc.service_account_file` to an absolute path or export `LV24_SEO_GSC_SERVICE_ACCOUNT_FILE`; an OAuth grant wins when it is complete, then the service-account file, then a stored `gsc_token`. The engine signs an RS256 JWT, exchanges it at the key's `token_uri` and refreshes it before expiry, so a long-lived `mcp serve` process survives token expiry. `properties` reports `token_source: oauth_refresh_token|service_account_file|secret` and `doctor` adds a non-fatal `gsc_auth` check; neither prints the key. A plain static token keeps working. A Google OAuth app in **Testing** expires refresh tokens after 7 days, so unattended runs should keep the service account.

## Desktop install matrix

Desktop `0.9.5` is the current release and bundles `lv24-seo 0.15.1`; it requires engine `0.15.1` or newer, so an installed `0.15.0` engine is incompatible. Download the assets from the project's Releases page; `SHA256SUMS.txt` covers every published asset.

| Platform | Assets | Auto-update |
|---|---|---|
| Windows 10/11 x64 | NSIS `LV24.SEO.Optimizer_0.9.5_x64-setup.exe` (+ `.sig`), portable `LV24-SEO-Optimizer_0.9.5_x64-portable.zip` (+ `.zip.sha256`) | NSIS only; portable is manual |
| Linux x64 | `LV24.SEO.Optimizer_0.9.5_amd64.AppImage` (+ `.AppImage.sig`), `LV24.SEO.Optimizer_0.9.5_amd64.deb`, `LV24.SEO.Optimizer-0.9.5-1.x86_64.rpm` | AppImage only; deb/rpm are manual |
| macOS 13+ arm64/x64 | `LV24.SEO.Optimizer_0.9.5_aarch64.dmg` / `LV24.SEO.Optimizer_0.9.5_x64.dmg` for first install, `LV24.SEO.Optimizer_0.9.5_aarch64.app.tar.gz` / `LV24.SEO.Optimizer_0.9.5_x64.app.tar.gz` (+ `.sig`) for updates | `.app` only; DMG is the first install |

Engine `0.15.1` rejects documented placeholder OAuth client ids before a consent URL and keeps the four 0.15.0 crawl rule packs (34 rules), the 0.14.1 hidden Windows launcher, 25 CLI commands, 12 MCP tools and schema v5. The desktop `0.9.5` bundles engine `0.15.1` and `MIN_ENGINE_VERSION` `0.15.1`; the new rules appear in reports and Diagnostics without a UI change, and Connect is disabled while the OAuth client is missing or misconfigured. The [release notes](/release/) list the limits.

### Windows

The NSIS installer installs per user, adds a Start menu entry and can auto-update. SmartScreen may warn because the build is unsigned; verify the checksum, then choose **More info → Run anyway**. Before an in-app update the shell stops only the engine sidecar PIDs it started; if one cannot be stopped, the install is blocked with `UPDATE_ENGINE_BUSY` and can be retried after that run exits. The portable ZIP has no installer and no in-app update: extract the whole `LV24 SEO Optimizer` folder, keep the `lv24-seo\` folder next to `lv24-seo-desktop.exe`, and run the executable. To remove the portable build, delete the extracted folder.

### Linux

The Linux bundles are x64 only and built on Ubuntu 22.04 with a glibc 2.35 baseline. Newer distributions normally work; older ones may not. Use the command for the package you downloaded.

```bash
chmod +x ./*_amd64.AppImage
./*_amd64.AppImage
sudo apt install ./*_amd64.deb
sudo dnf install ./*_amd64.rpm
```

If the AppImage refuses to start because FUSE 2 is missing, install `libfuse2` with your distribution's package manager or use the deb/rpm package.

### macOS

Use the `aarch64` DMG on Apple silicon and the `x64` DMG on Intel. Open the DMG, drag **LV24 SEO Optimizer** to **Applications**, then approve the first launch through **System Settings → Privacy & Security → Open Anyway**, or right-click the app and choose **Open**. The build is ad-hoc signed, not notarized. Auto-update uses the signed `.app.tar.gz` for the matching architecture.

### Upgrading from desktop 0.1.0

`0.1.0` was a Windows-only preview with no updater, endpoint or public key. Install `0.9.5` manually once (NSIS installer or portable ZIP). Auto-update works from `0.2.0` onward only for Windows NSIS, macOS `.app` and Linux AppImage.

## Unsigned builds

The OS packages are not signed by a paid certificate authority. Windows has no Authenticode signature; macOS is ad-hoc signed; Linux AppImage, deb and rpm are unsigned. SmartScreen, Gatekeeper or antivirus software may warn or block. Verify the download against `SHA256SUMS.txt` before running it:

```bash
sha256sum -c SHA256SUMS.txt --ignore-missing
```

On Windows, compare `Get-FileHash <file> -Algorithm SHA256` with the matching line in `SHA256SUMS.txt`. The updater signature is separate from OS code signing: it proves an update came from this project's release key, not that the OS trusts the package. Do not disable Gatekeeper or SmartScreen system-wide.

## Uninstall

```bash
uv tool uninstall lv24-seo
pipx uninstall lv24-seo
pip uninstall lv24-seo
```

Use the command that matches your installer. `npx` installs no global package, so there is nothing to uninstall there. On Windows, remove the NSIS install through **Settings → Apps → LV24 SEO Optimizer → Uninstall**; delete the portable folder by hand. On Linux, remove deb/rpm with the distribution's package manager. On macOS, delete the app from **Applications**.

Uninstalling the tool does not delete your project. `seo.toml`, `data/`, SQLite history, reports and backups stay where they are until you remove them.

## Next

- [Quickstart](/start/) — the five-minute path.
- [Desktop app](/desktop/) — features, updates and limitations.
- [Config reference](/reference/config/) — every `seo.toml` key.
- [Security and privacy](/security/) — token storage and write gates.

Source: `_source/engine-README.md`, `_source/engine-cli.md`, `_source/engine-config.md`, `_source/engine-auth.md`, `_source/engine-releases-0.15.1.md`, `_source/engine-releases-0.15.0.md`, `_source/engine-releases-0.14.1.md`, `_source/engine-releases-0.14.0.md`, `_source/engine-releases-0.13.1.md`, `_source/engine-releases-0.13.0.md`, `_source/desktop-README.md`, `_source/desktop-releases-0.9.5.md`, `_source/desktop-releases-0.9.4.md`, `_source/desktop-releases-0.9.3.md`, `_source/desktop-releases-0.9.2.md`, `_source/desktop-releases-0.9.1.md`, `_source/desktop-releases-0.8.0.md`, `_source/desktop-releases-0.7.0.md`, `_source/desktop-releases-0.6.0.md`, `_source/desktop-releases-0.5.0.md`, `_source/desktop-releases-0.4.0.md`, `_source/desktop-releases-0.3.0.md`, `_source/desktop-releases-0.2.3.md`, `_source/desktop-releases-0.2.2.md`, `_source/desktop-releases-0.2.0.md`.
