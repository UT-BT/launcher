---
name: consume-api-data
description: >-
  Wire new data from the backend API into the launcher UI — add or extend a
  fetcher in app/utils/api.ts and render it. Use when a page/detail needs a
  field, list, or endpoint it doesn't fetch yet (e.g. "show X on the player
  page", "add a column backed by new data", "pull the new stat"). Launcher-side
  only: if the API doesn't expose the data yet, that change happens in the
  separate backend repo, out of scope here.
---

# Consume new API data

All HTTP goes through the helpers in `app/utils/api.ts`. Read `agents/api.md` first, plus the
`agents/features/*.md` doc for the area you are touching.

## 1. Confirm the API exposes it

Look at the existing fetcher's response type, or inspect a live response. If the field or
endpoint is already there, skip to step 3.

## 2. If the API does not expose it yet

Getting it added is a backend change, made in the separate private backend repo and out of
scope here; describe the needed field to the user and stop until the API returns it. Keep
launcher code and docs free of backend details, and keep the renderer from deriving the
missing value or calling an undocumented endpoint (hard rule: extend the API).

## 3. Add or extend the fetcher in `app/utils/api.ts`

- Put it in the right domain group; build query strings with the existing `build*Query`
  helpers (`buildMapQuery`, `buildWorldRecordsQuery`, `buildPlayerQuery`).
- Signature: `accessToken` first when the endpoint is authenticated, then params.
- Normalise the response at the fetch layer (`agents/api.md`: envelope and coercion helpers)
  and give it a named TypeScript type.

## 4. Render it

- Call the fetcher from the page or detail component. Primary pages keep rows in `caches`
  and gate the skeleton on `querySig` when server-paginated (`agents/state-patterns.md`).
- Render through the shared components: `PlayerInfo` for any player, `CapTimeLink` for any
  cap time, `DataTable.*` for tables (`agents/shared-components.md`).

## Verify

- `npm run typecheck:web`.
- `npm run dev`: the data loads, errors surface in the page's error banner, and a revisit
  uses the cache instead of refetching.
