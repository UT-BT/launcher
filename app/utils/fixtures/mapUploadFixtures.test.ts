import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
    MAP_UPLOAD_FIXTURES,
    mapUploadErrorFixture,
    mapUploadFixture,
    mapUploadFixtureResponse,
    mapUploadFixtureText,
    type MapUploadErrorFixtureName,
    type MapUploadFixtureName,
    type MapUploadSuccessFixtureName,
    type MapUploadSuccessFixtures,
} from './mapUploadFixtures'
import {
    ACTIVATION_KINDS,
    BLOCK_CODES,
    DRAFT_STATUSES,
    DRIFT_LOCATION_STATES,
    DROPPED_REASON_CODES,
    FILE_DISPOSITIONS,
    FILE_KINDS,
    MAP_UPLOAD_ERROR_CODES,
    PUBLISH_HOST_STATES,
    PUBLISH_STATES,
    SCREENSHOT_SOURCES,
    VERSION_MODES,
    WARNING_CODES,
    type Draft,
    type DraftAcknowledgements,
    type DraftBlock,
    type DraftDeleted,
    type DraftFile,
    type DraftMetadata,
    type DraftScreenshot,
    type DraftSummary,
    type DraftUploadResult,
    type DraftVersion,
    type DraftWarning,
    type DriftLocation,
    type DriftRow,
    type MapUploadErrorCode,
    type MapUploadUser,
    type Publish,
    type PublishHost,
    type PublishStarted,
    type PublishSummary,
    type PublishVersion,
} from '@/app/utils/mapUploadTypes'

const FIXTURE_DIR = resolve(__dirname, 'mapUploads')

const PINNED_SHA256: Record<string, string> = {
    'upload.json': '2bca3ee15229414b106d7a55bec591c119b007698ef20d050099004333fbc7b0',
    'drafts.json': 'ef80b3ce0aed0017d2cf97ead1fbf12d417484f9a8d4d9ef1ff779a0ddd053b6',
    'draft.json': 'bececa31f0238a95df7636bf81f661938cf31f508ec7aebb81ce31ab63289014',
    'draft_patch.json': 'ad33f5d3fac28fe9e50ef038c8a10e2f9d870f4b87d2a944f5f5a7b42b33e1f0',
    'draft_screenshot_put.json': '2a07a211ffb196d36f3b03c2cf83f57565980952572ea8e8b2a79e1e3c609dba',
    'draft_screenshot_embedded.json': '5c710abf23e2654bd09032be60f19cc855dca272e99806d4a6e36f71931c42ce',
    'draft_screenshot_delete.json': 'bbc94a698aa37dc0572cee4a113c9778283cf3f35418566ed9ed5480b3daaf02',
    'discard.json': '2297675dc60deb70e2ee84e9ce601540057c4e939affba0a2cd9654675b3db1a',
    'publish_start.json': '81818ee7bfa6fd9caa4242a0a0016afdbee8b06030a49301ad921297507df2c0',
    'publishes.json': '03a5828afb82bf3b85bbb9080b3cbe34542ea14c5cc693e57be8f5f3f0650efa',
    'publish.json': '4969eaa60748deb07c428170239d63eae57d931474388c394bc9b719091e4a33',
    'force_activate.json': '31fb3818be71f1b24f6296de1c8560fa5b55f3397ac8532acd43f075909c3871',
    'drift.json': '4860d949063b31f5581227b1b96d6079b055634ef351983772f37514ff7d2f0e',
    'error_no_map.json': '0b9b2793d648cd45df432aa1f9e6833f07b2b01b86aee34d432ad30f4832dcb2',
    'error_bad_archive.json': '01311e966f6458e6bd6b869ba03a20d45edc965adbfff9759de3372a341d6db0',
    'error_draft_invalid.json': 'b8e31b8e20fb462dc7de9da703208512b7d364106101df0544f5bc7c8e5f3150',
    'error_too_early.json': 'dacd46a113d90cdfc4af0471af5d8f4f7aa8afd0db0e9132991ef1e5b397ed71',
    'error_stragglers_changed.json': 'aa1fcf294c40ab8204ab9cc0abf703662c24159dca158d16e59073e43c3941db',
    'error_not_distributing.json': 'f3306afca38831cdda189ab93a1f2a0c14a85a3e80d123e6f015a95a6002bfed',
}

