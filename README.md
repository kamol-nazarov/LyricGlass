# LyricGlass

A local-first Windows lyrics overlay for YouTube and YouTube Music. Electron runs the desktop overlay and authenticated loopback bridge; a browser extension reports playback; LRCLIB provides lyric records.

## Install the desktop app — no terminal needed

Run **LyricGlass-Setup-0.4.0-x64.exe** to install for your Windows account. The installer creates **LyricGlass** shortcuts on the Desktop and in the Start menu, pointing directly to the installed GUI executable. Node.js, npm and Git are not needed to run the installed app. The installer is unsigned.

Normal installed launches start the tray app without opening a command window or the settings window. The lyric overlay follows your existing visibility preference. Right-click the **LyricGlass tray icon → Settings & pairing** to connect a browser or change preferences; double-clicking an already-running app's shortcut opens settings. Use **tray → Quit LyricGlass** to exit completely. Existing local pairing, lyrics and appearance settings are retained. If Windows puts the icon in tray overflow, open **Show hidden icons**.

Default installation: `%LOCALAPPDATA%\Programs\LyricGlass\LyricGlass.exe`. Do not copy that executable alone; its adjacent runtime/resources are required. Use the installer when moving to another computer. The packaged browser extension folders are under `resources\browser-extension\chrome` and `resources\browser-extension\firefox` inside the installation directory. Load the Chrome/Edge folder or Firefox's `manifest.json` using the browser setup instructions below. An older paired extension can continue metadata reporting. Update its files and reload it to enable optional audio capture; old reporting messages remain compatible.

Historical 0.3.0 validation (not repeated for 0.4.0): the 0.3.0 NSIS installer built and installed successfully on the development Windows machine. The installed application was launched through its desktop shortcut, its executable was verified as Windows GUI subsystem 2, and no console/shell/Node process appeared in its process tree. No Windows login or installation on a second machine has been verified. The installer is a local deliverable, not an automatically published GitHub release.

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

Unresolved matches remain a quiet status. Open **gear → Find / change lyric match** when needed. Click the correct result row, checking artist, recording, duration and timing status. Search by title/artist or import a UTF-8 `.lrc` file (maximum 200 KB) if none is right. Choices persist per video ID.

**Positive delay means lyrics appear later:** +2000 ms displays a ten-second line at video time twelve seconds. The gear steps by ±250 ms; full settings also accepts a numeric value. Offsets persist per video and selected record.

If a record's lyric timeline runs past the video, the widget suppresses timed highlighting and offers manual reading in settings. Identity confidence and timing confidence are independent. Matching results label suspect timestamps **Check timing**. In matching settings, expand **Align lyrics to the vocals**: pause the video at the beginning of a sung line, choose that line from the list, then click **Align selected line now**. The app calculates and saves the offset from the playback clock. This corrects a constant shift; a different edit, missing verse or changing drift requires a matching lyric recording/LRC, not arbitrary tempo scaling. Invalid duration metadata alone is not proof that a different provider result contains correct timestamps.

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

Desktop data lives in `%APPDATA%\LyricGlass\data.json`: settings, pairing, lyric mappings/imports, delays and bounded cache. Chrome/Edge credentials use trusted-context extension storage; Firefox uses extension-origin IndexedDB. This settings/lyrics file is not encrypted. Optional ACRCloud credentials are stored separately in `recognition.secure`, encrypted using Electron safeStorage / Windows OS protection. They are never returned in app state or sent to the extension. No telemetry, microphone, whole-system recording, YouTube account access, media-file downloading or unrelated-site inspection is used. Opt-in tab audio sampling is described below.

The query cache is limited to 80 entries and approximately eight million serialized characters; mappings/imports to 250 videos and approximately sixteen million characters; each mapping keeps up to twenty offsets. Least recently used entries are evicted. Raw query entries retain fetchedAt independently of access recency: positive results expire after seven days, successful empty results after five minutes. Temporary failures are not negative matches. Provider requests have timeouts, cancellation, size limits, deduplication and cooldowns honoring seconds or HTTP-date Retry-After.

