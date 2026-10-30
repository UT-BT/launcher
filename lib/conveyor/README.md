# Conveyor IPC

Typed request/response calls from the renderer to the Electron main process, plus the
separate preload bridges for login, logging and main → renderer events. Read this before
calling main from the renderer, adding or changing a channel, or subscribing to a main
event. HTTP to the backend API does not go through Conveyor; it lives in
`app/utils/api.ts` ([agents/api.md](../../agents/api.md)). The services behind the
handlers are in [lib/main/README.md](../main/README.md).

None of these bridges exist in the web build. Shared UI reaches desktop behaviour through
`app/platform/` capability gates and web fallbacks, never through `window.conveyor`
presence checks ([agents/web-target.md](../../agents/web-target.md)).

## The channel triple

Every channel is one name shared by three pieces:

- **`api/<ns>-api.ts`**: a class extending `ConveyorApi` whose methods call
  `this.invoke('<channel>', ...args)`. The classes are collected in the `conveyor` object
  in `api/index.ts` and exposed as `window.conveyor.<ns>`. The preload side does no
  validation.
- **`schemas/<ns>-schema.ts`**: Zod `{ args, return }` per channel, spread into
  `ipcSchemas` in `schemas/index.ts`. This is the single source of types; the global
  `window.conveyor` type (`conveyor.d.ts`) derives from the `conveyor` object.
- **`handlers/<ns>-handler.ts`**: `handle('<channel>', fn)` from `lib/main/shared.ts`,
  inside a `register<Ns>Handlers(window)` that `createAppWindow` in `lib/main/app.ts`
  calls. `handle` validates the args, runs `fn`, validates the return, and logs and
  rethrows errors.

To add a channel, follow the `add-ipc-channel` skill
(`.claude/skills/add-ipc-channel/SKILL.md`); it covers the three registration points.

## Finding a channel

