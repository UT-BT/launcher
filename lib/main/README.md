---
doc: main-process
read_when:
  - "adding or changing main-process logic (services, handlers, file/process/network access)"
  - "reading/writing files, the UT99 install, or UTBT.ini from main"
  - "opening external URLs, spawning the game, or persisting launcher config"
  - "deciding whether logic belongs in the renderer or the main process"
keywords: [main, services, handle, resolveWithin, path-safety, openExternalSafe, config, safeStorage, ini, gateway, spawn, CSP, cam, koffi, stream-kit, updater, installer, splash]
provides: "the main-process service map, the safety helpers, config storage, and the renderer/main boundary"
not_here:
  - "the IPC channel/api/handler pattern → lib/conveyor/README.md"
  - "renderer HTTP calls → agents/data-sources.md"
sections: [services, the-renderer-main-boundary, file-path-safety, opening-urls, config-storage, ini-access, stream-cams, auto-updates, stream-kit-extractor, window-security-csp]
last_verified: 2026-10-30
verify_against:
  - lib/main/app.ts
  - lib/main/main.ts
  - lib/main/updater-service.ts
  - lib/main/startup-update.ts
  - app/components/splash/SplashScreen.tsx
  - app/components/splash/splashUpdateStatus.ts
  - app/components/splash/SplashPatreonCard.tsx
  - lib/main/legacy-install.ts
  - lib/main/legacy-install-service.ts
  - lib/conveyor/handlers/legacy-install-handler.ts
  - app/components/updater/LegacyInstallCard.tsx
  - app/components/updater/legacyInstall.ts
  - lib/main/config.ts
  - lib/main/path-safety.ts
  - lib/main/url-safety.ts
  - lib/conveyor/handlers/ini-handler.ts
  - lib/main/cam-service.ts
  - lib/main/cam-launcher.ts
  - lib/main/cam-windows.ts
  - lib/main/cam-log.ts
  - lib/main/cam-window-match.ts
  - lib/main/kit-extractor.ts
  - lib/main/kit-folder.ts
  - lib/stream-kit/cam-plan.ts
  - lib/stream-kit/team-server-detection.ts
  - electron-builder.yml
---

# Main process

Node-privileged Electron code. It owns the filesystem, child processes, the UT99
install, OS integration, and the Discord OAuth flow. The renderer reaches it only
through Conveyor IPC (`lib/conveyor/README.md`). `main.ts` runs the update check
first (Auto-updates below), then `createAppWindow()` in `app.ts` sets the CSP,
creates the window, and registers every handler.

## Services

Each service is a singleton module under `lib/main/`. Handlers (`lib/conveyor/
handlers/`) are thin and delegate to these.

| Service | Owns |
|---|---|
| `auth-service` | Discord OAuth (`auth:login/logout/get-profile`), token refresh |
| `game-service` | Launch/validate the UT99 install, detect running game |
| `demo-watcher-service` | Watch the demo folder, parse `.dem` headers, auto-upload per config |
| `patch-service` | Download + install the UTBT patch, version checks |
| `updater-service` | Stable launcher auto-updates (electron-updater): update-before-launch, background checks, silent install on quit (see Auto-updates) |
| `tray-service` | System-tray icon + right-click menu, minimize/close-to-tray interception (window `close`/`minimize` events + `before-quit` flag), start-on-startup login item |
| `gateway-service` | HTTP client for the gateway host (avatars, patrons, server list) |
| `installation-service` | Install detection/validation, ISO download orchestration |
| `cam-service` | Stream cams (Windows only): the `camService` singleton wiring `CamLauncher` (`cam-launcher.ts`) to `child_process.spawn`, config and the logger; handlers in `stream-kit-handler.ts` |
| `kit-extractor` | Stream kit download + extract (`kit-extractor.ts`, folder rules in `kit-folder.ts`); called straight from the handler, not a singleton |
| `logging-service` | File logger → `{userData}/logs/utbt.log` (mirrors warn/error to console in dev); `getRecentLogs` |

## The renderer/main boundary

Move logic to main when it needs Node privileges: filesystem, `child_process`
(`spawn`), OS dialogs, secret storage, or anything that must outlive the renderer.
Keep it in the renderer otherwise. Anything the renderer must trigger crosses via
a Conveyor channel — **handlers are where untrusted renderer input is validated.**

## File + path safety

Renderer-supplied paths are untrusted. Before touching the filesystem with one,
contain it with `path-safety.ts`:

- **`resolveWithin(baseDir, target)`** — resolves `target` against `baseDir` and
  **throws** if the result escapes (absolute paths, `..` traversal). Returns the
  safe absolute path. The ini handler uses it to keep all reads/writes inside
  `{install}/System`.
