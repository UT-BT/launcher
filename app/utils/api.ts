import type { AuthConfig } from '@/lib/main/config'

const GATEWAY_BASE_URL = 'https://gateway.utbt.net'

export function getAvatarUrl(userId: string | number): string {
    return `${GATEWAY_BASE_URL}/users/${userId}/avatar`
}

export interface UserTitle {
    id: string
    name: string
    color: string // "r,g,b"
    color_r: number
    color_g: number
    color_b: number
    rarity: 1 | 2 | 3 | 4 | 5
}

export interface AssignedTitleV2 {
    id: number
    user_id: string
    assigned_at: string
    selected: boolean
    alias: string
    title_id: string
    name: string
    rarity: number
    color_r: number
    color_g: number
    color_b: number
}

export interface LauncherActivity {
    id: number
    user_id: string
    launcher_version: string
    os_platform: string
    os_release: string
    os_arch: string
    created_at: string
}

export type TeamTagPosition = 'prefix' | 'suffix'

export interface UserTeamSummary {
    id: string
    name: string
    tag: string | null
    tag_position: TeamTagPosition | null
    tagged_alias: string | null
}

export interface UserProfile extends AuthConfig {
    active_title?: UserTitle | null
    alias?: string | null
    id?: string | null
    utbt_role?: number
    latest_activity?: LauncherActivity | null
    team?: UserTeamSummary | null
}

export interface Map {
    name: string
    added: string
    difficulty: number
    active: boolean
    tags?: string
    author: string | number
    author_str?: string
    author_ref?: string
    url?: string
    world_record?: number
    champion_medal?: number
    gold_medal?: number
    silver_medal?: number
    bronze_medal?: number
    required_players: number
}

export interface MapMetadata {
    name: string
    added: string
    difficulty: number
    active?: boolean
    tags?: string
    author?: string | number
    author_str?: string
    author_ref?: string
    url?: string
    world_record?: number
    champion_medal?: number
    gold_medal?: number
    silver_medal?: number
    bronze_medal?: number
    required_players: number
    preceded_by?: string | null
    superseded_by?: string | null
    changelog?: string | null
}

export interface BestCap {
    map: string
    cap_id?: string | null
    cap_time_seconds: number
    cap_type: number
    verified: boolean
}

export interface MedalHuntOpportunity {
    mapName: string
    difficulty: number
    currentTime: number
    targetTime: number
    targetMedal: 'Bronze Medal' | 'Silver Medal' | 'Gold Medal' | 'Champion Medal' | 'World Record'
    improvement: number
    improvementPct: number
    worldRecordAdded: string | null
}

export interface MapListParams {
    limit?: number
    offset?: number
    name?: string
    author?: string
    tag?: string
    difficulty?: number
    difficultyMin?: number
    difficultyMax?: number
    addedSince?: string
    addedUntil?: string
    active?: boolean
    sort?: 'newest' | 'name' | 'added' | 'difficulty'
    order?: 'asc' | 'desc'
    randomize?: boolean
    exclude?: string[]
    columns?: string[]
}

export type MapCountParams = Omit<MapListParams, 'limit' | 'offset' | 'sort' | 'order' | 'columns' | 'randomize' | 'exclude'>

export interface ActiveTitle {
    name: string
    rarity: 1 | 2 | 3 | 4 | 5
    color_r: number
    color_g: number
    color_b: number
}

export function toActiveTitle(
    t?: { name: string; rarity: number; color_r: number; color_g: number; color_b: number } | null,
): ActiveTitle | null {
    if (!t) return null
    const rarity = Math.min(5, Math.max(1, Math.round(t.rarity))) as 1 | 2 | 3 | 4 | 5
    return { name: t.name, rarity, color_r: t.color_r, color_g: t.color_g, color_b: t.color_b }
}

export interface MapReview {
    id: number
    map_name: string
    user: string | number
    alias?: string
    active_title?: ActiveTitle | null
    aesthetics: number
    learning: number
    luck: number
    difficulty: number
    overall: number
}

export interface RecordTeamMember {
    user: string
    alias: string
    cap_id: string
    cap_time_seconds: number
    verified: boolean
    active_title: ActiveTitle | null
}

export interface Record {
    cap_id: string
    user_id: string
    map: string
    added: string
    cap_time_seconds: number
    alias: string
    color_r?: number
    color_g?: number
    color_b?: number
    active_title?: ActiveTitle | null
    difficulty?: number
    members?: RecordTeamMember[] | null
}

export interface Playtime {
    id: number
    user: number
    map: string
    server: string
    time_played_seconds: number
    added: string
    is_spectator: boolean
    alias?: string
    active_title?: ActiveTitle | null
}


const API_BASE_URL = import.meta.env.DEV ? 'http://localhost' : 'https://api.utbt.net'

const DEFAULT_TIMEOUT_MS = 20_000

export interface ApiRequestOptions {
    token?: string
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
    body?: unknown
    headers?: { [key: string]: string }
    signal?: AbortSignal
    timeoutMs?: number
}

export async function apiRequest(path: string, opts: ApiRequestOptions = {}): Promise<Response> {
    const { token, method = 'GET', body, headers = {}, signal, timeoutMs = DEFAULT_TIMEOUT_MS } = opts
    const controller = new AbortController()
    const onAbort = () => controller.abort(signal?.reason)
    if (signal) {
        if (signal.aborted) controller.abort(signal.reason)
        else signal.addEventListener('abort', onAbort, { once: true })
    }
    const timer = setTimeout(() => controller.abort(new DOMException('Request timed out', 'TimeoutError')), timeoutMs)
    try {
        const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`
        return await fetch(url, {
            method,
            signal: controller.signal,
            headers: {
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
                ...headers,
            },
            body: body !== undefined ? JSON.stringify(body) : undefined,
        })
    } finally {
        clearTimeout(timer)
        if (signal) signal.removeEventListener('abort', onAbort)
    }
}

export class ApiError extends Error {
    status: number
    reason?: string
    constructor(status: number, reason: string | undefined, fallback: string) {
        super(reason || fallback)
        this.name = 'ApiError'
        this.status = status
        this.reason = reason
    }
}

export async function apiGet<T>(path: string, opts: ApiRequestOptions = {}): Promise<T> {
    const res = await apiRequest(path, opts)
    if (!res.ok) {
        let reason: string | undefined
        try { reason = (await res.json())?.reason } catch { reason = undefined }
        throw new ApiError(res.status, reason, `Request failed: ${res.statusText} (${res.status})`)
    }
    const json = await res.json()
    if (json && json.success && json.data !== null && json.data !== undefined) {
        return json.data as T
    }
    throw new Error('Invalid response format from server')
}

export async function apiGetList<T>(path: string, opts: ApiRequestOptions = {}): Promise<T[]> {
    const res = await apiRequest(path, opts)
    if (!res.ok) {
        let reason: string | undefined
        try { reason = (await res.json())?.reason } catch { reason = undefined }
        throw new ApiError(res.status, reason, `Request failed: ${res.statusText} (${res.status})`)
    }
    const json = await res.json()
    if (json && json.success) {
        return Array.isArray(json.data) ? (json.data as T[]) : []
    }
    throw new Error('Invalid response format from server')
}

export async function fetchUserProfile(accessToken: string): Promise<UserProfile> {
    return apiGet<UserProfile>('/users/me', { token: accessToken })
}

export async function downloadDemo(capId: string): Promise<ArrayBuffer> {
    const response = await fetch(`${API_BASE_URL}/demos/${encodeURIComponent(capId)}`)
    if (!response.ok) {
        throw new Error(`Demo download failed: ${response.statusText} (${response.status})`)
    }
    return await response.arrayBuffer()
}

export const MAP_DOWNLOAD_URL = 'https://api.utmapdownload.com/download'

export async function downloadMapZip(mapName: string, timeoutMs = 30_000): Promise<ArrayBuffer> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
        const url = `${MAP_DOWNLOAD_URL}?mapName=${encodeURIComponent(mapName)}`
        const response = await fetch(url, { signal: controller.signal })
        if (!response.ok) {
            throw new Error(`http-${response.status}`)
        }
        return await response.arrayBuffer()
    } finally {
        clearTimeout(timer)
    }
}

export async function uploadDemo(file: Blob, filename: string, accessToken: string): Promise<{ success: boolean; message?: string; reason?: string }> {
    const formData = new FormData()
    formData.append('file', file, filename)

    const response = await fetch(`${API_BASE_URL}/demos/upload`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`
        },
        body: formData
    })

    if (!response.ok) {
        const errorText = await response.text()
        let errorMessage = `Upload failed: ${response.statusText} (${response.status})`
        try {
            const json = JSON.parse(errorText)
            if (json.reason) {
                errorMessage = json.reason
            }
        } catch {
            // If response isn't JSON, we'll just use the generic error message
        }
        throw new Error(errorMessage)
    }

    return await response.json()
}

export interface AuditEntry {
    id: string
    action: string
    actor_id: string | null
    actor_alias: string | null
    actor_role: number
    actor_title: AdminActiveTitle | null
    target_type: string
    target_id: string | null
    target_alias: string | null
    summary: string
    details: unknown
    reason: string | null
    ip: string | null
    created_at: string | null
    reverts: string | null
    reverted: boolean
    can_rollback: boolean
}

export interface AdminOverview {
    stats: {
        active_bans: number
        warns_24h: number
        staff_actions_24h: number
        total_users: number
        total_caps: number
        disallowed_caps: number
        total_maps: number
        active_maps: number
        inactive_maps: number
        total_titles: number
    }
}

export interface AdminActiveTitle {
    id: string
    name: string
    color: string
    color_r: number
    color_g: number
    color_b: number
    rarity: number
}

export interface AdminUserRow {
    id: string
    alias: string | null
    utbt_role: number
    registered_at: string | null
    active_title: AdminActiveTitle | null
    banned: boolean
    ban_reason: string | null
    ban_expires: string | null
    warn_count: number
    ban_count: number
}

export interface AdminUserDetail {
    id: string
    alias: string | null
    utbt_role: number
    registered_at: string | null
    flag: string | null
    twitch_url: string | null
    cap_count: number
    active_bans: { id: string; reason: string; start: string | null; end: string | null }[]
    warns: { id: string; reason: string; warned_at: string | null }[]
    titles: { title_id: string; name: string; rarity: number; color: string; color_r: number; color_g: number; color_b: number; selected: boolean }[]
    ip_history: { value: string; count: number; last_seen: string | null }[]
    hwid_history: { value: string; count: number; last_seen: string | null }[]
}

export type AdminUserSort = 'name' | 'id' | 'role' | 'status' | 'warnings' | 'bans'

export interface AdminTitleSummary {
    id: string
    name: string
    rarity: number
    color: string
    color_r: number
    color_g: number
    color_b: number
    holders: number
}

export type AdminCapStatus = 'pending' | 'verified' | 'disallowed' | 'all'

export interface AdminCapRow {
    id: string
    user: string
    alias: string | null
    active_title: AdminActiveTitle | null
    map: string
    cap_time_seconds: number | null
    verified: boolean
    disallowed: boolean
    has_demo: boolean
    added: string | null
    ip: string | null
    hwid: string | null
    btpog_id: string | null
}

export type AdminCapSort = 'player' | 'map' | 'time' | 'status' | 'added'

export interface AdminCapsParams {
    status?: AdminCapStatus
    search?: string
    mapFuzzy?: string
    capId?: string
    sort?: AdminCapSort
    order?: 'asc' | 'desc'
    limit?: number
    offset?: number
}

export interface AuditParams {
    actor?: string
    action?: string
    targetType?: string
    search?: string
    limit?: number
    offset?: number
}

export interface DemoVerifyResult {
    success: boolean
    message?: string
    reason?: string
    debug?: { cap_id: string; steps: string[] }
}

function capsQuery(params: AdminCapsParams): string {
    const qs = new URLSearchParams()
    if (params.status && params.status !== 'all') qs.set('status', params.status)
    if (params.search) qs.set('search', params.search)
    if (params.mapFuzzy) qs.set('map_fuzzy', params.mapFuzzy)
    if (params.capId) qs.set('cap_id', params.capId)
    if (params.sort) qs.set('sort', params.sort)
    if (params.order) qs.set('order', params.order)
    if (params.limit != null) qs.set('limit', String(params.limit))
    if (params.offset != null) qs.set('offset', String(params.offset))
    return qs.toString()
}

function auditQuery(params: AuditParams): string {
    const qs = new URLSearchParams()
    if (params.actor) qs.set('actor', params.actor)
    if (params.action) qs.set('action', params.action)
    if (params.targetType) qs.set('target_type', params.targetType)
    if (params.search) qs.set('search', params.search)
    if (params.limit != null) qs.set('limit', String(params.limit))
    if (params.offset != null) qs.set('offset', String(params.offset))
    return qs.toString()
}

export async function fetchAdminOverview(token: string, signal?: AbortSignal): Promise<AdminOverview> {
    return apiGet<AdminOverview>('/admin/overview', { token, signal })
}

export type ActivityWindow = '24h' | '1w' | '1m' | '1y'

export interface AdminActivityPoint {
    t: string | null
    caps: number
    players: number
    playtime_hours: number
    new_maps: number
    new_users: number
    achievements: number
    launcher_logins: number
}

export interface AdminActivity {
    window: string
    bucket: string
    points: AdminActivityPoint[]
}

export async function fetchAdminActivity(token: string, window: ActivityWindow, signal?: AbortSignal): Promise<AdminActivity> {
    return apiGet<AdminActivity>(`/admin/overview/activity?window=${window}`, { token, signal })
}

