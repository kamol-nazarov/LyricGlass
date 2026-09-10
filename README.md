# LyricGlass

A local-first Windows lyrics overlay for YouTube and YouTube Music. Electron runs the desktop overlay and authenticated loopback bridge; a browser extension reports playback; LRCLIB provides lyric records.

## Install the desktop app — no terminal needed

Run **LyricGlass-Setup-0.3.0-x64.exe** to install for your Windows account. The installer creates **LyricGlass** shortcuts on the Desktop and in the Start menu, pointing directly to the installed GUI executable. Node.js, npm and Git are not needed to run the installed app. The installer is unsigned.

Normal installed launches start the tray app without opening a command window or the settings window. The lyric overlay follows your existing visibility preference. Right-click the **LyricGlass tray icon → Settings & pairing** to connect a browser or change preferences; double-clicking an already-running app's shortcut opens settings. Use **tray → Quit LyricGlass** to exit completely. Existing local pairing, lyrics and appearance settings are retained. If Windows puts the icon in tray overflow, open **Show hidden icons**.

Default installation: `%LOCALAPPDATA%\Programs\LyricGlass\LyricGlass.exe`. Do not copy that executable alone; its adjacent runtime/resources are required. Use the installer when moving to another computer. The packaged browser extension folders are under `resources\browser-extension\chrome` and `resources\browser-extension\firefox` inside the installation directory. Load the Chrome/Edge folder or Firefox's `manifest.json` using the browser setup instructions below. An existing paired extension on this computer can keep using its current folder.

Packaging is now explicitly exercised: the 0.3.0 NSIS installer built and installed successfully on the development Windows machine. The installed application was launched through its desktop shortcut, its executable was verified as Windows GUI subsystem 2, and no console/shell/Node process appeared in its process tree. No Windows login or installation on a second machine has been verified. The installer is a local deliverable, not an automatically published GitHub release.

## Run from source on Windows

Requirements: Windows 10/11 x64, Node.js 24 LTS, npm, Git, and Chrome/Edge 120+ or Firefox 128+.

```powershell
git clone https://github.com/kamol-nazarov/LyricGlass.git
cd LyricGlass
npm ci
npm run dev
```

`npm run dev` builds the desktop and extensions, then opens LyricGlass. It does not watch source files; quit through the tray and rerun after editing. Keep the terminal open during development use.

Quit an installed LyricGlass instance through its tray before running from source. Both use the same single-instance lock and local data; otherwise the installed instance handles the launch instead of running your changed development code.

**Chrome/Edge:** open `chrome://extensions` or `edge://extensions`, enable Developer mode, choose **Load unpacked**, and select `dist\extension`. Pin LyricGlass in the toolbar. Refresh existing YouTube/Music tabs once after installation or an extension update.

**Firefox:** open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on…**, and select `dist\extension-firefox\manifest.json`. Reload the temporary add-on after restarting Firefox. Permanent installation in standard Firefox requires Mozilla signing, which has not been performed. Do not disable signature verification.

Build only the extensions with `npm run build:extension`.

## Pair and listen

1. In desktop settings, click **Copy pairing details**.
2. Paste them into the extension popup and choose **Pair with desktop**.
3. Allow the declared YouTube/Music and loopback access if prompted.
4. Play a song on `www.youtube.com` or `music.youtube.com`.

The bridge binds strictly to **127.0.0.1**, default port **43821**. If occupied, change the desktop port and paste updated pairing details into the extension. One exact extension origin is paired at a time. Use **Reset pairing** to switch browsers or extension IDs. Secrets never appear in URLs and are not sent to YouTube or LRCLIB.

## Overlay controls

The settings window uses a scrolling Connection/Appearance/Matching column and a fixed live preview of the real Ledger card. Appearance options include **Dark / Light / System**, **360 / 400 / 460px** widths, **14–28px** text, opacity, text-only mode and a karaoke toggle. Existing legacy widths/font sizes are mapped into the new supported ranges. The preview uses labeled, original sample lyrics with demonstration word timestamps; it never changes the real song or moves/resizes the actual overlay.