- **`isWithin(baseDir, candidate)`** — boolean form.

Validate other shapes too: the game handler regex-checks `ip` before building an
`unreal://` URL and before `spawn('ping', …)` to prevent command injection. Never
interpolate renderer input into a shell or a path without a check.

## Opening URLs

Never call `shell.openExternal` directly. Use **`openExternalSafe(url)`**
(`url-safety.ts`), which only opens `http:`/`https:` and logs anything else. The
window's `setWindowOpenHandler` and `will-navigate` both route through it, so
external links and stray navigations leave the app safely.

## Config storage

`config.ts` persists `config.json` under `app.getPath('userData')/config`, written
atomically (tmp + rename). Typed accessors only — don't read the file directly:
`getUt99InstallPath` / `setUt99InstallPath`, `getGatewayConfig`, `getInstalledPatch`,
`getDemoWatcherConfig`, `getActiveProfile`, `getAuthConfig`,
`getWindowBehavior` (minimize/close-to-tray + start-on-startup, applied by `tray-service`),
`getCamFps` / `setCamFps` (the `camFps` key, the stream cams' frame rate: `60` or `120`; anything
else, a missing value or an unreadable file reads as `120`, and saving keeps the rest of the config),
`getCamVolume` / `setCamVolume` (the `camVolume` key, the stream cams' game volume in whole percent
`0`-`100`; anything else reads as `50`, the same way),
`getLegacyInstallDismissedVersion` / `setLegacyInstallDismissedVersion` (the `legacyInstallDismissedVersion`
key, the launcher version whose old-copy card was dismissed or acted on; see Auto-updates).

**Secrets are encrypted at rest.** Auth access/refresh tokens go through Electron
`safeStorage` (`enc:` prefix) in `set/getAuthConfig`. Never log them or store
secrets in plaintext config fields.

## Ini access

`ini-handler.ts` has a custom INI parser/serializer (`parseIni` / `stringifyIni`)
that preserves UT99 section names exactly (it does not escape dots) and keeps
duplicate keys as arrays. All paths flow through `resolveWithin({install}/System,
path)`. The renderer uses these via `window.conveyor.ini.*`; the settings panels
are the main consumer (see `app/components/pages/settings/README.md`).

## Stream cams

Four extra UT clients (slots A1, A2, B1, B2) for the Cams panel. Windows only;
everything else refuses with `unsupported-platform`. The renderer sends only a
lineup, two server addresses, an optional password per team and the frame rate,
`60` or `120` (`CamRequest`).

- **Plan.** Main reads `UnrealTournament.ini` and `User.ini` through
  `resolveWithin({install}/System, name)` and calls the shared
  `buildCamPlan` from `lib/stream-kit/`. That folder is pure (no Node, DOM or IPC)
  so main and renderer share it: `cam-plan.ts` (plan, `parseServerAddress`, the
  ini overrides, window titles) and `team-server-detection.ts` (which server
  each team is on), both using `isDiscordId` from `discord-id.ts`.
- **Files.** Each cam gets its own `UTBTCam<slot>.ini` / `UTBTCam<slot>User.ini`
  under System and its own log. The streamer's own ini files are only read.
  These are written by `cam-launcher.ts`, not the settings ini flow: that flow
  edits single keys in the user's files, whereas these are whole per-instance
  copies. They still follow the same path rule (`resolveWithin` under System).
  Ini text is handled as latin1 (UTF-16LE with BOM preserved).
- **Frame rate and audio.** Besides the window size and windowed-mode keys in
  `[WinDrv.WindowsClient]`, the plan writes, per cam copy of the streamer's ini:
  - `FrameRateLimit=<fps>` in `[WinDrv.WindowsClient]` and in the section named by
    `GameRenderDevice` in `[Engine.Engine]` (any device: D3D9, D3D11, OpenGL, Vulkan, …);
  - `UseShaderGamma` and `UseFragmentProgram=True` in that render device section when the
    device is `D3D9Drv` (`UseShaderGamma=2`) or `OpenGLDrv` (`UseShaderGamma=True`), from
    `CAM_SHADER_GAMMA_SETTINGS`. Without shader gamma these renderers apply the Brightness
    setting through the display's hardware gamma ramp, which window capture never sees, so OBS
    got a darker picture than the screen. Shader gamma draws the brightness into the frame
    itself. D3D11, Vulkan, XOpenGL and ICBINDx11 already do, so their sections only get the
    frame-rate limit;
  - `MusicVolume=0`, plus `SoundVolume` and `SpeechVolume` both set to the request's `volume`
    scaled from percent to UT's 0-255 (`utVolumeOf`: 50% is 128, 100% is 255), in the section
    named by `AudioDevice` in `[Engine.Engine]` (`ALAudio`, `Cluster` and `Galaxy` subsystems all
    use the same key names). Every cam plays at that one volume whatever the streamer's own
    setting, and music is always off. Other audio keys (`UseDigitalMusic`, …) are left alone.
    `volume` is the saved `camVolume` preference (default 50%), which the Cams tool's slider sets
    because four cams at UT's usual level are very loud together.
  - The device names are read only from `[Engine.Engine]`, trimmed and matched without regard
    to case. A missing or empty device key leaves that device's section untouched; a missing
    section is appended; existing keys are replaced in place and every other line is kept.
  - `fps` and `volume` come on the request (a restart without one keeps the values the cam launched with).
    It is the saved `camFps` preference, `60` or `120`, default 120: 120 keeps a 60 fps stream
    smooth, 60 is for a PC that struggles.