export interface AdminUsersParams {
    search?: string
    status?: 'active' | 'banned'
    role?: number
    sort?: AdminUserSort
    order?: 'asc' | 'desc'
    limit?: number
    offset?: number
}

export async function fetchAdminUsers(token: string, params: AdminUsersParams = {}, signal?: AbortSignal): Promise<AdminUserRow[]> {
    const qs = new URLSearchParams()
    if (params.search) qs.set('search', params.search)
    if (params.status) qs.set('status', params.status)
    if (params.role != null) qs.set('role', String(params.role))
    if (params.sort) qs.set('sort', params.sort)
    if (params.order) qs.set('order', params.order)
    qs.set('limit', String(params.limit ?? 50))
    qs.set('offset', String(params.offset ?? 0))
    const data = await apiGet<{ items: AdminUserRow[] }>(`/admin/users?${qs.toString()}`, { token, signal })
    return data.items
}

export async function fetchAdminUsersCount(token: string, params: Pick<AdminUsersParams, 'search' | 'status' | 'role'> = {}, signal?: AbortSignal): Promise<number> {
    const qs = new URLSearchParams()
    if (params.search) qs.set('search', params.search)
    if (params.status) qs.set('status', params.status)
    if (params.role != null) qs.set('role', String(params.role))
    const data = await apiGet<{ count: number }>(`/admin/users/count?${qs.toString()}`, { token, signal })
    return data.count
}

export async function fetchAdminUser(token: string, userId: string, signal?: AbortSignal): Promise<AdminUserDetail> {
    return apiGet<AdminUserDetail>(`/admin/users/${encodeURIComponent(userId)}`, { token, signal })
}

export async function setUserAlias(token: string, userId: string, alias: string): Promise<{ ok: boolean; alias: string }> {
    return apiGet(`/admin/users/${encodeURIComponent(userId)}/alias`, { token, method: 'PATCH', body: { alias } })
}

export async function warnUser(token: string, userId: string, reason: string): Promise<{ ok: boolean }> {
    return apiGet(`/admin/users/${encodeURIComponent(userId)}/warn`, { token, method: 'POST', body: { reason } })
}

export interface BanUserInput {
    lengthMinutes: number
    reason: string
    banUser?: boolean
    banHwid?: boolean
    banIp?: boolean
}

export async function banUser(token: string, userId: string, input: BanUserInput): Promise<{ ok: boolean; targets: string[] }> {
    return apiGet(`/admin/users/${encodeURIComponent(userId)}/ban`, {
        token,
        method: 'POST',
        body: {
            length_minutes: input.lengthMinutes,
            reason: input.reason,
            ban_user: input.banUser ?? true,
            ban_hwid: input.banHwid ?? true,
            ban_ip: input.banIp ?? true,
        },
    })
}

export async function unbanUser(token: string, userId: string): Promise<{ ok: boolean; lifted: number }> {
    return apiGet(`/admin/users/${encodeURIComponent(userId)}/unban`, { token, method: 'POST' })
}

export async function assignTitleToUser(token: string, userId: string, titleId: string): Promise<{ ok: boolean }> {
    return apiGet(`/admin/users/${encodeURIComponent(userId)}/titles/${encodeURIComponent(titleId)}`, { token, method: 'POST' })
}

export async function unassignTitleFromUser(token: string, userId: string, titleId: string): Promise<{ ok: boolean }> {
    return apiGet(`/admin/users/${encodeURIComponent(userId)}/titles/${encodeURIComponent(titleId)}`, { token, method: 'DELETE' })
}

export async function fetchAdminTitles(token: string, signal?: AbortSignal): Promise<AdminTitleSummary[]> {
    const data = await apiGet<{ items: AdminTitleSummary[] }>('/admin/titles', { token, signal })
    return data.items
}

export interface TitleHolder {
    id: string
    alias: string | null
}

export async function fetchTitleHolders(token: string, titleId: string, signal?: AbortSignal): Promise<TitleHolder[]> {
    const data = await apiGet<{ items: TitleHolder[] }>(`/admin/titles/${encodeURIComponent(titleId)}/holders`, { token, signal })
    return data.items
}

export async function createTitle(token: string, input: { name: string; r: number; g: number; b: number; rarity: number }): Promise<{ ok: boolean; id: string }> {
    return apiGet('/admin/titles', { token, method: 'POST', body: input })
}

export async function updateTitle(token: string, titleId: string, input: { name?: string; r?: number; g?: number; b?: number; rarity?: number }): Promise<{ ok: boolean }> {
    return apiGet(`/admin/titles/${encodeURIComponent(titleId)}`, { token, method: 'PATCH', body: input })
}

export async function deleteTitle(token: string, titleId: string): Promise<{ ok: boolean; holders_removed: number }> {
    return apiGet(`/admin/titles/${encodeURIComponent(titleId)}`, { token, method: 'DELETE' })
}

export async function fetchAdminCaps(token: string, params: AdminCapsParams = {}, signal?: AbortSignal): Promise<AdminCapRow[]> {
    const data = await apiGet<{ items: AdminCapRow[] }>(`/admin/caps?${capsQuery(params)}`, { token, signal })
    return data.items
}

export async function fetchAdminCapsCount(token: string, params: AdminCapsParams = {}, signal?: AbortSignal): Promise<number> {
    const data = await apiGet<{ count: number }>(`/admin/caps/count?${capsQuery(params)}`, { token, signal })
    return data.count
}

export async function disallowCap(token: string, capId: string, reason?: string): Promise<{ ok: boolean }> {
    return apiGet(`/admin/caps/${encodeURIComponent(capId)}/disallow`, { token, method: 'POST', body: { reason } })
}

export async function reallowCap(token: string, capId: string, reason?: string): Promise<{ ok: boolean }> {
    return apiGet(`/admin/caps/${encodeURIComponent(capId)}/reallow`, { token, method: 'POST', body: { reason } })
}

export interface BulkCapResult {
    ok: boolean
    changed: number
    skipped: number
    not_found: string[]
}

export async function bulkDisallowCaps(token: string, capIds: string[], reason?: string): Promise<BulkCapResult> {
    return apiGet('/admin/caps/bulk-disallow', { token, method: 'POST', body: { cap_ids: capIds, reason } })
}

export async function bulkReallowCaps(token: string, capIds: string[], reason?: string): Promise<BulkCapResult> {
    return apiGet('/admin/caps/bulk-reallow', { token, method: 'POST', body: { cap_ids: capIds, reason } })
}

export async function verifyCapFlag(token: string, capId: string, reason?: string): Promise<{ ok: boolean }> {
    return apiGet(`/admin/caps/${encodeURIComponent(capId)}/verify-flag`, { token, method: 'POST', body: { reason } })
}

export async function unverifyCap(token: string, capId: string, reason?: string): Promise<{ ok: boolean }> {
    return apiGet(`/admin/caps/${encodeURIComponent(capId)}/unverify`, { token, method: 'POST', body: { reason } })
}

export async function verifyCapWithDemo(token: string, capId: string, file: Blob, filename: string, override = false): Promise<DemoVerifyResult> {
    const formData = new FormData()
    formData.append('file', file, filename)
    if (override) formData.append('override', 'true')
    const response = await fetch(`${API_BASE_URL}/admin/caps/${encodeURIComponent(capId)}/verify`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
    })
    try {
        return await response.json() as DemoVerifyResult
    } catch {
        return { success: false, reason: `Upload failed: ${response.statusText} (${response.status})` }
    }
}

export async function fetchAuditLog(token: string, params: AuditParams = {}, signal?: AbortSignal): Promise<AuditEntry[]> {
    const data = await apiGet<{ items: AuditEntry[] }>(`/admin/audit?${auditQuery(params)}`, { token, signal })
    return data.items
}

export async function fetchAuditLogCount(token: string, params: AuditParams = {}, signal?: AbortSignal): Promise<number> {
    const data = await apiGet<{ count: number }>(`/admin/audit/count?${auditQuery(params)}`, { token, signal })
    return data.count
}

export async function rollbackAudit(token: string, auditId: string): Promise<{ ok: boolean }> {
    return apiGet(`/admin/audit/${encodeURIComponent(auditId)}/rollback`, { token, method: 'POST' })
}

export interface AdminMapRow {
    name: string
    active: boolean
    difficulty: number | null
    tags: string | null
    url: string | null
    changelog: string | null
    author_str: string | null
    author_ref: string | null
    author_alias: string | null
    superseded_by: string | null
    preceded_by: string | null
    added: string | null
    required_players: number
}

export type AdminMapSort = 'name' | 'difficulty' | 'active' | 'added'

export interface AdminMapsParams {
    search?: string
    author?: string
    difficulty?: number
    tag?: string
    active?: boolean
    sort?: AdminMapSort
    order?: 'asc' | 'desc'
    limit?: number
    offset?: number
}

function mapsQuery(params: AdminMapsParams): string {
    const qs = new URLSearchParams()
    if (params.search) qs.set('search', params.search)
    if (params.author) qs.set('author', params.author)
    if (params.difficulty != null) qs.set('difficulty', String(params.difficulty))
    if (params.tag) qs.set('tag', params.tag)
    if (params.active != null) qs.set('active', params.active ? 'true' : 'false')
    if (params.sort) qs.set('sort', params.sort)
    if (params.order) qs.set('order', params.order)
    if (params.limit != null) qs.set('limit', String(params.limit))
    if (params.offset != null) qs.set('offset', String(params.offset))
    return qs.toString()
}

export async function fetchAdminMaps(token: string, params: AdminMapsParams = {}, signal?: AbortSignal): Promise<AdminMapRow[]> {
    const data = await apiGet<{ items: AdminMapRow[] }>(`/admin/maps?${mapsQuery(params)}`, { token, signal })
    return data.items
}

export async function fetchAdminMapsCount(token: string, params: AdminMapsParams = {}, signal?: AbortSignal): Promise<number> {
    const data = await apiGet<{ count: number }>(`/admin/maps/count?${mapsQuery(params)}`, { token, signal })
    return data.count
}

export async function fetchAdminMapTags(token: string, signal?: AbortSignal): Promise<string[]> {
    const data = await apiGet<{ items: string[] }>('/admin/maps/tags', { token, signal })
    return data.items
}

export interface MapvoteStatus {
    announcement: string
    last_regenerated_at: string | null
    cooldown_seconds_remaining: number
    can_regenerate: boolean
}

export async function fetchMapvoteStatus(token: string, signal?: AbortSignal): Promise<MapvoteStatus> {
    return apiGet<MapvoteStatus>('/admin/mapvote', { token, signal })
}

export async function setMapvoteAnnouncement(token: string, announcement: string): Promise<{ ok: boolean }> {
    return apiGet('/admin/mapvote/announcement', { token, method: 'POST', body: { announcement } })
}

export async function regenerateMapvote(token: string, announcement?: string): Promise<{ ok: boolean; last_regenerated_at: string | null }> {
    return apiGet('/admin/mapvote/regenerate', { token, method: 'POST', body: announcement != null ? { announcement } : {} })
}

export interface AcPlayer {
    id: string
    alias: string | null
    active_title: AdminActiveTitle | null
}

export type AcSharedType = 'all' | 'hwid' | 'ip'

export interface AcSharedGroup {
    type: 'hwid' | 'ip'
    value: string
    player_count: number
    cap_count: number
    first_seen: string | null
    last_seen: string | null
    players: AcPlayer[]
}

export async function fetchAcShared(token: string, params: { type?: AcSharedType; limit?: number; offset?: number } = {}, signal?: AbortSignal): Promise<AcSharedGroup[]> {
    const qs = new URLSearchParams()
    if (params.type && params.type !== 'all') qs.set('type', params.type)
    if (params.limit != null) qs.set('limit', String(params.limit))
    if (params.offset != null) qs.set('offset', String(params.offset))
    const data = await apiGet<{ items: AcSharedGroup[] }>(`/admin/anti-cheat/shared?${qs.toString()}`, { token, signal })
    return data.items
}

export async function fetchAcSharedCount(token: string, params: { type?: AcSharedType } = {}, signal?: AbortSignal): Promise<number> {
    const qs = new URLSearchParams()
    if (params.type && params.type !== 'all') qs.set('type', params.type)
    const data = await apiGet<{ count: number }>(`/admin/anti-cheat/shared/count?${qs.toString()}`, { token, signal })
    return data.count
}

export interface AcCapDeltaRow {
    cap_id: string
    user: string
    alias: string | null
    active_title: AdminActiveTitle | null
    map: string
    cap_time_seconds: number | null
    client_cap_delta: number | null
    verified: boolean
    ip: string | null
    hwid: string | null
    btpog_id: string | null
    added: string | null
}

export type AcView = 'flagged' | 'allowed' | 'denied'

export interface AcCapDeltaParams {
    minDelta?: number
    sort?: 'risk' | 'added'
    view?: AcView
    limit?: number
    offset?: number
}

function acCapDeltaQuery(params: AcCapDeltaParams): string {
    const qs = new URLSearchParams()
    if (params.minDelta != null) qs.set('min_delta', String(params.minDelta))
    if (params.sort) qs.set('sort', params.sort)
    if (params.view) qs.set('view', params.view)
    if (params.limit != null) qs.set('limit', String(params.limit))
    if (params.offset != null) qs.set('offset', String(params.offset))
    return qs.toString()
}

export async function fetchAcCapDelta(token: string, params: AcCapDeltaParams = {}, signal?: AbortSignal): Promise<AcCapDeltaRow[]> {
    const data = await apiGet<{ items: AcCapDeltaRow[] }>(`/admin/anti-cheat/cap-delta?${acCapDeltaQuery(params)}`, { token, signal })
    return data.items
}

