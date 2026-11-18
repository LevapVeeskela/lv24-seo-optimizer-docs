LV24 SEO Optimizer Desktop 0.9.6 makes the OAuth card clearer when a provider is already connected.

If a provider already has a saved token or service account, the card now says "OAuth not configured (optional)" instead of "Not ready", and explains that the token is already used and OAuth is only needed for automatic refresh. Connect stays disabled until a real OAuth client is configured, so the documentation example client ids cannot open a consent tab.

The bundled engine stays lv24-seo 0.15.1, MIN_ENGINE_VERSION stays 0.15.1, and the four crawl rule packs, Indexing card and hidden Windows scheduled jobs are unchanged.

Auto-update works from 0.2.0 for Windows NSIS, macOS .app and Linux AppImage; deb, rpm, MSI and the portable ZIP are manual-only. 0.9.5 to 0.9.6 is the next in-app update. OS packages remain unsigned (Windows/Linux) or ad-hoc signed (macOS); verify SHA256SUMS.txt.
