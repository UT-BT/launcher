# Main process

Node-privileged Electron code: the filesystem, child processes, the UT99 install, OS
integration, launcher config and desktop Discord login. Read this before adding
main-process logic, touching files or the install from main, or deciding whether logic
belongs in main or the renderer. The renderer reaches main only through Conveyor IPC
([lib/conveyor/README.md](../conveyor/README.md)).

`main.ts` takes the single-instance lock (a second launch shows the existing window),
calls `createAppWindow()` in `app.ts` (CSP, window, every handler registration, tray,
demo watcher, updater init) and then `updaterService.installBeforeLaunch()`.

## Where logic goes

- **Main** when it needs Node privileges: filesystem, `child_process`, OS dialogs, secret
  storage, the registry, or anything that must outlive the renderer. Everything else stays
  in the renderer.
- **Services** are singleton modules in `lib/main/` (`*-service.ts`); handlers in
  `lib/conveyor/handlers/` stay thin and delegate. Handlers are where untrusted renderer
  input is validated.
- **Pure logic shared with the renderer** goes in `lib/stream-kit/` (no Node, DOM or IPC
  imports), as the cam plan does.
- Non-obvious owners: `tray-service` intercepts the window's `close`/`minimize` for
  close-to-tray (a `before-quit` flag lets a real quit through) and applies start-on-login;
  `logging-service` writes `{userData}/logs/utbt.log`; `game-processes.ts` lets
  `gameService.isGameRunning()` ignore cam PIDs, so cams never fire game-closed or pause
  server refreshes.

## File and path safety

Renderer-supplied paths are untrusted. Contain them with `path-safety.ts` before touching
the filesystem:

- `resolveWithin(baseDir, target)` resolves `target` against `baseDir` and throws if the
  result escapes it (absolute paths, `..`). Comparison is case-insensitive on Windows.
- `isWithin(baseDir, candidate)` is the boolean form.

Validate other shapes too. The game handler checks `ip` against a hostname regex before
building an `unreal://` URL and against an IPv4 regex before `spawn('ping', …)`. Never
interpolate renderer input into a command line or path unchecked.

Map ZIPs (`maps-handler.ts`) extract into the install root and never overwrite: existing
files come back in `skipped`. Demos (`demos-handler.ts`) are written to `{install}/System`
under a sanitized filename. Both refuse with `no-install` unless the install validates.

## Opening URLs

Open external URLs with `openExternalSafe(url)` (`url-safety.ts`), which opens only
`http:`/`https:` and logs anything else. The window's `setWindowOpenHandler` and
`will-navigate` (for cross-origin targets) route through it, and so does the `web-open-url`
channel behind the renderer's `openExternal`. The only direct `shell.openExternal` is the
auth service's fixed Discord authorize URL.

## Config storage

`config.ts` persists `config.json` under `{userData}/config`, written atomically (tmp file
+ rename). Read and write only through its exported `get*`/`set*` accessors; each setter
reads the current file and writes it back whole, so other keys survive. A missing or
unreadable file reads as `{}`.

- **Auth tokens** never reach the disk unencrypted. Read and write them only through
  `getAuthConfig`/`setAuthConfig`/`clearAuthConfig`, never from the file.
  - With Electron `safeStorage` encryption available, both tokens are stored encrypted with
    an `enc:` prefix, and an `enc:` value that cannot be decrypted reads as empty.
  - Without it, sign-ins are session-only: the sign-in lives in memory and is never written
    to the file (signing in or out also drops an encrypted `auth` an earlier session stored),
    and the user signs in on each launch. The first auth access logs once that sign-ins are
    session-only on this machine.
  - Encryption is checked on each auth access. On Windows `safeStorage` reports it
    unavailable until app `ready`, so call the auth accessors only after `ready`; an earlier
    call would treat the machine as session-only.
  - Loading the config deletes an `auth` holding a plain-text token (left by versions before
    session-only sign-ins) and logs the removal, whatever encryption is available.
  - Never log tokens or put secrets in other fields.
- **`camFps`**: `60` or `120`; anything else reads as `120` (`camFpsOf`).
- **`camVolume`**: whole percent `0`-`100`; anything else reads as `50` (`camVolumeOf`).
- **`windowBehavior`**: minimize/close-to-tray and start-on-startup, applied by
  `tray-service`.