export async function fetchAcCapDeltaCount(token: string, params: AcCapDeltaParams = {}, signal?: AbortSignal): Promise<number> {
    const data = await apiGet<{ count: number }>(`/admin/anti-cheat/cap-delta/count?${acCapDeltaQuery(params)}`, { token, signal })
    return data.count
}

export interface AcLowFpsWrRow {
    cap_id: string
    user: string
    alias: string | null
    active_title: AdminActiveTitle | null
    map: string
    cap_time_seconds: number | null
    fps_1pc: number | null
    fps_5pc: number | null
    fps_25pc: number | null
    fps_50pc: number | null
    set_fps_min: number | null
    set_fps_max: number | null
    netspeed_min: number | null
    netspeed_max: number | null
    spawn_count: number | null
    baseline_fps: number | null
    tier: 'critical' | 'high' | 'medium' | 'low'
    flags: string[]
    added: string | null
}

export interface AcLowFpsWrParams {
    view?: AcView
    limit?: number
    offset?: number
}

function acLowFpsWrQuery(params: AcLowFpsWrParams): string {
    const qs = new URLSearchParams()
    if (params.view) qs.set('view', params.view)
    if (params.limit != null) qs.set('limit', String(params.limit))
    if (params.offset != null) qs.set('offset', String(params.offset))
    return qs.toString()
}

export async function fetchAcLowFpsWr(token: string, params: AcLowFpsWrParams = {}, signal?: AbortSignal): Promise<AcLowFpsWrRow[]> {
    const data = await apiGet<{ items: AcLowFpsWrRow[] }>(`/admin/anti-cheat/low-fps-wr?${acLowFpsWrQuery(params)}`, { token, signal })
    return data.items
}

export async function fetchAcLowFpsWrCount(token: string, params: AcLowFpsWrParams = {}, signal?: AbortSignal): Promise<number> {
    const data = await apiGet<{ count: number }>(`/admin/anti-cheat/low-fps-wr/count?${acLowFpsWrQuery(params)}`, { token, signal })
    return data.count
}

export async function allowCap(token: string, capId: string, reason?: string): Promise<{ ok: boolean }> {
    return apiGet(`/admin/anti-cheat/cap/${encodeURIComponent(capId)}/allow`, { token, method: 'POST', body: { reason } })
}

export async function unallowCap(token: string, capId: string, reason?: string): Promise<{ ok: boolean }> {
    return apiGet(`/admin/anti-cheat/cap/${encodeURIComponent(capId)}/unallow`, { token, method: 'POST', body: { reason } })
}

export async function bulkAllowCaps(token: string, capIds: string[], reason?: string): Promise<BulkCapResult> {
    return apiGet('/admin/anti-cheat/caps/bulk-allow', { token, method: 'POST', body: { cap_ids: capIds, reason } })
}

export interface AcIdentifierCap {
    cap_id: string
    user: string
    alias: string | null
    active_title: AdminActiveTitle | null
    map: string
    cap_time_seconds: number | null
    verified: boolean
    disallowed: boolean
    added: string | null
}

export interface AcIdentifierDetail {
    summary: { cap_count: number; map_count: number; player_count: number }
    total: number
    items: AcIdentifierCap[]
}

export async function fetchAcIdentifier(token: string, params: { type: 'hwid' | 'ip'; value: string; limit?: number; offset?: number }, signal?: AbortSignal): Promise<AcIdentifierDetail> {
    const qs = new URLSearchParams()
    qs.set('type', params.type)
    qs.set('value', params.value)
    if (params.limit != null) qs.set('limit', String(params.limit))
    if (params.offset != null) qs.set('offset', String(params.offset))
    return apiGet<AcIdentifierDetail>(`/admin/anti-cheat/identifier?${qs.toString()}`, { token, signal })
}

export interface AcCapStats {
    cap_id: string
    user: string
    alias: string | null
    active_title: AdminActiveTitle | null
    map: string
    cap_time_seconds: number | null
    client_cap_delta: number | null
    verified: boolean
    disallowed: boolean
    added: string | null
    fps_1pc: number | null
    fps_5pc: number | null
    fps_25pc: number | null
    fps_50pc: number | null
    set_fps_min: number | null
    set_fps_max: number | null
    ping_1pc: number | null
    ping_5pc: number | null
    ping_25pc: number | null
    ping_50pc: number | null
    spawn_count: number | null
    team: number | null
    netspeed_min: number | null
    netspeed_max: number | null
    ip: string | null
    hwid: string | null
    btpog_id: string | null
}

export async function fetchAcCapStats(token: string, capId: string, signal?: AbortSignal): Promise<AcCapStats> {
    return apiGet<AcCapStats>(`/admin/anti-cheat/cap/${encodeURIComponent(capId)}`, { token, signal })
}

export type AcPopulationVerdict = 'typical' | 'below_map_normal' | 'well_below_map_normal' | 'above_map_normal' | 'insufficient_data'

export interface AcMetricCmp {
    value: number | null
    n: number
    sufficient: boolean
    p10: number | null
    p50: number | null
    p90: number | null
    min: number | null
    max: number | null
    percentile_rank: number | null
    verdict: AcPopulationVerdict
}

export interface AcMapComparison {
    cap_id: string
    map: string
    population: { n_total: number; sufficient: boolean }
    metrics: {
        fps_1pc: AcMetricCmp | null
        fps_5pc: AcMetricCmp | null
        fps_25pc: AcMetricCmp | null
        fps_50pc: AcMetricCmp | null
    }
}

export async function fetchAcCapMapComparison(token: string, capId: string, signal?: AbortSignal): Promise<AcMapComparison> {
    return apiGet<AcMapComparison>(`/admin/anti-cheat/cap/${encodeURIComponent(capId)}/map-comparison`, { token, signal })
}

export interface CreateMapInput {
    name: string
    difficulty: number
    active: boolean
    author_str?: string | null
    author_ref?: string | number | null
    tags?: string
    url?: string
    changelog?: string
    preceded_by?: string
    transfer_records?: boolean
    required_players: number
}

export async function createMap(token: string, input: CreateMapInput): Promise<{ ok: boolean }> {
    return apiGet('/admin/maps', { token, method: 'POST', body: input })
}

export interface UpdateMapInput {
    active?: boolean
    difficulty?: number
    tags?: string | null
    author_str?: string | null
    author_ref?: string | number | null
    required_players?: number
}

export async function updateMap(token: string, name: string, input: UpdateMapInput): Promise<{ ok: boolean }> {
    return apiGet(`/admin/maps/${encodeURIComponent(name)}`, { token, method: 'PATCH', body: input })
}

export interface DifficultySyncChange {
    name: string
    current: number | null
    average: number
    review_count: number
    proposed: number
}

export async function fetchDifficultySyncPreview(token: string, signal?: AbortSignal): Promise<DifficultySyncChange[]> {
    const data = await apiGet<{ changes: DifficultySyncChange[] }>('/admin/maps/difficulty-sync/preview', { token, signal })
    return data.changes
}

export async function applyDifficultySync(
    token: string,
    opts: { reason?: string; maps?: string[] },
): Promise<{ ok: boolean; count: number; changed: DifficultySyncChange[] }> {
    return apiGet('/admin/maps/difficulty-sync', { token, method: 'POST', body: { reason: opts.reason, maps: opts.maps } })
}

export type MapAuthorMatch = 'exact' | 'ci'
export type MapAuthorFlags = 'all' | 'co_authored' | 'placeholder' | 'clean'

export interface MapAuthorRow {
    author_str: string
    map_count: number
    active_map_count: number
    co_authored: boolean
    placeholder: boolean
    exact_alias_match: { id: string; alias: string | null } | null
}

export interface LinkedMapAuthorRow {
    author_ref: string
    alias: string | null
    map_count: number
    active_map_count: number
    original_str: string | null
    link_audit_id: string | null
}

export interface MapAuthorCandidate {
    id: string
    alias: string | null
    active_title: AdminActiveTitle | null
    match_type: 'exact' | 'normalized' | 'fuzzy'
    score: number
    existing_map_count: number
}

export interface MapAuthorPreviewMap {
    name: string
    active: boolean
    difficulty: number | null
    author_str: string
}

export interface MapAuthorPreview {
    author_str: string
    match: MapAuthorMatch
    map_count: number
    maps: MapAuthorPreviewMap[]
    variants: { author_str: string; map_count: number }[]
    co_authored: boolean
    placeholder: boolean
    target: {
        id: string
        alias: string | null
        active_title: AdminActiveTitle | null
        existing_map_count: number
        existing_maps: string[]
    } | null
}

export async function fetchMapAuthorStrings(
    token: string,
    params: { search?: string; sort?: 'name' | 'maps'; order?: 'asc' | 'desc'; flags?: MapAuthorFlags; limit?: number; offset?: number },
    signal?: AbortSignal,
): Promise<MapAuthorRow[]> {
    const q = new URLSearchParams()
    if (params.search) q.set('search', params.search)
    if (params.sort) q.set('sort', params.sort)
    if (params.order) q.set('order', params.order)
    if (params.flags) q.set('flags', params.flags)
    q.set('limit', String(params.limit ?? 50))
    q.set('offset', String(params.offset ?? 0))
    const data = await apiGet<{ items: MapAuthorRow[] }>(`/admin/maps/authors?${q}`, { token, signal })
    return data.items
}

export async function fetchMapAuthorStringsCount(token: string, params: { search?: string }, signal?: AbortSignal): Promise<number> {
    const q = new URLSearchParams()
    if (params.search) q.set('search', params.search)
    const data = await apiGet<{ count: number }>(`/admin/maps/authors/count?${q}`, { token, signal })
    return data.count
}

export async function fetchLinkedMapAuthors(token: string, signal?: AbortSignal): Promise<LinkedMapAuthorRow[]> {
    const data = await apiGet<{ items: LinkedMapAuthorRow[] }>('/admin/maps/authors/linked', { token, signal })
    return data.items
}

export async function fetchMapAuthorCandidates(token: string, authorStr: string, signal?: AbortSignal): Promise<MapAuthorCandidate[]> {
    const q = new URLSearchParams({ author_str: authorStr })
    const data = await apiGet<{ candidates: MapAuthorCandidate[] }>(`/admin/maps/authors/candidates?${q}`, { token, signal })
    return data.candidates
}

export async function fetchMapAuthorPreview(
    token: string,
    opts: { authorStr: string; match?: MapAuthorMatch; userId?: string },
    signal?: AbortSignal,
): Promise<MapAuthorPreview> {
    const q = new URLSearchParams({ author_str: opts.authorStr })
    if (opts.match) q.set('match', opts.match)
    if (opts.userId) q.set('user_id', opts.userId)
    return apiGet<MapAuthorPreview>(`/admin/maps/authors/preview?${q}`, { token, signal })
}

export async function linkMapAuthor(
    token: string,
    input: { authorStr: string; userId: string; match?: MapAuthorMatch; expectedMaps?: string[]; reason?: string; allowPlaceholder?: boolean },
): Promise<{
    ok: boolean
    linked_count: number
    user: { id: string; alias: string | null }
    maps: { name: string; author_str: string }[]
    audit_id: string
    warnings: string[]
}> {
    return apiGet('/admin/maps/authors/link', {
        token,
        method: 'POST',
        body: {
            author_str: input.authorStr,
            user_id: input.userId,
            match: input.match,
            expected_maps: input.expectedMaps,
            reason: input.reason,
            allow_placeholder: input.allowPlaceholder,
        },
    })
}

export async function unlinkMapAuthor(
    token: string,
    input: { authorStr: string; userId: string; maps?: string[]; reason?: string },
): Promise<{ ok: boolean; unlinked_count: number; maps: { name: string; author_ref: string }[] }> {
    return apiGet('/admin/maps/authors/unlink', {
        token,
        method: 'POST',
        body: { author_str: input.authorStr, user_id: input.userId, maps: input.maps, reason: input.reason },
    })
}

export type PatchChannel = 'stable' | 'rc'

export interface AdminPatch {
    id: string
    channel: string
    tag: string
    asset_name: string
    asset_url: string
    sha256: string
    exe_md5: string
    release_notes_url: string
    active: boolean
    added: string | null
}

export async function fetchAdminPatches(token: string, signal?: AbortSignal): Promise<AdminPatch[]> {
    const data = await apiGet<{ items: AdminPatch[] }>('/admin/patches', { token, signal })
    return data.items
}

export interface CreatePatchInput {
    channel: PatchChannel
    tag: string
    asset_name: string
    asset_url: string
    sha256: string
    exe_md5: string
    release_notes_url: string
    active?: boolean
}

export async function createPatch(token: string, input: CreatePatchInput): Promise<{ ok: boolean; id: string }> {
    return apiGet('/admin/patches', { token, method: 'POST', body: input })
}

export type UpdatePatchInput = Partial<CreatePatchInput>

export async function updatePatch(token: string, id: string, input: UpdatePatchInput): Promise<{ ok: boolean }> {
    return apiGet(`/admin/patches/${encodeURIComponent(id)}`, { token, method: 'PATCH', body: input })
}

export async function setPatchActive(token: string, id: string, active: boolean): Promise<{ ok: boolean }> {
    return apiGet(`/admin/patches/${encodeURIComponent(id)}/${active ? 'activate' : 'deactivate'}`, { token, method: 'POST' })
}

export async function deletePatch(token: string, id: string): Promise<{ ok: boolean }> {
    return apiGet(`/admin/patches/${encodeURIComponent(id)}`, { token, method: 'DELETE' })
}

export interface DerivedPatch {
    asset_url: string
    asset_name: string
    sha256: string
    exe_md5: string
    release_notes_url: string
    tag: string
}

