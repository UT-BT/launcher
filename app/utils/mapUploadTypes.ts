export const DRAFT_STATUSES = ['analyzing', 'ready', 'invalid', 'published'] as const
export type DraftStatus = (typeof DRAFT_STATUSES)[number]

export const PUBLISH_STATES = [
    'validating',
    'storing',
    'compressing',
    'registering',
    'distributing',
    'active',
    'failed',
] as const
export type PublishState = (typeof PUBLISH_STATES)[number]

export const PUBLISH_HOST_STATES = ['pending', 'installed', 'conflict', 'error'] as const
export type PublishHostState = (typeof PUBLISH_HOST_STATES)[number]

export const ACTIVATION_KINDS = ['auto', 'forced'] as const
export type ActivationKind = (typeof ACTIVATION_KINDS)[number]

export const VERSION_MODES = ['update', 'rework-retire', 'rework-keep-both'] as const
export type VersionMode = (typeof VERSION_MODES)[number]

export const FILE_DISPOSITIONS = ['install', 'skip-identical', 'keep-existing', 'dropped'] as const
export type FileDisposition = (typeof FILE_DISPOSITIONS)[number]

export const FILE_KINDS = ['map', 'texture', 'sound', 'music', 'code', 'companion', 'other'] as const
export type FileKind = (typeof FILE_KINDS)[number]

export const SCREENSHOT_SOURCES = ['embedded', 'upload', 'previous', 'none'] as const
export type ScreenshotSource = (typeof SCREENSHOT_SOURCES)[number]

export const DRIFT_LOCATION_STATES = ['present', 'conflict', 'error'] as const
export type DriftLocationState = (typeof DRIFT_LOCATION_STATES)[number]

export const BLOCK_CODES = [
    'bad_prefix',
    'bad_characters',
    'name_too_long',
    'name_taken',
    'missing_package',
    'host_only_package',
    'reserved_name',
    'collision_missing_objects',
    'collision_unverifiable',
    'code_package_unacknowledged',
    'version_target_invalid',
    'version_target_has_successor',
] as const
export type BlockCode = (typeof BLOCK_CODES)[number]

export const WARNING_CODES = [
    'required_players_mismatch',
    'no_screenshot',
    'code_package',
    'event_pool',
    'name_normalised',
] as const
export type WarningCode = (typeof WARNING_CODES)[number]

export const DROPPED_REASON_CODES = ['not_unreal', 'unreferenced', 'orphan_companion', 'companion_not_text'] as const
export type DroppedReasonCode = (typeof DROPPED_REASON_CODES)[number]

export const MAP_UPLOAD_ERROR_CODES = [
    'no_map',
    'bad_archive',
    'draft_invalid',
    'too_early',
    'stragglers_changed',
    'not_distributing',
] as const
export type MapUploadErrorCode = (typeof MAP_UPLOAD_ERROR_CODES)[number]

export interface MapUploadUser {
    id: string
    alias: string
}

export interface DraftFile {
    file: string
    kind: FileKind
    sha256: string
    size: number
    disposition: FileDisposition
    reason_code: DroppedReasonCode | null
    reason: string | null
}

export interface DraftBlock {
    code: BlockCode
    message: string
    package: string | null
    hosts: string[]
    objects: string[]
}

export interface DraftWarning {
    code: WarningCode
    message: string
}

export interface DraftMetadata {
    author_str: string | null
    author_ref: string | null
    author: string
    difficulty: number | null
    tags: string[]
    changelog: string
    required_players: number | null
    required_players_suggested: number
}

export interface DraftScreenshot {
    source: ScreenshotSource
    embedded_available: boolean
}

export interface DraftVersion {
    target: string | null
    mode: VersionMode | null
    candidates: string[]
}

export interface DraftAcknowledgements {
    code_package: boolean
}

export interface Draft {
    id: number
    status: DraftStatus
    map_name: string
    source_archive: string
    submitter: MapUploadUser
    created_by: MapUploadUser
    created_at: string
    updated_at: string
    expires_at: string
    files: DraftFile[]
    blocks: DraftBlock[]
    warnings: DraftWarning[]
    metadata: DraftMetadata
    screenshot: DraftScreenshot
    version: DraftVersion
    acknowledgements: DraftAcknowledgements
    publish_id: number | null
}

export interface DraftSummary {
    id: number
    status: DraftStatus
    map_name: string
    source_archive: string
    created_by: MapUploadUser
    created_at: string
    expires_at: string
    blocks_count: number
    warnings_count: number
    publish_id: number | null
}

export interface DraftUploadResult {
    draft_ids: number[]
}

export interface DraftDeleted {
    deleted: boolean
}

export interface PublishStarted {
    publish_id: number
}

export interface PublishHost {
    host: string
    state: PublishHostState
    detail: string | null
    updated_at: string
}

export interface PublishVersion {
    old_map: string | null
    mode: VersionMode | null
}

export interface Publish {
    id: number
    draft_id: number
    map_name: string
    state: PublishState
    error: string | null
    created_at: string
    updated_at: string
    activated_at: string | null
    activation: ActivationKind | null
    activated_by: MapUploadUser | null
    version: PublishVersion
    force_available_at: string | null
    hosts: PublishHost[]
}

export interface PublishSummary {
    id: number
    draft_id: number
    map_name: string
    state: PublishState
    error: string | null
    created_at: string
    activated_at: string | null
    activation: ActivationKind | null
    hosts_confirmed: number
    hosts_total: number
}

export interface DriftLocation {
    location: string
    sha256: string
    size: number
    state: DriftLocationState
    last_seen: string
}

export interface DriftRow {
    file: string
    locations: DriftLocation[]
}

export interface MapUploadErrorBody {
    success: false
    error: string
    code: MapUploadErrorCode
    data?: Draft
}
