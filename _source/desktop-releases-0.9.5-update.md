LV24 SEO Optimizer Desktop 0.9.5 bundles engine 0.15.1 and adds four crawl rule packs to the reports.

The engine now checks security headers and cookie flags, TLS certificate expiry/protocol/hostname/cipher, required Schema.org fields for ten rich-result types, and basic accessibility (input labels, button and link names, main landmark, skip link, heading order). The rule set grows from 30 to 34; the desktop report and Diagnostics screens render the new issue IDs without a UI change. The Indexing automation card, the Connect card readiness states and the hidden Windows scheduled-job launcher are unchanged.

Engine 0.15.1 also rejects documented placeholder OAuth client ids before a consent URL is built, and the Connect card disables Connect while the OAuth client is missing or misconfigured. MIN_ENGINE_VERSION is now 0.15.1 and the bundled sidecar is lv24-seo 0.15.1. MCP stays at 12 tools and the SQLite schema at version 5.

Auto-update works from 0.2.0 for Windows NSIS, macOS .app and Linux AppImage; deb, rpm, MSI and the portable ZIP are manual-only. 0.9.4 to 0.9.5 is the next in-app update. OS packages remain unsigned (Windows/Linux) or ad-hoc signed (macOS); verify SHA256SUMS.txt.