export async function derivePatch(token: string, assetUrl: string, signal?: AbortSignal): Promise<DerivedPatch> {
    return apiGet('/admin/patches/derive', { token, method: 'POST', body: { asset_url: assetUrl }, signal, timeoutMs: 120_000 })
}

export type NewsCategoryKey = string

export interface NewsCategoryDef {
    id: number
    key: string
    label: string
    colorR: number
    colorG: number
    colorB: number
    icon: string
    sortOrder: number
}

export interface AdminNewsCategory extends NewsCategoryDef {
    inUse: number
}

export interface NewsArticle {
    id: number
    category: NewsCategoryKey
    title: string
    excerpt: string
    body: string
    linkUrl?: string | null
    linkText?: string | null
    pinned: boolean
    publishedAt: string
    expiresAt?: string | null
    authorAlias?: string | null
}

export interface AdminNews extends NewsArticle {
    active: boolean
    authorId?: string | null
    createdAt: string
    updatedAt: string
}

interface NewsApiRow {
    id: number
    category: NewsCategoryKey
    title: string
    excerpt: string
    body: string
    link_url?: string | null
    link_text?: string | null
    pinned: boolean
    published_at: string
    expires_at?: string | null
    author_alias?: string | null
    active?: boolean
    author_id?: string | null
    created_at?: string
    updated_at?: string
}

interface NewsCategoryApiRow {
    id: number
    key: string
    label: string
    color_r: number
    color_g: number
    color_b: number
    icon: string
    sort_order: number
    in_use?: number
}

function toNewsArticle(row: NewsApiRow): NewsArticle {
    return {
        id: row.id,
        category: row.category,
        title: row.title,
        excerpt: row.excerpt,
        body: row.body,
        linkUrl: row.link_url ?? null,
        linkText: row.link_text ?? null,
        pinned: !!row.pinned,
        publishedAt: row.published_at,
        expiresAt: row.expires_at ?? null,
        authorAlias: row.author_alias ?? null,
    }
}

function toAdminNews(row: NewsApiRow): AdminNews {
    return {
        ...toNewsArticle(row),
        active: !!row.active,
        authorId: row.author_id ?? null,
        createdAt: row.created_at ?? '',
        updatedAt: row.updated_at ?? '',
    }
}

function toCategoryDef(row: NewsCategoryApiRow): AdminNewsCategory {
    return {
        id: row.id,
        key: row.key,
        label: row.label,
        colorR: row.color_r,
        colorG: row.color_g,
        colorB: row.color_b,
        icon: row.icon,
        sortOrder: row.sort_order,
        inUse: row.in_use ?? 0,
    }
}

export async function fetchNews(token: string, signal?: AbortSignal): Promise<NewsArticle[]> {
    const data = await apiGet<{ items: NewsApiRow[] }>('/v2/news/', { token, signal })
    return data.items.map(toNewsArticle)
}

export async function fetchNewsItem(token: string, id: number, signal?: AbortSignal): Promise<NewsArticle> {
    const row = await apiGet<NewsApiRow>(`/v2/news/${id}/`, { token, signal })
    return toNewsArticle(row)
}

export async function fetchNewsCategories(token: string, signal?: AbortSignal): Promise<NewsCategoryDef[]> {
    const data = await apiGet<{ items: NewsCategoryApiRow[] }>('/v2/news/categories/', { token, signal })
    return data.items.map(toCategoryDef)
}

export async function fetchAdminNews(token: string, signal?: AbortSignal): Promise<AdminNews[]> {
    const data = await apiGet<{ items: NewsApiRow[] }>('/admin/news', { token, signal })
    return data.items.map(toAdminNews)
}

export async function fetchAdminNewsCategories(token: string, signal?: AbortSignal): Promise<AdminNewsCategory[]> {
    const data = await apiGet<{ items: NewsCategoryApiRow[] }>('/admin/news/categories', { token, signal })
    return data.items.map(toCategoryDef)
}

export interface CreateNewsInput {
    category: NewsCategoryKey
    title: string
    excerpt: string
    body: string
    link_url?: string | null
    link_text?: string | null
    pinned?: boolean
    active?: boolean
    published_at?: string | null
    expires_at?: string | null
}

export type UpdateNewsInput = Partial<CreateNewsInput>

export async function createNews(token: string, input: CreateNewsInput): Promise<{ ok: boolean; id: string }> {
    return apiGet('/admin/news', { token, method: 'POST', body: input })
}

export async function updateNews(token: string, id: number, input: UpdateNewsInput): Promise<{ ok: boolean }> {
    return apiGet(`/admin/news/${id}`, { token, method: 'PATCH', body: input })
}

export async function setNewsActive(token: string, id: number, active: boolean): Promise<{ ok: boolean }> {
    return apiGet(`/admin/news/${id}/${active ? 'activate' : 'deactivate'}`, { token, method: 'POST' })
}

export async function deleteNews(token: string, id: number): Promise<{ ok: boolean }> {
    return apiGet(`/admin/news/${id}`, { token, method: 'DELETE' })
}

export interface CreateNewsCategoryInput {
    label: string
    key?: string
    color_r: number
    color_g: number
    color_b: number
    icon: string
    sort_order?: number
}

export async function createNewsCategory(token: string, input: CreateNewsCategoryInput): Promise<{ ok: boolean; id: string; key: string }> {
    return apiGet('/admin/news/categories', { token, method: 'POST', body: input })
}

export async function updateNewsCategory(token: string, id: number, input: Partial<CreateNewsCategoryInput>): Promise<{ ok: boolean }> {
    return apiGet(`/admin/news/categories/${id}`, { token, method: 'PATCH', body: input })
}

export async function deleteNewsCategory(token: string, id: number): Promise<{ ok: boolean }> {
    return apiGet(`/admin/news/categories/${id}`, { token, method: 'DELETE' })
}

export async function logLauncherStartup(accessToken: string): Promise<void> {
    try {
        const version = await window.conveyor.app.version()
        const osInfo = await window.conveyor.app.getOSInfo()

        const response = await fetch(`${API_BASE_URL}/launcher/activity/`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                launcher_version: version,
                os_platform: osInfo.platform,
                os_release: osInfo.release,
                os_arch: osInfo.arch
            })
        })

        if (!response.ok) {
            console.warn(`Failed to log launcher startup: ${response.statusText} (${response.status})`)
        }
    } catch (error) {
        console.error('Error logging launcher startup:', error)
    }
}

const DEFAULT_MAP_COLUMNS = [
    'name', 'added', 'difficulty', 'tags',
    'author', 'author_str', 'author_ref',
    'world_record', 'champion_medal', 'gold_medal', 'silver_medal', 'bronze_medal',
    'active', 'required_players',
]

const MAP_METADATA_COLUMNS = [
    'name', 'added', 'difficulty', 'tags', 'author', 'author_str', 'author_ref',
    'world_record', 'champion_medal', 'gold_medal', 'silver_medal', 'bronze_medal',
    'required_players',
]

function buildMapQuery(params: MapListParams, defaultActive = true): string {
    const usp = new URLSearchParams()

    if (params.limit !== undefined) usp.set('limit', String(params.limit))
    if (params.offset !== undefined) usp.set('offset', String(params.offset))
    if (params.name) usp.set('name', params.name)
    if (params.author) usp.set('author', params.author)
    if (params.tag) usp.set('tag', params.tag)
    if (params.difficulty !== undefined) usp.set('difficulty', String(params.difficulty))
    if (params.difficultyMin !== undefined) usp.set('difficulty_min', String(params.difficultyMin))
    if (params.difficultyMax !== undefined) usp.set('difficulty_max', String(params.difficultyMax))
    if (params.addedSince) usp.set('added_since', params.addedSince)
    if (params.addedUntil) usp.set('added_until', params.addedUntil)
    if (params.active !== undefined) usp.set('active', String(params.active))
    else if (defaultActive) usp.set('active', 'true')
    if (params.sort) usp.set('sort', params.sort)
    if (params.order) usp.set('order', params.order)
    if (params.randomize) usp.set('randomize', 'true')
    if (params.exclude?.length) usp.set('exclude', params.exclude.join(','))

    const cols = params.columns ?? DEFAULT_MAP_COLUMNS
    usp.set('columns', cols.join(','))

    return usp.toString()
}

export async function fetchMaps(accessToken: string, params: MapListParams = {}): Promise<Map[]> {
    const response = await apiRequest(`/maps/?${buildMapQuery(params)}`, { token: accessToken })
    if (!response.ok) throw new Error(`Failed to fetch maps: ${response.statusText} (${response.status})`)
    const json = await response.json()
    if (json?.success && Array.isArray(json.data)) return json.data as Map[]
    return []
}

export async function fetchMap(accessToken: string, mapName: string, columns?: string[]): Promise<MapMetadata | null> {
    try {
        const qs = columns?.length ? `?columns=${columns.join(',')}` : ''
        return await apiGet<MapMetadata>(`/maps/${encodeURIComponent(mapName)}${qs}`, { token: accessToken })
    } catch (error) {
        console.error('Error fetching map:', error)
        return null
    }
}

export async function fetchMapsMetadata(accessToken: string): Promise<MapMetadata[]> {
    const rows = await fetchMaps(accessToken, {
        columns: MAP_METADATA_COLUMNS,
        active: true,
    })
    return rows as unknown as MapMetadata[]
}

export async function fetchMedalHunt(accessToken: string, signal?: AbortSignal): Promise<MedalHuntOpportunity[]> {
    const data = await apiGet<{ opportunities?: unknown }>('/v2/summary/medal_hunt', { token: accessToken, signal })
    return Array.isArray(data?.opportunities) ? (data.opportunities as MedalHuntOpportunity[]) : []
}

export async function fetchBestCaps(accessToken: string, userId: string | number): Promise<BestCap[]> {
    try {
        return await apiGet<BestCap[]>(`/caps/capped_maps/${userId}`, { token: accessToken })
    } catch (error) {
        console.error('Error fetching best caps:', error)
        return []
    }
}

export async function fetchMapAuthors(accessToken: string, activeOnly = true): Promise<string[]> {
    try {
        const response = await fetch(`${API_BASE_URL}/maps/authors/?active=${activeOnly}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        })

        if (!response.ok) {
            throw new Error(`Failed to fetch map authors: ${response.statusText} (${response.status})`)
        }

        const json = await response.json()
        if (json.success && Array.isArray(json.data)) {
            return json.data as string[]
        }

        return []
    } catch (error) {
        console.error('Error fetching map authors:', error)
        return []
    }
}

export async function fetchMapsCount(accessToken: string, params: MapCountParams = {}): Promise<number> {
    try {
        const usp = new URLSearchParams()
        if (params.name) usp.set('name', params.name)
        if (params.author) usp.set('author', params.author)
        if (params.tag) usp.set('tag', params.tag)
        if (params.difficulty !== undefined) usp.set('difficulty', String(params.difficulty))
        if (params.difficultyMin !== undefined) usp.set('difficulty_min', String(params.difficultyMin))
        if (params.difficultyMax !== undefined) usp.set('difficulty_max', String(params.difficultyMax))
        if (params.addedSince) usp.set('added_since', params.addedSince)
        if (params.addedUntil) usp.set('added_until', params.addedUntil)
        usp.set('active', params.active === undefined ? 'true' : String(params.active))

        const response = await fetch(`${API_BASE_URL}/maps/count/?${usp.toString()}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        })

        if (!response.ok) {
            throw new Error(`Failed to fetch maps count: ${response.statusText} (${response.status})`)
        }

        const json = await response.json()
        if (json.success && json.data) {
            return json.data.count as number
        }

        throw new Error('Invalid response format from server')
    } catch (error) {
        console.error('Error fetching maps count:', error)
        throw error
    }
}
export async function fetchLatestActivity(accessToken: string): Promise<LauncherActivity | null> {
    try {
        const response = await fetch(`${API_BASE_URL}/launcher/activity/latest`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        })

        if (!response.ok) {
            if (response.status === 404) return null
            throw new Error(`Failed to fetch latest activity: ${response.statusText} (${response.status})`)
        }

        const json = await response.json()
        if (json.success) {
            return json.data as LauncherActivity
        }

        return null
    } catch (error) {
        console.error('Error fetching latest activity:', error)
        return null
    }
}

export interface WorldRecordsParams {
    limit?: number
    offset?: number
    search?: string
    sort?: 'asc' | 'desc'
    sortBy?: 'map' | 'holder' | 'time' | 'difficulty' | 'date'
    addedSince?: string
    maps?: string
    users?: string
    difficulties?: string
    years?: string
    timeRanges?: string
}

const WR_SORT_BY_PARAM: { [K in NonNullable<WorldRecordsParams['sortBy']>]: string } = {
    map: 'map',
    holder: 'holder',
    time: 'time',
    difficulty: 'difficulty',
    date: 'added',
}

function buildWorldRecordsQuery(params: WorldRecordsParams): URLSearchParams {
    const usp = new URLSearchParams()
    if (params.limit !== undefined) usp.set('limit', String(params.limit))
    if (params.offset !== undefined) usp.set('offset', String(params.offset))
    if (params.search) usp.set('search', params.search)
    if (params.sort) usp.set('sort', params.sort)
    if (params.sortBy) usp.set('sort_by', WR_SORT_BY_PARAM[params.sortBy])
    if (params.addedSince) usp.set('added_since', params.addedSince)
    if (params.maps) usp.set('maps', params.maps)
    if (params.users) usp.set('users', params.users)
    if (params.difficulties) usp.set('difficulties', params.difficulties)
    if (params.years) usp.set('years', params.years)
    if (params.timeRanges) usp.set('time_ranges', params.timeRanges)
    return usp
}

