# Doc map

Manifest of every agent-facing doc. Two jobs:

1. **"Is there a doc for X?"** — scan the table.
2. **"Did my code change invalidate a doc?"** — after editing, grep your changed
   paths against the `verify_against` column; update any doc that matches and bump
   its `last_verified`.

The always-loaded router lives in `/CLAUDE.md`. These docs are pull-on-demand:
open the ONE the router points to, not the whole set.

## Reference docs

| Doc | Path | Provides | verify_against |
|---|---|---|---|
| build | `agents/build.md` | dev/build/lint/typecheck commands + pre-commit gate | `package.json`, `tsconfig.web.json` |
| styling | `agents/styling.md` | locked design tokens + canonical class strings + animation and reduced motion | `app/components/shared/DataTable.tsx`, `app/styles/{globals,index,desktop}.css`, `lib/utils.ts`, `app/hooks/{useElementWidth,usePrefersReducedMotion}.ts` |
| shared-components | `agents/shared-components.md` | inventory of reusable components + when to use each + the pick/ban visual core and its motion + the copy-link hook | `app/components/shared/{PlayerInfo,DataTable,CapTimeLink,MapNavLink,MapNameCell,ColumnsMenu,FilterPresetsMenu}.tsx`, `app/components/pages/events/pickban/components/*`, `app/components/pages/events/pickban/usePickBanPreload.ts`, `app/hooks/{useCopyFeedback,usePrefersReducedMotion}.ts` |
| state-patterns | `agents/state-patterns.md` | three state tiers + localStorage convention + controlled pages + polling live data | `app/components/main/Main.tsx`, `app/components/navigation/useNavState.ts`, `app/hooks/useAsync.ts`, `app/utils/userState.ts`, `app/utils/poller.ts`, `app/components/pages/events/pickban/{pickBanSession,usePickBanSession,mergePickBanState,captainPlay,useCaptainPlay}.ts` |
| navigation | `agents/navigation.md` | nav stack, `navigate()` funnel, renderView, sidebar, `open-*` events, web URL sync, `NavLink` link semantics + shareable match links + the match pick/ban page | `app/components/main/Main.tsx`, `app/components/layout/AppLayout.tsx`, `app/components/navigation/{NavLink,NavigationContext}.tsx`, `app/components/navigation/{useNavState,useUnsavedChanges,routes,useUrlSync,useDocumentMeta,titles,matchLinks}.ts`, `app/public/route-contract.json`, `app/components/pages/{EventDetailPage,MatchPickBanPage}.tsx` |
| data-sources | `agents/data-sources.md` | client-side API contract + asset URLs + favorites/patreon sync + the event bracket/format/scheduling contract + the pick/ban state, commands and view model + the manager match queue + the per-stage pick/ban setup editor | `app/utils/api.ts`, `app/utils/chartBuckets.ts`, `app/components/pages/admin/components/controls.tsx`, `app/components/pages/admin/sections/HostsManagementSection.tsx`, `app/utils/patreon.ts`, `app/utils/server-utils.ts`, `app/hooks/useServerFavorites.ts`, `app/components/pages/events/manage/formatFields.tsx`, `app/components/pages/events/bracket/bracketShared.tsx`, `app/components/pages/events/bracket/BracketTab.tsx`, `app/components/pages/events/predictions/predictionsShared.tsx`, `app/components/pages/events/predictions/PredictionsTab.tsx`, `app/components/pages/events/schedule/scheduleShared.tsx`, `app/components/pages/events/schedule/ScheduleTab.tsx`, `app/components/pages/events/schedule/SlotPickerModal.tsx`, `app/components/pages/events/schedule/slotGeneration.ts`, `app/components/pages/events/schedule/SlotGrid.tsx`, `app/components/pages/events/manage/DateTimeField.tsx`, `app/components/pages/events/eventsShared.tsx`, `app/components/pages/EventDetailPage.tsx`, `app/utils/timezone.ts`, `app/components/pages/events/manage/ScheduleOversightPanel.tsx`, `app/components/pages/events/ManagePanel.tsx`, `app/components/main/Main.tsx`, `app/components/layout/AppLayout.tsx`, `app/components/pages/events/maps/MapsTab.tsx`, `app/components/pages/events/maps/mapsShared.ts`, `app/components/pages/events/pickban/pickBanView.ts`, `app/components/pages/events/pickban/pickBanStatus.ts`, `app/components/pages/events/pickban/pickBanSession.ts`, `app/components/pages/events/pickban/clockOffset.ts`, `app/components/pages/events/manage/pickban/pickBanEditor.ts`, `app/components/pages/events/manage/pickban/PickBanPanel.tsx`, `app/components/pages/events/manage/pickban/PickBanStageCard.tsx`, `app/components/pages/events/manage/pickban/PickBanQueuePanel.tsx`, `app/components/pages/events/manage/pickban/pickBanQueue.ts`, `app/components/pages/events/pickBanTags.ts`, `app/components/navigation/matchLinks.ts`, `app/utils/poller.ts` |
| web-target | `agents/web-target.md` | web build target: platform layer, capability gates, web build commands | `app/platform/*.ts`, `app/components/navigation/NavLink.tsx`, `app/renderer-web.tsx`, `vite.entry.ts`, `vite.config.web.ts`, `app/components/main/pageLoaders.ts`, `scripts/check-web-bundle.mjs` |
| conveyor-ipc | `lib/conveyor/README.md` | renderer↔main IPC contract + channel inventory + event bridges | `lib/conveyor/api/index.ts`, `lib/conveyor/schemas/index.ts`, `lib/main/app.ts`, `lib/preload/preload.ts` |
| main-process | `lib/main/README.md` | main-process service map + safety helpers + config + boundary | `lib/main/app.ts`, `lib/main/config.ts`, `lib/main/path-safety.ts`, `lib/main/url-safety.ts`, `lib/conveyor/handlers/ini-handler.ts` |
| settings | `app/components/pages/settings/README.md` | settings sections + ini flow + constants reference | `app/components/pages/settings/SettingsLayout.tsx`, `constants.ts`, `SettingsComponents.tsx` |

## Skills (`.claude/skills/`, model-invoked procedures)

| Skill | Use when |
|---|---|
| `add-data-page` | adding a new primary sidebar page |
| `add-table-column` | adding/modifying a sortable or toggleable DataTable column |
| `add-ipc-channel` | adding a renderer↔main IPC channel |
| `consume-api-data` | wiring new data from the API into the UI |
| `doc-audit` | (maintenance) diff every doc against its `verify_against` files |

## Confidentiality

This repo is public. Docs cover the launcher only — never backend repo names,
paths, tech stack, internal architecture, or "how to change the backend." Every
`verify_against` path must be inside this repo.
