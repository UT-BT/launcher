---
doc: conveyor-ipc
read_when:
  - "calling the main process from the renderer (window.conveyor.* / window.auth / window.ut*)"
  - "adding or changing an IPC channel"
  - "subscribing to a main→renderer event (game closed, patch status, updater state)"
keywords: [conveyor, ipc, window.conveyor, invoke, handle, Zod, schema, preload, contextBridge, channel]
provides: "the renderer↔main IPC contract: the channel inventory, the api/handler/schema pattern, and the event bridges"
not_here:
  - "HTTP calls to the API → agents/data-sources.md"
  - "the step-by-step add-a-channel procedure → .claude/skills/add-ipc-channel/SKILL.md"
  - "the main-process services behind the handlers → lib/main/README.md"
sections: [overview, the-channel-inventory, calling-from-the-renderer, adding-a-channel, event-bridges, conventions]
last_verified: 2026-09-30
verify_against:
  - lib/conveyor/api/index.ts
  - lib/conveyor/schemas/index.ts
  - lib/main/app.ts
  - lib/preload/preload.ts
  - lib/conveyor/schemas/stream-kit-schema.ts
  - lib/conveyor/api/stream-kit-api.ts
  - lib/conveyor/handlers/stream-kit-handler.ts
---

# Conveyor — type-safe IPC

`request → response` calls from the renderer to the Electron main process. Each
channel is one triple kept in three folders:

- **`lib/conveyor/api/`** — renderer-side classes (`extends ConveyorApi`) whose
  methods call `this.invoke('<channel>', ...args)`. Bundled into the `conveyor`
  object in `api/index.ts` and exposed as `window.conveyor`.
- **`lib/conveyor/handlers/`** — main-side implementations registered with
  `handle('<channel>', fn)` (from `@/lib/main/shared`). `handle` validates args,
  runs the fn, validates the return, logs errors.
- **`lib/conveyor/schemas/`** — Zod `{ args, return }` per channel, spread into
  `ipcSchemas` in `schemas/index.ts`. This is the single source of types; the
  global `window.conveyor` type in `lib/conveyor/conveyor.d.ts` is **auto-derived**
  from the `conveyor` object — no manual type updates.

> This is for renderer↔main calls. HTTP to the backend API does **not** go
> through Conveyor — it lives in `app/utils/api.ts` (see `agents/data-sources.md`).

> **Web target:** none of these bridges exist in the web build. Shared UI must
> reach desktop functionality through `app/platform/` (capability gates + web
> fallbacks), never via raw `window.conveyor` presence checks. See
> `agents/web-target.md`.

## The channel inventory

`window.conveyor.<namespace>.<method>()` — every method returns a `Promise`.

| Namespace | Methods (renderer name → channel) |
|---|---|
| `app` | `version`, `getOSInfo`; install/ISO: `selectInstallDirectory`, `validateAndSetInstallPath`, `validateCurrentInstallation`, `get/setUt99InstallPath`, `downloadUt99Iso`, `cancelUt99Download`, `mountAndRunUt99Iso`; patches: `fetchPatches`, `installPatch`, `get/setInstalledPatch`; config: `get/setGatewayConfig`, `get/setDemoWatcherConfig`, `get/setWindowBehavior`; profiles: `createProfile`, `getProfiles`, `switchProfile`, `deleteProfile`, `renameProfile`, `getActiveProfile`, `checkProfileSync`; logs: `getUploadLogs`, `addUploadLog`, `updateUploadLogStatus`, `extractBtpogId` |
| `window` | `windowInit`, `windowMinimize`, `windowMaximize`, `windowMaximizeToggle`, `windowClose`, `windowIsMinimizable`, `windowIsMaximizable`, `webSetLocked`, `web{Undo,Redo,Cut,Copy,Paste,SelectAll,Reload,ToggleDevtools,ZoomIn,ZoomOut,OpenUrl,…}` |
| `game` | `launchGame(ip,port)`, `launchGameStandalone()`, `fetchServers()` (`/server-info`), `fetchPatrons()` (`/patreon` → `{tier1,tier2,tier3}` of Discord ids), `pingServer(ip)`, `validateCurrentInstallation()`, `isGameRunning()` |
| `ini` | `readIniValue(path,section,key)`, `writeIniValue(path,section,key,value,createIfMissing?)`, `readIniSection(path,section)` |
| `favorites` | `readIni()` → `{ ok, mapNames }`, `writeIni(mapNames)` — favorites in the user's `UTBT.ini` |
| `maps` | `extractToInstall(mapName, bytes)` → extract a map zip into the install dir without overwriting |
| `demos` | `saveToSystem(filename, bytes)` → write a demo into `{install}/System` |
| `updater` | `check(manual?)`, `download()`, `quitAndInstall()`, `getState()` |
| `streamKit` | Cam tool (Windows desktop only): `planCams(req)`, `launchCams(req)`, `retitleCams()`, `getCamStatus()`, `restartCam(slot, req?)`, `stopCams()`, `getCamFps()`, `setCamFps(fps)`; kit: `extractKit({url,token,folder})` → channel `extractStreamKit` |
| `logging` | `log/info/warn/error/debug(message, context?, data?)`, `getLogFilePath()`, `getRecentLogs(lines?)` |