Use **Forget match** or **Reset timing** for a selected video without resetting pairing. For a complete reset, close LyricGlass and move `%APPDATA%\LyricGlass\data.json` aside, then pair again. Never commit this file, pairing details, personal lyrics or environment secrets; common local-data paths are ignored.

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



## 0.4.0 reliability and optional audio

The resolver settles meaningful metadata changes for 400 ms, then uses an explicit video selection, strongly supported recording knowledge, cached candidates, a fully specified LRCLIB exact lookup when available, structured search and a small number of normalized/broad hypotheses. It scores all valid results (up to 100 per response) before limiting visible suggestions to 20. Query identity is independent of evidence revision, so later duration or artist evidence can rerank already fetched results. Navigation/source changes and manual choices cancel ownership of old work. Duration jitter does not reset budgets.

Each automatic resolution episode has at most six lyric calls, including conservative counting of cache hits. A temporary failure permits one retry after at least 30 seconds and the provider cooldown, when a fresh playback update arrives. **Retry lyrics** starts a new explicit episode without bypassing provider cooldowns or the recognition daily cap. Automatic episodes do not open settings or show an interruption. Strong identity with uncertain/incompatible timing stays untimed; a duration fit is only plausible timing, not proof of vocal alignment. Recording versions and artist conflicts outweigh a timed result. Separate recordings need a meaningful score margin; duplicates require more than title and duration, including matching lyric content and compatible version evidence.

### Recognition setup and limits

1. Optional: obtain an ACRCloud music-recognition project yourself. This build creates no account and includes no credentials. Open **Lyric match & timing → Optional audio recognition**, enter the project's regional host, access key and secret, and save them using Windows protection.
2. Read the transmission notice, consent and enable recognition. Its configurable daily cap defaults to 50 and cannot exceed 50. Credential entry fields clear on submission. Remove credentials to disable recognition and stop capture.
3. In **Chrome/Edge 120+**, open the extension popup on the YouTube tab and select **Enable audio for this tab**. Grant its optional tabCapture permission. Enabling a session is a user action; permission is not transferred when another tab is selected. Firefox continues to support the deterministic resolver but has no capture route in this release.
4. Use **Stop audio session** to close the stream. Disabling recognition, losing its desktop connection, closing the tab or leaving YouTube also releases it. A permitted session can remain open during pauses/ads/ineligibility so playback stays audible, but no application sample buffer is retained outside eligible windows. Browser restart does not silently recreate consented tab capture.

The actual capture route uses a service-worker-issued tab stream consumed in an offscreen document, audio only. The original tab audio is routed to the audio output exactly once; an AudioWorklet collects a ten-second, 16 kHz mono PCM WAV (320,044 bytes) only for a desktop-issued request. Chunked transport uses the existing authenticated loopback channel and its unchanged 16 KiB per-message limit. No microphone, screen/video capture, desktop audio or browser-process loopback fallback exists. Windows application loopback was evaluated and rejected because a browser process tree does not establish the selected tab as its audio source.

Only fresh, normal-speed, unmuted content with a single attributable audible media element qualifies. Ads, uncertain identity, seeks, buffering, stale sources, rate changes and conflicting media invalidate the window. At most two attempts per video episode are persisted across trivial metadata changes/restarts; explicit **Retry lyrics** begins another episode while the daily cap and provider cooldown remain in force. The bounded episode ledger retains the most recent 1,000 videos. Silence, low-confidence identification and provider failures stop the episode. Samples remain transient in memory and are cleared after completion/cancellation; none are written to diagnostics, storage or artifacts. Consented samples are transmitted to ACRCloud, and its service terms/retention apply; this app cannot promise deletion by that provider.

The authenticated ACRCloud adapter uses a validated regional HTTPS host, HMAC signing, bounded multipart audio, cancellation, timeout and no redirects. Identity results without validated optional sample/database offsets are identity-only. Automatic alignment requires two nonoverlapping windows of the same recording/source generation, consistent matched spans, low estimated anchor uncertainty and offsets agreeing within 400 ms. `capture start + sample offset − reference offset` determines delay, not response arrival: 42 + 2 − 32 = +12 seconds, so a line at ten seconds appears at video time 22. Explicit edits/slowed/sped-up versions are excluded from automatic alignment. Lyric recording metadata and supplied timestamps must also be compatible; audio recognition alone cannot validate LRCLIB's vocal timestamps. There is no time stretching, inferred word timing or transcription. Manual offsets remain absolute overrides, not additions to an automatic delay; Reset timing clears both for that video/record.

