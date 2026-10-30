# Admin → Map Uploads

Staff add a map by uploading the mapper's archive. The server unpacks it, checks every
file, and keeps the result as a **draft** until someone publishes or discards it; a
publish then installs the files on every host and makes the map live. This doc is the
client contract: routes, shapes, error codes, states, polling, the draft form and
publishing. Read it before touching `app/components/pages/admin/sections/mapUploads/` or a
map-upload function in `app/utils/api.ts`. The rest of the admin dashboard:
[admin.md](admin.md).

## Where the code lives

Paths starting `mapUploads/` are under `app/components/pages/admin/sections/`.

| Path | Holds |
|---|---|
| `mapUploads/MapUploadsSection.tsx`, `handover.ts`, `useMapUploadsNav.ts` | the shell: tabs, the open draft and publish, the props it hands down |
| `mapUploads/*.tsx` | the screens: upload panel, draft list, report, checks, form, screenshot, publishing list and detail, drift |
| `mapUploads/*.ts` (not hooks) | pure rules, each with a `.test.ts`: `uploadState`, `draftFormState`, `reportView`, `reportLabels`, `publishState`, `publishLabels`, `driftView`. New rules go here, not in a component |
| `mapUploads/useArchiveUpload.ts`, `usePollWhile.ts` | the archive upload with abort; every poll ([Polling](#polling)) |
| `app/utils/api.ts`, `app/utils/mapUploadTypes.ts` | the map-upload fetchers (`uploadMapArchive` through `fetchMapUploadDrift`); the shapes and `MAP_UPLOAD_ERROR_CODES` |
| `app/utils/fixtures/mapUploads/`, `app/utils/fixtures/mapUploadFixtures.ts` | API payload fixtures and their loader ([Tests](#tests)) |
| `app/components/modals/MapScreenshotModal.tsx`, `mapScreenshotCrop.ts` | the screenshot crop the draft shares with Maps Management |
| `app/components/pages/admin/components/AuthorPicker.tsx`, `TagEditor.tsx` | form pieces the draft shares with Maps Management |

## Access and wiring

- Moderators and Admins (`ADMIN_DASHBOARD_ROLES`). A Cup Admin does not see the section and
  the API refuses them. Every route takes the staff bearer `userProfile.accessToken`.
- Section id `map-uploads` (Game Content group). It is the only way to add a map: **Add
  Map** in Maps Management calls `openDraft(null)` from `useMapUploadsNav`, then
  `onNavigate('map-uploads')`. The Maps form only edits.
- `useMapUploadsNav` keeps the shell's state per navigation entry with `useNavState`
  (keys `admin.mapUploads.tab`, `.draftId`, `.publishId`, `.uploadedIds`), so Back and
  Forward restore the open tab, draft, selected publish and map-pack list. A section switch
  pushes no history entry, which is why Maps Management can write the state the section then
  reads. Per-entry state: [state-patterns.md](../state-patterns.md).
- Tabs: **Drafts**, **Publishing / Recent**, **Drift**. The shell (`MapUploadsSection.tsx`)
  owns the open tab, draft and publish; the props it hands the draft form and the other
  tabs are typed in `handover.ts`. `onPublished` is the shell's `openPublish`: it switches
  to Publishing / Recent with that publish selected.

## Routes

All under `/admin/map-uploads`; functions in `app/utils/api.ts`.

| Route | Function | Answer |
|---|---|---|
| `POST /admin/map-uploads`, multipart field `archive` | `uploadMapArchive(token, archive, filename, { signal, onProgress })` | 201 `{ draft_ids }`, one id per map in the archive |
| `GET /drafts` | `fetchMapUploadDrafts` | `DraftSummary[]`, newest first, every staff member's drafts |
| `GET /drafts/<id>` | `fetchMapUploadDraft` | `Draft` |
| `DELETE /drafts/<id>` | `discardMapUploadDraft` | `{ deleted: true }` |
| `PATCH /drafts/<id>`, JSON body `MapUploadDraftPatch` | `patchMapUploadDraft` | `Draft` |
| `PUT /drafts/<id>/screenshot`, multipart field `file` | `uploadMapUploadScreenshot` | `Draft` |
| `POST /drafts/<id>/screenshot/embedded` | `selectEmbeddedMapUploadScreenshot` | `Draft` |
| `DELETE /drafts/<id>/screenshot` | `removeMapUploadScreenshot` | `Draft` |
| `GET /drafts/<id>/screenshot?source=staged\|embedded` | `fetchMapUploadScreenshot` | the PNG as a `Blob`; `null` on 404 |
| `POST /drafts/<id>/publish` | `publishMapUploadDraft` | 202 `{ publish_id }` → `{ kind: 'started', publishId }`; 409 `draft_invalid` with the re-checked draft in `data` → `{ kind: 'invalid', draft }` |
| `GET /publishes?limit=20` | `fetchMapUploadPublishes` (`MAP_UPLOAD_PUBLISHES_LIMIT`) | `PublishSummary[]`, newest first |
| `GET /publishes/<id>` | `fetchMapUploadPublish` | `Publish` |
| `POST /publishes/<id>/force-activate`, body `{ confirm_hosts: string[] }` | `forceActivateMapUploadPublish` | the activated `Publish` |
| `GET /drift` | `fetchMapUploadDrift` | `DriftRow[]` |

Answers use the usual `{ success, data }` envelope ([api.md](../api.md)). An empty list
comes back as `{ "success": true }` with no `data`, which `apiGetList` reads as `[]`. Error
bodies are `{ success: false, error, code, data? }`: `code` arrives as `ApiError.reason`.
The archive and screenshot uploads go through `apiUpload` (real byte progress, no timeout).

## Shapes

Types: `app/utils/mapUploadTypes.ts`, with every code list as an `as const` array. One
real response per route sits in `app/utils/fixtures/mapUploads/` (loaded through
`mapUploadFixtures.ts`). The fixtures are byte-for-byte what the API sends and their
sha256 is pinned by `mapUploadFixtures.test.ts`: never reformat them.

- Timestamps are ISO 8601 with a `+00:00` offset.
- People (`created_by`, `submitter`, `activated_by`) are `{ alias, id }` with a **string**
  id. Render them with `PlayerInfo`.
- **Draft status**: `analyzing` → `ready` or `invalid`, then `published`. A draft expires 14
  days after creation unless it has a publish (`publish_id` set); that one never expires and
  stays until discarded (`DraftExpiry`).
- **Files** (`DraftFile`): `kind` is `map`, `texture`, `sound`, `music`, `code`, `companion`
  (`.int`) or `other`. `disposition` is `install`, `skip-identical`, `keep-existing` or
  `dropped`. A dropped file has a `reason_code`; `skip-identical` and `keep-existing` have a
  `reason` only; an install usually has neither.
- **Blocks** stop publishing: `{ code, message, package, hosts, objects }`. `package` is
  `null` for a block about the map itself; `hosts` are host names as the API returns them;
  `objects` lists missing objects. **Warnings** (`{ code, message }`) do not stop publishing.
- **Publish state**: `validating` → `storing` → `compressing` → `registering` →
  `distributing` → `active`, or `failed` from any step, with the reason in `error`.
  `activation` is `auto` or `forced`. `version` is `{ old_map, mode }`, both `null` for a
  new map. `force_available_at` may be `null` before the hosts are asked.
- **Publish hosts**: `{ host, state, detail, updated_at }`. `host` is the name the API
  returns; the launcher knows nothing else about a host. `state` is `pending`, `installed`,
  `conflict` (the host holds a different copy of a package) or `error` (it could not install
  a file); `detail` says what is wrong, or is `null`.
- **Drift** (`DriftRow`): `{ file, locations }`. A location's `location` is `redirect` (the
  download server players fetch from) or a host name; its `state` is `present`, `conflict`
  or `error`.

Show the server's `message`, `reason` and `detail` as they are. `reportLabels.ts` and
`publishLabels.ts` add a plain label per status, kind, disposition and code; each table is a
`Record` over the full code list, so a new code fails the typecheck until it has words.

## Errors

`mapUploadErrorMessage(error)` turns any failure into one sentence for staff:

| Error | Message |
|---|---|
| `AbortError` (`isAbortError`) | The upload was cancelled |
| 413 with a JSON `error` (too many entries, expands too far) | The server's message |
| 413 without one (often not JSON) | Over the `MAP_ARCHIVE_MAX_LABEL` (1 GB) upload limit |
| 422 `no_map` / `bad_archive` | No `.unr` in the archive / the archive could not be opened |
| 409 `draft_invalid`, `too_early`, `stragglers_changed`, `not_distributing` | One plain message each (publish and force-activate) |
| 404 | The draft no longer exists (discarded or expired) |
| anything else | The error's message, or a generic retry line |

## Upload

- `archiveProblem` refuses, before sending: a name not ending in `.zip`, `.rar` or `.7z`
  (`ARCHIVE_ACCEPT`), an empty file, or one over `MAP_ARCHIVE_MAX_BYTES` (1 GiB).
- `uploadReducer` states: `idle` → `uploading` (`loaded`, `total`) → `done` (draft ids) or
  `error` (message). `total` is the file size until the browser reports one. Cancel aborts
  the request and returns to `idle`; the `AbortError` that follows is ignored. A new file is
  accepted from `idle`, `done` or `error`, never over a running upload.
- `uploadOutcome`: one draft opens its report; several (a map pack) list as buttons above
  the drafts table until dismissed (`uploadedIds`).
- `useArchiveUpload` lives in the section shell: switching tabs keeps the upload running,
  leaving the section aborts it.

## Drafts and the report

- The list keeps the API's order (newest first) and polls while any draft is `analyzing`.
- **Discard** asks first (`DiscardDraftDialog`, shared by the list and the report) and works
  on every draft. Without a publish the draft is deleted with its files. With a publish it
  leaves the list and its files are deleted, but the server keeps it with its publish
  history.
- An open draft that answers 404 (someone else discarded it) is dropped from the report with
  the message, and polling stops.
- The report is a container (`@container/draft`), so its layout follows its own width, not
  the window's. From `@5xl/draft` (64rem) it has two columns with the Publish panel sticky at
  the top right; below that it is one column and the Publish panel is a bar stuck to the
  bottom of the view.
- **Hero**: the staged screenshot, name, status, archive, uploader, expiry, Discard, and View
  publish once published.
- **Checks** (`DraftChecks`): blocks, then warnings. Up to 6 missing objects show inline;
  more collapse into a list grouped by `groupObjects`, with Copy all. A finding a form field
  fixes gets **Fix** (block) or **Review** (warning), which scrolls to that field through
  `blockField` / `warningField` and `scrollToDraftField`.
- **Files** (`DraftFiles`): ordered by `sortFiles` (the map first, then install, already
  there, keep ours, dropped, then by name), with a count per outcome and the bytes to install.

## Draft form

`DraftWorkspace` (`DraftForm.tsx`) wraps the report's Checks and Files panels. A draft that
is not published gets the **Map details** panel under them and the **Publish** panel beside
them; a published draft gets no form, only a Published card linking to its publish. Each
form section has an id from `draftFieldId(draft.id, field)`, the target of Fix, Review and
the publish checklist.

**Autosave** (`createDraftAutosave` in `draftFormState.ts`):

- Each change sends a `PATCH` with only the fields that changed (`draftPatch`), and the
  report shows the `Draft` that comes back, so blocks and warnings are always the server's.
- Text fields (free-text author, changelog) wait `TEXT_DEBOUNCE_MS` (600 ms) after the last
  key; everything else saves at once. One save runs at a time; edits made meanwhile go in
  the next one.
- `sync(draft)` re-reads the form values from a new `Draft` only while no edit is waiting
  or saving, so server prefills land without overwriting typing.
- `flush()` sends any waiting edit and rejects if that save fails. `dispose()` still sends
  a waiting edit, so leaving the draft never drops typing.

| Field | Rules | Sent as |
|---|---|---|
| Map name | Shown only while a name block (`nameBlocks`) is present, prefilled with `suggestMapName`. **Rename** stays off while `hasMapTitle` is false (no letter after the `CTF-BT-` prefix) | `map_name` in its own `PATCH` after a flush; the server re-runs the checks, so the draft goes back to `analyzing` |
| Author (required) | `AuthorPicker` with its mode toggle in the label row. Player mode is the default; Name mode shows when the draft stores a free-text author (`formValuesFromDraft`). Player mode sends nothing until a player is picked. While no author is set (`hasAuthor`), a re-read keeps the chosen mode unless the server's author changed (a version prefill) | `author_str` with `author_ref: null`, or `author_ref` with `author_str: null` |
| Tags (optional) | `TagEditor`, suggestions from `fetchAdminMapTags` | `tags` |
| Difficulty (required) | 1–10 | `difficulty` |
| Required players (required) | 1–12, prefilled by the server; a value other than `metadata.required_players_suggested` shows a note | `required_players` |
| Changelog (optional) | Text | `changelog` |
| Version | A switch, the old map, the mode. Turning the switch off clears both | `version_target`, `version_mode` |
| Code package | "I reviewed the code in this archive", shown when `hasCodePackage` (a `code_package` warning or `code_package_unacknowledged` block) | `acknowledgements: { code_package }` |

The server enforces the required fields: no author, no difficulty and an empty name are
the `author_missing`, `difficulty_missing` and `name_empty` blocks.

`suggestMapName` normalises the prefix: `ctf-bt-Foo`, `Foo`, `CTF-BTFoo`, `CTF-Foo`,
`BT-Foo` and `ctf_bt_Foo` all become `CTF-BT-Foo`. The field stays editable.

**Screenshot** (`DraftScreenshot.tsx`). The staged image is fetched with the staff bearer
(`fetchMapUploadScreenshot(…, 'staged')`) and shown through an object URL, because an
`<img>` cannot send the token. `useStagedScreenshot` loads it once for the hero and the form;
a change bumps a revision that reloads it. Upload or Replace opens `MapScreenshotModal` in
callback mode and sends the square crop. **Use the map's own** appears when
`screenshot.embedded_available` and another source is staged. With no screenshot the report
carries the `no_screenshot` warning and Publish asks for confirmation.

**New version** (`VersionTargetPicker`). The server's `version.candidates` come first as
one-click suggestions, then `MapSearchInput` searches active maps. The modes:

- `update`: records, team records, playtime, reviews and favourites move to the new map; the
  old map is retired.
- `rework-retire`: the old map is retired with its records; the new one starts clean.
- `rework-keep-both`: both stay votable, each with its own records.

Setting the old map makes the server prefill difficulty, tags, author, required players and
the screenshot; `sync` brings them into the form. The `event_pool` warning and the
`version_target_invalid` / `version_target_has_successor` blocks show with the report's
other findings.

## Publish

- `publishGate(draft)` enables the button only when the draft is `ready` with no blocks,
  its code package (if any) is acknowledged, and it has a mode whenever it has an old map.
  `reason` says what is missing.
- The Publish panel shows a headline and, in the two-column layout, the checklist from
  `readinessItems(draft, values)`: author, difficulty and required players first (from the
  live form values), then the remaining blocks (not counting `author_missing` and
  `difficulty_missing` again), warnings, code review, new map or the one it replaces, and
  the optional screenshot. Each item scrolls to its field. As a bottom bar it shows the
  first item still to do, or the gate's reason.
- Pressing Publish first `flush`es, then re-checks the gate on the saved draft
  (`publishNextStep`: `blocked`, `confirm-no-screenshot` or `publish`). A failed flush
  publishes nothing and shows the error.
- 202: `onPublished(publishId)`. 409 `draft_invalid`: the report shows the re-checked `Draft`
  from the response with `DRAFT_CHANGED_MESSAGE` (`publishOutcome`). Anything else: the
  `mapUploadErrorMessage` line.

## Publishing / Recent

- The selected publish (`publishId` from the shell, or a row clicked in the list) shows above
  the recent list, with **Close** and **Open draft**. The list keeps the API's order.
- The publish view (`PublishDetail`, `@container/publish`) shows its state, start time, the
  map it replaces and how, the step tracker (`publishSteps`), the status line, Force live,
  and the Hosts panel (`hostProgress`, one card per host; conflict and error tinted red).
- A failed publish has no step tracker, because the API does not say where it stopped; it
  shows its `error`.
- A publish that answers 404 shows "This publish no longer exists." (`publishErrorMessage`)
  and stops polling.

## Force live

The rules are in `publishState.ts`:

- **Stragglers** (`publishStragglers`): every host not `installed`, in the API's order.
- **Availability** (`forceAvailability(publish, now)`): `closed` unless the publish is
  `distributing` with at least one straggler; `waiting` before `force_available_at` (or while
  it is `null`); `available` from then on. The server sets that time 15 minutes after the
  hosts were asked. The panel re-renders at that moment.
- **Confirmation** (`forceConfirmation`): a snapshot of the stragglers taken when the dialog
  opens. The dialog lists them, and confirming sends exactly those names as `confirm_hosts`,
  even if a poll changes the publish behind the dialog. The dialog hides once a poll shows
  the publish is no longer `distributing`.
- **Success** answers the activated `Publish` (`activation: "forced"`), which replaces the one
  on screen; the list is re-read.
- **Errors** are 409s, handled by `forceActivateFailure`. The launcher re-reads the publish
  after each:

  | Code | Meaning | Launcher |
  |---|---|---|
  | `too_early` | `force_available_at` has not passed on the server | Closes the dialog, shows the message |
  | `stragglers_changed` | `confirm_hosts` is not exactly the current stragglers | If force is still available, asks again with the new list and the message in the dialog; otherwise closes quietly |
  | `not_distributing` | The publish went live or failed meanwhile | Closes the dialog, shows the message |

## Polling

Everything polls through `usePollWhile`, which wraps `createPoller`
([state-patterns.md](../state-patterns.md)) at `ANALYSIS_POLL_MS` (3 s) and pauses while the
page is hidden:

- an open draft while it is `analyzing`; the drafts list while any draft is `analyzing`;
- the selected publish while `shouldPollPublish` holds: until `active` or `failed`, including
  after a failed first read, but never after a 404;
- the publishes list while any listed publish is unsettled.

## Drift

A read-only table of packages whose copies differ between locations: the file, then one row
per location with its state, short sha256 (`shortSha`, full value on hover), size and last
seen. Rows not `present` are tinted red. `filterDriftRows` matches part of the file name,
ignoring case. No actions; the report is read once when the tab opens.

## Tests

API functions against the fixtures: `app/utils/api.mapUploads.test.ts`,
`api.mapUploadDraftForm.test.ts`, `api.mapPublishes.test.ts`. Pure modules: the `*.test.ts`
files in `mapUploads/`. Fixture integrity: `app/utils/fixtures/mapUploadFixtures.test.ts`.
Section visibility: `app/components/pages/admin/registry.test.ts`.
