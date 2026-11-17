# Release runbook

This page is the release contract for `lv24-seo-optimizer-desktop`. It covers versioning, the manual
desktop workflow, the PyInstaller sidecar, checksums, updater signing, `latest.json`, OS signing,
draft/undraft publishing, artifact retention, owner gating, rollback and cost.

The pipeline is **manual and owner-gated**. There are no `push`, pull-request or tag triggers, no
paid runners, no paid OS code-signing certificates and no notarization. A release that cannot prove
its checksums, its updater signatures or its engine version does not ship.

## 1. Release state

`0.2.0` was the first multi-platform release; `0.9.0` is the latest published release (2026-11-17),
and `0.8.0` is the previous line. `0.7.0`, `0.6.0`, `0.5.0`, `0.4.0`, `0.3.0` and `0.2.3` are
kept for rollback:

- **Windows x64:** unsigned NSIS installer, signed updater `.exe`, portable ZIP.
- **Linux x64:** AppImage (signed updater), deb and rpm (manual-only).
- **macOS arm64/x64:** DMG plus signed `.app.tar.gz` updater archives.
- **Common:** `latest.json` and `SHA256SUMS.txt`.

Release notes: [`docs/releases/0.9.0.md`](releases/0.9.0.md) for the current release,
[`docs/releases/0.8.0.md`](releases/0.8.0.md) for the previous line and
[`docs/releases/0.7.0.md`](releases/0.7.0.md) for the one before that.

Auto-update is enabled for Windows NSIS, macOS `.app` and Linux AppImage. deb, rpm, MSI and the
portable ZIP are manual-only; the UI disables in-app installation for those bundle types and links
to the release page. `0.1.0` has no updater, so `0.1.0` users must install `0.9.0` manually once.

Release preconditions (as used for `0.9.0`; update the version pins for the next release):

- `package.json`, `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml` all say `0.9.0`.
- `scripts/cli-checksums.json` says `0.11.0` and the workflow runs with `engine_version=0.11.0`.
  The release gate rejects a mismatch.
- `MIN_ENGINE_VERSION` in `src-tauri/src/commands.rs` is `0.11.0`, equal to the `0.9.0` bundle. An
  older engine is reported as incompatible; the desktop does not run commands against it. Verify the
  gate and the pin agree before publishing.
- CI (web, Rust matrix, contract drift) is green on the exact release commit. The contracts were
  regenerated from the pinned engine and match `scripts/cli-checksums.json`.
- The `desktop-release` environment exists with the owner as required reviewer.
- The `TAURI_SIGNING_PRIVATE_KEY` repository secret exists. `publish=true` fails without it.
- README, `docs/*`, release notes and the unsigned warning are current.

### Cancellable background runs (`0.6.0`)

`0.6.0` ships `run_cancel` and a window-wide run banner:

- Cancellable commands are exactly `crawl`, `report_weekly`, `logs_analyze`, `backup_create`,
  `backup_restore` and `schedule_install` (`CliCommandId::cancellable`). `cli_run` rejects a run id
  for every other command with `RUN_NOT_CANCELLABLE`; short reads keep their synchronous path.
- `run_cancel(runId)` returns `false` for an unknown or already finished run, or when the PID is no
  longer ours. It signals only the exact child PID registered for that run (and its process group on
  Unix), after checking that the PID is still an engine image or one of the exact children this
  process tracks. It never matches a process by name.
- A cancelled run returns `RUN_CANCELLED`; the UI shows a distinct cancelled state, not a generic
  error. Cancellation is not rollback: files already written stay on disk, and a cancelled restore
  keeps the engine's pre-restore copy but may have replaced one file. The release notes name the new
  command and the no-rollback limitation.
- `schedule_install` is a cancellable host write. The shell appends `--allow-write` only after the
  confirmation dialog; engine `0.8.0` made `schedule install` plan-only by default, so the opt-in is
  mandatory and a plan-only call is not an install.
- Verification: `cargo test --all-targets` (registry, finished run, double cancel, unrelated PID),
  `npm test` (cancel visibility, cancelled state, banner across a route change), plus the standard
  `npm run typecheck`, `npm run build`, `npm run test:release`, `cargo fmt --check` and
  `cargo clippy --all-targets -- -D warnings`.

### Bing URL submission and status views (`0.8.0`)

This wave adds the desktop surface for the engine `0.10.0` Bing commands. It ships in `0.8.0`; the
`0.7.0` line keeps its `0.9.0` pin and its notes below.

- `bing_submit` builds
  `bing submit --config <path> [--url <abs> ...] [--from-sitemap] [--sitemap-url <abs>] --allow-write [--confirm <token>] --json`.
  The plan carries the opt-in without a token; the apply adds the reviewed token. `--sitemap-url`
  requires `--from-sitemap`, and at least one explicit URL or the sitemap source is required. Only
  `provider: bing` is accepted, and it is never emitted because the command group already names Bing.
