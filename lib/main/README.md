---
doc: main-process
read_when:
  - "adding or changing main-process logic (services, handlers, file/process/network access)"
  - "reading/writing files, the UT99 install, or UTBT.ini from main"
  - "opening external URLs, spawning the game, or persisting launcher config"
  - "deciding whether logic belongs in the renderer or the main process"
keywords: [main, services, handle, resolveWithin, path-safety, openExternalSafe, config, safeStorage, ini, gateway, spawn, CSP]
provides: "the main-process service map, the safety helpers, config storage, and the renderer/main boundary"
not_here:
  - "the IPC channel/api/handler pattern → lib/conveyor/README.md"
  - "renderer HTTP calls → agents/data-sources.md"
sections: [services, the-renderer-main-boundary, file-path-safety, opening-urls, config-storage, ini-access, window-security-csp]
last_verified: 2026-06-16
verify_against:
  - lib/main/app.ts
  - lib/main/config.ts
  - lib/main/path-safety.ts
  - lib/main/url-safety.ts
  - lib/conveyor/handlers/ini-handler.ts
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
| `updater-service` | Launcher auto-update (electron-updater), prerelease channel |
| `gateway-service` | HTTP client for the gateway host (avatars, patrons, server list) |
| `installation-service` | Install detection/validation, ISO download orchestration |
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
`getDemoWatcherConfig`, `getUpdaterConfig`, `getActiveProfile`, `getAuthConfig`.

**Secrets are encrypted at rest.** Auth access/refresh tokens go through Electron
`safeStorage` (`enc:` prefix) in `set/getAuthConfig`. Never log them or store
secrets in plaintext config fields.

## Ini access

`ini-handler.ts` has a custom INI parser/serializer (`parseIni` / `stringifyIni`)
that preserves UT99 section names exactly (it does not escape dots) and keeps
duplicate keys as arrays. All paths flow through `resolveWithin({install}/System,
path)`. The renderer uses these via `window.conveyor.ini.*`; the settings panels
are the main consumer (see `app/components/pages/settings/README.md`).

## Window security + CSP

`app.ts` injects a `Content-Security-Policy` on every response. `connect-src`,
`img-src`, and `media-src` pin the exact remote hosts the launcher may reach — a
new remote host (API, asset CDN) **won't load until it's added there**. Renderer
HTTP failing with a CSP error usually means the host is missing from this list.