export async function fetchWorldRecords(accessToken: string, params: WorldRecordsParams = {}): Promise<Record[]> {
    const response = await apiRequest(`/v2/world_records/?${buildWorldRecordsQuery(params).toString()}`, { token: accessToken })
    if (!response.ok) throw new Error(`Failed to fetch world records: ${response.statusText} (${response.status})`)
    const json = await response.json()
    if (json?.success && Array.isArray(json.data)) return json.data as Record[]
    return []
}

export async function fetchWorldRecordsCount(accessToken: string, params: WorldRecordsParams = {}): Promise<number> {
    const usp = buildWorldRecordsQuery({ ...params, limit: undefined, offset: undefined, sort: undefined, sortBy: undefined })
    usp.set('count', 'true')
    const data = await apiGet<{ count: number }>(`/v2/world_records/?${usp.toString()}`, { token: accessToken })
    return data.count
}

export interface RusherRow {
    user_id: string
    alias: string
    active_title?: ActiveTitle | null
    count: number
    median: number | null
    average: number | null
}

export interface RushersPage {
    total: number
    total_records: number
    max_count: number
    items: RusherRow[]
}

export async function fetchRushers(
    accessToken: string,
    params: { limit?: number; offset?: number; search?: string } = {},
): Promise<RushersPage> {
    const usp = new URLSearchParams()
    if (params.limit !== undefined) usp.set('limit', String(params.limit))
    if (params.offset !== undefined) usp.set('offset', String(params.offset))
    if (params.search) usp.set('search', params.search)
    return apiGet<RushersPage>(`/v2/world_records/rushers/?${usp.toString()}`, { token: accessToken })
}

export interface WorldRecordHolderOption {
    user_id: string
    alias: string
    count: number
}

export interface WorldRecordFilterOptions {
    holders: WorldRecordHolderOption[]
    years: number[]
}

export async function fetchWorldRecordFilterOptions(accessToken: string): Promise<WorldRecordFilterOptions> {
    return apiGet<WorldRecordFilterOptions>('/v2/world_records/filter_options/', { token: accessToken })
}

export interface WorldRecordProgressionEntry {
    cap_id: string
    user_id: string | null
    alias: string | null
    cap_time_seconds: number
    added: string | null
    active_title: ActiveTitle | null
    members?: SummaryTeamMember[] | null
}

export async function fetchWorldRecordProgression(accessToken: string, mapName: string): Promise<WorldRecordProgressionEntry[]> {
    const url = `${API_BASE_URL}/v2/world_records/progression/${encodeURIComponent(mapName)}`
    try {
        const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
        if (!res.ok) return []
        const json = await res.json()
        if (json.success && Array.isArray(json.data)) {
            return json.data as WorldRecordProgressionEntry[]
        }
        return []
    } catch {
        return []
    }
}

export async function fetchMapCapsCount(accessToken: string, mapName: string): Promise<number> {
    const url = `${API_BASE_URL}/caps/count/?map=${encodeURIComponent(mapName)}`
    try {
        const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
        if (!res.ok) return 0
        const json = await res.json()
        if (json.success && json.data && typeof json.data.count === 'number') {
            return json.data.count
        }
        return 0
    } catch {
        return 0
    }
}

export async function fetchUserCapCountForMap(accessToken: string, userId: string | number, mapName: string): Promise<number> {
    const url = `${API_BASE_URL}/caps/count/?user=${encodeURIComponent(String(userId))}&map=${encodeURIComponent(mapName)}`
    try {
        const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
        if (!res.ok) return 0
        const json = await res.json()
        if (json.success && json.data && typeof json.data.count === 'number') {
            return json.data.count
        }
        return 0
    } catch {
        return 0
    }
}

export async function fetchWorldRecordsForMaps(accessToken: string, mapNames: string[]): Promise<Record[]> {
    if (mapNames.length === 0) return []
    const mapsParam = encodeURIComponent(mapNames.join(','))
    const url = `${API_BASE_URL}/v2/world_records/?maps=${mapsParam}&limit=${mapNames.length}`
    try {
        const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
        if (!res.ok) return []
        const json = await res.json()
        if (json.success && Array.isArray(json.data)) return json.data as Record[]
        return []
    } catch {
        return []
    }
}

export interface DemoVideo { type: string; url: string }
export interface DemoConverterStatus {
    response?: { status?: number }
    videos?: DemoVideo[]
    status?: string
}

export interface LeaderboardEntry {
    map: string
    user: string
    cap_time_seconds: number
    added: string
    alias: string
    cap_type: number
    verified: boolean
    id: string
    team?: number | null
    active_title?: ActiveTitle | null
}

export async function fetchMapLeaderboard(accessToken: string, mapName: string, verifiedOnly = false): Promise<LeaderboardEntry[]> {
    try {
        const params = verifiedOnly ? '?verified=true' : ''
        const res = await fetch(`${API_BASE_URL}/caps/leaderboard/map/${encodeURIComponent(mapName)}${params}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
        })
        if (!res.ok) return []
        const json = await res.json()
        if (json.success && Array.isArray(json.data)) return json.data as LeaderboardEntry[]
        return []
    } catch {
        return []
    }
}

export interface TeamRunMember {
    user: string
    alias: string
    cap_id: string
    cap_time_seconds: number | null
    verified: boolean
    disallowed?: boolean
    active_title?: ActiveTitle | null
}

export type TeamRunState = 'incomplete' | 'pending' | 'verified' | 'disallowed'

export interface TeamLeaderboardEntry {
    id: string
    map: string
    added: string
    cap_time_seconds: number
    verified: boolean
    complete: boolean
    disallowed: boolean
    state: TeamRunState
    team_size: number
    user: string
    medal: number
    members: TeamRunMember[]
}

export interface TeamRunStatus {
    complete: boolean
    verified: boolean
    disallowed: boolean
    state: TeamRunState
    invalid_reason?: string | null
    team_time_seconds: number | null
    team_cap_id: string
    members: TeamRunMember[]
    is_combination_best_verified: boolean
    is_combination_best_unverified: boolean
    is_world_record: boolean
}

export interface TeamMapLeaderboardOptions {
    verifiedLimit?: number
    unverifiedLimit?: number
    member?: string | number
    before?: string
    columns?: string[]
    signal?: AbortSignal
}

export async function fetchTeamMapLeaderboard(
    accessToken: string,
    mapName: string,
    opts: TeamMapLeaderboardOptions = {},
): Promise<TeamLeaderboardEntry[]> {
    const usp = new URLSearchParams()
    if (opts.verifiedLimit != null) usp.set('verified_limit', String(opts.verifiedLimit))
    if (opts.unverifiedLimit != null) usp.set('unverified_limit', String(opts.unverifiedLimit))
    if (opts.member != null) usp.set('member', String(opts.member))
    if (opts.before) usp.set('before', opts.before)
    if (opts.columns?.length) usp.set('columns', opts.columns.join(','))
    const qs = usp.toString()
    const res = await fetch(
        `${API_BASE_URL}/caps/leaderboard/team/map/${encodeURIComponent(mapName)}${qs ? `?${qs}` : ''}`,
        { headers: { Authorization: `Bearer ${accessToken}` }, signal: opts.signal },
    )
    if (!res.ok) {
        throw new Error(`Failed to fetch team leaderboard: ${res.statusText} (${res.status})`)
    }
    const json = await res.json()
    if (!json.success || !Array.isArray(json.data)) {
        throw new Error('Invalid team leaderboard response')
    }
    return json.data as TeamLeaderboardEntry[]
}

export interface TeamMapUserStats {
    personal_best_seconds: number | null
    verified: boolean | null
    medal: number | null
    cap_type: number
    rank: number | null
    total_ranks: number
    total_runs: number
    team_cap_id: string | null
    team_run_id: string | null
    added: string | null
}

export async function fetchUserTeamMapStats(
    accessToken: string,
    userId: string | number,
    mapName: string,
): Promise<TeamMapUserStats | null> {
    try {
        const res = await fetch(
            `${API_BASE_URL}/caps/team/stats/${encodeURIComponent(String(userId))}/${encodeURIComponent(mapName)}`,
            { headers: { Authorization: `Bearer ${accessToken}` } },
        )
        if (!res.ok) return null
        const json = await res.json()
        if (json.success && json.data) return json.data as TeamMapUserStats
        return null
    } catch {
        return null
    }
}

export async function fetchTeamRunStatus(
    accessToken: string,
    teamRunId: string,
    signal?: AbortSignal,
): Promise<TeamRunStatus | null> {
    try {
        const res = await fetch(`${API_BASE_URL}/caps/team_runs/${encodeURIComponent(teamRunId)}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
            signal,
        })
        if (!res.ok) return null
        const json = await res.json()
        if (json.success && json.data) return json.data as TeamRunStatus
        return null
    } catch {
        return null
    }
}

export interface TeamCapDetailMember {
    user: string
    alias: string | null
    active_title: ActiveTitle | null
    cap_id: string
    cap_time_seconds: number | null
    verified: boolean
    disallowed: boolean
    has_demo: boolean
    cap?: CapRecord
}

export interface TeamCapMedalThresholds {
    world_record: number | null
    champion: number | null
    gold: number | null
    silver: number | null
    bronze: number | null
}

export interface TeamCapDeltas {
    world_record: number | null
    champion: number | null
    gold: number | null
    silver: number | null
    bronze: number | null
}

export interface TeamCapDetail {
    id: string
    team_run_id: string
    team_cap_id: string
    map: string
    team_size: number
    member_key: string | null
    team_time_seconds: number | null
    cap_type: number
    medal: number
    complete: boolean
    verified: boolean
    disallowed: boolean
    state: TeamRunState
    invalid_reason?: string | null
    public_server: string | null
    added: string | null
    completed_at: string | null
    verified_at: string | null
    members: TeamCapDetailMember[]
    is_world_record: boolean
    is_combination_best_verified: boolean
    is_combination_best_unverified: boolean
    wr_time_seconds: number | null
    rank_on_map: number | null
    total_on_map: number
    medals: TeamCapMedalThresholds | null
    deltas: TeamCapDeltas | null
    server: { name: string | null; region: string | null }
}

export async function fetchTeamCapDetail(
    accessToken: string,
    teamCapId: string,
    signal?: AbortSignal,
): Promise<TeamCapDetail | null> {
    try {
        const res = await fetch(`${API_BASE_URL}/caps/team_caps/${encodeURIComponent(teamCapId)}/detail`, {
            headers: { Authorization: `Bearer ${accessToken}` },
            signal,
        })
        if (!res.ok) return null
        const json = await res.json()
        if (json.success && json.data) return json.data as TeamCapDetail
        return null
    } catch {
        return null
    }
}

export async function fetchDemoStatus(capId: string): Promise<DemoConverterStatus | null> {
    try {
        const res = await fetch(`${GATEWAY_BASE_URL}/democonverter/status/${capId}`)
        if (!res.ok) return null
        const data = await res.json() as DemoConverterStatus
        if (data?.status === 'error') return null
        return data
    } catch {
        return null
    }
}

export function getFirstPersonVideoUrl(status: DemoConverterStatus | null): string | null {
    if (!status || status.status === 'error') return null
    if (status.response?.status !== 4) return null
    const fp = status.videos?.find(v => v.type === 'first_person')
    return fp?.url ?? null
}

export interface CapCheckpoint {
    zone: string
    cumulative: number
    segment: number
}

export interface CapNeighbor {
    rank: number
    id: string
    user: string
    alias: string | null
    cap_time_seconds: number
    active_title: ActiveTitle | null
}

export interface CapRecord {
    id: string
    user: string | number
    map: string
    alias?: string | null
    cap_time_seconds: number
    client_cap_delta?: number | null
    added?: string | null
    verified: boolean
    disallowed: boolean
    cap_type: number
    medal: number
    engine?: string | null
    renderer?: string | null
    spawn_count?: number | null
    team?: number | null
    team_run_id?: string | null
    netspeed_min?: number | null
    netspeed_max?: number | null
    fps_1pc?: number | null
    fps_5pc?: number | null
    fps_25pc?: number | null
    fps_50pc?: number | null
    ping_1pc?: number | null
    ping_5pc?: number | null
    ping_25pc?: number | null
    ping_50pc?: number | null
    active_title?: ActiveTitle | null
    [key: string]: unknown
}

export interface CapDeltas {
    wr: number | null
    champion: number | null
    gold: number | null
    silver: number | null
    bronze: number | null
}

export interface CapMedalThresholds {
    world_record: number | null
    champion: number | null
    gold: number | null
    silver: number | null
    bronze: number | null
}

export interface CapCompareCandidate {
    id: string
    user: string
    alias: string | null
    cap_time_seconds: number
}

export interface CapDetail {
    cap: CapRecord
    checkpoints: CapCheckpoint[]
    has_checkpoints: boolean
    compare_candidates: CapCompareCandidate[]
    wr_checkpoints: CapCheckpoint[]
    wr_cap_id: string | null
    wr_time_seconds: number | null
    rank_on_map: number
    total_on_map: number
    neighbors: { above: CapNeighbor[]; below: CapNeighbor[] }
    deltas: CapDeltas
    medals: CapMedalThresholds
    server: { name: string | null; region: string | null }
}

export async function fetchCapDetail(accessToken: string, capId: string, signal?: AbortSignal): Promise<CapDetail | null> {
    try {
        return await apiGet<CapDetail>(`/caps/${encodeURIComponent(capId)}/detail`, { token: accessToken, signal })
    } catch (e) {
        console.error('fetchCapDetail failed', e)
        return null
    }
}