- **`legacyInstallDismissedVersion`**: the launcher version whose old-copy card was
  dismissed or acted on (see Auto-updates).

## Desktop auth

`auth-service.ts` runs Discord OAuth with PKCE as a public client: it listens on
`http://127.0.0.1:54321/callback`, opens Discord's authorize page and exchanges the code
with Discord directly (the web build goes through the API instead, see
[agents/web-target.md](../../agents/web-target.md)). `getProfile` refreshes single-flight
within 5 minutes of expiry and falls back to the stored token if that fails. `refreshNow`
refreshes at once, whatever the expiry, and returns the new access token, or `null` when
nobody is signed in or the refresh fails (never the stale token; the sign-in stays stored).
It joins a refresh already in flight, so a rotated refresh token is spent once. The demo
watcher calls it after a `401` ([agents/features/game.md](../../agents/features/game.md)).
Sign-in, refresh and sign-out persist through the config auth accessors, so without
encryption they all stay in memory (see Config storage). The renderer never receives the
refresh token (`toRendererProfile` blanks it). The `auth:*` channels are plain
`ipcMain.handle` calls in `main.ts`, outside the Zod-validated Conveyor set.

## Ini access (settings panels)

`ini-handler.ts` serves `readIniValue`, `writeIniValue` and `readIniSection`. Every path
goes through `resolveWithin({install}/System, path)`. Its parser keeps UT99 section names
exactly (dots unescaped) and duplicate keys as arrays: `readIniSection` returns the
arrays, `readIniValue` returns the first value. `writeIniValue` sets one key (or deletes it
with `null`) by parsing the whole file and writing it back as UTF-8, so comment lines and
original formatting are not preserved. The settings panels are the consumer
([app/components/pages/settings/README.md](../../app/components/pages/settings/README.md)).

## Stream cams

Four extra UT clients (slots A1, A2, B1, B2) for the Stream tab's Cams panel. Windows
only; elsewhere every call refuses with `unsupported-platform`. The renderer sends only a
`CamRequest` (lineup, two server addresses, optional per-team passwords, `fps`,
`volume`); it never sends paths, command lines or ini text. The IPC shape is in
[lib/conveyor/README.md](../conveyor/README.md).

**Plan.** `cam-launcher.ts` reads the streamer's `UnrealTournament.ini` and `User.ini`
through `resolveWithin({install}/System, name)` and calls `buildCamPlan` from
`lib/stream-kit/cam-plan.ts` (also home to `parseServerAddress` and the window titles).
`lib/stream-kit/team-server-detection.ts` decides which server each team is on. Both use
`isDiscordId` from `discord-id.ts`.

**What each cam gets.** A cam runs
`System\UnrealTournament.exe <url> -NewWindow INI=UTBTCam<slot>.ini USERINI=UTBTCam<slot>User.ini LOG=UTBTCam<slot>.log`.
The streamer's own ini files are only read; each cam's copies are written whole by
`cam-launcher.ts` (not through the ini handler), keeping the source encoding (latin1, or
UTF-16LE with its BOM), under the same `resolveWithin` rule.

- **Connect URL**: `unreal://<host:port>` plus the `CAM_JOIN_OPTIONS`
  (`?OverrideClass=Botpack.CHSpectator?UTBTSpectator=True?UTBTFollow=<discordId>?UTBTHud=Broadcast?UTBTMuteJoinLeave=True`),
  then `?password=<password>` last when the team has one. The password never enters
  `joinOptions`. `isValidServerPassword` refuses whitespace, `?`, `#`, `"` (UT splits URL
  options on `?` and `#` and drops a URL whose option holds a space) and anything over 64
  characters, as `invalid-password` naming only the team. The password is on the cam's
  command line, so it shows in that cam's own UT log like any typed join URL.
