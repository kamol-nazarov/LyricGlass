# Changelog

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