export async function fetchCapCheckpoints(
    accessToken: string, capId: string, signal?: AbortSignal,
): Promise<{ checkpoints: CapCheckpoint[]; cap_time_seconds: number; alias: string | null; team: number | null } | null> {
    const detail = await fetchCapDetail(accessToken, capId, signal)
    if (!detail) return null
    return {
        checkpoints: detail.checkpoints,
        cap_time_seconds: detail.cap.cap_time_seconds,
        alias: detail.cap.alias ?? null,
        team: detail.cap.team ?? null,
    }
}

export async function fetchRecordsCount(accessToken: string, addedSince?: string): Promise<number> {
    try {
        const addedSinceParam = addedSince ? `&added_since=${encodeURIComponent(addedSince)}` : ''
        const response = await fetch(`${API_BASE_URL}/v2/world_records/?count=true${addedSinceParam}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        })

        if (!response.ok) {
            throw new Error(`Failed to fetch records count: ${response.statusText} (${response.status})`)
        }

        const json = await response.json()
        if (json.success && json.data) {
            return json.data.count as number
        }

        throw new Error('Invalid response format from server')
    } catch (error) {
        console.error('Error fetching records count:', error)
        throw error
    }
}

export async function fetchTitles(accessToken: string, limit: number, offset: number, userId?: string | number): Promise<AssignedTitleV2[]> {
    try {
        const userParam = userId ? `&user=${userId}` : ''
        const response = await fetch(`${API_BASE_URL}/v2/titles/?limit=${limit}&offset=${offset}${userParam}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        })

        if (!response.ok) {
            throw new Error(`Failed to fetch titles: ${response.statusText} (${response.status})`)
        }

        const json = await response.json()
        if (json.success) {
            return (json.data || []) as AssignedTitleV2[]
        }

        throw new Error(json.error || 'Invalid response format from server')
    } catch (error) {
        console.error('Error fetching titles:', error)
        throw error
    }
}

export async function fetchTitlesCount(accessToken: string, userId?: number): Promise<number> {
    try {
        const userParam = userId ? `&user=${userId}` : ''
        const response = await fetch(`${API_BASE_URL}/v2/titles/?count=true${userParam}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        })

        if (!response.ok) {
            throw new Error(`Failed to fetch titles count: ${response.statusText} (${response.status})`)
        }

        const json = await response.json()
        if (json.success && json.data) {
            return json.data.count as number
        }

        throw new Error('Invalid response format from server')
    } catch (error) {
        console.error('Error fetching titles count:', error)
        return 0
    }
}

export async function fetchRecentPlaytime(accessToken: string, limit: number, offset: number): Promise<Playtime[]> {
    try {
        const response = await fetch(`${API_BASE_URL}/playtime/?limit=${limit}&offset=${offset}&order=desc`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        })

        if (!response.ok) {
            throw new Error(`Failed to fetch playtime: ${response.statusText} (${response.status})`)
        }

        const json = await response.json()
        if (Array.isArray(json)) {
            return json as Playtime[]
        }

        throw new Error('Invalid response format from server')
    } catch (error) {
        console.error('Error fetching playtime:', error)
        throw error
    }
}

export async function fetchPlaytimeForMap(accessToken: string, mapName: string): Promise<Playtime[]> {
    try {
        const response = await fetch(`${API_BASE_URL}/playtime/?map=${encodeURIComponent(mapName)}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        })
        if (!response.ok) return []
        const json = await response.json()
        if (Array.isArray(json)) return json as Playtime[]
        if (json?.success && Array.isArray(json.data)) return json.data as Playtime[]
        return []
    } catch (error) {
        console.error('Error fetching playtime for map:', error)
        return []
    }
}

export async function fetchMapsFuzzy(accessToken: string, partialName: string, limit?: number, signal?: AbortSignal): Promise<Map[]> {
    try {
        const usp = new URLSearchParams({ active: 'true' })
        if (limit !== undefined) usp.set('limit', String(limit))
        const response = await fetch(`${API_BASE_URL}/maps/fuzzy/${encodeURIComponent(partialName)}?${usp.toString()}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            },
            signal,
        })

        if (!response.ok) {
            throw new Error(`Failed to fetch fuzzy maps: ${response.statusText} (${response.status})`)
        }

        const json = await response.json()
        if (json.success && json.data) {
            return json.data as Map[]
        }

        throw new Error('Invalid response format from server')
    } catch (error) {
        if ((error as { name?: string })?.name === 'AbortError') throw error
        console.error('Error fetching fuzzy maps:', error)
        return []
    }
}

export async function fetchAllMapReviews(accessToken: string): Promise<MapReview[]> {
    try {
        const response = await fetch(`${API_BASE_URL}/map_reviews/?columns=aesthetics,learning,luck,overall,map_name,user`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        })

        if (!response.ok) {
            throw new Error(`Failed to fetch map reviews: ${response.statusText} (${response.status})`)
        }

        const json = await response.json()
        if (json.success && json.data) {
            return json.data as MapReview[]
        }

        throw new Error('Invalid response format from server')
    } catch (error) {
        console.error('Error fetching all map reviews:', error)
        return []
    }
}

export async function fetchMapReviews(accessToken: string, mapName: string): Promise<MapReview[]> {
    try {
        const response = await fetch(`${API_BASE_URL}/map_reviews/?map_name=${encodeURIComponent(mapName)}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        })

        if (!response.ok) {
            // It's possible there are no reviews, so generic errors might be expected.
            // But we should throw if it's a real error. 
            // The backend returns empty list if no reviews usually, unless error.
            throw new Error(`Failed to fetch map reviews: ${response.statusText} (${response.status})`)
        }

        const json = await response.json()
        if (json.success && json.data) {
            return json.data as MapReview[]
        }

        throw new Error('Invalid response format from server')
    } catch (error) {
        console.error('Error fetching map reviews:', error)
        return []
    }
}

export interface SummaryTeamMember {
    userId: string | null
    alias: string
    activeTitle: ActiveTitle | null
}

export interface SummaryWorldRecord {
    id: string
    mapName: string
    userId: string | null
    alias: string | null
    activeTitle?: ActiveTitle | null
    time: number
    added: string | null
    timeAgo: string
    members?: SummaryTeamMember[] | null
}

export interface SummaryNewMap {
    name: string
    author: string
    difficulty: number
    tags?: string | null
    added: string | null
    timeAgo: string
}

export interface Summary {
    global: {
        newMaps: number
        newRecords: number
    }
    achievements: {
        id: string
        mapName: string
        author: string
        difficulty: number
        time: number
        medal: string
        timeAgo: string
        verified: boolean
        isTeam?: boolean
        teamCapId?: string | null
        teamMembers?: SummaryTeamMember[] | null
    }[]
    recentWorldRecords?: SummaryWorldRecord[]
    newMaps?: SummaryNewMap[]
    latestPatch?: {
        tag: string
        channel: string
        added: string
        release_notes_url: string
    } | null
}

export interface SummaryCap {
    id: string
    mapName: string
    author: string
    difficulty: number
    time: number
    medal: string
    added: string
    verified: boolean
    isTeam?: boolean
    teamMembers?: SummaryTeamMember[] | null
    teamCapId?: string | null
}

export async function fetchSummary(accessToken: string): Promise<Summary> {
    const response = await fetch(`${API_BASE_URL}/v2/summary/`, {
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    })
    if (!response.ok) throw new Error('Failed to fetch summary')
    const json = await response.json()
    return json.data
}

export interface HotMap {
    name: string
    author?: string
    difficulty?: number
    ingameSeconds: number
    spectateSeconds: number
    players: number
}

export async function fetchHotMaps(accessToken: string): Promise<HotMap[]> {
    const response = await fetch(`${API_BASE_URL}/v2/summary/hot_maps`, {
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    })
    if (!response.ok) throw new Error('Failed to fetch hot maps')
    const json = await response.json()
    return Array.isArray(json.data) ? json.data : []
}

export interface PendingReview {
    id: string
    mapName: string
    timeAgo: string
}

export interface PendingReviewsPage {
    total: number
    items: PendingReview[]
}

export async function fetchPendingReviews(
    accessToken: string,
    limit = 10,
    offset = 0,
): Promise<PendingReviewsPage> {
    const response = await fetch(
        `${API_BASE_URL}/v2/summary/pending_reviews?limit=${limit}&offset=${offset}`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } },
    )
    if (!response.ok) throw new Error('Failed to fetch pending reviews')
    const json = await response.json()
    return json.data
}

export async function fetchSummaryCaps(accessToken: string, limit = 50, offset = 0): Promise<SummaryCap[]> {
    const response = await fetch(`${API_BASE_URL}/v2/summary/caps?limit=${limit}&offset=${offset}`, {
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    })
    if (!response.ok) throw new Error('Failed to fetch summary caps')
    const json = await response.json()
    return json.data
}

export async function submitSummaryReview(accessToken: string, review: {
    map_name: string
    aesthetics: number
    learning: number
    luck: number
    difficulty: number
    overall: number
}) {
    const response = await fetch(`${API_BASE_URL}/v2/summary/map_reviews`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(review)
    })
    if (!response.ok) throw new Error('Failed to submit review')
    const json = await response.json()
    return json.data
}

export interface UserFavoriteMap {
    user: number
    map_name: string
    created_at: string
}

export async function fetchUserFavorites(accessToken: string, userId?: string | number): Promise<string[]> {
    try {
        const url = userId !== undefined && userId !== null && userId !== ''
            ? `${API_BASE_URL}/user_favorite_maps/?user=${encodeURIComponent(String(userId))}`
            : `${API_BASE_URL}/user_favorite_maps/`
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        })
        if (!response.ok) {
            throw new Error(`Failed to fetch favorites: ${response.statusText} (${response.status})`)
        }
        const json = await response.json()
        if (json.success && Array.isArray(json.data)) {
            return (json.data as UserFavoriteMap[]).map((row) => row.map_name)
        }
        return []
    } catch (error) {
        console.error('Error fetching favorites:', error)
        return []
    }
}

export async function addFavoriteMap(accessToken: string, mapName: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/user_favorite_maps/`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ map_name: mapName })
    })
    if (!response.ok) {
        throw new Error(`Failed to add favorite: ${response.statusText} (${response.status})`)
    }
}

export async function removeFavoriteMap(accessToken: string, mapName: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/user_favorite_maps/${encodeURIComponent(mapName)}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    })
    if (!response.ok) {
        throw new Error(`Failed to remove favorite: ${response.statusText} (${response.status})`)
    }
}

export async function replaceFavoriteMaps(accessToken: string, mapNames: string[]): Promise<string[]> {
    const response = await fetch(`${API_BASE_URL}/user_favorite_maps/replace`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ map_names: mapNames })
    })
    if (!response.ok) {
        throw new Error(`Failed to replace favorites: ${response.statusText} (${response.status})`)
    }
    const json = await response.json()
    if (json.success && Array.isArray(json.data)) {
        return (json.data as UserFavoriteMap[]).map((row) => row.map_name)
    }
    return []
}

export interface UserSummaryProfile {
    id: string
    alias: string | null
    registered_at: string | null
    twitch_url: string | null
    flag: string | null
    utbt_role: number
    active_title: ActiveTitle | null
    active_ban: { reason?: string; end?: string; start?: string; active?: boolean } | null
}

export interface UserSummaryMedals {
    user_id: string
    world_records: number
    champion_medals: number
    gold_medals: number
    silver_medals: number
    bronze_medals: number
    certified_caps: number
    points: number
    rank: number
}

export interface UserSummaryCounts {
    total_caps: number
    verified_caps: number
    disallowed_caps: number
    certified_caps: number
    unique_maps: number
    uncapped_maps: number
    total_playtime_seconds: number
    spectator_playtime_seconds: number
    map_review_count: number
    wr_count: number
    favorite_count: number
}

export interface UserSummaryRecentWr {
    cap_id: string | null
    mapName: string
    time: number
    added: string | null
}

export interface UserSummary {
    profile: UserSummaryProfile
    medals: UserSummaryMedals
    counts: UserSummaryCounts
    recentCaps: SummaryCap[]
    recentWrs: UserSummaryRecentWr[]
}

function normaliseActiveTitle(raw: any): ActiveTitle | null {
    if (!raw || typeof raw !== 'object') return null
    if (!raw.name) return null
    return {
        name: raw.name,
        rarity: raw.rarity,
        color_r: raw.color_r ?? 255,
        color_g: raw.color_g ?? 255,
        color_b: raw.color_b ?? 255,
    }
}

export async function fetchUserSummary(accessToken: string, userId: string | number): Promise<UserSummary> {
    const response = await fetch(`${API_BASE_URL}/v2/summary/user/${encodeURIComponent(String(userId))}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!response.ok) {
        throw new Error(`Failed to fetch user summary: ${response.statusText} (${response.status})`)
    }
    const json = await response.json()
    if (!json.success || !json.data) {
        throw new Error('Invalid response format from server')
    }
    const data = json.data
    const profile = data.profile ?? {}
    const activeBan = profile.active_ban && Object.keys(profile.active_ban).length ? profile.active_ban : null
    const normalisedProfile: UserSummaryProfile = {
        id: profile.id != null ? String(profile.id) : String(userId),
        alias: profile.alias ?? null,
        registered_at: profile.registered_at ?? null,
        twitch_url: profile.twitch_url ?? null,
        flag: profile.flag ?? null,
        utbt_role: typeof profile.utbt_role === 'number' ? profile.utbt_role : 0,
        active_title: normaliseActiveTitle(profile.active_title),
        active_ban: activeBan,
    }
    return {
        profile: normalisedProfile,
        medals: data.medals,
        counts: data.counts,
        recentCaps: data.recentCaps ?? [],
        recentWrs: data.recentWrs ?? [],
    }
}

