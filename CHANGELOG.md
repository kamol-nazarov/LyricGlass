# Changelog

## 0.4.0 — Matching and synchronization reliability

- Separate recording identity, lyric availability and timing plausibility; normalize Unicode/decorations/featured credits while retaining recording distinctions.
- Rerank candidates on meaningful metadata improvements, score before display truncation, and run a cancellable staged resolver with six-call episodes and bounded retry/cooldown.
- Keep unresolved matches quiet; add Retry lyrics, Forget match, Reset timing and sanitized local diagnostics.
- Migrate legacy data with a protected backup, explicit provenance, separate cache freshness, video-scoped rejections and independent manual/automatic offsets.
- Add off-by-default ACRCloud identification, Windows-protected credentials, explicit Chrome/Edge audio-only tab sessions, bounded transient samples and persistent attempt/daily caps.
- Require two independent audio anchors before automatic alignment; retain manual timing authority and real-word-timestamp-only karaoke.
- Preserve console-free tray packaging and older extension playback compatibility. Build artifacts are not installed or automatically released.
- Synthetic baseline: 8 correct / 3 wrong / 19 unresolved of 30; new matcher: 14 / 0 / 16. No live recognition or hardware capture accuracy claim.

## 0.3.0 — Installable tray application

- Build a per-user Windows installer with Desktop/Start-menu shortcuts to the native GUI executable.
- Installed launches go directly to the tray without npm, Node, a console window or an automatic settings window.
- Add a bundled LyricGlass executable/tray icon and include both browser-extension folders in the installation.
- Preserve local settings/pairing and migrate an already-enabled startup preference to the installed executable.
- Validate packaging, silent per-user installation, desktop shortcut launch and absence of console child processes on the development Windows machine.

## 0.2.0 — Settings window and live appearance preview

- Rebuild settings as an 880px two-column window with custom title controls, an independently scrolling controls column, and a live Ledger preview.
- Add Dark/Light/System theme selection, 360/400/460 widths, 14–28px text sizing, custom sliders, switches and compact delay controls.
- Wire launch-at-startup, playback-only widget visibility and optional word highlighting to persisted preferences.
- Preserve pairing, search/selection, LRC import, vocal alignment, per-record offsets and hotkeys.
- Use labeled synthetic preview lyrics without changing the real playback source or positioning the real widget.

## 0.1.1 — Timing-data validation and vocal alignment

- Reject automatic matches whose nonempty lyric timestamps run beyond their declared recording or the current video.
- Flag incompatible cached timing instead of displaying it as synchronized; label problematic search candidates.
- Add explicit vocal-line alignment using the current authoritative playback position, with per-record offset persistence.
- Keep supplied timing data unchanged; no guessed delay or tempo scaling is applied.

## 0.1.0 — Initial public source snapshot

- Windows Electron lyric overlay with the compact Ledger design, dark/light themes, click-through locking and tray recovery.
- YouTube and YouTube Music browser adapters, authenticated loopback pairing, and Chrome/Edge plus Firefox manifests.
- LRCLIB lookup, manual matching, local LRC import, per-record timing offsets and bounded local storage.
- Line-accurate highlighting; word highlighting only when real word timestamps are present.
- Navigation, overlay resizing and drag-continuity fixes covered by focused unit tests.

This is a source snapshot, not a signed installer release. See README for current verification limits.
