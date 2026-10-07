---
doc: admin-map-uploads
read_when:
  - "working on Admin → Map Uploads: uploading an archive, the drafts list, the draft report, the draft form, publishing or drift"
  - "calling a /admin/map-uploads route or changing a map-upload function in app/utils/api.ts"
  - "changing the Add Map button in Admin → Maps Management"
keywords: [map uploads, Map Uploads, Add Map, draft, DraftSummary, Draft, archive, zip, rar, 7z, uploadMapArchive, fetchMapUploadDrafts, fetchMapUploadDraft, discardMapUploadDraft, mapUploadErrorMessage, patchMapUploadDraft, MapUploadDraftPatch, uploadMapUploadScreenshot, selectEmbeddedMapUploadScreenshot, removeMapUploadScreenshot, fetchMapUploadScreenshot, publishMapUploadDraft, PublishDraftResult, draftFormState, createDraftAutosave, publishGate, suggestMapName, draft_invalid, rename, version target, version mode, code package, MAP_ARCHIVE_MAX_MB, MAP_ARCHIVE_MAX_BYTES, no_map, bad_archive, 413, analyzing, disposition, block, warning, uploadState, uploadReducer, useArchiveUpload, usePollWhile, useMapUploadsNav, handover, DraftForm, PublishingTab, DriftTab, mapUploadFixtures]
provides: "the client contract of Admin → Map Uploads: the routes the launcher calls, the shapes it relies on, the error codes, the polling, and the section's layout and hand-over props"
not_here:
  - "the upload-with-progress helper apiUpload itself → data-sources.md (Backend API)"
  - "how admin sections are registered and gated → navigation.md (the sidebar registry)"
  - "AuthorPicker, TagEditor and the screenshot modal's callback mode → shared-components.md"
sections: [who-can-use-it, the-section, routes, shapes, errors, upload, drafts-and-the-report, polling, draft-form-and-publish, publishing-recent-and-drift, tests]
last_verified: 2026-10-07
verify_against:
  - app/utils/api.ts
  - app/utils/mapUploadTypes.ts
  - app/utils/fixtures/mapUploadFixtures.ts
  - app/components/pages/admin/registry.tsx
  - app/components/pages/admin/types.ts
  - app/components/pages/admin/sections/MapsManagementSection.tsx
  - app/components/pages/admin/sections/mapUploads/MapUploadsSection.tsx
  - app/components/pages/admin/sections/mapUploads/handover.ts
  - app/components/pages/admin/sections/mapUploads/useMapUploadsNav.ts
  - app/components/pages/admin/sections/mapUploads/uploadState.ts
  - app/components/pages/admin/sections/mapUploads/useArchiveUpload.ts
  - app/components/pages/admin/sections/mapUploads/UploadPanel.tsx
  - app/components/pages/admin/sections/mapUploads/DraftList.tsx
  - app/components/pages/admin/sections/mapUploads/DraftReport.tsx
  - app/components/pages/admin/sections/mapUploads/DiscardDraftDialog.tsx
  - app/components/pages/admin/sections/mapUploads/DraftExpiry.tsx
  - app/components/pages/admin/sections/mapUploads/ToneChip.tsx
  - app/components/pages/admin/sections/mapUploads/reportLabels.ts
  - app/components/pages/admin/sections/mapUploads/usePollWhile.ts
  - app/components/pages/admin/sections/mapUploads/DraftForm.tsx
  - app/components/pages/admin/sections/mapUploads/draftFormState.ts
  - app/components/pages/admin/sections/mapUploads/DraftScreenshot.tsx
  - app/components/pages/admin/sections/mapUploads/VersionTargetPicker.tsx
  - app/components/pages/admin/sections/mapUploads/PublishingTab.tsx
  - app/components/pages/admin/sections/mapUploads/DriftTab.tsx
---

# Admin → Map Uploads

Staff publish a new map by uploading the mapper's archive. The server unpacks it,
checks every file, and keeps the result as a **draft** until someone publishes or
discards it. This doc is the client side of that contract.

