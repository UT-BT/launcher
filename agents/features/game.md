# Game integration

How the desktop app works with the UT99 install: finding and validating it, patches,
launching and joining servers, map and demo files written into it, the demo watcher,
game profiles, and the custom window chrome. Read it before touching any of those flows.
Main-process mechanics (path safety, config storage, ini access, cams, CSP, close-to-tray)
are in [lib/main/README.md](../../lib/main/README.md), channels in
[lib/conveyor/README.md](../../lib/conveyor/README.md), the settings panels and ini keys in
[the settings README](../../app/components/pages/settings/README.md), and the demo upload
and map download endpoints in [api.md](../api.md). The old all-users launcher copy is
launcher packaging, not the game: lib/main/README.md.

## Where the code lives

| Path | Holds |
|---|---|
| `lib/main/game-service.ts` | install validation, standalone launch, `isGameRunning`, game profiles; no tests |
| `lib/main/installation-service.ts`, `lib/main/patch-service.ts` | UT99 ISO download and setup, patch download, verify and extract |
| `lib/main/demo-watcher-service.ts` | the demo watcher: detection, cap checks, upload, durable retry, upload log; no tests |
| `lib/main/game-processes.ts` | pure `tasklist` parsing that keeps cam PIDs out of `isGameRunning`; Vitest |
| `lib/conveyor/handlers/` | `game-handler.ts` (join, ping), `app-handler.ts` (install, patches, profiles, demo log), `maps-handler.ts` and `demos-handler.ts` (writes into the install), `window-handler.ts` |
| `app/components/main/Main.tsx` | `installationStatus`, `validateInstallation`, the install banner |
| `app/components/pages/GameInstallationSettings.tsx` | Settings → Installation: ISO installer, folder picker, patch list |
| `app/utils/serverJoin.ts` | pure Join/Spec/Play decisions (running check, `User.ini` class writes) behind a `GameLaunchPort`; Vitest |
| `app/hooks/useServerJoin.ts` | `useServerJoin` (Join/Spec for the server browser and Home, with the notice it shows) and `launchStandaloneGame` (sidebar Play) |
| `app/components/layout/sidebar/SidebarActions.tsx` | sidebar Join Server and Play |
| `app/platform/` | capability flags, `saveMapZip` / `saveDemoFile` with their web fallbacks, the gateway server list (normaliser tested in `gateway.test.ts`) |
| `app/hooks/useMapDownload.ts`, `app/hooks/useDemoDownload.ts`, `app/components/shared/` | download state, and the `*DownloadStatusModal` reason → message tables |
| `app/components/window/` | titlebar, window controls, the Game Profiles and Demo Uploads modals; desktop only |

## The install

### Choosing and validating

- The path and the installed patch are launcher config (`ut99InstallPath`,
  `installedPatch`). Changing the path clears `installedPatch`, and an install without one
  is invalid, so set the path only through `validateAndSetInstallPath`, never the raw
  `setUt99InstallPath` channel.
- A folder is an install when it has `System`, `Textures`, `Maps`, `Music`, `Sounds` and
  `System/UnrealTournament.exe`, `User.ini`, `UnrealTournament.ini`.
- The version is the MD5 of `System/UnrealTournament.exe` matched against the gateway's
  active patches (`GET /patches`, `exe_md5` → `tag`, through the main-process
  `gatewayService`). No match is the tag `'Unsupported'`. `installedPatch.sha256` holds
  that MD5 despite its name.
- **Browse** (`selectInstallDirectory`, then `validateAndSetInstallPath(path)`) checks the
  layout, stores path and patch, restarts the demo watcher, snapshots the ini files into
  two new profiles `Original (n)` and `Default (n)` (Default becomes active), sends
  `installation-path-updated`, then downloads the custom announcer to
  `Sounds/Announcer.uax` from the gateway's `/assets/ut/Announcer.uax` with progress
  events. An announcer failure only logs.
- **`validateCurrentInstallation()`** re-checks the stored path: `{ valid: false }` when
  the path, the patch or a required file is missing; `{ valid: true, version:
  'Unsupported' }` (and stored) when the hash matches no active patch; the stored tag when
  the gateway is unreachable, so offline launches stay valid. Every call hashes the exe and
  asks the gateway.

### `installationStatus`

`Main.tsx` turns the answer into `'valid'`, `'unsupported'` (version `'Unsupported'`) or
`'no-install'` (not valid, or the call threw). It validates on mount and 500 ms after a
patch `complete` or `installation-path-updated`; nothing polls, so an install removed
while the app runs reads valid until then. On web it stays `null`: `validateInstallation`
returns early without `capabilities.install`, so no banner shows.