**Launch at startup** configures the current user's Windows login item when explicitly toggled. In development, it points to this checkout and its bundled Electron executable, so keep the checkout and installed dependencies in place. **Show widget only while a video is playing** hides the overlay when the selected playback is paused or stale; tray/settings controls remain accessible. System theme follows the operating-system appearance. Turning off karaoke highlights the current line; turning it on uses real word timestamps when available, without restoring guessed timing for ordinary line-only lyrics.

Pairing settings and advanced vocal alignment remain accessible as collapsible controls. Minimize/maximize/close apply to the settings window; closing it leaves the widget/tray running. The footer refers to local settings rather than claiming all data stays local, because lyric lookup sends necessary track metadata to LRCLIB.

- **Ctrl+Alt+L:** show/hide.
- **Ctrl+Alt+K:** lock/unlock. Locked mode makes the whole overlay click-through.
- **Tray:** recovery controls, lyric matching, full settings, reset position and quit.
- **Drag:** move anywhere on the unlocked card except controls. Lyric resizing preserves position and waits until dragging ends.
- **Gear:** delay controls, dark/light appearance and **Find / change lyric match**.

The Ledger card defaults to 400px, five lyric lines, and a compact time/status/delay footer. DM Sans and DM Mono are bundled locally. There is no outer drop shadow. Full settings retain opacity, text-only mode, font size and width presets. CSS backdrop blur is included, but blurring other applications behind a transparent Electron window depends on Windows/Electron compositor behavior.

When needed, click **Choose lyric match →** on the widget. Click **Use lyrics** beside the correct result, checking artist, recording, duration and **Synced** status. Search by title/artist or import a UTF-8 `.lrc` file (maximum 200 KB) if none is right. Choices persist per video ID.

**Positive delay means lyrics appear later:** +2000 ms displays a ten-second line at video time twelve seconds. The gear steps by ±250 ms; full settings also accepts a numeric value. Offsets persist per video and selected record.

If a record's lyric timeline runs past the video, the widget now flags **Fix lyric timing** instead of presenting those timestamps as synchronized. Matching results label these records **Timing mismatch**. In matching settings, expand **Align lyrics to the vocals**: pause the video at the beginning of a sung line, choose that line from the list, then click **Align selected line now**. The app calculates and saves the offset from the playback clock. This corrects a constant shift; a different edit, missing verse or changing drift requires a matching lyric recording/LRC, not arbitrary tempo scaling. Invalid duration metadata alone is not proof that a different provider result contains correct timestamps.

**Line sync** highlights the current line using supplied timestamps. **Word sync** is used only with enhanced LRC containing actual `<mm:ss.xx>` word timestamps. Word timing is never guessed. Plain-only lyrics are explicitly untimed and shown for manual reading in settings.

The most recently started audible tab wins; pausing retains the selected tab. Use **Use this YouTube tab** in the extension to pin a regular YouTube or Music tab. Ads and uncertain identities suppress lyrics. A stale clock stops advancing after twelve seconds without a fresh snapshot.

## Numbered version branches

Development branches are named **MAJOR.MINOR.PATCH**, such as `0.1.111`. `main` is the protected integration branch.

| Number | Meaning | Example |
| --- | --- | --- |
| Major | Fundamental release or breaking redesign | `0.1.111` → `1.0.0` |
| Minor | New features | `0.1.111` → `0.2.0` |
| Patch | Bug fixes and hotfixes | `0.1.111` → `0.1.112` |

The initial public source snapshot is **0.1.0**. Its branch and `main` begin at the same import commit; earlier interactive development is not represented as invented Git history.

Start the next version from an updated main or the current numbered branch:

```powershell
git switch main
git pull --ff-only
npm run version:new -- patch
# Also accepts minor, major, bugfix, hotfix, or an explicit newer version.
```

This requires a clean worktree, creates the numbered branch, and updates the package, lockfile and both extension manifests. It leaves changes ready to review and commit. Then make the code changes:

```powershell
npm run version:check
npm test
git add .
git commit -m "fix: describe the correction"
git push -u origin HEAD
gh pr create --base main
```