- **Main ini copy**: the `CAM_INI_OVERRIDES` (960×540 windowed, not fullscreen or
  borderless), then from the request:
  - `FrameRateLimit=<fps>` in `[WinDrv.WindowsClient]` and in the section named by
    `[Engine.Engine] GameRenderDevice` (any device).
  - For `D3D9Drv` (`UseShaderGamma=2`) and `OpenGLDrv` (`UseShaderGamma=True`), also
    `UseFragmentProgram=True` (`CAM_SHADER_GAMMA_SETTINGS`). Without shader gamma these
    renderers apply Brightness through the display's hardware gamma ramp, which window
    capture never sees, so OBS got a darker picture than the screen. Other renderers
    already draw brightness into the frame and only get the frame-rate limit.
  - In the section named by `[Engine.Engine] AudioDevice`: `MusicVolume=0`, and
    `SoundVolume` and `SpeechVolume` set to `volume` scaled to UT's 0-255 (`utVolumeOf`:
    50% is 128). Every cam plays at that one volume whatever the streamer's setting; four
    cams at UT's usual level are very loud together.
  - Device names are read only from `[Engine.Engine]`, trimmed and matched
    case-insensitively. A missing or empty device key leaves that device's section alone;
    a missing section is appended; existing keys are replaced in place and every other
    line is kept.
- **User ini copy**: `[DefaultPlayer] OverrideClass=Botpack.CHSpectator`
  (`CAM_USER_INI_OVERRIDES`).

`fps` and `volume` are the saved `camFps` / `camVolume` preferences, which the renderer
reads and puts on every request. A restart without a request keeps the values the cam
launched with.

**Lifecycle.** Clients spawn detached and are tracked by PID. `launch`, `restart` and
`stopAll` run one at a time through a single queue; `launch` stops any running cams first.

**Clean shutdown.** UT writes `System/Running.ini` at startup and deletes it only on a
clean exit; finding it makes the next UT open a safe-mode recovery prompt. So stopping a
cam posts `WM_CLOSE` to its game window (`CamWindows.requestClose`, on the window
`pickCamWindow` chooses), which UT treats as a normal quit, and waits up to 8 s
(`closeTimeoutMs`). Only a cam with no window to close, that cannot be asked, or that does
not exit in time is killed. On `will-quit`, `stopAllNow` posts the same close without
waiting and kills only the cams it could not ask. As a backstop, every launch and restart
deletes a leftover `Running.ini` before spawning.

**Status.** `cam-log.ts` reads each cam's log incrementally and takes the server from the
last network `LoadMap:` line. `cam-window-match.ts` picks which top-level window of a PID
to title or close.

**Window titles** are set through `koffi` bindings to user32 in `cam-windows.ts`
(`EnumWindows`, `SendMessageTimeoutW`, `PostMessageW`, …), re-applied about every 2 s
while a cam runs. koffi loads lazily through `createRequire(__filename)('koffi')`; a
dynamic `import()` would stay native ESM in the CJS main bundle. If koffi fails to load
the cams still run and `retitle.available` is false. `electron-builder.yml` unpacks
`node_modules/koffi/**` from the asar and strips its non-Windows binaries.

## Stream kit extractor

`extractKit` (`kit-extractor.ts`, called from `stream-kit-handler.ts`) downloads the kit
ZIP with the user's bearer token and extracts it into a folder. Windows only.

- The token is sent only to `https://api.utbt.net` with no port (any `http(s)` localhost
  or `127.0.0.1` URL is also allowed in unpackaged dev builds). Redirects are refused
  (`redirect: 'error'`) and the download times out after 2 minutes.
- The folder passes `validateKitFolder` (`kit-folder.ts`) first: absolute drive-letter
  path, no `.`/`..` segments, no invalid characters, not a bare drive root.
- The ZIP is held in memory (200 MB cap), scanned for zip-slip with `isWithin` before
  anything is written, then extracted with a per-entry `isWithin` check and
  `safeSymlinksOnly`. Files from an older kit in the same folder are overwritten.
- Progress goes out on `stream-kit:kit-progress` (bridge `window.utStreamKit`).

## Auto-updates

Packaged builds update during the intro splash. `installBeforeLaunch()` sets
`holdingLaunch` in the updater state and runs `runStartupUpdate` (`startup-update.ts`,
unit-tested): check (5 s cap), download (2 min cap), then `quitAndInstall`. A failed or
slow step releases the hold and the app opens normally; a download still running carries
on in the background. Once an install starts, the hold is released after 15 s in case the
app never quits.