- **Server passwords.** A team's password goes last on its cams' connect URL as
  `?password=<password>`, the option UT's login reads, so a locked server lets the cams in
  without the password prompt. It never enters `joinOptions`. `isValidServerPassword` refuses
  whitespace, `?`, `#` and `"` (UT splits URL options on `?` and `#` and drops a URL whose
  option holds a space) and anything over 64 characters, as `invalid-password` with the team
  only. The password is on the cam's command line, so it shows in that cam's own UT log the
  way any typed UT join URL does.
- **Lifecycle.** Clients are spawned detached and tracked by PID. `launch`,
  `restart` and `stopAll` run one at a time through a single queue.
  `game-processes.ts` lets `gameService.isGameRunning()` ignore cam PIDs so cams
  don't fire game-closed or pause server refreshes.
- **Clean shutdown.** UT writes `System/Running.ini` at startup and deletes it only
  on a clean exit. When it finds the file and no other UT is running, it opens a
  recovery prompt that offers safe mode. A killed cam leaves the file behind, so the
  next cam or the streamer's own game would open that prompt. Stopping a cam therefore
  posts `WM_CLOSE` to its game window (`CamWindows.requestClose`, the window
  `pickCamWindow` chooses), which UT handles as a normal quit, and waits up to 8 s
  (`closeTimeoutMs`). Only a cam that has no window to close, cannot be asked, or
  does not exit in time is killed. On `will-quit`, `stopAllNow` posts the same
  close without waiting and kills only the cams it could not ask. As a backstop,
  every launch and restart deletes a leftover `Running.ini` before spawning, so the
  cams always open straight into the game.
- **Status.** `cam-log.ts` reads each cam's log incrementally and takes the
  server from the last network `LoadMap:` line (`Browse:` is ignored).
  `cam-window-match.ts` picks which top-level window of a PID to title or close.
- **Window titles** are set through `koffi` bindings to user32 in
  `cam-windows.ts` (`EnumWindows`, `SendMessageTimeoutW`, `PostMessageW`, …), re-applied about
  every 2 s while a cam runs. koffi loads lazily via
  `createRequire(__filename)('koffi')`; a dynamic `import()` would stay native
  ESM in the CJS main bundle. If it fails to load the cams still run and
  `retitle.available` is false. Packaging: `electron-builder.yml` unpacks
  `node_modules/koffi/**` from the asar and strips its non-Windows binaries.

## Auto-updates

Packaged builds update during the intro splash, Discord-style. `main.ts` creates the
window and calls `updaterService.installBeforeLaunch()`, which sets `holdingLaunch`
in the updater state while it runs. The sequence lives in `startup-update.ts`
(unit-tested): check (5 s cap), download (2 min cap), then `quitAndInstall`. A
failed or slow step releases the hold and the app opens normally; a download that
is still running carries on in the background.

The renderer's `SplashScreen` will not leave the intro while `holdingLaunch` is set.
`splashUpdateStatus.ts` (unit-tested) turns the updater state into the line under
the subtitle: "Updating to vX" with a progress bar, then "Restarting to finish the
update". The check usually finishes inside the 2 s intro, so a launch with nothing to
install looks exactly like before. If the check is still running when the intro
ends, "Checking for updates" appears. When an install starts, the hold is released
after 15 s in case the app never quits. While an update downloads or restarts,
`SplashPatreonCard` fades in under the bar: "Love BunnyTrack? Be a legend like
<patron>" with a Support on Patreon button. How the patron is picked is in
`agents/data-sources.md` (Patreon members).