Use `feat:`, `fix:`, or `feat!:`/`BREAKING CHANGE:` in commit messages. Both ordinary bug fixes and urgent hotfixes increment patch; the description distinguishes urgency. Update `CHANGELOG.md` in each version PR.

Hooks installed by `npm ci` reject direct main commits/pushes and validate version consistency. Reinstall with `npm run hooks:install`. GitHub checks every non-main branch push and PR into main. Main requires a PR and passing `unit-tests`; force pushes and branch deletion are disabled. Numbered branch history is retained without force pushes/deletion. Local hooks are conveniences; GitHub protections enforce shared rules.

A normal push does not bump versions, merge, publish releases or upload installers. Tags may mark accepted source versions separately from packaged releases.

## Commands and verification

```powershell
npm test                  # Focused offline unit tests
npm run version:check     # Branch/version consistency
npm run build             # Desktop and both extension bundles
npm run build:extension   # Unpacked extension folders
npm run package:win       # Build the per-user x64 Windows installer; never auto-publishes
```

Tests use synthetic lyrics, fake clocks, synthetic DOM/media fixtures and mocked filesystem/socket/browser boundaries. They do not launch Electron, open browsers, bind listeners or call YouTube/LRCLIB. Desktop builds, launch and some regular YouTube playback have been exercised during development. This is not comprehensive native/browser validation. Firefox, YouTube Music, additional display configurations and installation on other computers still need real-machine acceptance checks.

Source: `desktop` contains main/preload/renderer and local services; `extension` contains browser observation/connection; `shared` contains protocol and pure lyric/timing logic; `tests` contains the focused suite.

## Local data and troubleshooting

Desktop data lives in `%APPDATA%\LyricGlass\data.json`: settings, pairing, lyric mappings/imports, delays and bounded cache. Chrome/Edge credentials use trusted-context extension storage; Firefox uses extension-origin IndexedDB. Data is not encrypted by this app. There is no telemetry, microphone access, audio recording, account access, media downloading or unrelated-site inspection.

The query cache is limited to 80 entries and approximately eight million serialized characters; mappings/imports to 250 videos and approximately sixteen million characters; each mapping keeps up to twenty offsets. Least recently used entries are evicted. Provider requests have timeouts, cancellation, size limits, deduplication and rate-limit cooldowns.

To reset, quit through the tray, delete `%APPDATA%\LyricGlass\data.json`, and pair again. Never commit this file, pairing details, personal lyrics or environment secrets; common local-data paths are ignored.

| Problem | Action |
| --- | --- |
| Port in use | Choose another port in desktop settings and update extension pairing. |
| Disconnected | Start the desktop, check ports, and click extension Reconnect. |
| Pairing rejected | Reset pairing and paste fresh details. |
| Missing site access | Grant declared YouTube/Music permissions; do not disable browser security. |
| New video not recognized | Update the extension and refresh existing tabs once. Subsequent SPA navigation should work. |
| Wrong/missing lyrics | Choose a match, search, or import LRC. |
| Lyrics consistently early/late | Adjust the saved lyric delay. |
| Stale playback | Resume/refresh a suspended tab; the app will not trust an old clock indefinitely. |
| Widget inaccessible | Use Ctrl+Alt+K / Ctrl+Alt+L or tray recovery controls. |

YouTube's DOM can change and require adapter updates. Livestreams, DJ mixes, multi-song videos, exclusive-fullscreen games and Windows security prompts are not supported targets. Timing quality depends on choosing the correct recording.

## Manual acceptance checklist

- [ ] Play songs on regular YouTube and YouTube Music.
- [ ] Navigate between videos/queue items without refreshing.
- [ ] Pause, resume, seek and change playback speed.
- [ ] Drag through a lyric transition and confirm position is retained.
- [ ] Lock/click through, then recover via shortcut and tray.
- [ ] Correct a match, import LRC and adjust timing.
- [ ] Restart app/browser and verify reconnection.
- [ ] Observe ad suppression/resumption when an ad occurs.
- [ ] Remove a monitor and verify position recovery.

Lyrics are provided by [LRCLIB](https://lrclib.net/docs). Fonts retain SIL Open Font License files in `assets/fonts`. No project-wide redistribution license has been selected; making the repository public does not add one automatically.

