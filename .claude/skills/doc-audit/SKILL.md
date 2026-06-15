---
name: doc-audit
description: >-
  Maintenance check that the agent docs still match the code and leak no
  closed-source internals. Use when asked to audit/verify the docs, before a
  release, or after a large refactor — NOT during normal feature work. Diffs each
  doc's verify_against source files against the documented contract and runs the
  confidentiality leak gate.
---

# Doc audit

A periodic drift + confidentiality check. Report findings; don't silently
rewrite — fix with the change author's sign-off and bump `last_verified`.

## 1. Leak gate (must pass)

This repo is public. Grep all markdown for closed-source internals:

```
DataService|Nebula|Paul-Discord|UTBT_FrontEnd|Flask|SQLAlchemy|RabbitMQ|Python|
model\.py|data_service|@handle_response|C:\\Development|MapReview\.json
```

Any hit is a leak — generalize it to the client-side contract (endpoint URL +
response shape only) or remove it. `verify_against` paths must all be inside this
repo.

## 2. Drift check (per doc)

Read `agents/_map.md` for the doc list. For each doc, read its frontmatter
`verify_against` files and confirm the documented contract still holds. High-value
checks:

- **styling** — the locked class strings vs `app/components/shared/DataTable.tsx`
  + `app/styles/globals.css`.
- **conveyor-ipc** — the channel inventory vs `lib/conveyor/api/index.ts` +
  `schemas/index.ts`; every namespace/method present and named correctly.
- **navigation** + **state-patterns** — the views, `*_STORAGE_KEY`s, and
  `*_PREF_KEYS` vs `app/components/main/Main.tsx`; the renderView cases and
  `navSections` vs `AppLayout.tsx`.
- **data-sources** — the helper list vs `app/utils/api.ts`.
- **settings** — `SettingsSectionId` + `BIND_CATEGORIES` vs the settings files.

## 3. Report

List each stale/leaking doc with the specific mismatch (documented vs actual) and
the fix. After fixes are applied, bump each touched doc's `last_verified` and
update `agents/_map.md` if a doc was added/removed/renamed.