- `bing_sitemaps`, `bing_issues` and `bing_quota` are read-only and accept only `--config` and
  `--json`. The shell rejects a write flag, token, sitemap URL or per-URL argument before the engine
  starts.
- The submission result means Bing **accepted** the URLs. It does not mean they were indexed, and the
  engine exposes no per-URL status. The UI labels the count as accepted and says so explicitly.
- Quota is shown as remaining, never as used or total. Daily and monthly buckets are separate; the
  monthly remaining (1,400 for lv24.by) can run out before the daily remaining (100), and Bing does
  not document the monthly reset.
- `GetFeeds` rows show URL, free-form status, last crawl and URL count. The panel states that Bing
  does not return a per-URL error reason or crawl status. `GetFeedDetails` only expands sitemap-index
  children and has no separate screen.
- `GetCrawlIssues` rows show URL, HTTP code, the decoded issue bitmask (1=301, 2=302, 4=4xx, 8=5xx,
  16=robots, 32=malware, 64=important robots, 128=DNS, 256=timeout) and in-links. No severity or date
  field is invented.
- A missing key/site and a Bing HTTP 400 `ErrorCode` are shown with the engine message and code; the
  UI never turns either into a fake success.
- Verification: `cargo test --all-targets` (argv for all four commands, dry/apply, from-sitemap,
  repeated URLs, invalid URL), `npm test` (plan/apply and read-only load/error states),
  `npm run typecheck`, `npm run build`, `npm run test:release`, `cargo fmt --check` and
  `cargo clippy --all-targets -- -D warnings`.

Limitations: the new commands need engine `0.10.0`; an older engine returns `CLI_INVALID_JSON` and
the panel says an update is needed. There is no `--site` override: the target comes from
`providers.bing.site`. Writes are not cancellable and have no rollback. The read-only views are
bounded by the engine response and do not retry automatically. `GetFeedDetails` is a note in the
panel, not a screen.

### Bing indexing actions (`0.7.0`)

`0.7.0` ships the desktop surface for two engine `0.9.0` commands and one external opener:

- `sitemap_submit` builds
  `sitemap submit --provider bing --config <path> [--url <abs>] --allow-write [--confirm <token>] --json`.
  The engine requires the opt-in even for the plan, so the plan call includes `--allow-write` but no
  token; the apply adds the reviewed token. Without `--url` the engine uses
  `{project.base_url}/sitemap.xml`. Only `--provider bing` is accepted.
- `indexnow_submit` builds
  `indexnow submit --from-sitemap --config <path> [--sitemap-url <abs>] --allow-write [--confirm <token>] --json`,
  with the same two-phase gate. The engine reads the sitemap and extracts its URLs.
- Both commands pin `--config` to the active workspace because the engine opens its write ledger
  there. A token without the opt-in, a missing opt-in, a non-Bing provider or a relative URL is
  rejected by the shell before the engine starts.
- The shell generates a fresh 32-byte hex `LV24_SEO_WRITE_SECRET` at startup, keeps it only in Rust
  memory and sets it on every engine child after `env_clear()`. It is never in argv or a result; a new
  session invalidates old plan tokens. A CLI user sets the variable themselves.
- A missing Bing key is shown as `AUTH_REQUIRED` with a Settings hint. A pre-`0.9.0` engine returns
  `CLI_INVALID_JSON`; the panel says the action needs engine `0.9.0` instead of showing a success.
  `MIN_ENGINE_VERSION` is `0.9.0` in this release, so an older bundled or `LV24_SEO_BIN` engine is
  reported as incompatible before the action is offered.
- `open_bing_sitescan` only opens
  `https://www.bing.com/webmasters/sitescan?siteUrl=<percent-encoded>` in the default browser. Bing
  has no public API for starting a Site Scan; the desktop does not start, poll or import a scan, and
  the UI says so. The destination host/path are hard-coded and re-checked before the opener runs.

Limitations: the sitemap write uses the Bing Webmaster API key stored as the `bing_api_key` secret
(or `LV24_SEO_BING_API_KEY`); IndexNow additionally needs `providers.bing.indexnow_key` and a hosted
key file. Writes are not cancellable and have no rollback. The result card shows the engine's
status/details and, for IndexNow, the submitted URL count; it does not import scan results, retry a
failed write automatically, or replay a consumed token. A changed sitemap URL invalidates both plans
and requires a fresh review, and plan tokens expire with the app session. Verification:
`cargo test --all-targets`, `npm run typecheck`, `npm test`, `npm run build`,
`npm run test:release`, `cargo fmt --check` and `cargo clippy --all-targets -- -D warnings`.

## 2. Versioning

