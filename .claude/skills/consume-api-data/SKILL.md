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

All HTTP lives in `app/utils/api.ts` — never raw `fetch` in a component. Read
`agents/data-sources.md` first.

## 1. Confirm the API exposes it

Check whether the field/endpoint already exists — look at the existing fetcher's
response type, or inspect a live response. If it's already there, skip to step 3.

## 2. If the API does NOT expose it yet

Getting the field added is a **backend change made in the separate (private)
backend repo — out of scope for this repo, and no backend details belong in
launcher code or docs.** Don't work around a missing field by deriving it
client-side or hand-rolling a request to an undocumented endpoint (that's the
hard rule: extend the API, don't hack the renderer). Coordinate the backend
change separately; once the API returns the field, continue.

## 3. Add / extend the fetcher in `app/utils/api.ts`

- Put it in the right domain group; reuse the existing `build*Query` helpers for
  query strings (`buildMapQuery`, `buildWorldRecordsQuery`, `buildPlayerQuery`).
- Signature: `accessToken` first when the endpoint is authenticated, then params.
- Unwrap the `{ success, data }` envelope (the existing helpers do this) and give
  the response a named TypeScript type.

## 4. Render it

- Call the fetcher from the page/detail component. For primary pages, store rows
  in `caches` and gate the skeleton on `querySig` if it's server-paginated
  (`agents/state-patterns.md`).
- Render through shared components — `PlayerInfo` for any player, `CapTimeLink`
  for any cap time, `DataTable.*` for tables (`agents/shared-components.md`).

## Verify

- `npx tsc --noEmit -p tsconfig.web.json`.
- `npm run dev`: the data loads, errors surface in the page's error banner, and a
  revisit uses the cache instead of refetching.