export interface AchievementTitle {
    id: number
    name: string
    rarity: number
    color_r: number
    color_g: number
    color_b: number
}

export type AchievementCategory = 'general' | 'solo' | 'team' | 'mapper' | 'mastery'

export interface AchievementTier {
    index?: number
    level: number
    threshold: number
    dynamic?: boolean
    is_all?: boolean
    grants_title_id: number | null
    title?: AchievementTitle | null
    unlocked_at?: string | null
}

export interface AchievementDefinition {
    code: string
    name: string
    description: string
    metric: string
    icon: string
    goal: string            // requirement phrasing with {n} placeholder, e.g. "Reach {n} hours played"
    goal_all?: string | null // phrasing for an "all" tier, e.g. "Cap every map"
    unit?: string           // short noun for the "N <unit> to go" countdown, e.g. "hours"
    team?: boolean
    category?: AchievementCategory
    tiers: AchievementTier[]
}

export interface AchievementProgress {
    code: string
    current_value: number
    current_tier: number
    current_level: number
    next_threshold: number | null
    max_threshold: number
    percent_to_next: number
    unlocked: boolean
    maxed: boolean
    unlocked_tiers: AchievementTier[]
    current?: {
        value: number
        label: string
        extra?: { value: number; label: string } | null
    } | null
}

export interface MyAchievements {
    items: AchievementProgress[]
}

export async function fetchAchievementDefinitions(accessToken: string): Promise<AchievementDefinition[]> {
    const response = await fetch(`${API_BASE_URL}/v2/achievements/definitions`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!response.ok) return []
    const json = await response.json()
    if (json?.success && Array.isArray(json.data?.achievements)) return json.data.achievements as AchievementDefinition[]
    return []
}

export async function fetchMyAchievements(accessToken: string): Promise<MyAchievements> {
    const response = await fetch(`${API_BASE_URL}/v2/achievements/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!response.ok) return { items: [] }
    const json = await response.json()
    if (json?.success && json.data && Array.isArray(json.data.items)) return json.data as MyAchievements
    return { items: [] }
}

// Another player's achievements (read-only; never stamps unlocks or grants titles).
export async function fetchUserAchievements(accessToken: string, userId: string | number): Promise<MyAchievements> {
    const response = await fetch(`${API_BASE_URL}/v2/achievements/user/${encodeURIComponent(String(userId))}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!response.ok) return { items: [] }
    const json = await response.json()
    if (json?.success && json.data && Array.isArray(json.data.items)) return json.data as MyAchievements
    return { items: [] }
}

export interface UserCapRow {
    id: string
    mapName: string
    author: string
    difficulty: number
    time: number
    medal: string
    added: string | null
    timeAgo?: string
    verified: boolean
    disallowed: boolean
    disallowed_at?: string | null
    disallow_reason?: string | null
    cap_type: number
    isTeam: boolean
    teamMembers: SummaryTeamMember[] | null
    teamCapId: string | null
}

export interface UserCapsPage {
    total: number
    items: UserCapRow[]
}

export type CapFilter = 'all' | 'verified' | 'certified' | 'casual' | 'disallowed'

export interface UserPersonalBestRow {
    id: string
    mapName: string
    author: string
    difficulty: number
    time: number
    medal: string
    added: string | null
    verified: boolean
    cap_type: number
    isTeam: boolean
    teamMembers: SummaryTeamMember[] | null
    teamCapId: string | null
}

export interface UserPersonalBestsPage {
    total: number
    items: UserPersonalBestRow[]
}

export interface PersonalBestsParams {
    limit?: number
    offset?: number
    mapFuzzy?: string
    capFilter?: CapFilter
    favoritesOnly?: boolean
    sort?: 'added' | 'time' | 'map'
    order?: 'asc' | 'desc'
}