## Who can use it

Moderators and Admins (`ADMIN_DASHBOARD_ROLES`). A Cup Admin does not see the
section, and the API refuses them too. Every route below needs the staff bearer
token (`userProfile.accessToken`).

## The section

`map-uploads` in the Game Content group, right after Maps Management, with the
`FileUp` icon. The **Add Map** button in Maps Management opens it on the Drafts
list (`openDraft(null)` from `useMapUploadsNav`, then `onNavigate('map-uploads')`).
Maps can no longer be created from the Maps section; its form only edits.

Folder: `app/components/pages/admin/sections/mapUploads/`.

| File | Role |
|---|---|
| `MapUploadsSection.tsx` | The shell: the three tabs, the upload, and which draft or publish is open |
| `useMapUploadsNav.ts` | The shell's state, kept per navigation entry with `useNavState`: `tab`, `draftId`, `publishId`, `uploadedIds`, plus `openDraft(id)` and `openPublish(id)` |
| `handover.ts` | The props the shell passes to the draft form and the Publishing and Drift tabs |
| `uploadState.ts` | Pure upload state: file checks, the reducer, percent, what to open afterwards |
| `useArchiveUpload.ts` | Runs one upload at a time through `uploadMapArchive` and feeds the reducer |
| `UploadPanel.tsx` | Drop zone and file picker, progress bar with Cancel, the result or error line |
| `DraftList.tsx` | The Drafts tab list, and the drafts a map pack created |
| `DraftReport.tsx` | One draft: header, blocks, warnings, the files table, then the draft form |
| `DiscardDraftDialog.tsx` | The discard confirmation, used by the list and the report |
| `DraftExpiry.tsx` | When a draft expires, or that it never does once it has a publish |
| `ToneChip.tsx` | The small coloured chip for statuses, dispositions and counts |
| `reportLabels.ts` | Plain-language labels for statuses, dispositions, kinds, blocks and warnings |
| `usePollWhile.ts` | Polls with `createPoller` while a condition holds |
| `DraftForm.tsx` | The draft form and the Publish button, see [Draft form and publish](#draft-form-and-publish) |
| `draftFormState.ts` | Pure form state: values from a draft, the PATCH diff, autosave with debouncing, the rename suggestion, the publish rules and the 409 outcome |
| `DraftScreenshot.tsx` | The staged screenshot with Replace, Use embedded and Remove |
| `VersionTargetPicker.tsx` | The new-version toggle, the old map and the version mode |
| `PublishingTab.tsx`, `DriftTab.tsx` | Placeholders, see [Publishing, Recent and Drift](#publishing-recent-and-drift) |

Tabs: **Drafts**, **Publishing / Recent**, **Drift**. The shell owns the open tab,
the open draft and the selected publish. The hand-over props:

- `DraftFormProps { token, draft, onDraftChange(draft), onPublished(publishId) }`. The
  report renders the form under the files table for every draft status.
  `onDraftChange` replaces the draft the report shows. `onPublished` is the shell's
  `openPublish`: it switches to Publishing / Recent with that publish selected.
- `PublishingTabProps { token, publishId, onSelectPublish(id | null), onOpenDraft(id) }`.
  `publishId` is the selected publish or `null` for the list.
- `DriftTabProps { token }`.

## Routes

All under `/admin/map-uploads`. Functions live in `app/utils/api.ts`.

| Route | Function | Answer |
|---|---|---|
| `POST /admin/map-uploads`, multipart field `archive` | `uploadMapArchive(token, archive, filename, { signal, onProgress })` | 201 `{ draft_ids: number[] }`, one id per map in the archive |
| `GET /admin/map-uploads/drafts` | `fetchMapUploadDrafts(token, signal?)` | `DraftSummary[]`, newest first, every staff member's drafts |
| `GET /admin/map-uploads/drafts/<id>` | `fetchMapUploadDraft(token, id, signal?)` | `Draft` |
| `DELETE /admin/map-uploads/drafts/<id>` | `discardMapUploadDraft(token, id)` | `{ deleted: true }` |
| `PATCH /admin/map-uploads/drafts/<id>`, JSON body | `patchMapUploadDraft(token, id, patch)` | `Draft` |
| `PUT /admin/map-uploads/drafts/<id>/screenshot`, multipart field `file` | `uploadMapUploadScreenshot(token, id, image, filename)` | `Draft` |
| `POST /admin/map-uploads/drafts/<id>/screenshot/embedded` | `selectEmbeddedMapUploadScreenshot(token, id)` | `Draft` |
| `DELETE /admin/map-uploads/drafts/<id>/screenshot` | `removeMapUploadScreenshot(token, id)` | `Draft` |
| `GET /admin/map-uploads/drafts/<id>/screenshot?source=staged` or `embedded` | `fetchMapUploadScreenshot(token, id, source, signal?)` | the PNG as a `Blob`, or `null` on 404 |
| `POST /admin/map-uploads/drafts/<id>/publish` | `publishMapUploadDraft(token, id)` | 202 `{ publish_id }` → `{ kind: 'started', publishId }`; 409 `draft_invalid` → `{ kind: 'invalid', draft }` |

Responses use the usual `{ success, data }` envelope. An empty list comes back as
`{ "success": true }` with no `data` key, which `apiGetList` reads as `[]`.

## Shapes

The types are in `app/utils/mapUploadTypes.ts`, and one example response per route is
in `app/utils/fixtures/mapUploads/` (loaded through `mapUploadFixtures.ts`). The
fixtures are byte-for-byte what the API sends and their hashes are pinned by a test,
so never reformat them.

- Timestamps are ISO 8601 with a `+00:00` offset.
- People (`created_by`, `submitter`) are `{ alias, id }` with a **string** id. Render
  them with `PlayerInfo`.
- `DraftSummary`: `id`, `status`, `map_name`, `source_archive`, `created_by`,
  `created_at`, `expires_at`, `blocks_count`, `warnings_count`, `publish_id`.
- `Draft` adds `submitter`, `updated_at`, `files`, `blocks`, `warnings`, `metadata`,
  `screenshot`, `version`, `acknowledgements`.
- **Status**: `analyzing` → `ready` or `invalid`, then `published`. A draft expires
  14 days after it was created, unless it has a publish (`publish_id` set): that one
  never expires and stays until it is discarded.
- **Files**: `{ file, kind, sha256, size, disposition, reason_code, reason }`. Kinds:
  `map`, `texture`, `sound`, `music`, `code`, `companion` (`.int`), `other`.
  Dispositions: `install`, `skip-identical`, `keep-existing`, `dropped`. A dropped
  file has a `reason_code` (`not_unreal`, `unreferenced`, `orphan_companion`,
  `companion_not_text`); `skip-identical` and `keep-existing` have a `reason` only;
  an install usually has neither, and the report explains it itself.
- **Blocks** stop publishing: `{ code, message, package, hosts, objects }`. `package`
  is `null` for a block about the map itself; `hosts` names hosts as the API returns
  them; `objects` lists missing objects. Codes are in `BLOCK_CODES`.
- **Warnings** do not stop publishing: `{ code, message }`. Codes are in `WARNING_CODES`.

The server's `message` and `reason` are shown as they are. `reportLabels.ts` adds a
plain heading per code and a label per status, kind and disposition; each table is
typed over the full code list, so a new code fails the typecheck until it has words.

## Errors

`mapUploadErrorMessage(error)` turns any failure into a sentence for staff:

| Error | Message |
|---|---|
| Cancelled upload (`AbortError`) | The upload was cancelled. |
| 413 (any body, often not JSON) | This archive is over the 200 MB upload limit. |
| 422 `no_map` | The archive has no `.unr` map. |
| 422 `bad_archive` | The archive could not be opened. |
| 404 | The draft no longer exists (discarded or expired). |
| 409 `draft_invalid`, `too_early`, `stragglers_changed`, `not_distributing` | One plain message each, for the publish and force-activate routes |
| anything else | The server's message, or a generic retry line |

The code arrives as `ApiError.reason`.

## Upload

- Accepts `.zip`, `.rar` and `.7z` (`ARCHIVE_ACCEPT`), checked by name before sending.
  Files over `MAP_ARCHIVE_MAX_BYTES` (`MAP_ARCHIVE_MAX_MB` = 200, so 200 × 1024 × 1024 bytes) and empty files are
  refused before sending, with the reason.
- The upload goes through `apiUpload`, so the bar shows real bytes sent. The total is
  the file size until the browser reports one.
- States (`uploadReducer`): `idle` → `uploading` (loaded, total) → `done` (draft ids)
  or `error` (message). Cancel aborts the request and goes back to `idle`; the abort
  that follows is ignored. A new file can be dropped from `idle`, `done` or `error`,
  never over a running upload.
- Afterwards (`uploadOutcome`): one draft opens its report; several (a map pack) show
  as a list of buttons above the drafts table until dismissed.
- Leaving the section aborts a running upload.

## Drafts and the report

- The list shows map name and archive, status, block and warning counts, who
  created it, and when it expires, in the order the API sends (newest first).
  Below the table's width it turns into cards.
- Open shows the report. Discard asks first and works for every draft. A draft
  without a publish is deleted with its files. A draft with a publish leaves the
  list and its files are deleted, but the server keeps it with its publish history.
- If the open draft answers 404 (someone else discarded it), the report drops it,
  shows the message and stops polling.
- The report shows the blocks (or "Nothing blocks publishing"), the warnings, and
  every file with its kind, what happens to it and why. A published draft links to
  its publish.

## Polling

A draft in `analyzing` is polled every 3 s (`ANALYSIS_POLL_MS`) through `createPoller`
until its status changes; the report then shows the settled result. The list polls
the same way while any draft in it is `analyzing`. Polling pauses while the page is
hidden, as `createPoller` does by default.

## Draft form and publish

The report renders `DraftForm` under the files table. A published draft shows no
form; its header links to the publish instead.

**Fields.** Every field saves itself. Each change sends a `PATCH` with only the
fields that changed, and the report shows the `Draft` that comes back, so the blocks
and warnings are always the server's. Text fields (the free-text author and the
changelog) wait 600 ms after the last key (`TEXT_DEBOUNCE_MS`); everything else
saves at once. One save runs at a time; edits made meanwhile go in the next one.

| Field | Control | Sent as |
|---|---|---|
| Map name | Shown only while a name block (`bad_prefix`, `bad_characters`, `name_too_long`, `name_taken`) is present: its plain title, a text field prefilled with `suggestMapName`, and **Rename** | `map_name` (the checks run again, so the draft goes back to `analyzing`) |
| Author | `AuthorPicker`: free text, or a linked player | `author_str` with `author_ref: null`, or `author_ref` with `author_str: null`. Choosing Player sends nothing until a player is picked, and stays chosen when the form re-reads the `Draft` |
| Tags | `TagEditor`, with suggestions from `fetchAdminMapTags` | `tags` |
| Difficulty | 1–10, or Not set | `difficulty` |
| Required players | 1–12, prefilled by the server. A value other than `metadata.required_players_suggested` shows an inline note | `required_players` |
| Changelog | Text | `changelog` |
| Version | A toggle, the old map, the mode | `version_target`, `version_mode`; turning the toggle off clears both |
| Code package | "I reviewed this code package", shown when the report has a `code_package` warning or a `code_package_unacknowledged` block | `acknowledgements: { code_package }` |

`suggestMapName` fixes the prefix: `ctf-bt-Foo` → `CTF-BT-Foo`, `Foo` → `CTF-BT-Foo`,
`CTF-BTFoo` → `CTF-BT-Foo` (also `CTF-Foo`, `BT-Foo` and `ctf_bt_Foo`). The field
stays editable.

**Screenshot.** The staged image is read with `fetchMapUploadScreenshot(…, 'staged')`
as a blob with the staff bearer and shown through an object URL, with its source:
embedded in the map, uploaded, from the old version, or none. **Replace** opens
`MapScreenshotModal` in callback mode and sends the square crop with
`uploadMapUploadScreenshot`. **Use embedded** appears when
`screenshot.embedded_available` is true and another source is staged. **Remove**
clears it. With no screenshot, the report shows the `no_screenshot` warning and
Publish asks for confirmation.

**New version.** The server's `version.candidates` come first as one-click
suggestions, then `MapSearchInput` searches active maps by name. Each of the three
modes has a one-line explanation:

- **Update**: records, team records, playtime, reviews and favourites move to the new map, and the old map is retired.
- **Rework, retire old**: the old map is retired with its records; the new one starts clean.
- **Rework, keep both**: both stay votable, each with its own records.

Setting the old map makes the server prefill difficulty, tags, author, required
players and the screenshot. The form then reads its fields again from the `Draft`
the `PATCH` returns, but only when no edit is waiting to be saved. The `event_pool`
warning and the `version_target_invalid` and `version_target_has_successor` blocks
show with the report's other warnings and blocks, right above the form.

**Publish.** `publishGate(draft)` enables the button only when the draft is `ready`
with no blocks, its code package (if any) is acknowledged, and it has a mode whenever
it has an old map. Otherwise the reason shows next to the button. Pressing Publish
first sends any waiting edit, then checks the gate again on the saved draft. If that
save fails, nothing is published and the error shows (`flush` rejects). With no
screenshot it asks for confirmation. Then:

- 202: `onPublished(publishId)`, so the section switches to Publishing / Recent with
  that publish selected;
- 409 `draft_invalid`: the report shows the re-checked `Draft` from the response,
  with "The draft changed since it was checked." (`DRAFT_CHANGED_MESSAGE`);
- anything else: the `mapUploadErrorMessage` line.

**State module** (`draftFormState.ts`, no React): `formValuesFromDraft`,
`draftPatch(base, next)`, `createDraftAutosave({ initial, save, onSaved, onError,
onState })` with `edit`, `sync`, `flush` and `dispose`, plus `suggestMapName`,
`nameBlocks`, `requiredPlayersMismatch`, `hasCodePackage`, `publishGate`,
`publishNextStep` (`blocked`, `confirm-no-screenshot` or `publish`) and
`publishOutcome`. `dispose` still sends an edit that was waiting, so leaving the
draft never drops typing.

## Publishing, Recent and Drift

Not written yet. The ticket that replaces `PublishingTab.tsx` and `DriftTab.tsx`
documents here `GET /admin/map-uploads/publishes`, `GET /admin/map-uploads/publishes/<id>`,
`POST /admin/map-uploads/publishes/<id>/force-activate` and `GET /admin/map-uploads/drift`.

## Tests

- `app/utils/api.mapUploads.test.ts`: the functions above against the fixtures, the
  error mapping for every code and for 413 and 404, and the progress callback.
- `mapUploads/uploadState.test.ts`: the upload states, the file checks and what opens
  afterwards.
- `mapUploads/reportLabels.test.ts`: every code has words.
- `app/utils/api.mapUploadDraftForm.test.ts`: the PATCH, screenshot and publish
  functions against the fixtures: method, path, body and multipart field; 404 and
  refused values; the screenshot 404 as `null`; and, for publish, 202, 409
  `draft_invalid` with and without a draft, and other failures.
- `mapUploads/draftFormState.test.ts`: the PATCH diff, the rename suggestions, the
  publish rules, the 409 outcome, and autosave (debounce, one save at a time,
  re-reading values, flush, failures, dispose).
- `admin/registry.test.ts`: visible to Moderators and Admins, hidden from users and
  Cup Admins.
