LV24 SEO Optimizer Desktop 0.9.3 shows OAuth readiness in the Connect card.

The card now tells you exactly what is missing for Google Search Console, Yandex Webmaster and Metrika: client ID, client secret, sign-in, expired token, missing scopes, unknown scopes or an invalid redirect, with the engine's next action. Only a complete configuration is shown as Ready; a missing or unknown report is shown as unavailable, never as success. No token or secret is read or displayed.

The bundled engine stays lv24-seo 0.14.0 and MIN_ENGINE_VERSION stays 0.14.0, so 0.9.2 users get the same engine with the new readiness view. The Indexing automation card is unchanged.

Auto-update works from 0.2.0 for Windows NSIS, macOS .app and Linux AppImage; deb, rpm, MSI and the portable ZIP are manual-only. 0.9.2 to 0.9.3 is the next in-app update. OS packages remain unsigned (Windows/Linux) or ad-hoc signed (macOS); verify SHA256SUMS.txt.