| | `valid` | `unsupported` | `no-install` |
|---|---|---|---|
| Join, Spec, sidebar Play | enabled; Join also needs a free slot | disabled, tooltip "Unsupported game version" | disabled, "No valid UT99 installation found" |
| `InstallationBanner` (opens Settings at `game-installation`) | hidden | shown | shown |
| Game settings sections, titlebar Game Profiles | enabled | disabled | disabled |
| Map and demo saves (main side, re-validated per call) | written | written (`valid: true`) | refused `no-install` |

Settings → Demos uses its own rule: disabled while no path is stored or the stored patch
is `'Unsupported'`.

### Installing UT99 and patches

- **Download & Install UT99** shows `GameInstallLegalModal`, then `downloadUt99Iso`
  fetches the GOTY CD1 ISO from archive.org into `{temp}/utbt-ut99/` and checks its MD5
  (a cached ISO that matches skips the download; progress on `iso-download-progress`).
  `mountAndRunUt99Iso` mounts it with PowerShell `Mount-DiskImage`, runs `Setup.exe`,
  waits, and always unmounts. The installer never sets the path: the user browses to the
  folder afterwards. `cancelUt99Download` aborts only the download.
- **Patches.** `fetchPatches` lists the active gateway patches. `installPatch` reuses
  `{userData}/patch-cache/<asset_name>` when its SHA-256 matches, else downloads and
  verifies it, extracts over the install root (an entry escaping the root fails the
  install), then stores the new exe MD5 and tag. Status arrives on `patch-install-status`
  (`verifying`, `downloading`, `extracting`, `complete`, `error`), progress on
  `patch-install-progress`. A patch with `channel === 'rc'` asks for confirmation first.

## Launching and joining

- Every entry point goes through `app/utils/serverJoin.ts`: the server browser and Home
  (with its favorite servers card) call `useServerJoin().join`, the sidebar Play calls
  `launchStandaloneGame`. Both return early without `capabilities.game`, and the buttons
  render only with it, so web shows no Join, Spec or Play. Add a new launch entry point
  through them, never with direct `window.conveyor` calls.
- **Play** (sidebar) first resets `User.ini` `[DefaultPlayer]` to a player (below), then
  `game.launchGameStandalone()` spawns `System/UnrealTournament.exe` detached, with
  `System` as the working directory. A launch failure only logs.