Namespaces are the keys of `conveyor` in `api/index.ts` (`app`, `window`, `logging`,
`game`, `ini`, `favorites`, `demos`, `maps`, `updater`, `legacyInstall`, `streamKit`,
plus `electron`, the toolkit's raw API). To trace a call, grep its channel name: it
appears in the api class's `invoke`, the schema key and the handler's `handle`, and all
three must match exactly.

- **Renderer method names can differ from channel names**: `favorites.readIni` /
  `writeIni` → `readFavoritesIni` / `writeFavoritesIni`, `maps.extractToInstall` →
  `extractMapToInstall`, `demos.saveToSystem` → `saveDemoToSystem`,
  `streamKit.extractKit` → `extractStreamKit`, and every `window`, `updater` and
  `legacyInstall` method (see naming below).
- **Channel names are global.** `ipcSchemas` is one flat object and `handle` removes any
  earlier handler for the name, so a name reused in two namespaces collapses to the last
  one registered. `validateCurrentInstallation` exists in both `app` and `game` with
  identical schemas and the same service call; keep any other reuse identical too.
- **`app.getPathForFile(file)`** is assigned in `lib/preload/preload.ts` from Electron's
  `webUtils`: synchronous, no channel.

## Calling from the renderer

```ts
const { valid, version } = await window.conveyor.app.validateCurrentInstallation()
```

`useConveyor()` (`app/hooks/use-conveyor.ts`) returns the same object inside components.
Wrap a channel used in more than one place in a hook or helper rather than scattering
`window.conveyor.*` calls (`useDemoDownload`, `useFavorites`, and the `app/platform/`
modules, which also carry the web fallback).

## Conventions

- **Channel names follow the namespace's style.** `window` uses kebab-case
  (`window-minimize`, `web-open-url`); `updater` and `legacyInstall` use
  `namespace:method` (`updater:check`, `legacyInstall:remove`); every other namespace uses
  camelCase. Match the namespace you touch; do not add a fourth style.
- **Define a Zod schema for both `args` and `return`**, with real types.
  (`readIniSection`'s `return` is `z.any()`, the one exception.)
- **Handlers are the security boundary.** File and process access happens there, and
  every untrusted input is validated (paths via `resolveWithin`; see
  [lib/main/README.md](../main/README.md)). The renderer sends intent, not paths or
  command lines.

## Channels with rules the schema does not show

### `ini`

Paths are relative to `{install}/System` and contained there. `readIniValue` returns the
first value of a duplicated key, `readIniSection` returns duplicates as arrays,
`writeIniValue(path, section, key, value | null, createIfMissing?)` deletes the key on
`null` and rewrites the whole file (comments are lost). Details in
[lib/main/README.md](../main/README.md); the settings panels are the consumer.

### `game`

`fetchServers` / `fetchPatrons` fetch the gateway from main. Renderer code calls them
through `app/platform/gateway.ts`, which normalises the server list and takes the web
path on the web build.

### `streamKit` (Windows desktop only)

Every call refuses with `unsupported-platform` off Windows; the renderer gates the UI on
`capabilities.camTool`. Types and error codes are in `schemas/stream-kit-schema.ts`.

- **Cam calls** (`planCams`, `launchCams`, `restartCam`) take a `CamRequest`: lineup
  (Discord ids per slot A1–B2), the two team servers, optional per-team passwords (≤ 64
  characters), `fps` (`60 | 120`) and `volume` (whole percent `0`-`100`). Main reads the
  install itself. They return `{ ok: true, … }` or `{ ok: false, errors }` with coded
  errors; `invalid-password` names only the team, never the password.
  `retitleCams`, `getCamStatus` and `stopCams` return `CamToolStatus`
  (`{ supported, retitle: { available, error }, cams }`, always four slots).
- **`restartCam(slot, null)`** relaunches from the plan that cam started with (including
  its fps and volume); with a request it rebuilds that slot from the current lineup,
  servers, passwords, fps and volume.
- **`getCamFps` / `setCamFps`, `getCamVolume` / `setCamVolume`** read and save the
  launcher-config preferences. Getters answer the default (120, 50) when nothing valid is
  stored; setters return the stored, normalised value. The renderer puts both values on
  every `CamRequest`; what the cam plan writes from them is in
  [lib/main/README.md](../main/README.md).
- **`selectKitFolder(current)`** opens the native folder picker (starting at `current`
  when it is a valid drive path) and returns the folder, or `null` when cancelled. The
  desktop Kit card fills its read-only folder field from it; the web build keeps a typed
  path and downloads instead.
- **`extractKit({ url, token, folder })`** (channel `extractStreamKit`) downloads the kit
  ZIP with the caller's bearer token and extracts it into `folder`: `{ ok: true, folder,
  files }` or `{ ok: false, reason, status? }`. Progress arrives on
  `window.utStreamKit.onKitProgress`.

### `legacyInstall`

The old all-users copy (Windows desktop only). `getStatus().offer` is false once the
current version was dismissed. The flow and the safety rules are in
[lib/main/README.md](../main/README.md).

## Bridges outside `conveyor`

`lib/preload/preload.ts` exposes these as separate `contextBridge` globals. Each `on*`
returns an unsubscribe function: return it from the effect.

```ts
useEffect(() => window.utFavorites?.onGameClosed(() => refetchFavorites()), [])
```

| Global | What | Main side |
|---|---|---|
| `window.auth` | `login()`, `logout()`, `getProfile()` (desktop Discord OAuth) | `auth:login`, `auth:logout`, `auth:get-profile`: raw `ipcMain.handle` in `lib/main/main.ts`, no Zod |
| `window.logging` | `log/info/warn/error/debug(message, context?, data?)`, `getLogFilePath()`, `getRecentLogs(lines?)`; used by `useLogger` and `ErrorBoundary` | the `logMessage`, `getLogFilePath`, `getRecentLogs` channels |
| `window.utPatch` | `onPatchInstallStatus`, `onPatchInstallProgress`, `onInstallationPathUpdated`, `onAnnouncerInstallProgress`, `onAnnouncerInstallComplete` | `patch-install-*`, `installation-path-updated`, `announcer-install-*` |
| `window.utInstall` | `onIsoDownloadProgress` | `iso-download-progress` |
| `window.utProfile` | `onChanged`: profile refreshed | `profile-changed` |
| `window.utFavorites` | `onGameClosed`: game exited, re-read ini favorites | `favorites:game-closed` |
| `window.utbtUpdater` | `onStateChanged`: updater state push | `updater:state-changed` |
| `window.utStreamKit` | `onKitProgress`: `{ phase: 'downloading' \| 'extracting', done, total }` (`total` null without a content length) | `stream-kit:kit-progress` |
| `window.uiScale` | `set(factor)` / `get()`: zoom through `webFrame`, no IPC | none |

`utInstall.onProgress`, `onStatus`, `onConfirm` / `respondConfirm` and `utPatch.onStatus`
listen on channels (`ut-install-progress`, `ut-install-status`, `ut-install-confirm`,
`ut-patch-status`) that nothing in main sends; do not build on them.

To add a bridge, expose it in both branches of `preload.ts` (the `contextIsolated` branch
and the fallback that assigns `window.*` directly), and declare its type in
`app/index.d.ts`: unlike `window.conveyor`, these globals are typed by hand.