The desktop follows [Semantic Versioning 2.0.0](https://semver.org/):

- pre-1.0: `MINOR` may contain breaking changes; `PATCH` is fixes and additive changes;
- 1.0+: breaking changes only in `MAJOR`;
- the desktop version is independent from the engine version, but the engine is pinned exactly.

The version must agree in all of these places:

1. `package.json` → `version`
2. `src-tauri/tauri.conf.json` → `version`
3. `src-tauri/Cargo.toml` → `[package] version`
4. the Git tag `vX.Y.Z` supplied to the workflow
5. the release title/notes generated by the workflow

The engine pin lives in `scripts/cli-checksums.json` (`version`, `python`, `pydantic`, `typer`,
`pyinstaller`). The workflow passes `engine_version` explicitly; the release gate requires it to
match the pin before uploading.

### Engine compatibility

- A release build bundles the exact pinned engine version. `0.9.0` bundles `lv24-seo 0.11.0`.
- The shell accepts an engine whose version is at least `MIN_ENGINE_VERSION` and marks an older one
  incompatible with a notice. It does not silently migrate commands to an older engine. The current
  source gates at `0.11.0`.
- A development build may use `LV24_SEO_BIN` with another version; the shell records it as source
  `env` and checks the minimum version. The current UI shows the engine version, not a separate
  path/source panel. A `PATH` engine is used only when `LV24_SEO_ALLOW_PATH_ENGINE=1` is set.

## 3. Manual desktop workflow

Workflow: [`.github/workflows/desktop.yml`](../.github/workflows/desktop.yml)

Trigger: **Actions → Desktop build → Run workflow**. It has no push, pull-request or tag trigger.

| Input | Type | Default | Meaning |
|---|---|---|---|
| `engine_version` | string | `0.11.0` for this release | exact `lv24-seo` version bundled in the sidecar |
| `signed` | boolean | `false` | request OS signing/notarization; requires paid certificates that this project does not buy |
| `publish` | boolean | `false` | create a GitHub release after every matrix build passes |
| `tag` | string | empty | `vX.Y.Z` release tag; required when `publish=true` |

The `engine_version` input must equal `scripts/cli-checksums.json`; the release gate rejects the
manifest mismatch. The workflow input default and the pin name the same version and are bumped
together in the release commit (`0.11.0` for the `0.9.0` line). A different value is allowed for a
rebuild only when `scripts/cli-checksums.json` is updated in the same commit.

### Matrix

| Runner | Rust target | Bundles | Updater artifact |
|---|---|---|---|
| `windows-latest` | `x86_64-pc-windows-msvc` | NSIS | signed setup `.exe` |
| `ubuntu-22.04` | `x86_64-unknown-linux-gnu` | AppImage, deb, rpm | signed AppImage |
| `macos-15` | `aarch64-apple-darwin` | DMG + app | signed `.app.tar.gz` |
| `macos-15-intel` | `x86_64-apple-darwin` | DMG + app | signed `.app.tar.gz` |

`ubuntu-22.04` sets a glibc 2.35 baseline. It is deprecated in September 2026 and unsupported in
April 2027; when it retires, move to `ubuntu-24.04` (glibc 2.39) or a pinned 22.04 container and
document the new baseline. Do not silently raise the minimum glibc without a release note.

All runners are standard GitHub-hosted runners. No larger runner, paid minute, paid storage or paid
signing service is used. Artifact retention is **7 days**; the release job uploads the final assets
to the GitHub release, which is the durable distribution channel.

### Pull-request CI gates

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs on every pull request and on `main`
(public repository, standard runners only):

| Job | What it proves |
|---|---|
| `web` | `npm run typecheck`, `npm test` (unit + release-script tests), `npm run build` |
| `contracts` | the committed contracts still match the pinned engine |
| `rust` | `cargo fmt --check`, `cargo clippy -D warnings`, `cargo test` on linux-x64, windows-x64, macos-arm64 and macos-x64 |
| `audit` | `npm audit --audit-level=high` and `cargo audit` (RustSec) |

The Rust matrix includes `macos-15-intel`, the runner the release uses for `x86_64-apple-darwin`
(QA-05), so an x64 macOS regression fails on the PR instead of at release time. Both workflows
install Rust `1.95.0` rather than `stable`, so the shipped binary is built by the reviewed compiler;
bump that pin deliberately with the release that reviews the new toolchain (QA-09).

The release scripts are covered by `scripts/*.test.mjs` (QA-01/QA-02) against fixture directories in
the OS temp dir: `merge-latest-json.mjs`, the published-asset allowlist, `SHA256SUMS.txt`, the
portable ZIP and its `.sha256`, and validation against `contracts/latest.schema.json`. A bug fails
`npm test` on the pull request, not the owner-gated publish run. `npm run test:release` runs only
that subset.

## 4. Sidecar build

The release sidecar is a PyInstaller **onedir** tree. Onefile is rejected: it extracts on every
call, starts slowly, is AV-prone and cannot be signed correctly on macOS.

```bash
# Build on the matching host; PyInstaller does not cross-compile.
python scripts/build-sidecar.py \
  --engine-version 0.11.0 \
  --target x86_64-pc-windows-msvc \
  --out src-tauri/engine
```

The script:

- uses `uv` to create an isolated environment with `lv24-seo[secrets]==<pinned>`, the pinned
  `typer`, `pydantic` and PyInstaller versions (unpinned Typer 0.21 breaks `datetime.date` options);
- runs PyInstaller with `--onedir`, `--noupx`, `--collect-submodules keyring.backends`,
  `--collect-submodules lv24_seo.crawl.rules`, hidden imports for both MCP server modules,
  `--collect-data lv24_seo` (including `schema.sql`) and `--add-data` for the packaged skills;
- writes `src-tauri/engine/lv24-seo/` with the executable and `_internal/`;
- smoke-runs `version --json` and writes `build-info.json` next to the tree.

The Tauri bundle maps `engine/lv24-seo/` to the app resource directory `engine/lv24-seo/`. The shell
resolves `<resource_dir>/engine/lv24-seo/lv24-seo[.exe]`, falls back to the flat
`<resource_dir>/lv24-seo/lv24-seo[.exe]`, then a sibling `lv24-seo/` folder next to the app. Do not
use Tauri `externalBin` for an onedir tree: it copies one file and cannot keep `_internal/`
adjacent.

### Verify

```bash
node scripts/verify-sidecar.mjs \
  --root src-tauri/engine \
  --target x86_64-pc-windows-msvc \
  --engine-version 0.11.0
```

The strict verifier checks:

- the target is present in `scripts/cli-checksums.json`;
- the executable exists and is non-empty;
- `version --json` returns `ok: true`, `data.name = "lv24-seo"` and the exact pinned version;
- SHA-256 and size match the manifest when they are pinned;
- placeholder hashes (`null`) are a warning by default and a failure with `--require-pinned`.

This is what a local release build must pass before a pin is committed.

PyInstaller does not produce byte-identical output, so a CI rebuild cannot match the pin. The build
job runs the verifier with `--no-hash` (alias `--allow-rebuild`):

```bash
node scripts/verify-sidecar.mjs \
  --root src-tauri/engine \
  --target x86_64-pc-windows-msvc \
  --engine-version 0.11.0 \
  --no-hash \
  --report release/sidecar-checksums-x86_64-pc-windows-msvc.json
```

`--no-hash` still verifies the target, the executable and the exact engine version, and computes the
actual SHA-256 and size. A SHA-256 or size mismatch against the reviewed pin becomes a warning
instead of a failure; the report records the actual `sha256`, `size`, `pinnedSha256`,
`hashPolicy: "rebuild"`, `hashMatched` and `sizeMatched`. `--write` cannot be combined with
`--no-hash`.

The report is written to `release/sidecar-checksums-<target>.json` inside the workspace and uploaded
with the build artifact. It is **CI evidence**, not a published release asset: the release job skips
it when uploading and `SHA256SUMS.txt` does not list it.

## 5. Checksums and release assets

[`scripts/cli-checksums.json`](../scripts/cli-checksums.json) is the reviewed pin for the **local
release build**:

```json
{
  "schemaVersion": 1,
  "engine": "lv24-seo",
  "version": "0.11.0",
  "python": "3.12",
  "pydantic": "2.14.3",
  "typer": "0.29.0",
  "pyinstaller": "6.22.3",
  "targets": {
    "x86_64-pc-windows-msvc": {
      "path": "lv24-seo/lv24-seo.exe",
      "sha256": null,
      "size": null
    },
    "x86_64-unknown-linux-gnu": {
      "path": "lv24-seo/lv24-seo",
      "sha256": null,
      "size": null
    },
    "aarch64-apple-darwin": {
      "path": "lv24-seo/lv24-seo",
      "sha256": null,
      "size": null
    },
    "x86_64-apple-darwin": {
      "path": "lv24-seo/lv24-seo",
      "sha256": null,
      "size": null
    }
  }
}
```

The values above illustrate the shape; the committed file is authoritative. The Windows entry records
the reviewed `0.11.0` build. The Linux and macOS targets are `null` until the `0.11.0` sidecar is
rebuilt and reviewed on a matching host; a pin from an older engine does not carry over because the
executable changes with the engine. `null` means “not pinned yet”. After a verified local build,
compute the hash and commit the 64-hex value plus size in a focused PR
(`node scripts/verify-sidecar.mjs ... --write` writes the pin after a verified build).

### Why CI does not compare against the pin

PyInstaller onedir output is not byte-reproducible. The same engine, Python and PyInstaller versions
produce a different executable SHA-256 on the next build (embedded timestamps and paths). An earlier
local Windows build pinned `216f7aa6…`; an immediate rebuild produced `72e7e260…`. Comparing a CI
rebuild with the pin would fail every run without indicating a real problem.

The policy is therefore:

- **Local release build — strict.** `verify-sidecar.mjs` must match the committed SHA-256 and size;
  `--write` updates the pin after review. The pin is the durable record of the reviewed build.
- **CI rebuild — rebuild-aware.** The build job runs `verify-sidecar.mjs --no-hash`, which still
  verifies the target, the executable, a positive size and the exact engine version, and records the
  actual SHA-256 in `release/sidecar-checksums-<target>.json`. A hash or size mismatch with the pin
  is a warning in the report, not a failure.
- **Release gate — report-based.** The release job requires one valid report for every shipped
  target: matching target name, `hashPolicy: "rebuild"`, `ok: true`, a 64-hex `sha256`, a positive
  `size` and `expectedVersion`/`actualVersion` equal to the `engine_version` input. It also requires
  the manifest `version` to equal that input. It does not require repo-pinned hashes, so
  non-reproducible CI rebuilds do not block a release.

### Published assets and `SHA256SUMS.txt`

The release job uploads only the publishable allowlist:

- Windows: `*-setup.exe`, `*-setup.exe.sig`, `*-portable.zip`, `*-portable.zip.sha256`, plus the
  `.nsis.zip` fallback pair when Tauri produced it;
- Linux: `*.AppImage`, `*.AppImage.sig`, `*.deb`, `*.rpm` (and optional `.deb.sig`/`.rpm.sig`),
  plus the `.AppImage.tar.gz` fallback pair when Tauri produced it;
- macOS: two `*.dmg`, two `*.app.tar.gz`, two `*.app.tar.gz.sig`;
- `latest.json` and `SHA256SUMS.txt`.

`build-info-*.json`, `sidecar-checksums-*.json` and `updater-*.json` stay in the CI workspace as
evidence. `SHA256SUMS.txt` is generated from the published allowlist by basename and includes
`latest.json` and every `.sig` file. It fails on duplicate basenames or whitespace. Verify an
installer with `SHA256SUMS.txt`; the sidecar executable is inside the installer, so its hash is not
listed separately.

The allowlist itself lives in [`scripts/release-assets.mjs`](../scripts/release-assets.mjs) and is
used for the checksum list, the upload list and the release gate. It used to be duplicated between
an inline `isPublished()` helper and a bash upload `case`; the portable ZIP checksum was produced and
uploaded to the CI artifact but dropped from the release (QA-08). `scripts/release-assets.test.mjs`
fails `npm test` when an artifact is added to one consumer but not the others.

Asset names are normalized before checksums: GitHub replaces spaces with dots. The staging and
release scripts reject characters GitHub may rewrite and refuse duplicate basenames. The published
Windows asset is therefore `LV24.SEO.Optimizer_0.9.0_x64-setup.exe`, not the spaced build output.

## 6. Updater signing and `latest.json`

The committed Tauri config enables updater artifacts and embeds the public key:

```json
{
  "bundle": { "createUpdaterArtifacts": true },
  "plugins": {
    "updater": {
      "pubkey": "<minisign public key>",
      "endpoints": [
        "https://github.com/LevapVeeskela/lv24-seo-optimizer-desktop/releases/latest/download/latest.json"
      ],
      "requireSignedVersion": true,
      "windows": { "installMode": "passive" }
    }
  }
}
```

Updater signatures use a free Ed25519/minisign key, separate from OS code signing:

- the **public** key is in `src-tauri/tauri.conf.json` and is shipped with the app;
- the **private** key is the `TAURI_SIGNING_PRIVATE_KEY` repository secret, optionally protected by
  `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`;
- the private key is passed only to the **Build Tauri installers** step. The staging, `latest.json`
  merge, checksum, release-upload and undraft steps do not receive it;
- `publish=true` fails if the key is missing. A build-only run without the key sets
  `createUpdaterArtifacts=false` in the CI config override;
- local builds without the key use `--no-sign` or a config override with
  `createUpdaterArtifacts: false`. Never commit the private key.

`requireSignedVersion: true` binds the announced version to the signed package. The updater only
accepts a version greater than the running one, so it cannot downgrade. A signature failure blocks
the artifact and points to the release page.

### Sidecar cleanup before install

The engine sidecar is installed inside the app resources, so a running `lv24-seo` process keeps
`engine/lv24-seo/lv24-seo[.exe]` locked and the NSIS installer cannot replace it. This is what broke
the `0.2.1` in-app update.

The webview holds only `updater:allow-check`, so it can read the manifest but cannot call the
plugin's `downloadAndInstall`. The install action calls `prepare_update` and then the Rust
`update_install(expectedVersion)` command. `update_install` re-checks the endpoint, refuses a version
that differs from the one the user saw (`UPDATE_VERSION_MISMATCH`), allows one install at a time
(`UPDATE_IN_PROGRESS`), stops the tracked sidecars itself and only then downloads and installs.
`update_cancel` stops a download before the installer starts and returns `UPDATE_CANCELLED`; once
installation has begun it returns `false`.

The stop targets only the engine PIDs the current app instance registered when it spawned them and
waits up to `2 s` for them to exit; `prepare_update` reports how many it stopped. Nothing is matched
by image name: another installed copy, a portable build, a terminal `lv24-seo` run or an unrelated
process is never killed.

If cleanup fails, the command returns `UPDATE_ENGINE_BUSY` and does not start the installer. The
error is retryable and says what to close.

### Staging

`scripts/stage-release-assets.mjs` copies the bundles into a flat `release/` directory, normalizes
names, and writes `updater-<platform>.json` metadata containing the asset name and the signature
contents. It accepts both Tauri 2.12 boolean-mode artifacts and v1-compatible archives:

- Windows: signed `*-setup.exe` preferred, else `*.nsis.zip` + `.nsis.zip.sig`;
- Linux: signed `*.AppImage` preferred, else `*.AppImage.tar.gz` + `.AppImage.tar.gz.sig`;
- macOS: `*.app.tar.gz` + `.app.tar.gz.sig`, renamed to a version/architecture-specific basename so
  arm64 and x64 do not collide.

It also removes the `release/portable/` staging tree so the uploaded artifact stays flat.

### Merging

`scripts/merge-latest-json.mjs` merges the per-platform metadata into `latest.json`:

```bash
node scripts/merge-latest-json.mjs \
  --dist dist \
  --version "$VERSION" \
  --tag "$TAG" \
  --repo "$GITHUB_REPOSITORY"
```

It requires the generic keys `windows-x86_64`, `linux-x86_64`, `darwin-aarch64` and
`darwin-x86_64`, and adds the bundle aliases the updater probes: `windows-x86_64-nsis`,
`linux-x86_64-appimage`, `darwin-aarch64-app` and `darwin-x86_64-app`. It adds
`linux-x86_64-deb`/`linux-x86_64-rpm` only when Tauri produced those signatures. Every URL points
under `releases/download/<tag>/`, every signature is checked against the `.sig` file on disk, and
every referenced asset must exist. The notes come from `docs/releases/<version>.md` when present;
otherwise the version string is used.

The merged manifest is then validated against
[`contracts/latest.schema.json`](../contracts/latest.schema.json) by
`node scripts/validate-latest-json.mjs --file dist/latest.json`. The schema is the contract with
`tauri-plugin-updater` (QA-02): a manifest the plugin would reject — wrong `pub_date`, missing
generic platform, short or non-base64 signature, non-HTTPS URL, unknown field — fails the release job
before the draft is created. `scripts/latest-schema.test.mjs` keeps the schema, the validator and the
merge script in agreement.

### Expected asset gates

Before the draft is published, the release job independently checks:

- exactly one Windows `-setup.exe` and its `.exe.sig` (or the `.nsis.zip` fallback pair);
- exactly one `-portable.zip` and its `.sha256` sidecar, and the sidecar must hash the archive;
- exactly one AppImage, one deb, one rpm, and the AppImage `.sig` (or the `.AppImage.tar.gz`
  fallback pair);
- exactly two macOS DMGs (one `_aarch64`, one `_x64`), two `.app.tar.gz` archives and two `.sig`
  files;
- `latest.json` that is schema-valid, with all generic platforms, all four aliases, non-empty
  signatures, URLs under the release tag and assets that exist;
- `SHA256SUMS.txt` that references every `latest.json` asset.

### Draft, upload and undraft

The release is created as a **draft** first. Assets are uploaded while it is a draft; the upload list
comes from the tested allowlist and is sent in one `gh release upload` call. The job then publishes
with `gh release edit --draft=false` and verifies the remote asset names against `SHA256SUMS.txt`.

`releases/latest/download/latest.json` only resolves to a published (non-draft) release, so users
never see a partially uploaded manifest. A rerun reuses an existing draft, clears its assets and
refuses to overwrite a published release.

## 7. OS code signing

### Default: unsigned

- **macOS:** ad-hoc signature (`bundle.macOS.signingIdentity = "-"`, hardened runtime off). The
  build job also ad-hoc signs every Mach-O file in the bundled sidecar before the app bundle is
  sealed. Gatekeeper warns on first launch. The documented flow is System Settings → Privacy &
  Security → Open Anyway, or right-click → Open. Do not instruct users to disable Gatekeeper
  globally.
- **Windows:** no Authenticode signature. SmartScreen, Smart App Control or antivirus may warn or
  block the installer. Publish SHA-256 checksums and explain verification.
- **Linux:** AppImage, deb and rpm are unsigned packages. Verify checksums and follow distribution
  policy.

The release notes must say **UNSIGNED** when `signed=false`. Do not use a “signed” badge for an
ad-hoc or unsigned build. The updater signature is separate and does not make the OS package
trusted.

### `signed=true`

This input exists for an owner who later approves and configures certificates. It is **not**
configured in this zero-spend repository:

- macOS signing/notarization requires an Apple Developer account and notarization credentials. The
  workflow refuses to claim a signed build when `APPLE_CERTIFICATE` is missing.
- Windows Authenticode requires a certificate or a custom `signCommand`. The workflow prints a
  warning and leaves Windows unsigned.
- Do not buy certificates, notarization, email QA or paid runners without explicit owner approval.

## 8. Build steps performed by CI

For each matrix entry:

1. checkout the workflow commit;
2. install Node 24 and run `npm ci`;
3. install `uv`, Python 3.12, Rust `1.95.0` and the matrix target;
4. install Linux WebKitGTK/AppImage/rpm build dependencies on Ubuntu;
5. require the updater key when `publish=true`;
6. build the onedir sidecar with the pinned engine;
7. run `verify-sidecar.mjs --no-hash` and write `release/sidecar-checksums-<target>.json`;
8. ad-hoc sign the bundled Mach-O sidecar files on macOS;
9. write a CI Tauri config override:
   - `bundle.resources = { "engine/lv24-seo/": "engine/lv24-seo/" }`;
   - `bundle.macOS.signingIdentity = "-"` and `hardenedRuntime = false` when `signed=false`;
   - `bundle.createUpdaterArtifacts` is `true` only when the updater key exists;
10. run `npm run tauri build -- --target <target> --bundles <bundles> --config <ci-config>`;
11. on Windows, run `node scripts/package-portable.mjs --target <target>` to write the portable ZIP
    and its `.sha256` sidecar to `release/`;
12. run `node scripts/stage-release-assets.mjs --target <target>` (with `--require-updater` when the
    key exists or `publish=true`) and upload `release/*` as a 7-day artifact.

`upload-artifact` stores files relative to the least common ancestor of its `path` entries.
Uploading a single `release/*` pattern makes that root `release/`, so the artifact is flat: the
release job downloads it with `merge-multiple: true` and finds every file directly in `dist/`.

The release job:

1. downloads all artifacts;
2. validates the tag and requires a valid sidecar checksum report per shipped target;
3. normalizes/flattens names and rejects duplicate basenames;
4. merges `latest.json` and validates it against `contracts/latest.schema.json`;
5. verifies the expected asset set, the portable `.sha256` and `latest.json` references;
6. generates `SHA256SUMS.txt` from the published allowlist (`scripts/release-assets.mjs`);
7. writes release notes with the engine version, platforms, updater endpoint and unsigned warning;
8. creates a draft release, uploads the allowlisted assets in one `gh release upload` call,
   undrafts it and verifies the remote names.

## 9. Release procedure

### Preflight (before running the workflow)

- [ ] CI is green on the pull request that contains the release commit.
- [ ] `package.json`, `tauri.conf.json`, `Cargo.toml` and the intended tag agree (`0.9.0`).
- [ ] `scripts/cli-checksums.json` says `0.11.0` and `engine_version=0.11.0` will be supplied.
- [ ] The `engine_version` workflow input default matches the pin (`0.11.0`); the release gate compares
      it with `scripts/cli-checksums.json`.
- [ ] Contracts were regenerated from the pinned engine and match
      `scripts/cli-checksums.json`.
- [ ] `MIN_ENGINE_VERSION` is `0.11.0` and equals the pin.
- [ ] The local release build you reviewed matches the pinned SHA-256 and size in
      `scripts/cli-checksums.json` (strict `verify-sidecar.mjs`), or that target is explicitly
      `null` because its `0.11.0` sidecar has not been rebuilt yet. CI rebuilds are recorded, not
      compared.
- [ ] README, `docs/*`, `docs/releases/0.9.0.md`, changelog/release notes and the unsigned warning
      are current.
- [ ] No secrets, private keys or customer data are in the diff or fixtures.
- [ ] The GitHub environment `desktop-release` exists with the owner as required reviewer.
- [ ] `TAURI_SIGNING_PRIVATE_KEY` and, if used, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` exist.
- [ ] `npm run check`, `npm run contract:check` and the Rust checks pass locally or on the PR.

### Build-only run

1. Run **Desktop build** with `publish=false`, `engine_version=0.11.0` and `signed=false`.
2. Wait for all four matrix jobs.
3. Download each artifact.
4. On a clean machine/VM per OS, install and launch **offline**:
   - the app starts and shows both desktop and engine versions;
   - `doctor` and provider status load;
   - a no-data weekly report renders honestly;
   - the sidecar path is inside the app resources;
   - uninstalling removes the app but not the user's workspace.
5. Confirm the updater panel reports the bundle type correctly: NSIS/AppImage/app can update;
   portable/deb/rpm/MSI show the manual-only hint and link to the release page.
6. Open `sidecar-checksums-<target>.json` from the artifact: `ok` is true, `hashPolicy` is
   `rebuild`, `sha256` is a 64-hex digest, `size` is positive and `actualVersion` is `0.11.0`. It
   will not equal the reviewed pin; that is expected.

### Publish run

1. Update `scripts/cli-checksums.json` in a PR if the reviewed local build or engine pin changed;
   merge it.
2. Run **Desktop build** with `publish=true`, the final `tag` (`v0.9.0`), `engine_version=0.11.0`
   and `signed=false` (unless certificates are actually configured).
3. Approve the `desktop-release` environment as the repository owner. The release job also requires
   the actor to be the repository owner; a non-owner run is skipped.
4. The workflow creates the draft release, uploads the assets, verifies `latest.json` and
   `SHA256SUMS.txt`, then undrafts it.
5. Verify the release page: asset names, checksums (including `*-portable.zip.sha256`), all four
   platforms, `latest.json` and notes.
6. Verify the in-app update on a machine with the previous release installed. `0.2.0 → 0.2.1`
   through `0.7.0 → 0.8.0` are verified end-to-end on Windows NSIS, including the Rust-side version
   re-check and a running sidecar stopped before the installer. The relaunched `0.8.0` build reports
   Desktop `0.8.0`, Engine `0.10.0` and loads the real `lv24.by` workspace. `0.8.0 → 0.9.0` is the
   next update to verify after publish; the macOS `.app` and Linux AppImage paths were not re-run
   for `0.8.0` either. Cancellation during download and `UPDATE_ENGINE_BUSY`
   when cleanup is blocked are covered by unit tests. Do not advertise auto-update for
   deb/rpm/MSI/portable.
7. Announce with the unsigned-build instructions, the manual-only cases and the checksum file.

### Post-release

- Monitor issues for install/launch failures, especially Gatekeeper/SmartScreen reports.
- Do not move or reuse a published tag. Cut a patch release for fixes.
- Keep the previous release assets available for rollback.
- Update the brain/notes and the next milestone.

## 10. Rollback

- **Bad installer but valid app:** publish a fixed patch and tell users to verify the new checksum.
  Do not overwrite assets under the same tag.
- **Bad `latest.json`:** publish a fixed patch. The draft gate prevents a partial manifest from
  being visible; do not hand-edit a published `latest.json` without a correctly signed replacement
  package. If the endpoint must be disabled, ship a manual release and document it.
- **Compromised key:** rotate the updater key, ship a manual release with the new public key, and
  document that auto-update cannot bridge the rotation.
- **Engine regression:** pin the previous engine version, rebuild, and publish a patch. The desktop
  refuses an engine older than its minimum rather than guessing.
- **No downgrades:** users cannot auto-roll back. A rollback is a manual install of an older
  release.

## 11. Cost and policy

- GitHub Actions: public repository, standard hosted runners, free minutes within the included
  quota. No larger runners, paid minutes, paid storage or paid add-ons.
- Artifacts: 7-day retention; release assets are the durable copy. Check storage quotas separately
  from runner minutes.
- Signing: no paid OS certificates, no notarization, no paid signing service by default. The
  updater uses a free minisign key. Free OSS signing is optional only with owner approval.
- Python/npm/PyPI: free public packages. No paid provider key is required to build.
- The workflow is manual; there are no push/tag triggers that could spend minutes unexpectedly.
- Keep hard budgets and overage blocking enabled at the account/org level. This document cannot
  prove the current billing state; check it before a release.

## 12. Release notes template

`docs/releases/<version>.md` is also used as the updater notes by `merge-latest-json.mjs`. Keep the
top summary short and user-facing; the full install matrix can follow.

```markdown
## LV24 SEO Optimizer Desktop vX.Y.Z

Engine: lv24-seo X.Y.Z (bundled onedir sidecar)
Platforms: Windows x64 (NSIS + portable ZIP), Linux x64 (AppImage, deb, rpm),
macOS arm64/x64 (DMG + .app.tar.gz)

### Status
UNSIGNED OS build. Windows has no Authenticode signature; macOS is ad-hoc signed; Linux packages
are unsigned. SmartScreen/Gatekeeper may warn. Verify SHA256SUMS.txt.

### Changes
- ...

### Auto-update
Windows NSIS, macOS .app and Linux AppImage update in place after confirmation.
deb/rpm/MSI/portable ZIP are manual-only. 0.1.0 must install the current release manually once.
Updater manifest: https://github.com/LevapVeeskela/lv24-seo-optimizer-desktop/releases/latest/download/latest.json

### Verification
- SHA256SUMS.txt
- CI run: ...
- Sidecar checksum reports are CI evidence, not release assets.

### Known limitations
- No downgrades.
- No Windows arm64 or Linux arm64 build.
- Unsigned OS packages.
```
