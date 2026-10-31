---
name: doc-audit
description: >-
  Audit the agent docs against the code and run the confidentiality leak gate.
  Use when asked to audit or verify the docs, before a release, or after a large
  refactor. Everyday changes use `npm run docs:check` instead.
---

# Doc audit

Find every place the docs and the code disagree, and anything that leaks backend internals
into this public repo. Report first; apply fixes once the user agrees.

## 1. Mechanical check

Run `npm run docs:check` and fix its failures (missing paths, broken links, unlisted docs)
before reading any doc.

## 2. Leak gate

The list of private names to grep for lives outside this repo, in the private workspace
around it (its `CLAUDE.md` says where and how to run it). Run it over the whole repo: code
comments and UI strings leak as easily as docs. If you cannot find the list, ask the user for it; the names themselves
never go into this repo. Rewrite each hit as the client-side contract (endpoint path and
response shape) or remove it.

## 3. Drift check

For each doc in `agents/verify.json`, least recently changed first (`git log -1 -- <doc>`),
read the doc and then its listed sources, and check every statement that names a symbol,
path, route, storage key, constant or behaviour. Highest-value checks:

- `agents/styling.md`: the locked class strings vs `app/components/shared/DataTable.tsx` and
  `app/styles/globals.css`.
- `lib/conveyor/README.md`: namespaces and channel naming vs `lib/conveyor/api/index.ts` and
  `lib/conveyor/schemas/index.ts`.
- `agents/navigation.md` and `agents/state-patterns.md`: views, `*_STORAGE_KEY`s and
  `*_PREF_KEYS` vs `app/components/main/Main.tsx`; sidebar entries vs
  `app/components/navigation/nav-items.ts`.
- `agents/api.md` and `agents/features/*`: fetcher names, routes and payload rules vs
  `app/utils/api.ts` and the feature folders.
- `app/components/pages/settings/README.md`: `SettingsSectionId` and `BIND_CATEGORIES` vs the
  settings files.

Also flag code a doc describes that its `agents/verify.json` entry does not list.

## 4. Report

Per doc: each mismatch as documented vs actual (`file:line`) and the proposed fix. The audit is
done when every doc in `agents/verify.json` has a verdict: clean, or its mismatches listed.
