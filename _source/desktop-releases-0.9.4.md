# LV24 SEO Optimizer Desktop 0.9.4

**Status: released (2026-11-18).** `0.9.4` is published on GitHub Releases for Windows x64, Linux x64
and macOS arm64/x64. The latest published line is `0.9.4`; `0.9.3` remains available for rollback and
as the previous in-app update source. See [`0.9.3.md`](0.9.3.md) for that release's notes.

| | |
|---|---|
| Desktop version | `0.9.4` (released 2026-11-18) |
| Bundled engine | `lv24-seo 0.14.1` |
| Minimum engine | `lv24-seo 0.14.1` (`MIN_ENGINE_VERSION`) |
| Contracts | generated from `lv24-seo 0.14.1` |
| Platforms | Windows x64, Linux x64, macOS arm64 and x64 (unchanged) |
| Auto-update | Windows NSIS, macOS `.app`, Linux AppImage (unchanged) |
| Manual-only | deb, rpm, MSI, portable ZIP (unchanged) |
| OS signing | Windows unsigned, macOS ad-hoc, Linux unsigned (unchanged) |

## Changed

### Hidden Windows scheduled jobs

`0.9.4` bundles engine `0.14.1`, which stops Windows Task Scheduler jobs from opening a console
window. A task installed from the desktop (`schedule install --kind indexing --target windows
--allow-write`) now registers a generated `<name>.vbs` launcher through
`wscript.exe //B //Nologo`; the launcher runs the engine hidden, waits for it and forwards its exit
code. `schedule status` lists the task, the XML and the launcher; `schedule uninstall` removes both
files.

A task installed by desktop `0.9.3` or older keeps the old console action until it is reinstalled
once. The desktop reports the task as outdated through the engine status.

- `MIN_ENGINE_VERSION` is now `0.14.1`; an older sidecar is reported as incompatible.
- The bundled onedir sidecar is `lv24-seo 0.14.1`. The Windows x64 reviewed pin records the built
  `0.14.1` executable (`2bdf0077…0503`, 14,582,464 bytes); Linux/macOS pins remain `null` and are
  covered by rebuild-aware CI checksum reports.
- Contracts (`config.schema.json`, CLI fixtures) are regenerated from engine `0.14.1`.

## Not changed

- The read-only Indexing automation card and the Connect card readiness states.
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
  --target x86_64-pc-windows-msvc --engine-version 0.14.1 --require-pinned
```

Results: the full Vitest and Rust suites, contracts at engine `0.14.1`, and the Windows sidecar
verified against the pinned SHA-256
(`2bdf0077887f3d0da29b9dce217ace6964d942469be5f3a03deaf336db3e0503`, 14,582,464 bytes). The four
platform bundles are built by the manual `Desktop build` workflow with `engine_version=0.14.1`.

## Limitations

- Existing Windows scheduled tasks need one reinstall to replace the console action.
- The launcher relies on Windows Script Host (`wscript.exe`), present on supported Windows versions.
- The Indexing card stays read-only; installing or changing the job remains a separate gated action.