### Migration, diagnostics and recovery

On first write, schema v2 backs up the exact valid legacy file as `data.json.pre-v2.bak`, then writes through a temporary file and atomic rename. Settings, pairing, imports and old absolute offsets are preserved. Legacy selections are `legacy-unknown`, never invented user confirmations; actual metadata contradictions suppress their display without deleting them. New selections distinguish explicit selection, import, metadata and recognition, with matcher version, selection date and provider-scoped record identity. Rejections are video-scoped. Recording reuse does not copy another video's offset. Matcher-version changes rerank safe raw records rather than trusting old derived decisions.

Malformed/unrecognized schema data is protected from subsequent saves. Close LyricGlass before repairing or moving that file aside. To roll back an upgrade, preserve the newer file and restore `data.json.pre-v2.bak` while the app is closed. A failed write leaves the previous file intact. Recognition credentials are separate; remove them through settings rather than resetting pairing.

**Local matching diagnostics** shows a bounded trace for the selected source: query stages, provenance, candidate IDs, score reasons/conflicts, timing decisions, cache outcome, elapsed lookup time and request counts. **Export diagnostics** explicitly saves selected song metadata and that sanitized trace. It includes no full lyrics, audio, secrets, cookies, filesystem paths or browsing history. Scores are explainable heuristics, not correctness labels.

### Evidence and remaining checks

The frozen 0.3.0 matcher plus its pre-scoring 20-result limit is evaluated against the same 30 labeled synthetic cases as the new matcher (`tests/evaluation`). The new resolver has additional unit regressions for stale responses, metadata updates, fallback, budgets, migrations and capture boundaries.

| Same synthetic corpus (30 cases) | Correct auto | Wrong auto | Unresolved |
| --- | ---: | ---: | ---: |
| Frozen 0.3.0 behavior | 8 | 3 | 19 |
| 0.4.0 matcher | 14 | 0 | 16 |

The explicit adversarial subset contains 17 cases and has zero wrong automatic matches after the change. Among 14 selected records, the new timing assessment is 9 plausible, 2 uncertain, 1 incompatible and 2 untimed; the three uncertain/incompatible records use manual reading instead of timed highlighting. The baseline displayed 9 timed and 2 untimed selections without the new timing separation. These denominators describe constructed cases only and are not real-world accuracy estimates.

This sprint uses offline unit tests only, with mocked network, capture, storage, browser and OS protection. A normal build/installer generation is permitted; no 0.4.0 installation, Electron launch, browser automation, live provider request, real audio recording or credential-backed recognition test was performed. Actual Chrome/Edge invocation/offscreen behavior, audible output, capture latency/anchor uncertainty on hardware, provider coverage/quotas, and alignment with real music require later user-enabled acceptance. Core matching works without ACRCloud. The existing installed 0.3.0 app was left running unchanged.

References checked for this implementation: [LRCLIB docs](https://lrclib.net/docs) and its [current official routing source](https://github.com/tranxuanthang/lrclib/blob/main/server/src/router.rs) (exact `/api/get`, search `/api/search`); [ACRCloud identification](https://docs.acrcloud.com/reference/identification-api/identification-api), [offset field semantics](https://docs.acrcloud.com/reference/identification-api/metadata/music) and [error codes](https://docs.acrcloud.com/sdk-reference/error-codes); [Chrome tabCapture](https://developer.chrome.com/docs/extensions/reference/api/tabCapture), [offscreen capture lifecycle](https://developer.chrome.com/docs/extensions/how-to/web-platform/screen-capture); [Microsoft application loopback sample](https://github.com/microsoft/Windows-classic-samples/tree/main/Samples/ApplicationLoopback).

Delivery verification for 0.4.0: the one final full offline `npm test` run passed **278 tests in 28 files**. Focused subsets were used during implementation. The x64 NSIS installer was generated successfully; it has not been installed or launched for this sprint. No lint/standalone typecheck, integration suite, browser automation or live-service probe was run.