- **Join / Spec** (server browser rows and compact cards, Home's favorite servers card)
  check that the game is not running (below), write `User.ini` `[DefaultPlayer]`, then call
  `game.launchGame(ip, hostport)`:
  - Spec sets `OverrideClass=Botpack.CHSpectator`.
  - Join and Play clear `OverrideClass`, and clear `Class` when it is `Botpack.CHSpectator`,
    so a Spec never carries over into a later Join or Play.
- **`launchGame`** (main) checks the stored path and exe, requires `ip` to match
  `^[a-zA-Z0-9.-]+$`, and spawns the exe with `unreal://<ip>:<port>` as its only argument.
  The schema requires a positive integer port, so a server whose `hostport` normalised to
  `0` fails before main runs. Join passes no password or URL options; the stream cams are
  the only launch that sends a server password (lib/main/README.md).
- `useServerJoin` holds one `notice` (`{ title, message }`): a launch error ("Launch Error")
  or the already-running notice ("Game Already Running"). The server browser shows it in its
  `ErrorModal`, Home in a `Modal`.
- **Ping.** `pingServer` accepts IPv4 only (schema) and runs one `ping` with a 1 s
  timeout; `999` means failed. The server browser pings unique IPs six at a time after
  each fetch, behind `capabilities.ping`.

### The game already running

- `gameService.isGameRunning()` lists `UnrealTournament.exe` with `tasklist` and ignores
  stream-cam PIDs (`game-processes.ts`), so cams never count as the player's game.
- The server browser's 60 s auto-refresh skips while the game runs.
- `startBackgroundGamePoller` (`favorites-handler.ts`, every 5 s from main) sends
  `favorites:game-closed` on a running → stopped edge; map favorites re-read the ini then
  ([api.md](../api.md)).
- Join and Spec check it first. While the game runs, or while another Join or Spec is still
  starting it, they write nothing and launch nothing, and show "UT99 is already running.
  Close it to join another server." instead.
- Nothing checks it before Play, a profile switch or a settings write, so a second Play
  still starts a second client.

## Files written into the install

Map ZIPs and downloaded demos go through `app/platform/downloads.ts`, which carries the web
fallback; call it, not the `maps` / `demos` channels.

| Function | Desktop | Web |
|---|---|---|
| `saveMapZip(mapName, bytes)` | `extractMapToInstall`: unzip into the install root (the ZIP is laid out like an install); existing files are never overwritten and come back in `skipped` | browser download `<map>.zip`, `ok` with empty lists |
| `saveDemoFile(filename, bytes)` | `saveDemoToSystem`: write `{install}/System/<name>.dem` (`/\:*?"<>\|` → `_`, `.dem` appended), replacing a same-named file | browser download |

- Both handlers re-validate the install and refuse `no-install`; `'Unsupported'` passes.
  Other reasons: map `empty-zip`, `extract-error` (zip-lib also refuses entries outside the
  folder); demo `empty`, `write-error`. `useMapDownload` adds `fetch-error`, `timeout` and
  `http-<status>`; `useDemoDownload` reports any thrown error as `fetch-error`. Give every
  new reason a line in the matching status modal.
- `useDemoDownload` names files `<map>__<time>__<alias>.dem` (time like `01-23-456`). The
  demo watcher's filename pattern never matches that, so a downloaded demo is never
  uploaded.

## Demo watcher

`demoWatcherService` runs in main. `createAppWindow` starts it; it restarts whenever the
install path or the Demos settings change. Settings → Demos stores
`autoUpload` (`Never` | `Personal Bests Only` | `World Records Only`, default `Never`)
and `postUploadAction` / `discardDemoAction` (`Do Nothing` | `Move to Folder` | `Delete`)
through `app.setDemoWatcherConfig`, and the game's own recording switch `AutoDemoRec` in
`UTBT_UserSettings.ini`.

### Detection

- chokidar watches `{install}/System` (depth 0, initial files ignored, `awaitWriteFinish`
  2 s). Under OneDrive or a `\Desktop\` folder it polls every second instead, because
  native events are unreliable there.
- Only the game recorder's names count:
  `CTF-BT…__<MMm_SSs_mmmms | HHHh_MMm_SSs_mmmms>__YYYY-MM-DD-HHhMMm_Run<N>.dem`
  (`DEMO_REGEX` in `handleNewFile`). The map is the first `__` part, the time the second.
- A demo's identity is the fingerprint `lowercased path|size|mtime`. A fingerprint that
  finished (`uploaded`, `discarded`, `rejected`) is skipped for 24 h. Duplicate `add`
  events within 3 s and a file already in flight are dropped.
- Every start and restart rescans `.dem` files in `System` modified in the last 24 h, so
  demos recorded while the launcher was closed or upload was `Never` are picked up.
- `UTBT_DEMO_DIAG=1` in the environment logs every chokidar event under `DemoDiag`.

### Decision

1. `Never`: nothing happens.
2. Read the BTPog ID with `resources/bin/ut99-strings.exe` (unpacked from the asar): the
   most frequent id on lines containing `BTPOG`, which must appear at least twice. None
   yet → retry.
3. Look the cap up on the gateway: `GET /caps?btpog_ids=<id>&columns=cap_type,team_run_id`.
   No row → retry (the server may not have registered the cap yet). No row with
   a certified `cap_type` (`isCertifiedCap`) → `rejected`, file left alone. A failed lookup retries.
4. Team run (`team_run_id` set) → upload whatever the PB/WR setting: every certified
   member demo is evidence for the team run.
5. Solo: `Personal Bests Only` compares with the signed-in user's best verified time
   (`GET /caps/leaderboard/map/<map>?user=<discordId>&unverified_limit=0&verified_limit=1&columns=cap_time_seconds`;
   no desktop login → retry), `World Records Only` with the map's best (the same query
   without `user`). No previous time counts as a record. Strictly faster uploads;
   otherwise `discardDemoAction` runs (`System/Discarded`) and the demo is `discarded`. A
   failed check retries.

### Upload

- `uploadDemo` is imported from `app/utils/api.ts` into main, so keep it free of DOM and
  renderer-only APIs. The watcher sends the stored desktop token (`getAuthConfig`) as is,
  without refreshing it; no token → retry.
- In place it tries up to 5 times, `attempt × 2 s` apart, but repeats only file locks
  (`EBUSY`, `EPERM`, `EACCES`, `EIO`), cloud-file errors, "no matching cap found" and
  "network error". After the fifth attempt, or at once for any other failure, the demo
  goes to the durable retry.
- An error message containing "already verified" or "already exists" counts as success.
- `422` → `rejected`, never retried (contract in [api.md](../api.md)).
- Success → `uploaded`, then `postUploadAction` (`System/Uploaded`, delete, or leave).

### Durable retry

- Jobs are keyed by filename and persisted with the finished fingerprints to
  `{userData}/demo-watcher-state.json` (tmp file + rename), so they survive restarts.
- Backoff starts at 5 s and doubles to 10 min. 24 h after first sight the job is dropped,
  the demo stays where it is and a failed log entry says so. A job whose file is gone is
  dropped.
- While upload is `Never`, due jobs are pushed back 10 min instead of running.

### Upload log and manual upload

- The log is in memory only: newest first, 50 entries, gone on restart.
- The titlebar Demo Uploads button polls `getUploadLogs` every 2 s and pulses while an
  entry is `uploading`. Its modal lists the log and takes dropped or picked `.dem` files:
  it gets the path from `app.getPathForFile`, reads the BTPog ID through
  `extractBtpogId` (main runs the tool only on an existing `.dem` path, via `execFile`),
  and calls `uploadDemo` from the renderer. That path has no cap or certification check,
  no 422 rule and no retry.

## Game profiles

- A profile is a copy of `System/UnrealTournament.ini` and `User.ini` in
  `{userData}/profiles/<name>/` (names contained with `resolveWithin`); the active name is
  config `activeProfile`. The titlebar Game Profiles modal is the only UI.
- Create, and Overwrite (the same `createProfile` call on an existing name), copy install
  → profile and make it active; Switch copies profile → install. Both send
  `profile-changed`, on which the game settings panels re-read (`window.utProfile.onChanged`).
- `checkProfileSync(active)` reports unsaved changes by comparing tracked sections:
  `User.ini` `DefaultPlayer`, `Engine.Player`, `Engine.PlayerPawn` (plus `Engine.Input` and
  `Aliases` when present); `UnrealTournament.ini` `Engine.Engine`, `Engine.GameEngine`,
  `WinDrv.WindowsClient`, `Engine.Player`, `Engine.GameInfo` and every `*RenderDevice` /
  `*AudioSubsystem` section, ignoring `RunCount` and `LocalTime`. The modal asks before
  switching away from a dirty profile.
- `Original` and `Original (n)` cannot be overwritten, renamed or deleted from the modal;
  main does not enforce it. Every successful Browse adds a new `Original (n)` /
  `Default (n)` pair, even for the same folder.

## Window chrome (desktop only)

- The window is frameless (`frame: false` in `lib/main/app.ts`, minimum 1280 × 720), so
  the renderer draws the titlebar. `app/renderer-desktop.tsx` wraps the app in
  `WindowContextProvider`; the web entry does not ([web-target.md](../web-target.md)).
- `WindowContextProvider` asks `window-init` for `{ width, height, minimizable,
  maximizable, platform }`, renders `TitlebarContextProvider` + `Titlebar` above
  `.window-content`, and marks the parent `.window-frame`. The titlebar sits outside
  `App`: it has no navigation context, user profile or updater state.
- `Titlebar`: centred icon and brand; on the right `.window-titlebar-actions` holds
  Links, About, Settings, Game Profiles, Demo Uploads and, in dev builds, Impersonate.
  Minimise / maximise / close render only on `win32` and call `window-minimize`,
  `window-maximize-toggle`, `window-close`. The maximise icon guesses the state from the
  window size against `screen.availWidth` / `availHeight`.
- **Drag region.** `.window-titlebar` is `-webkit-app-region: drag`, which swallows
  clicks. Put interactive titlebar content inside a `no-drag` container
  (`.window-titlebar-actions`, `.window-titlebar-controls`); anywhere else a click drags
  the window.
- **Titlebar state** arrives as CustomEvents dispatched on the `#titlebar-context`
  element, not `window`. Senders look the element up and skip when it is absent (web).

  | Event | Detail | Sent by | Effect |
  |---|---|---|---|
  | `set-titlebar-global-disabled` | `{ disabled }` | `app/app.tsx`: true until the app phase is `main` | disables Game Profiles and Demo Uploads |
  | `set-titlebar-game-profiles-disabled` | `{ disabled }` | `Main.tsx`: true unless `installationStatus === 'valid'` | disables Game Profiles |
  | `toggle-app-info` | none | About button | toggles the `AppInfo` overlay |

  Both disabled flags start `true`.
- Buttons that open UI living under `App` dispatch a `window` event instead: Settings sends
  `open-settings` ([navigation.md](../navigation.md)), Impersonate sends
  `DEV_IMPERSONATE_EVENT` for `DevImpersonateModal`. Game Profiles and Demo Uploads render
  their own modals. Links and the About page open URLs through `web-open-url`.
- `--window-titlebar-height` (26 px in `app/styles/window.css`, 0 px on web) is the top
  offset of full-window overlays (`top-[var(--window-titlebar-height)]` in
  `app/components/ui/modal.tsx`, `ErrorModal`, the settings fallback), which keeps the
  titlebar usable.
  Titlebar colours and the scope of `window.css`: [styling.md](../styling.md).
- Not in use: `TitlebarMenu.tsx` and `menus.ts` (a File / View / Links / About menu bar,
  still exported from `index.ts`) are never rendered, and nothing sends
  `set-titlebar-lock` or calls `webSetLocked`. Build on the action buttons.

## Platform notes

- The app ships for Windows only (`npm run build:win`). The ISO installer (PowerShell),
  `ut99-strings.exe` and the window controls are Windows-only; the `pgrep` and Unix `ping`
  branches exist for development on other systems.
- Paths are built with `path.join` on the stored install path. Containment checks are
  case-insensitive on Windows (lib/main/README.md), and the demo fingerprint lowercases
  the path for the same reason.
- Web hides launching, ping, the install flow and the titlebar through `app/platform/`
  capabilities and turns map and demo saves into browser downloads; the full table is in
  [web-target.md](../web-target.md).

## Adding a file that installs into the game folder

Modelled on map downloads.

1. Add the fetcher to `app/utils/api.ts`: return an `ArrayBuffer`, abort after a timeout
   and throw `http-<status>` on a non-2xx (copy `downloadMapZip`, [api.md](../api.md)). A
   new remote host also goes into the desktop CSP `connect-src`, in both lists
   (lib/main/README.md).
2. Add an IPC channel with the
   [`add-ipc-channel` skill](../../.claude/skills/add-ipc-channel/SKILL.md), returning
   `{ ok: true, … } | { ok: false, reason }`. In the handler refuse empty bytes, call
   `gameService.validateCurrentInstallation()` and refuse `no-install`, keep every write
   inside the install (`resolveWithin`, or zip-lib's containment for archives) and decide
   the overwrite rule. Copy `maps-handler.ts` for an archive, `demos-handler.ts` for a
   single file.
3. Add the platform function to `app/platform/downloads.ts` (desktop calls the channel,
   web calls `triggerBrowserDownload`) and export it from `app/platform/index.ts`, both
   as a named export and under `platform.downloads`. Copy `saveMapZip`.
4. Add a hook in `app/hooks/` holding `downloading | success | error` and sending
   `trackOutcome` events. Copy `useMapDownload`.
5. Add a status modal in `app/components/shared/` with a message for every reason the
   handler and the hook return. Copy `MapDownloadStatusModal`.
6. Wire the trigger on the page and leave it visible on web.
7. Verify: `npm run typecheck:web` and `npm run lint` pass; in `npm run dev` with a valid
   install the file lands under the install, and with no install the modal shows the
   `no-install` message; in `npm run dev:web` the browser downloads the file.

## Adding a titlebar button

Modelled on Game Profiles and Impersonate.

1. Create `app/components/window/<Name>Button.tsx`: a
   `<button className="titlebar-action-button" aria-label=…>` with a `react-icons/fa`
   icon inside `<Tooltip side="bottom">`. Copy `SettingsButton` when it opens UI under
   `App`, `GameProfilesButton` when it owns a modal.
2. When the action needs the app past splash and login, disable it on
   `useTitlebarContext().areButtonsDisabled`, as `UploadLogButton` does. A narrower gate
   gets its own flag and event in `TitlebarContext.tsx`, sent from where the state lives
   (copy `set-titlebar-game-profiles-disabled`).
3. To open UI that needs navigation or the user, dispatch a `window` CustomEvent and
   handle it under `App`: `open-settings` is handled in `AppLayout`,
   `DEV_IMPERSONATE_EVENT` by `DevImpersonateModal`, mounted in `Main.tsx`.
4. Render the button in `Titlebar.tsx` inside `.window-titlebar-actions`; wrap a dev-only
   button in `import.meta.env.DEV`. An action web users also need gets a second entry
   point outside the titlebar.
5. Verify: `npm run typecheck:web` and `npm run lint` pass; in `npm run dev` the tooltip
   shows and a click acts instead of dragging the window.