- **Splash.** `SplashScreen` does not leave the intro while `holdingLaunch` is set.
  `splashUpdateStatus.ts` (unit-tested) turns the updater state into the line under the
  subtitle ("Updating to vX" with a progress bar, then "Restarting to finish the
  update"); "Checking for updates" appears only if the check outlasts the 2 s intro.
  During a download or restart `SplashPatreonCard` fades in with a patron's name; how the
  patron is picked is in [agents/api.md](../../agents/api.md).
- **In session.** `startBackgroundChecks()` re-checks every 4 h and downloads on its own.
  A finished download shows `UpdateBanner` (Restart now · What's new) and never opens the
  modal by itself. `autoInstallOnAppQuit` installs it silently on quit.
- **Dev.** Unpackaged builds never hold the launch or download on their own; Settings →
  General → Updates drives check and download by hand.
- **Installer.** `electron-builder.yml` builds a one-click per-user NSIS installer, so
  updates need no wizard and no UAC. Differential downloads use the release's `.blockmap`.
- **Old all-users installs.** The per-user installer cannot remove a copy installed for
  all users, so the app offers to, never without asking. `LegacyInstallCard`
  (`app/components/updater/`, mounted from `app.tsx` once the app reaches main; state in
  `legacyInstall.ts`) explains the one Windows prompt and acts only on Remove old copy.
  "Not now" stores the version in `legacyInstallDismissedVersion`, so the card returns
  after the next update; Settings → General shows a Remove old copy row that reopens it
  while the copy exists. `legacy-install-service.ts` finds the copy in the machine
  registry under `LEGACY_INSTALL_KEY` (derived from the `appId`), and
  `planLegacyRemoval()` (`legacy-install.ts`, unit-tested) removes only when the
  registered uninstaller sits in the install folder, the app is not running from that
  folder, and the folder holds only launcher files (Electron's `.dll/.pak/.bin/.dat`,
  `locales`, `resources`, `swiftshader`, the exe, the uninstaller, the license files): the
  old uninstaller deletes its whole folder, so a folder with a game or demos in it is left
  alone. Removal runs the uninstaller with `/S /allusers` through an elevated
  `Start-Process` (one UAC prompt, app data kept) and polls up to 2 minutes until the
  uninstall key is gone before reporting `removed`; a declined prompt reports `declined`.
  Taskbar pins into the old folder are rewritten to the new exe when they survive; when
  Windows removed them, `pinLost` tells the card to explain how to pin again.

## Packaging

`files` in `electron-builder.yml` is an allowlist (`out/**`, `resources/**`), so nothing
else (`dist-web/` included) ships. `dependencies` in `package.json` holds only what main
and preload load at runtime; renderer libraries belong in `devDependencies`, because Vite
already bundles them into `out/renderer` and anything in `dependencies` ships in the asar a
second time.

## Window security and CSP

`app.ts` injects a `Content-Security-Policy` on every response. `connect-src`, `img-src`
and `media-src` pin the exact remote hosts the renderer may reach: a new remote host (API,
asset CDN) will not load until it is added there. Renderer HTTP failing with a CSP error
usually means a missing host.

- **Packaged and dev lists are separate.** Each of the three directives is built twice,
  because dev also talks to localhost. Add a host to both, or it works in `npm run dev` and
  is silently blocked in the shipped build (or the reverse).
- **Redirect hops count.** CSP is checked on every hop. Replay videos from
  `recorder.utbt.net` redirect archived recordings to `archive.org`, which redirects again
  to a numbered `*.archive.org` node, so `media-src` lists both `https://archive.org` and
  `https://*.archive.org` (the wildcard does not cover the bare domain).
- **`data:` and `blob:` in `img-src`** let the renderer preview an image the user just
  picked (`MapScreenshotModal` renders the file from an object URL before uploading).
  Dropping either leaves that preview blank with no network error.
- **utbt.net frames.** `frame-src` allows `https://utbt.net`, and sub-frame responses from
  that origin skip the injected header so they keep their own policy. The Stream tab's
  scene previews are iframes of the live scene pages.