Renderer method names and channel names sometimes differ (e.g.
`favorites.writeIni` → channel `writeFavoritesIni`, `maps.extractToInstall` →
`extractMapToInstall`, `streamKit.extractKit` → `extractStreamKit`). The channel name is what appears in the api class's
`this.invoke(...)`, the schema key, and the handler's `handle(...)` — all three
must match exactly.

### Stream kit channels

Schemas, types and error codes live in `schemas/stream-kit-schema.ts`
(`CamRequest`, `CamToolStatus`, `KitExtractRequest`, `KitProgress`).

- **Cam calls** take `CamRequest` = `{ lineup: { A1, A2, B1, B2 }, servers: { A, B }, fps }`
  (lineup and servers are strings or null; `fps` is required and is `60` or `120`). The renderer never sends paths, command lines or ini text;
  main reads the install itself. `plan`/`launch`/`restart` return `{ ok: true, … }`
  or `{ ok: false, errors }` (coded, e.g. `missing-slot`, `missing-server`,
  `no-install`, `unsupported-platform`); `retitle`/`getCamStatus`/`stopCams`
  return `CamToolStatus` = `{ supported, retitle: { available, error }, cams }`
  (always four slots A1, A2, B1, B2).
- **`restartCam(slot, null)`** relaunches from the plan the cam started with (including its
  frame rate); with a request it rebuilds that slot from the current lineup, servers and `fps`.
- **`getCamFps()` / `setCamFps(fps)`** read and save the Cam FPS preference (`camFpsSchema`,
  `60 | 120`). `getCamFps` answers 120 when nothing valid is stored. The renderer reads it, puts it
  on the `CamRequest`, and main's cam plan writes the frame-rate limits and audio settings from
  it (see `lib/main/README.md`).
- **`extractKit`** downloads the kit ZIP with the caller's bearer token and
  extracts it into `folder`. Returns `{ ok: true, folder, files }` or
  `{ ok: false, reason, status? }`; reasons cover folder, URL/token, HTTP and
  archive failures. Progress arrives on `window.utStreamKit.onKitProgress`.
- Both are Windows-only in main (`unsupported-platform` elsewhere); the renderer
  gates on `capabilities.camTool`.

Don't sprinkle `window.conveyor.*` through the renderer — wrap a channel in a
hook or thin utility if it's used in more than one place (e.g. `useDemoDownload`,
`useFavorites`).

## Calling from the renderer

```ts
const { valid, version } = await window.conveyor.app.validateCurrentInstallation()
// or, in a component:
import { useConveyor } from '@/app/hooks/use-conveyor'
const conveyor = useConveyor()
await conveyor.maps.extractToInstall(mapName, bytes)
```

## Adding a channel

The full ordered procedure (and the easy-to-miss "register in three places" step)
is the **`add-ipc-channel` skill**. In short — for channel `doThing`:

1. **Schema** — add to a file in `schemas/` and ensure that file is spread into
   `ipcSchemas` in `schemas/index.ts`:
   ```ts
   doThing: { args: z.tuple([z.string()]), return: z.object({ ok: z.boolean() }) }
   ```
2. **API** — add a method to the relevant class in `api/` (the class must be in
   the `conveyor` object in `api/index.ts`):
   ```ts
   doThing = (name: string) => this.invoke('doThing', name)
   ```
3. **Handler** — implement in a file in `handlers/` and make sure its
   `register*Handlers(window)` is called in `lib/main/app.ts → createAppWindow`:
   ```ts
   handle('doThing', async (name: string) => ({ ok: true }))
   ```

Zod validates args + return on the main side (`handle`), so keep schema and impl
in sync. The `window.conveyor` global type updates itself.

## Event bridges (main → renderer)

Push notifications (not request/response) are **separate** `contextBridge`
exposures in `lib/preload/preload.ts`, **not** part of `conveyor`. Each `on*`
returns an unsubscribe function — call it on cleanup.

| Global | Purpose |
|---|---|
| `window.auth` | `login()`, `logout()`, `getProfile()` (Discord OAuth, main-driven) |
| `window.utInstall` | `onProgress`, `onStatus`, `onConfirm`/`respondConfirm`, `onIsoDownloadProgress` |
| `window.utPatch` | `onStatus`, `onPatchInstallStatus`, `onPatchInstallProgress`, `onInstallationPathUpdated`, `onAnnouncerInstall*` |
| `window.utProfile` | `onChanged` — profile refreshed |
| `window.utFavorites` | `onGameClosed` — game exited; re-read ini favorites |
| `window.utbtUpdater` | `onStateChanged` — updater state push |
| `window.utStreamKit` | `onKitProgress` — kit download/extract progress `{ phase: 'downloading' \| 'extracting', done, total }` (`total` null without a content length) |
| `window.uiScale` | `set(factor)` / `get()` — zoom |

```ts
useEffect(() => window.utFavorites.onGameClosed(() => refetchFavorites()), [])
```

## Conventions

- **Match the existing channel-name style in the namespace you touch.** `window`
  uses kebab-case (`window-minimize`); `updater` uses `updater:method`; the newer
  game/ini/maps/demos/app channels use camelCase. Don't introduce a fourth style.
- **Always define the Zod schema** for both `args` and `return` — no `any`.
- **Handlers are the security boundary.** File/process access happens here, not in
  the renderer. Validate untrusted inputs (paths via `resolveWithin`, see
  `lib/main/README.md`).