type Check<T> = ((value: unknown, path: string) => void) & { readonly checks?: T }
type Schema<T> = { [K in keyof T]-?: Check<T[K]> }

function fail(path: string, message: string): never {
    throw new Error(`${path}: ${message}`)
}

const str: Check<string> = (value, path) => {
    if (typeof value !== 'string') fail(path, `expected a string, got ${JSON.stringify(value)}`)
}

const int: Check<number> = (value, path) => {
    if (!Number.isInteger(value)) fail(path, `expected an integer, got ${JSON.stringify(value)}`)
}

const bool: Check<boolean> = (value, path) => {
    if (typeof value !== 'boolean') fail(path, `expected a boolean, got ${JSON.stringify(value)}`)
}

const timestamp: Check<string> = (value, path) => {
    str(value, path)
    if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?\+00:00$/.test(value as string)) {
        fail(path, `expected a UTC ISO timestamp, got ${JSON.stringify(value)}`)
    }
}

const sha256: Check<string> = (value, path) => {
    str(value, path)
    if (!/^[0-9a-f]{64}$/.test(value as string)) fail(path, `expected 64 lowercase hex, got ${JSON.stringify(value)}`)
}

function nullable<T>(check: Check<T>): Check<T | null> {
    return (value, path) => {
        if (value !== null) check(value, path)
    }
}

function oneOf<V extends string>(values: readonly V[]): Check<V> {
    return (value, path) => {
        if (typeof value !== 'string' || !(values as readonly string[]).includes(value)) {
            fail(path, `expected one of ${values.join(', ')}, got ${JSON.stringify(value)}`)
        }
    }
}

function arrayOf<T>(check: Check<T>): Check<T[]> {
    return (value, path) => {
        if (!Array.isArray(value)) fail(path, `expected an array, got ${JSON.stringify(value)}`)
        value.forEach((item, index) => check(item, `${path}[${index}]`))
    }
}

function object<T>(schema: Schema<T>): Check<T> {
    return (value, path) => {
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
            fail(path, `expected an object, got ${JSON.stringify(value)}`)
        }
        const record = value as Record<string, unknown>
        const expected = Object.keys(schema).sort()
        const actual = Object.keys(record).sort()
        if (expected.join() !== actual.join()) fail(path, `expected keys ${expected.join()}, got ${actual.join()}`)
        for (const key of expected) {
            ;(schema as Record<string, Check<unknown>>)[key](record[key], `${path}.${key}`)
        }
    }
}

const user = object<MapUploadUser>({
    id: (value, path) => {
        str(value, path)
        if (!/^\d+$/.test(value as string)) fail(path, 'expected a numeric string id')
    },
    alias: str,
})

const draftFile = object<DraftFile>({
    file: str,
    kind: oneOf(FILE_KINDS),
    sha256,
    size: int,
    disposition: oneOf(FILE_DISPOSITIONS),
    reason_code: nullable(oneOf(DROPPED_REASON_CODES)),
    reason: nullable(str),
})

const draftBlock = object<DraftBlock>({
    code: oneOf(BLOCK_CODES),
    message: str,
    package: nullable(str),
    hosts: arrayOf(str),
    objects: arrayOf(str),
})

const draftWarning = object<DraftWarning>({ code: oneOf(WARNING_CODES), message: str })

const draftMetadata = object<DraftMetadata>({
    author_str: nullable(str),
    author_ref: nullable(str),
    author: str,
    difficulty: nullable(int),
    tags: arrayOf(str),
    changelog: str,
    required_players: nullable(int),
    required_players_suggested: int,
})

