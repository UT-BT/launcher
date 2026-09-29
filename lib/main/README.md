---
doc: main-process
read_when:
  - "adding or changing main-process logic (services, handlers, file/process/network access)"
  - "reading/writing files, the UT99 install, or UTBT.ini from main"
  - "opening external URLs, spawning the game, or persisting launcher config"
  - "deciding whether logic belongs in the renderer or the main process"
keywords: [main, services, handle, resolveWithin, path-safety, openExternalSafe, config, safeStorage, ini, gateway, spawn, CSP, cam, koffi, stream-kit]
provides: "the main-process service map, the safety helpers, config storage, and the renderer/main boundary"
not_here:
  - "the IPC channel/api/handler pattern → lib/conveyor/README.md"
  - "renderer HTTP calls → agents/data-sources.md"
sections: [services, the-renderer-main-boundary, file-path-safety, opening-urls, config-storage, ini-access, stream-cams, stream-kit-extractor, window-security-csp]
last_verified: 2026-09-29
verify_against:
  - lib/main/app.ts
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
through Conveyor IPC (`lib/conveyor/README.md`). `createAppWindow()` in `app.ts`
is the entry point: it sets the CSP, creates the window, and registers every
handler.

## Services

Each service is a singleton module under `lib/main/`. Handlers (`lib/conveyor/
handlers/`) are thin and delegate to these.

| Service | Owns |
|---|---|
| `auth-service` | Discord OAuth (`auth:login/logout/get-profile`), token refresh |
| `game-service` | Launch/validate the UT99 install, detect running game |
| `demo-watcher-service` | Watch the demo folder, parse `.dem` headers, auto-upload per config |
| `patch-service` | Download + install the UTBT patch, version checks |
| `updater-service` | Stable launcher auto-updates (electron-updater) |
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
`getWindowBehavior` (minimize/close-to-tray + start-on-startup, applied by `tray-service`).

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
lineup and two server addresses (`CamRequest`).

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
- **Lifecycle.** Clients are spawned detached and tracked by PID. `launch`,
  `restart` and `stopAll` run one at a time through a single queue. All cams are
  killed on `will-quit`. `game-processes.ts` lets `gameService.isGameRunning()`
  ignore cam PIDs so cams don't fire game-closed or pause server refreshes.
- **Status.** `cam-log.ts` reads each cam's log incrementally and takes the
  server from the last network `LoadMap:` line (`Browse:` is ignored).
  `cam-window-match.ts` picks which top-level window of a PID to title.
- **Window titles** are set through `koffi` bindings to user32 in
  `cam-windows.ts` (`EnumWindows`, `SendMessageTimeoutW`, …), re-applied about
  every 2 s while a cam runs. koffi loads lazily via
  `createRequire(__filename)('koffi')`; a dynamic `import()` would stay native
  ESM in the CJS main bundle. If it fails to load the cams still run and
  `retitle.available` is false. Packaging: `electron-builder.yml` unpacks
  `node_modules/koffi/**` from the asar and strips its non-Windows binaries.

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

`connect-src` and `img-src` are each built twice, packaged vs dev, because dev talks to a
localhost API. Adding a host to only one of them produces the worst kind of bug: works in
`npm run dev`, silently blocked in the shipped build (or the reverse). Change both.

`img-src` also allows `data:` and `blob:` so the renderer can preview an image the user
just picked — `MapScreenshotModal` renders the chosen file from an object URL before
uploading it. Dropping either scheme leaves that preview blank with no network error.
