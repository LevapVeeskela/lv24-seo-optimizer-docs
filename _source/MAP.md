# Source map: `_source/` files to site pages

Every file in this snapshot is represented below. Pages keep the source
wording, warnings, and command syntax; relative Markdown links were rewritten
to site routes.

| Snapshot file | Site pages | Notes |
|---|---|---|
| `engine-README.md` | `/`, `/start/`, `/install/` | Product summary, install paths, feature matrix. |
| `engine-architecture.md` | `/architecture/` | Package layout, surfaces, dependency rules, storage. |
| `engine-security.md` | `/security/` | Threat model, secrets, write gates, reporting. |
| `engine-cli.md` | `/reference/cli/`, `/start/` | Command groups, exit codes, envelopes. |
| `engine-config.md` | `/reference/config/` | Config file keys, defaults, precedence. |
| `engine-data-sources.md` | `/providers/` | Provider capabilities, quotas, limits. |
| `engine-mcp.md` | `/mcp/` | Tools, resources, prompts, annotations. |
| `engine-skills.md` | `/mcp/` | Canonical skills and export. |
| `engine-scheduling.md` | `/automation/` | cron/systemd/Task Scheduler generators. |
| `engine-troubleshooting.md` | `/troubleshooting/` | Common failures and diagnostics. |
| `engine-releases-0.5.1.md` | `/release/` | Engine release notes and limits. |
| `desktop-README.md` | `/desktop/`, `/install/` | Desktop install matrix, update, troubleshooting. |
| `desktop-release.md` | `/release/` | Release pipeline, signing, assets, rollback. |
| `desktop-security.md` | `/security/`, `/desktop/` | Shell boundary, secrets, updater trust. |
| `desktop-architecture.md` | `/architecture/`, `/desktop/` | FSD layout, commands, stores, resources. |
| `desktop-releases-0.2.1.md` | `/release/` | Desktop 0.2.1 patch notes: Metrika token and shared CLI keychain. |
| `desktop-releases-0.2.0.md` | `/release/` | Desktop 0.2.0 release notes, kept for the first multi-platform release. |

## Known source tensions

- The desktop is distributed unsigned at the OS level (Windows/Linux) or
  ad-hoc signed (macOS), while updater payloads are minisign-signed. Pages keep
  both facts separate.
- Auto-update works for Windows NSIS, macOS `.app` and Linux AppImage only.
  deb/rpm/MSI/portable ZIP are manual-only and the UI says so.
- Engine `0.5.1` adds `writes_local_state` to the MCP schema; clients may now
  ask for confirmation before `seo_crawl_site` and `seo_weekly_report`.
