# LyricGlass

One implementation owner. This directory is the repository root. Preserve user changes.
Keep Electron privileged work in main and expose only validated, narrow preload methods.
Keep YouTube selectors in the adapter and shared timing/protocol logic pure.
Verify changes with focused unit tests only; do not launch browsers, Electron, live-service probes,
lint, standalone typechecks, integration suites, or packaging validation unless the user changes scope.
Use synthetic lyric fixtures. Document real-machine checks honestly in README.

Work on numbered MAJOR.MINOR.PATCH branches, never directly on main. Major = fundamental
releases, minor = features, patch = bug fixes/hotfixes. Keep package, lockfile and both
extension manifest versions aligned with the branch. Use pull requests into main.
