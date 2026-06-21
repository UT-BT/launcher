---
doc: auth
read_when:
  - "anything touching login / logout / the signed-in user profile"
  - "reading or passing the Discord access token to the API"
  - "the splash → login → main gating in app.tsx"
keywords: [auth, login, logout, discord, oauth, pkce, token, accessToken, refreshToken, safeStorage, getProfile, window.auth]
provides: "the client-side Discord OAuth login flow end-to-end: the auth-service token handling, encrypted token storage, the auth:* IPC bridge, and how the renderer gates on / consumes the profile"
not_here:
  - "the API endpoints the access token is sent to → agents/data-sources.md"
  - "generic renderer↔main IPC pattern (Conveyor) → lib/conveyor/README.md (auth is a SEPARATE window.auth bridge, not Conveyor)"
  - "how the backend validates the Bearer token → out of scope; this repo is public"
sections: [flow, the-auth-bridge, token-storage, refresh, renderer-gating, consuming-the-token, hard-rules]
last_verified: 2026-06-21
verify_against:
  - lib/main/auth-service.ts
  - lib/main/config.ts
  - lib/main/main.ts
  - lib/preload/preload.ts
  - app/index.d.ts
  - app/app.tsx
  - app/components/pages/LoginPage.tsx
  - app/components/layout/AppLayout.tsx
---

# Auth — Discord OAuth login

The launcher authenticates the user against **Discord** directly (OAuth2 with
PKCE), in the main process. There is no launcher-owned login form: the user is
sent to `discord.com` in their system browser, and the resulting Discord
**access token** becomes the `Authorization: Bearer` token for every API call.

`AuthService` (`lib/main/auth-service.ts`) is a singleton (`authService`) that
owns the whole flow. The renderer only ever sees `window.auth` — three methods,
no token plumbing.

## Flow (one login)

1. Renderer (`LoginPage.tsx → handleLogin`) calls `window.auth.login()`.
2. `AuthService.login()` starts a one-shot loopback HTTP server on
   `127.0.0.1:54321` and `shell.openExternal(...)` to the Discord authorize URL
   (`response_type=code`, `scope=identify`, `code_challenge_method=S256`).
3. PKCE: `generatePKCE()` makes a `randomBytes(32)` base64url **verifier** and a
   SHA-256 base64url **challenge**. Only the challenge goes to Discord.
4. Discord redirects to `http://127.0.0.1:54321/callback?code=...`. The server's
   `/callback` handler serves a "Login Successful" page (with `window.close()`),
   shuts the server down, and re-focuses the app window.
5. `exchangeCodeForToken(code, verifier, redirectUri)` POSTs to
   `https://discord.com/api/oauth2/token` with the verifier → `{ access_token,
   refresh_token, expires_in }`.
6. `fetchUserProfile(access_token)` GETs `https://discord.com/api/users/@me` →
   `{ id, username, avatar }`.
7. An `AuthConfig` is built and persisted via `setAuthConfig(...)` (see
   [Token storage](#token-storage)); the promise resolves with the renderer-safe
   profile.

`error` in the callback (or a token/profile failure) rejects the `login()`
promise; `LoginPage` shows a generic error and also fails the flow on a timeout.

## The `auth:*` bridge

Auth does **not** go through Conveyor. It is its own context-bridge:

- Main (`lib/main/main.ts`): `ipcMain.handle('auth:login' | 'auth:logout' |
  'auth:get-profile', ...)` → `authService.login/logout/getProfile`.
- Preload (`lib/preload/preload.ts`): `contextBridge.exposeInMainWorld('auth',
  { login, logout, getProfile })`, each an `ipcRenderer.invoke('auth:...')`.
- Types (`app/index.d.ts`): `window.auth` is `{ login(): Promise<AuthConfig>;
  logout(): Promise<void>; getProfile(): Promise<AuthConfig | undefined> }`.

So in the renderer always call `window.auth.login()` / `.logout()` /
`.getProfile()` — never reach for a Conveyor channel.

## Token storage

`AuthConfig` (`lib/main/config.ts`):

```ts
type AuthConfig = {
  discordId: string
  username: string
  avatar: string
  accessToken: string
  refreshToken: string
  expiresAt: number   // epoch ms
}
```

It lives under the `auth` key of the launcher config file. `accessToken` and
`refreshToken` are **encrypted at rest** with Electron `safeStorage` (OS-backed):
`setAuthConfig` encrypts both fields, `getAuthConfig` decrypts them on read. The
encrypted form is tagged with an `ENC_PREFIX`; if `safeStorage.isEncryptionAvailable()`
is false the secret decrypts to `''`. `clearAuthConfig` (used by `logout`) drops
the whole `auth` key.

**`refreshToken` never crosses the IPC boundary.** `toRendererProfile()` in
`auth-service.ts` blanks `refreshToken` to `''` before any value is returned to
the renderer, so `window.auth.*` profiles carry only `accessToken`.

## Refresh

`getProfile()` is the read path *and* the refresh path. If now is within 5
minutes of `expiresAt`, it calls `performRefresh()` →
`refreshAccessToken(refreshToken)` (POST `grant_type=refresh_token` to Discord),
persists the new tokens with `setAuthConfig`, and returns the refreshed profile.
A single in-flight refresh is de-duped via `refreshPromise`. If refresh throws,
it logs and returns the still-stored (possibly stale) profile rather than logging
the user out.

## Renderer gating

`app/app.tsx` drives a `'splash' | 'login' | 'main'` phase machine:

- `preloadData()` calls `window.auth.getProfile()`. `undefined` → `'loggedout'`
  → phase `login`. A profile → it fans out `fetchUserProfile(accessToken)` +
  `fetchLatestActivity(accessToken)` (API calls, see `agents/data-sources.md`),
  merges into a `UserProfile`, and goes to phase `main`.
- `LoginPage` (`onLoginSuccess` → `handleLoginSuccess`) re-runs `preloadData()`
  after a successful `window.auth.login()`.
- Logout: `AppLayout.tsx` confirm modal calls
  `window.auth.logout().then(() => window.location.reload())` — a full reload,
  which re-enters at the splash/preload and lands on `login`.

## Consuming the token

The `accessToken` from the profile is the API auth token. API fetchers in
`app/utils/api.ts` take it as a `token` arg and send `Authorization: Bearer
<accessToken>` (e.g. `fetchUserProfile`, `fetchLatestActivity`, `fetchMaps`,
`uploadDemo`). Pass the token down from `userProfile.accessToken`; do not read
config or call `getProfile()` from inside data fetchers.

## Hard rules

1. **Renderer talks to auth only via `window.auth`.** Never invoke `auth:*`
   channels directly and never add auth to Conveyor — it is a deliberate
   standalone bridge.
2. **Never return `refreshToken` to the renderer.** Anything leaving
   `AuthService` for the UI must go through `toRendererProfile()`.
3. **Secrets are `safeStorage`-encrypted.** Persist tokens only via
   `setAuthConfig` / clear via `clearAuthConfig`; don't write the `auth` config
   key by hand or store a plaintext token anywhere.
4. **Refresh through `getProfile()`.** Treat it as the single source of a fresh
   token; don't hit Discord's token endpoint from elsewhere.
5. **Gate on phase, not on a raw token.** New screens key off `app.tsx`'s
   `appPhase` / `userProfile`, not their own `getProfile()` checks.