const draftShape = object<Draft>({
    id: int,
    status: oneOf(DRAFT_STATUSES),
    map_name: str,
    source_archive: str,
    submitter: user,
    created_by: user,
    created_at: timestamp,
    updated_at: timestamp,
    expires_at: timestamp,
    files: arrayOf(draftFile),
    blocks: arrayOf(draftBlock),
    warnings: arrayOf(draftWarning),
    metadata: draftMetadata,
    screenshot: object<DraftScreenshot>({ source: oneOf(SCREENSHOT_SOURCES), embedded_available: bool }),
    version: object<DraftVersion>({ target: nullable(str), mode: nullable(oneOf(VERSION_MODES)), candidates: arrayOf(str) }),
    acknowledgements: object<DraftAcknowledgements>({ code_package: bool }),
    publish_id: nullable(int),
})

const draftSummary = object<DraftSummary>({
    id: int,
    status: oneOf(DRAFT_STATUSES),
    map_name: str,
    source_archive: str,
    created_by: user,
    created_at: timestamp,
    expires_at: timestamp,
    blocks_count: int,
    warnings_count: int,
    publish_id: nullable(int),
})

const publishShape = object<Publish>({
    id: int,
    draft_id: int,
    map_name: str,
    state: oneOf(PUBLISH_STATES),
    error: nullable(str),
    created_at: timestamp,
    updated_at: timestamp,
    activated_at: nullable(timestamp),
    activation: nullable(oneOf(ACTIVATION_KINDS)),
    activated_by: nullable(user),
    version: object<PublishVersion>({ old_map: nullable(str), mode: nullable(oneOf(VERSION_MODES)) }),
    force_available_at: nullable(timestamp),
    hosts: arrayOf(
        object<PublishHost>({
            host: str,
            state: oneOf(PUBLISH_HOST_STATES),
            detail: nullable(str),
            updated_at: timestamp,
        })
    ),
})

const publishSummary = object<PublishSummary>({
    id: int,
    draft_id: int,
    map_name: str,
    state: oneOf(PUBLISH_STATES),
    error: nullable(str),
    created_at: timestamp,
    activated_at: nullable(timestamp),
    activation: nullable(oneOf(ACTIVATION_KINDS)),
    hosts_confirmed: int,
    hosts_total: int,
})

const driftRow = object<DriftRow>({
    file: str,
    locations: arrayOf(
        object<DriftLocation>({
            location: str,
            sha256,
            size: int,
            state: oneOf(DRIFT_LOCATION_STATES),
            last_seen: timestamp,
        })
    ),
})

const SUCCESS_SHAPES: { [N in MapUploadSuccessFixtureName]: Check<MapUploadSuccessFixtures[N]> } = {
    upload: object<DraftUploadResult>({ draft_ids: arrayOf(int) }),
    drafts: arrayOf(draftSummary),
    draft: draftShape,
    draftPatch: draftShape,
    draftScreenshotPut: draftShape,
    draftScreenshotEmbedded: draftShape,
    draftScreenshotDelete: draftShape,
    discard: object<DraftDeleted>({ deleted: bool }),
    publishStart: object<PublishStarted>({ publish_id: int }),
    publishes: arrayOf(publishSummary),
    publish: publishShape,
    forceActivate: publishShape,
    drift: arrayOf(driftRow),
}

const ERROR_CODES: Record<MapUploadErrorFixtureName, MapUploadErrorCode> = {
    errorNoMap: 'no_map',
    errorBadArchive: 'bad_archive',
    errorDraftInvalid: 'draft_invalid',
    errorTooEarly: 'too_early',
    errorStragglersChanged: 'stragglers_changed',
    errorNotDistributing: 'not_distributing',
}

const SUCCESS_NAMES = Object.keys(SUCCESS_SHAPES) as MapUploadSuccessFixtureName[]
const ERROR_NAMES = Object.keys(ERROR_CODES) as MapUploadErrorFixtureName[]
const ALL_NAMES = Object.keys(MAP_UPLOAD_FIXTURES) as MapUploadFixtureName[]

function fileText(name: MapUploadFixtureName): string {
    return readFileSync(resolve(FIXTURE_DIR, MAP_UPLOAD_FIXTURES[name].file), 'utf8')
}

