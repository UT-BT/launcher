import discard from './mapUploads/discard.json'
import draft from './mapUploads/draft.json'
import draftPatch from './mapUploads/draft_patch.json'
import draftScreenshotDelete from './mapUploads/draft_screenshot_delete.json'
import draftScreenshotEmbedded from './mapUploads/draft_screenshot_embedded.json'
import draftScreenshotPut from './mapUploads/draft_screenshot_put.json'
import drafts from './mapUploads/drafts.json'
import drift from './mapUploads/drift.json'
import errorBadArchive from './mapUploads/error_bad_archive.json'
import errorDraftInvalid from './mapUploads/error_draft_invalid.json'
import errorNoMap from './mapUploads/error_no_map.json'
import errorNotDistributing from './mapUploads/error_not_distributing.json'
import errorStragglersChanged from './mapUploads/error_stragglers_changed.json'
import errorTooEarly from './mapUploads/error_too_early.json'
import forceActivate from './mapUploads/force_activate.json'
import publish from './mapUploads/publish.json'
import publishStart from './mapUploads/publish_start.json'
import publishes from './mapUploads/publishes.json'
import upload from './mapUploads/upload.json'
import type {
    Draft,
    DraftDeleted,
    DraftSummary,
    DraftUploadResult,
    DriftRow,
    MapUploadErrorBody,
    Publish,
    PublishStarted,
    PublishSummary,
} from '@/app/utils/mapUploadTypes'

export interface MapUploadSuccessFixtures {
    upload: DraftUploadResult
    drafts: DraftSummary[]
    draft: Draft
    draftPatch: Draft
    draftScreenshotPut: Draft
    draftScreenshotEmbedded: Draft
    draftScreenshotDelete: Draft
    discard: DraftDeleted
    publishStart: PublishStarted
    publishes: PublishSummary[]
    publish: Publish
    forceActivate: Publish
    drift: DriftRow[]
}

export type MapUploadSuccessFixtureName = keyof MapUploadSuccessFixtures

export type MapUploadErrorFixtureName =
    | 'errorNoMap'
    | 'errorBadArchive'
    | 'errorDraftInvalid'
    | 'errorTooEarly'
    | 'errorStragglersChanged'
    | 'errorNotDistributing'

export type MapUploadFixtureName = MapUploadSuccessFixtureName | MapUploadErrorFixtureName

interface FixtureEntry {
    file: string
    route: string
    status: number
    body: unknown
}

export const MAP_UPLOAD_FIXTURES: Record<MapUploadFixtureName, FixtureEntry> = {
    upload: { file: 'upload.json', route: 'POST /admin/map-uploads', status: 201, body: upload },
    drafts: { file: 'drafts.json', route: 'GET /admin/map-uploads/drafts', status: 200, body: drafts },
    draft: { file: 'draft.json', route: 'GET /admin/map-uploads/drafts/:id', status: 200, body: draft },
    draftPatch: {
        file: 'draft_patch.json',
        route: 'PATCH /admin/map-uploads/drafts/:id',
        status: 200,
        body: draftPatch,
    },
    draftScreenshotPut: {
        file: 'draft_screenshot_put.json',
        route: 'PUT /admin/map-uploads/drafts/:id/screenshot',
        status: 200,
        body: draftScreenshotPut,
    },
    draftScreenshotEmbedded: {
        file: 'draft_screenshot_embedded.json',
        route: 'POST /admin/map-uploads/drafts/:id/screenshot/embedded',
        status: 200,
        body: draftScreenshotEmbedded,
    },
    draftScreenshotDelete: {
        file: 'draft_screenshot_delete.json',
        route: 'DELETE /admin/map-uploads/drafts/:id/screenshot',
        status: 200,
        body: draftScreenshotDelete,
    },
    discard: { file: 'discard.json', route: 'DELETE /admin/map-uploads/drafts/:id', status: 200, body: discard },
    publishStart: {
        file: 'publish_start.json',
        route: 'POST /admin/map-uploads/drafts/:id/publish',
        status: 202,
        body: publishStart,
    },
    publishes: { file: 'publishes.json', route: 'GET /admin/map-uploads/publishes', status: 200, body: publishes },
    publish: { file: 'publish.json', route: 'GET /admin/map-uploads/publishes/:id', status: 200, body: publish },
    forceActivate: {
        file: 'force_activate.json',
        route: 'POST /admin/map-uploads/publishes/:id/force-activate',
        status: 200,
        body: forceActivate,
    },
    drift: { file: 'drift.json', route: 'GET /admin/map-uploads/drift', status: 200, body: drift },
    errorNoMap: { file: 'error_no_map.json', route: 'POST /admin/map-uploads', status: 422, body: errorNoMap },
    errorBadArchive: {
        file: 'error_bad_archive.json',
        route: 'POST /admin/map-uploads',
        status: 422,
        body: errorBadArchive,
    },
    errorDraftInvalid: {
        file: 'error_draft_invalid.json',
        route: 'POST /admin/map-uploads/drafts/:id/publish',
        status: 409,
        body: errorDraftInvalid,
    },
    errorTooEarly: {
        file: 'error_too_early.json',
        route: 'POST /admin/map-uploads/publishes/:id/force-activate',
        status: 409,
        body: errorTooEarly,
    },
    errorStragglersChanged: {
        file: 'error_stragglers_changed.json',
        route: 'POST /admin/map-uploads/publishes/:id/force-activate',
        status: 409,
        body: errorStragglersChanged,
    },
    errorNotDistributing: {
        file: 'error_not_distributing.json',
        route: 'POST /admin/map-uploads/publishes/:id/force-activate',
        status: 409,
        body: errorNotDistributing,
    },
}

export function mapUploadFixture<K extends MapUploadSuccessFixtureName>(name: K): MapUploadSuccessFixtures[K] {
    const body = MAP_UPLOAD_FIXTURES[name].body as { data: MapUploadSuccessFixtures[K] }
    return structuredClone(body.data)
}

export function mapUploadErrorFixture(name: MapUploadErrorFixtureName): MapUploadErrorBody {
    return structuredClone(MAP_UPLOAD_FIXTURES[name].body as MapUploadErrorBody)
}

export function mapUploadFixtureText(name: MapUploadFixtureName): string {
    return `${JSON.stringify(MAP_UPLOAD_FIXTURES[name].body)}\n`
}

export function mapUploadFixtureResponse(name: MapUploadFixtureName): Response {
    return new Response(mapUploadFixtureText(name), {
        status: MAP_UPLOAD_FIXTURES[name].status,
        headers: { 'Content-Type': 'application/json' },
    })
}
