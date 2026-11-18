LV24 SEO Optimizer Desktop 0.9.4 bundles engine 0.14.1 and stops Windows scheduled jobs from opening a console window.

A task installed from the desktop now runs through a generated .vbs launcher started by wscript.exe //B //Nologo. The launcher runs the engine hidden, waits for it and forwards the exit code. The read-only Indexing card shows the same data; the only change is that the 04:00 job no longer flashes a terminal. Existing tasks created by 0.9.3 or older keep the console action until they are reinstalled once; the engine reports them as outdated.

MIN_ENGINE_VERSION is now 0.14.1. The Indexing automation card, the Connect card readiness states, the two-phase write gates and the 12 MCP tools are unchanged.

Auto-update works from 0.2.0 for Windows NSIS, macOS .app and Linux AppImage; deb, rpm, MSI and the portable ZIP are manual-only. 0.9.3 to 0.9.4 is the next in-app update. OS packages remain unsigned (Windows/Linux) or ad-hoc signed (macOS); verify SHA256SUMS.txt.