describe('map upload fixtures', () => {
    it('lists every fixture file once, and every file is pinned', () => {
        const onDisk = readdirSync(FIXTURE_DIR).filter((file) => file.endsWith('.json')).sort()

        expect(ALL_NAMES.map((name) => MAP_UPLOAD_FIXTURES[name].file).sort()).toEqual(onDisk)
        expect(Object.keys(PINNED_SHA256).sort()).toEqual(onDisk)
        expect([...SUCCESS_NAMES, ...ERROR_NAMES].sort()).toEqual([...ALL_NAMES].sort())
    })

    it.each(ALL_NAMES)('pins %s byte for byte', (name) => {
        const bytes = readFileSync(resolve(FIXTURE_DIR, MAP_UPLOAD_FIXTURES[name].file))

        expect(createHash('sha256').update(bytes).digest('hex')).toBe(PINNED_SHA256[MAP_UPLOAD_FIXTURES[name].file])
    })

    it.each(ALL_NAMES)('serves %s as the exact file text', (name) => {
        expect(mapUploadFixtureText(name)).toBe(fileText(name))
    })

    it.each(SUCCESS_NAMES)('%s satisfies its response type inside the success envelope', (name) => {
        const body = JSON.parse(fileText(name))

        expect(Object.keys(body).sort()).toEqual(['data', 'success'])
        expect(body.success).toBe(true)
        expect(() => SUCCESS_SHAPES[name](mapUploadFixture(name), name)).not.toThrow()
    })

    it.each(ERROR_NAMES)('%s is an error body with its code', (name) => {
        const body = mapUploadErrorFixture(name)

        expect(body.success).toBe(false)
        expect(body.code).toBe(ERROR_CODES[name])
        expect(MAP_UPLOAD_ERROR_CODES).toContain(body.code)
        expect(typeof body.error).toBe('string')
        expect(MAP_UPLOAD_FIXTURES[name].status).toBeGreaterThanOrEqual(400)
        const keys = name === 'errorDraftInvalid' ? ['code', 'data', 'error', 'success'] : ['code', 'error', 'success']
        expect(Object.keys(body).sort()).toEqual(keys)
    })

    it('carries the re-checked draft on a draft_invalid refusal', () => {
        const body = mapUploadErrorFixture('errorDraftInvalid')

        expect(() => draftShape(body.data, 'data')).not.toThrow()
        expect(body.data?.status).toBe('invalid')
        expect(body.data?.blocks.length).toBeGreaterThan(0)
    })

    it('rejects a fixture that drifts from its type', () => {
        const changed = mapUploadFixture('draft') as unknown as Record<string, unknown>
        changed.status = 'archived'
        const missing = mapUploadFixture('publish') as unknown as Record<string, unknown>
        delete missing.hosts

        expect(() => draftShape(changed, 'draft')).toThrow(/status/)
        expect(() => publishShape(missing, 'publish')).toThrow(/keys/)
    })

    it('covers every disposition, a blocked draft, one host per state and a conflict', () => {
        const ready = mapUploadFixture('draft')
        const blocked = mapUploadFixture('draftScreenshotEmbedded')
        const publish = mapUploadFixture('publish')
        const drift = mapUploadFixture('drift')

        expect(ready.status).toBe('ready')
        expect(new Set(ready.files.map((file) => file.disposition))).toEqual(new Set(FILE_DISPOSITIONS))
        expect(blocked.status).toBe('invalid')
        expect(blocked.blocks.length).toBeGreaterThan(0)
        expect(publish.hosts.map((host) => host.state).sort()).toEqual([...PUBLISH_HOST_STATES].sort())
        expect(drift.some((row) => row.locations.some((location) => location.state === 'conflict'))).toBe(true)
    })

    it('hands out copies, so a test cannot change the fixture for the next one', () => {
        mapUploadFixture('draft').map_name = 'Changed'

        expect(mapUploadFixture('draft').map_name).toBe('CTF-BT-Foo')
    })

    it.each(ALL_NAMES)('builds a %s mock response with its status', async (name) => {
        const response = mapUploadFixtureResponse(name)

        expect(response.status).toBe(MAP_UPLOAD_FIXTURES[name].status)
        expect(response.headers.get('Content-Type')).toBe('application/json')
        expect(await response.text()).toBe(fileText(name))
    })
})