export async function fetchPersonalBestsForUser(
    accessToken: string,
    userId: string | number,
    params: PersonalBestsParams = {},
): Promise<UserPersonalBestsPage> {
    const usp = new URLSearchParams({
        limit: String(params.limit ?? 25),
        offset: String(params.offset ?? 0),
    })
    if (params.mapFuzzy) usp.set('map_fuzzy', params.mapFuzzy)
    if (params.capFilter && params.capFilter !== 'all') usp.set('cap_filter', params.capFilter)
    if (params.favoritesOnly) usp.set('favorites_only', 'true')
    if (params.sort) usp.set('sort', params.sort)
    if (params.order) usp.set('order', params.order)
    const response = await fetch(`${API_BASE_URL}/v2/summary/user/${encodeURIComponent(String(userId))}/personal_bests?${usp.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!response.ok) return { total: 0, items: [] }
    const json = await response.json()
    if (json?.success && json.data && Array.isArray(json.data.items)) return json.data as UserPersonalBestsPage
    return { total: 0, items: [] }
}

export interface UserCapsParams {
    limit?: number
    offset?: number
    mapFuzzy?: string
    capFilter?: CapFilter
    favoritesOnly?: boolean
    sort?: 'added' | 'time' | 'map' | 'disallowed_at'
    order?: 'asc' | 'desc'
}

export async function fetchCapsForUser(
    accessToken: string,
    userId: string | number,
    params: UserCapsParams = {},
): Promise<UserCapsPage> {
    const usp = new URLSearchParams({
        limit: String(params.limit ?? 25),
        offset: String(params.offset ?? 0),
    })
    if (params.mapFuzzy) usp.set('map_fuzzy', params.mapFuzzy)
    if (params.capFilter && params.capFilter !== 'all') usp.set('cap_filter', params.capFilter)
    if (params.favoritesOnly) usp.set('favorites_only', 'true')
    if (params.sort) usp.set('sort', params.sort)
    if (params.order) usp.set('order', params.order)
    const response = await fetch(`${API_BASE_URL}/v2/summary/user/${encodeURIComponent(String(userId))}/caps?${usp.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!response.ok) return { total: 0, items: [] }
    const json = await response.json()
    if (json?.success && json.data && Array.isArray(json.data.items)) return json.data as UserCapsPage
    return { total: 0, items: [] }
}

export async function fetchCapsCountForUser(
    accessToken: string,
    userId: string | number,
    extra: { verified?: boolean } = {},
): Promise<number> {
    const usp = new URLSearchParams({ user: String(userId) })
    if (extra.verified !== undefined) usp.set('verified', String(extra.verified))
    const response = await fetch(`${API_BASE_URL}/caps/count/?${usp.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!response.ok) return 0
    const json = await response.json()
    if (json?.success && json.data && typeof json.data.count === 'number') return json.data.count
    return 0
}

export interface UserWorldRecordsParams {
    limit?: number
    offset?: number
    sort?: 'asc' | 'desc'
    sortBy?: 'added' | 'time' | 'map'
    mapFuzzy?: string
}

export async function fetchUserWorldRecords(
    accessToken: string,
    userId: string | number,
    params: UserWorldRecordsParams = {},
): Promise<Record[]> {
    const usp = new URLSearchParams({
        user: String(userId),
        limit: String(params.limit ?? 25),
        offset: String(params.offset ?? 0),
        sort: params.sort ?? 'desc',
    })
    if (params.sortBy) usp.set('sort_by', params.sortBy)
    if (params.mapFuzzy) usp.set('map', params.mapFuzzy)
    const response = await fetch(`${API_BASE_URL}/v2/world_records/?${usp.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!response.ok) return []
    const json = await response.json()
    if (json?.success && Array.isArray(json.data)) return json.data as Record[]
    return []
}

export async function fetchUserWorldRecordsCount(
    accessToken: string,
    userId: string | number,
): Promise<number> {
    const usp = new URLSearchParams({ user: String(userId), count: 'true' })
    const response = await fetch(`${API_BASE_URL}/v2/world_records/?${usp.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!response.ok) return 0
    const json = await response.json()
    if (json?.success && json.data && typeof json.data.count === 'number') return json.data.count
    return 0
}

export interface PlaytimeByMapRow {
    map: string
    total_seconds: number
    sessions: number
    last_played: string | null
}

export interface PlaytimeByMapPage {
    total: number
    items: PlaytimeByMapRow[]
}

export interface PlaytimeByMapParams {
    limit?: number
    offset?: number
    includeSpectator?: boolean
    mapFuzzy?: string
    favoritesOnly?: boolean
    sort?: 'hours' | 'sessions' | 'last_played' | 'map'
    order?: 'asc' | 'desc'
}

export async function fetchPlaytimeByMap(
    accessToken: string,
    userId: string | number,
    params: PlaytimeByMapParams = {},
): Promise<PlaytimeByMapPage> {
    const usp = new URLSearchParams({
        limit: String(params.limit ?? 25),
        offset: String(params.offset ?? 0),
    })
    if (params.includeSpectator) usp.set('include_spectator', 'true')
    if (params.mapFuzzy) usp.set('map_fuzzy', params.mapFuzzy)
    if (params.favoritesOnly) usp.set('favorites_only', 'true')
    if (params.sort) usp.set('sort', params.sort)
    if (params.order) usp.set('order', params.order)
    const response = await fetch(`${API_BASE_URL}/playtime/by_map/${encodeURIComponent(String(userId))}?${usp.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!response.ok) return { total: 0, items: [] }
    const json = await response.json()
    if (json?.success && json.data && Array.isArray(json.data.items)) {
        return json.data as PlaytimeByMapPage
    }
    return { total: 0, items: [] }
}

export interface UncappedMapsParams {
    limit?: number
    offset?: number
    mapFuzzy?: string
    sort?: 'name' | 'difficulty' | 'added'
    order?: 'asc' | 'desc'
    difficultyMin?: number
    difficultyMax?: number
}

export async function fetchUncappedMaps(
    accessToken: string,
    userId: string | number,
    params: UncappedMapsParams = {},
): Promise<Map[]> {
    const usp = new URLSearchParams({
        limit: String(params.limit ?? 25),
        offset: String(params.offset ?? 0),
    })
    if (params.mapFuzzy) usp.set('map_fuzzy', params.mapFuzzy)
    if (params.sort) usp.set('sort', params.sort)
    if (params.order) usp.set('order', params.order)
    if (params.difficultyMin !== undefined) usp.set('difficulty_min', String(params.difficultyMin))
    if (params.difficultyMax !== undefined) usp.set('difficulty_max', String(params.difficultyMax))
    const response = await fetch(`${API_BASE_URL}/caps/uncapped/${encodeURIComponent(String(userId))}?${usp.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!response.ok) return []
    const json = await response.json()
    if (json?.success && Array.isArray(json.data)) return json.data as Map[]
    return []
}

export async function fetchUncappedMapsCount(
    accessToken: string,
    userId: string | number,
): Promise<number> {
    const usp = new URLSearchParams({ count: 'true' })
    const response = await fetch(`${API_BASE_URL}/caps/uncapped/${encodeURIComponent(String(userId))}?${usp.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!response.ok) return 0
    const json = await response.json()
    if (json?.success && json.data && typeof json.data.count === 'number') return json.data.count
    return 0
}

export async function fetchMapReviewsByUser(
    accessToken: string,
    userId: string | number,
): Promise<MapReview[]> {
    const response = await fetch(`${API_BASE_URL}/map_reviews/?user=${encodeURIComponent(String(userId))}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!response.ok) return []
    const json = await response.json()
    if (json?.success && Array.isArray(json.data)) return json.data as MapReview[]
    if (Array.isArray(json)) return json as MapReview[]
    return []
}

export interface UserActivityBucket {
    week: string
    caps: number
    hours: number
}

export async function fetchUserActivity(
    accessToken: string,
    userId: string | number,
): Promise<UserActivityBucket[]> {
    const response = await fetch(`${API_BASE_URL}/v2/summary/user/${encodeURIComponent(String(userId))}/activity`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!response.ok) return []
    const json = await response.json()
    if (json?.success && json.data && Array.isArray(json.data.items)) {
        return json.data.items as UserActivityBucket[]
    }
    return []
}

export async function fetchPlaytimeForUser(
    accessToken: string,
    userId: string | number,
    { limit = 500 }: { limit?: number } = {},
): Promise<Playtime[]> {
    const response = await fetch(`${API_BASE_URL}/playtime/?user=${encodeURIComponent(String(userId))}&limit=${limit}&order=desc`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!response.ok) return []
    const json = await response.json()
    if (Array.isArray(json)) return json as Playtime[]
    if (json?.success && Array.isArray(json.data)) return json.data as Playtime[]
    return []
}

export async function assignTitle(accessToken: string, titleId?: string | null): Promise<void> {
    try {
        const response = await fetch(`${API_BASE_URL}/v2/titles/assign`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ title_id: titleId ?? null })
        })

        if (!response.ok) {
            throw new Error(`Failed to assign title: ${response.statusText} (${response.status})`)
        }

        const json = await response.json()
        if (!json.success) {
            throw new Error(json.reason || 'Failed to assign title')
        }
    } catch (error) {
        console.error('Error assigning title:', error)
        throw error
    }
}

export interface PlayerListRow {
    id: string
    alias: string | null
    registered_at: string | null
    utbt_role: number
    active_title: ActiveTitle | null
    banned: boolean
    ban_reason: string | null
    ban_expires: string | null
    rank: number
    points: number
    world_records: number
    champion_medals: number
    gold_medals: number
    silver_medals: number
    bronze_medals: number
    certified_caps: number
}

export type PlayerSortField =
    | 'rank' | 'points' | 'alias' | 'registered_at'
    | 'world_records' | 'champion_medals' | 'gold_medals'
    | 'silver_medals' | 'bronze_medals' | 'certified_caps'

export interface PlayerListParams {
    search?: string
    sort?: PlayerSortField
    order?: 'asc' | 'desc'
    limit?: number
    offset?: number
}

function buildPlayerQuery(params: PlayerListParams): string {
    const usp = new URLSearchParams()
    if (params.search) usp.set('search', params.search)
    if (params.sort) usp.set('sort', params.sort)
    if (params.order) usp.set('order', params.order)
    if (params.limit !== undefined) usp.set('limit', String(params.limit))
    if (params.offset !== undefined) usp.set('offset', String(params.offset))
    return usp.toString()
}

export async function fetchPlayers(accessToken: string, params: PlayerListParams = {}): Promise<PlayerListRow[]> {
    const qs = buildPlayerQuery(params)
    const response = await fetch(`${API_BASE_URL}/v2/players/?${qs}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!response.ok) {
        throw new Error(`Failed to fetch players: ${response.statusText} (${response.status})`)
    }
    const json = await response.json()
    if (json.success && Array.isArray(json.data)) {
        return (json.data as any[]).map(row => ({
            ...row,
            id: String(row.id),
            active_title: normaliseActiveTitle(row.active_title),
        })) as PlayerListRow[]
    }
    throw new Error('Invalid response format from server')
}

export async function fetchPlayersCount(
    accessToken: string,
    params: Pick<PlayerListParams, 'search'> = {},
): Promise<number> {
    const usp = new URLSearchParams()
    if (params.search) usp.set('search', params.search)
    const response = await fetch(`${API_BASE_URL}/v2/players/count/?${usp.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!response.ok) {
        throw new Error(`Failed to fetch players count: ${response.statusText} (${response.status})`)
    }
    const json = await response.json()
    if (json.success && json.data) {
        return json.data.count as number
    }
    throw new Error('Invalid response format from server')
}

export interface CapItAllRow {
    user_id: string
    alias: string | null
    active_title: ActiveTitle | null
    rank: number
    certified_caps: number
    certified_percentage: number
    non_certified_caps: number
    non_certified_percentage: number
    team_caps: number
    team_percentage: number
    total_caps: number
    total_percentage: number
}

export interface CapItAllParams {
    search?: string
    limit?: number
    offset?: number
}

export interface CapItAllLeaderboardPage {
    mapCount: number
    total: number
    items: CapItAllRow[]
}

function normaliseCapItAllRows(raw: any): CapItAllRow[] {
    if (!Array.isArray(raw)) return []
    return raw.map(row => ({
        user_id: String(row.user_id),
        alias: row.alias ?? null,
        active_title: normaliseActiveTitle(row.active_title),
        rank: Number(row.rank) || 0,
        certified_caps: Number(row.certified_caps) || 0,
        certified_percentage: Number(row.certified_percentage) || 0,
        non_certified_caps: Number(row.non_certified_caps) || 0,
        non_certified_percentage: Number(row.non_certified_percentage) || 0,
        team_caps: Number(row.team_caps) || 0,
        team_percentage: Number(row.team_percentage) || 0,
        total_caps: Number(row.total_caps) || 0,
        total_percentage: Number(row.total_percentage) || 0,
    }))
}

export async function fetchCapItAllLeaderboard(
    accessToken: string,
    params: CapItAllParams = {},
): Promise<CapItAllLeaderboardPage> {
    const usp = new URLSearchParams()
    if (params.search) usp.set('search', params.search)
    if (params.limit !== undefined) usp.set('limit', String(params.limit))
    if (params.offset !== undefined) usp.set('offset', String(params.offset))
    const response = await fetch(`${API_BASE_URL}/v2/leaderboards/cap_it_all?${usp.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!response.ok) {
        throw new Error(`Failed to fetch leaderboard: ${response.statusText} (${response.status})`)
    }
    const json = await response.json()
    if (json.success && json.data) {
        return {
            mapCount: Number(json.data.map_count) || 0,
            total: Number(json.data.total) || 0,
            items: normaliseCapItAllRows(json.data.items),
        }
    }
    throw new Error('Invalid response format from server')
}

export type TeamRole = 'owner' | 'admin' | 'member'
export type TeamMemberStatus = 'invited' | 'applied' | 'active' | 'blocked'
export type TeamSort = 'added' | 'members' | 'name'

export interface TeamCore {
    id: string
    name: string
    tag: string | null
    tag_position: TeamTagPosition | null
    is_open: boolean
    owner: string
    member_count: number
    added: string | null
}

export interface TeamMember {
    user: string
    alias: string | null
    role: TeamRole
    status: TeamMemberStatus
    joined_at: string | null
    tag: string | null
    tag_position: TeamTagPosition | null
    tagged_alias: string | null
    title?: ActiveTitle | null
}

export interface Lineup {
    id: string
    team_id: string
    label: string
    member_key: string
    members: string[]
    added: string | null
}

export interface TeamDetail extends TeamCore {
    members: TeamMember[]
    lineups: Lineup[]
}

export interface TeamDirectoryPage {
    total: number
    teams: TeamCore[]
}

export type TeamActivityType = 'cap' | 'world_record' | 'playtime'

export interface TeamActivityItem {
    type: TeamActivityType
    user: string
    alias: string | null
    title: ActiveTitle | null
    map: string | null
    cap_id: string | null
    cap_time_seconds: number | null
    time_played_seconds: number | null
    medal: string | null
    verified: boolean | null
    added: string | null
}

export interface TeamActivityPage {
    total: number
    caps: number
    world_records: number
    playtime: number
    items: TeamActivityItem[]
}

export interface CreateTeamInput {
    name: string
    tag?: string | null
    tag_position?: TeamTagPosition
    is_open?: boolean
}

export interface UpdateTeamInput {
    name?: string
    tag?: string | null
    tag_position?: TeamTagPosition
    is_open?: boolean
}

export interface TeamDirectoryParams {
    limit?: number
    offset?: number
    search?: string
    isOpen?: boolean
    sort?: TeamSort
    order?: 'asc' | 'desc'
}

export async function createTeam(accessToken: string, input: CreateTeamInput): Promise<TeamDetail> {
    return apiGet<TeamDetail>('/teams/', { token: accessToken, method: 'POST', body: input })
}

export async function fetchTeams(accessToken: string, params: TeamDirectoryParams = {}): Promise<TeamDirectoryPage> {
    const usp = new URLSearchParams()
    if (params.limit !== undefined) usp.set('limit', String(params.limit))
    if (params.offset !== undefined) usp.set('offset', String(params.offset))
    if (params.search) usp.set('search', params.search)
    if (params.isOpen !== undefined) usp.set('is_open', String(params.isOpen))
    if (params.sort) usp.set('sort', params.sort)
    if (params.order) usp.set('order', params.order)
    return apiGet<TeamDirectoryPage>(`/teams/?${usp.toString()}`, { token: accessToken })
}

export async function fetchTeam(accessToken: string, teamId: string): Promise<TeamDetail> {
    return apiGet<TeamDetail>(`/teams/${encodeURIComponent(teamId)}`, { token: accessToken })
}

export async function fetchTeamActivity(
    accessToken: string,
    teamId: string,
    params: { limit?: number } = {},
): Promise<TeamActivityPage> {
    const usp = new URLSearchParams()
    if (params.limit !== undefined) usp.set('limit', String(params.limit))
    return apiGet<TeamActivityPage>(`/teams/${encodeURIComponent(teamId)}/activity?${usp.toString()}`, { token: accessToken })
}

export type TeamAuditAction =
    | 'create' | 'update' | 'invite' | 'apply' | 'withdraw' | 'decline' | 'join'
    | 'approve' | 'deny' | 'block' | 'unblock' | 'kick' | 'promote' | 'demote' | 'transfer' | 'leave'

export interface TeamAuditEntry {
    id: string
    action: TeamAuditAction | string
    actor: string | null
    actor_alias: string | null
    target: string | null
    target_alias: string | null
    created_at: string | null
}

export async function fetchTeamAudit(
    accessToken: string,
    teamId: string,
    params: { limit?: number } = {},
): Promise<TeamAuditEntry[]> {
    const usp = new URLSearchParams()
    if (params.limit !== undefined) usp.set('limit', String(params.limit))
    return apiGetList<TeamAuditEntry>(`/teams/${encodeURIComponent(teamId)}/audit?${usp.toString()}`, { token: accessToken })
}

export async function updateTeam(accessToken: string, teamId: string, input: UpdateTeamInput): Promise<TeamDetail> {
    return apiGet<TeamDetail>(`/teams/${encodeURIComponent(teamId)}`, { token: accessToken, method: 'PATCH', body: input })
}

export async function disbandTeam(accessToken: string, teamId: string): Promise<{ id: string; disbanded: boolean }> {
    return apiGet(`/teams/${encodeURIComponent(teamId)}`, { token: accessToken, method: 'DELETE' })
}

export async function transferTeamOwnership(accessToken: string, teamId: string, user: string): Promise<TeamDetail> {
    return apiGet<TeamDetail>(`/teams/${encodeURIComponent(teamId)}/transfer`, { token: accessToken, method: 'POST', body: { user } })
}

export async function fetchTeamMembers(accessToken: string, teamId: string): Promise<TeamMember[]> {
    return apiGetList<TeamMember>(`/teams/${encodeURIComponent(teamId)}/members`, { token: accessToken })
}

export async function inviteToTeam(accessToken: string, teamId: string, user: string): Promise<TeamDetail> {
    return apiGet<TeamDetail>(`/teams/${encodeURIComponent(teamId)}/invite`, { token: accessToken, method: 'POST', body: { user } })
}

export async function applyToTeam(accessToken: string, teamId: string): Promise<TeamDetail> {
    return apiGet<TeamDetail>(`/teams/${encodeURIComponent(teamId)}/apply`, { token: accessToken, method: 'POST' })
}

export async function acceptTeamInvite(accessToken: string, teamId: string): Promise<TeamDetail> {
    return apiGet<TeamDetail>(`/teams/${encodeURIComponent(teamId)}/accept`, { token: accessToken, method: 'POST' })
}

export async function withdrawApplication(accessToken: string, teamId: string): Promise<TeamDetail> {
    return apiGet<TeamDetail>(`/teams/${encodeURIComponent(teamId)}/withdraw`, { token: accessToken, method: 'POST' })
}

export async function declineTeamInvite(accessToken: string, teamId: string): Promise<TeamDetail> {
    return apiGet<TeamDetail>(`/teams/${encodeURIComponent(teamId)}/decline`, { token: accessToken, method: 'POST' })
}

export async function leaveTeam(accessToken: string, teamId: string): Promise<{ id: string; left: boolean }> {
    return apiGet(`/teams/${encodeURIComponent(teamId)}/leave`, { token: accessToken, method: 'POST' })
}

export async function approveTeamMember(accessToken: string, teamId: string, user: string): Promise<TeamDetail> {
    return apiGet<TeamDetail>(`/teams/${encodeURIComponent(teamId)}/members/${encodeURIComponent(user)}/approve`, { token: accessToken, method: 'POST' })
}

export async function denyTeamMember(accessToken: string, teamId: string, user: string, block = false): Promise<TeamDetail> {
    return apiGet<TeamDetail>(`/teams/${encodeURIComponent(teamId)}/members/${encodeURIComponent(user)}/deny`, { token: accessToken, method: 'POST', body: { block } })
}

export async function unblockTeamMember(accessToken: string, teamId: string, user: string): Promise<TeamDetail> {
    return apiGet<TeamDetail>(`/teams/${encodeURIComponent(teamId)}/members/${encodeURIComponent(user)}/unblock`, { token: accessToken, method: 'POST' })
}

export async function kickTeamMember(accessToken: string, teamId: string, user: string): Promise<TeamDetail> {
    return apiGet<TeamDetail>(`/teams/${encodeURIComponent(teamId)}/members/${encodeURIComponent(user)}/kick`, { token: accessToken, method: 'POST' })
}

export async function setTeamMemberRole(accessToken: string, teamId: string, user: string, role: 'admin' | 'member'): Promise<TeamDetail> {
    return apiGet<TeamDetail>(`/teams/${encodeURIComponent(teamId)}/members/${encodeURIComponent(user)}/role`, { token: accessToken, method: 'POST', body: { role } })
}

export async function fetchLineups(accessToken: string, teamId: string): Promise<Lineup[]> {
    return apiGetList<Lineup>(`/teams/${encodeURIComponent(teamId)}/lineups`, { token: accessToken })
}

export async function createLineup(accessToken: string, teamId: string, input: { label: string; members: string[] }): Promise<Lineup> {
    return apiGet<Lineup>(`/teams/${encodeURIComponent(teamId)}/lineups`, { token: accessToken, method: 'POST', body: input })
}

export async function updateLineup(accessToken: string, teamId: string, lineupId: string, label: string): Promise<Lineup> {
    return apiGet<Lineup>(`/teams/${encodeURIComponent(teamId)}/lineups/${encodeURIComponent(lineupId)}`, { token: accessToken, method: 'PATCH', body: { label } })
}

export async function deleteLineup(accessToken: string, teamId: string, lineupId: string): Promise<{ id: string; deleted: boolean }> {
    return apiGet(`/teams/${encodeURIComponent(teamId)}/lineups/${encodeURIComponent(lineupId)}`, { token: accessToken, method: 'DELETE' })
}

export async function fetchMyTeam(accessToken: string): Promise<TeamDetail | null> {
    const data = await apiGet<{ team: TeamDetail | null }>('/me/team', { token: accessToken })
    return data.team
}

export async function fetchMyInvitations(accessToken: string): Promise<TeamCore[]> {
    return apiGetList<TeamCore>('/me/invitations', { token: accessToken })
}

export async function fetchMyApplications(accessToken: string): Promise<TeamCore[]> {
    return apiGetList<TeamCore>('/me/applications', { token: accessToken })
}