- **In-session:** `startBackgroundChecks()` re-checks every 4 h and downloads on
  its own. A finished download shows `UpdateBanner` (Restart now · What's new); it
  never opens the modal on its own. `autoInstallOnAppQuit` installs it silently on
  quit, so the next start is already current.
- **Dev:** unpackaged builds never hold the launch or download on their own; the
  Settings → Updates button still drives check / download by hand.
- **Installer:** `electron-builder.yml` builds a one-click per-user NSIS installer
  (`%LOCALAPPDATA%\Programs\utbt-launcher`), so updates need no wizard and no UAC.
  Differential downloads use the `.blockmap` the release uploads.
- **Moving off all-users installs:** releases before the switch installed for all
  users, and the per-user installer cannot remove that copy. The new app offers to
  remove it once it is running, and never without asking: `LegacyInstallCard`
  (`app/components/updater/`, opened from `app.tsx` once the app reaches main)
  explains that UTBT now updates itself and that Windows will ask once to allow the
  old uninstaller, named as Windows shows it. Windows asks only after the player
  clicks Remove old copy. "Not now" stores the version in
  `legacyInstallDismissedVersion`, so the card returns after the next update, and
  Settings → General shows a Remove old copy row that opens the same card while the
  old copy exists. The renderer state lives in `legacyInstall.ts`; the channels are
  `legacyInstall:getStatus`, `legacyInstall:dismiss` and `legacyInstall:remove`.
  `legacy-install-service.ts` reads the machine registry (`LEGACY_INSTALL_KEY`,
  which comes from the unchanged `appId`), and `planLegacyRemoval()`
  (`legacy-install.ts`, unit-tested) decides whether it is safe. It removes only
  when the registered uninstaller sits in the install folder, the app is not running
  from that folder, and the folder holds nothing but launcher files: Electron's
  `.dll/.pak/.bin/.dat`, `locales`, `resources`, the exe, the uninstaller and the
  license files. A custom folder that also holds a game, demos or anything else is
  left alone, because the old uninstaller deletes its whole folder. Removal runs the
  registered uninstaller with `/S /allusers` through an elevated `Start-Process`:
  one UAC prompt, app data kept. The uninstaller hands off to a temp copy and exits,
  so the service polls until the uninstall key is gone (up to 2 minutes) before it
  reports `removed`; a declined prompt reports `declined`. The old uninstaller stops
  processes by their path inside its own folder, so the new app keeps running (only
  without PowerShell does it fall back to stopping every `utbt.exe`). Taskbar
  pins that pointed into the old folder are rewritten to the new exe when they
  survive the uninstall; when Windows removed them, the card tells the player how to
  pin UTBT again.
- **Package size:** `files` in `electron-builder.yml` is an allowlist (`out/**`,
  `resources/**`). `dependencies` in `package.json` holds only what main and preload
  load at runtime; renderer libraries belong in `devDependencies`, because Vite
  already bundles them into `out/renderer` and anything in `dependencies` ships in
  the asar a second time.

## Stream kit extractor

`extractKit` (`kit-extractor.ts`) downloads a ZIP with the user's bearer token
and extracts it into a folder. The token is only ever sent to the launcher's own
API host over https (localhost is allowed in unpackaged dev builds); redirects
are refused and requests time out. The folder passes `kit-folder.ts` first
(absolute drive-letter path, no traversal, no bare drive root). The ZIP is held
in memory (200 MB cap), scanned for zip-slip with `isWithin` before anything is
written, then extracted with the maps handler's guard (`isWithin`, symlinks
refused). Existing files are overwritten. Progress is pushed on
`stream-kit:kit-progress` (bridge: `lib/conveyor/README.md`).

## Window security + CSP

`app.ts` injects a `Content-Security-Policy` on every response. `connect-src`,
`img-src`, and `media-src` pin the exact remote hosts the launcher may reach — a
new remote host (API, asset CDN) **won't load until it's added there**. Renderer
HTTP failing with a CSP error usually means the host is missing from this list.

CSP is checked on every redirect hop, not just the first URL. Replay videos from
`recorder.utbt.net` redirect archived recordings to `archive.org`, which redirects again
to a numbered `*.archive.org` node, so `media-src` lists `https://archive.org` and
`https://*.archive.org` too (the wildcard does not cover the bare domain). Drop either
and only older replays break.

`connect-src`, `img-src` and `media-src` are each built twice, packaged vs dev, because dev talks to a
localhost API. Adding a host to only one of them produces the worst kind of bug: works in
`npm run dev`, silently blocked in the shipped build (or the reverse). Change both.

`img-src` also allows `data:` and `blob:` so the renderer can preview an image the user
just picked — `MapScreenshotModal` renders the chosen file from an object URL before
uploading it. Dropping either scheme leaves that preview blank with no network error.
