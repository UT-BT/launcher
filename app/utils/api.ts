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
    rarity: number
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

export interface UserProfile extends AuthConfig {
    active_title?: UserTitle | null
    alias?: string | null
    id?: string | null
    latest_activity?: LauncherActivity | null
}

export interface Map {
    name: string
    added: string
    difficulty: number
    active: boolean
    tags?: string
    author: string | number
    author_str?: string
    author_ref?: number
    url?: string
    world_record?: number
    champion_medal?: number
    gold_medal?: number
    silver_medal?: number
    bronze_medal?: number
}

export interface MapMetadata {
    name: string
    added: string
    difficulty: number
    active?: boolean
    tags?: string
    author?: string | number
    author_str?: string
    author_ref?: number
    url?: string
    world_record?: number
    champion_medal?: number
    gold_medal?: number
    silver_medal?: number
    bronze_medal?: number
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


const API_BASE_URL = import.meta.env.DEV ? 'http://localhost:5000' : 'https://api.utbt.net'

const DEFAULT_TIMEOUT_MS = 20_000

export interface ApiRequestOptions {
    token?: string
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
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

export async function apiGet<T>(path: string, opts: ApiRequestOptions = {}): Promise<T> {
    const res = await apiRequest(path, opts)
    if (!res.ok) {
        throw new Error(`Request failed: ${res.statusText} (${res.status})`)
    }
    const json = await res.json()
    if (json && json.success && json.data !== null && json.data !== undefined) {
        return json.data as T
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
    'active',
]

const MAP_METADATA_COLUMNS = [
    'name', 'added', 'difficulty', 'tags', 'author', 'author_str', 'author_ref',
    'world_record', 'champion_medal', 'gold_medal', 'silver_medal', 'bronze_medal',
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
    return apiGet<Map[]>(`/maps/?${buildMapQuery(params)}`, { token: accessToken })
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

export async function fetchRecords(accessToken: string, limit: number, offset: number, sort?: string): Promise<Record[]> {
    try {
        const sortParam = sort ? `&sort=${sort}` : ''
        const response = await fetch(`${API_BASE_URL}/v2/world_records/?limit=${limit}&offset=${offset}${sortParam}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        })

        if (!response.ok) {
            throw new Error(`Failed to fetch records: ${response.statusText} (${response.status})`)
        }

        const json = await response.json()
        if (json.success && json.data) {
            return json.data as Record[]
        }

        throw new Error('Invalid response format from server')
    } catch (error) {
        console.error('Error fetching records:', error)
        throw error
    }
}

export async function fetchAllWorldRecords(accessToken: string): Promise<Record[]> {
    const pageSize = 500
    const out: Record[] = []
    let offset = 0
    while (true) {
        const batch = await fetchRecords(accessToken, pageSize, offset)
        out.push(...batch)
        if (batch.length < pageSize) break
        offset += pageSize
        if (offset > 50_000) break
    }
    return out
}

export interface WorldRecordProgressionEntry {
    cap_id: string
    user_id: string | null
    alias: string | null
    cap_time_seconds: number
    added: string | null
    active_title: ActiveTitle | null
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
    // Same-team caps from other players that have checkpoint data (routes only
    // align within a team). Drives the split comparison picker.
    compare_candidates: CapCompareCandidate[]
    wr_checkpoints: CapCheckpoint[]
    wr_cap_id: string | null
    wr_time_seconds: number | null
    rank_on_map: number
    total_on_map: number
    neighbors: { above: CapNeighbor | null; below: CapNeighbor | null }
    deltas: CapDeltas
    medals: CapMedalThresholds
    server: { name: string | null; region: string | null }
}

export interface MovementMetricAgg {
    label: string
    direction: 'lower' | 'higher'
    avg: number | null
    p10: number | null
    p50: number | null
    p90: number | null
    min: number | null
    n: number
}

export interface MovementAggregate {
    map: string
    sample_size: number
    // NB: `Record` is shadowed by a local interface in this file — use an index
    // signature so this stays the generic map type.
    metrics: { [key: string]: MovementMetricAgg }
}

export async function fetchCapDetail(accessToken: string, capId: string, signal?: AbortSignal): Promise<CapDetail | null> {
    try {
        return await apiGet<CapDetail>(`/caps/${encodeURIComponent(capId)}/detail`, { token: accessToken, signal })
    } catch (e) {
        console.error('fetchCapDetail failed', e)
        return null
    }
}

export async function fetchMovementAggregate(accessToken: string, mapName: string, signal?: AbortSignal): Promise<MovementAggregate | null> {
    try {
        return await apiGet<MovementAggregate>(`/caps/movement_aggregate/map/${encodeURIComponent(mapName)}`, { token: accessToken, signal })
    } catch (e) {
        console.error('fetchMovementAggregate failed', e)
        return null
    }
}

/** Checkpoints for a run to overlay in the compare picker. Reuses the detail
 *  endpoint so the (semicolon) parsing stays server-side only. */
export async function fetchCapCheckpoints(
    accessToken: string, capId: string, signal?: AbortSignal,
): Promise<{ checkpoints: CapCheckpoint[]; cap_time_seconds: number; alias: string | null } | null> {
    const detail = await fetchCapDetail(accessToken, capId, signal)
    if (!detail) return null
    return {
        checkpoints: detail.checkpoints,
        cap_time_seconds: detail.cap.cap_time_seconds,
        alias: detail.cap.alias ?? null,
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

export interface SummaryTopServer {
    id: string
    ip: string
    hostname: string
    hostport: number
    map_name: string
    player_count: number
    max_players: number
    spectators: number
    certified_records: boolean
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
    playtime: {
        weekly: number
        weeklyTop: number | null
        monthly: number
        monthlyTop: number | null
        yearly: number
        yearlyTop: number | null
    }
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
    }[]
    pendingReviews: {
        id: string
        mapName: string
        timeAgo: string
        metrics: { label: string, value: number }[]
    }[]
    topServers?: SummaryTopServer[]
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

export interface AchievementTier {
    index?: number
    level: number
    threshold: number
    dynamic?: boolean
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
    goal_all?: string | null // phrasing for a dynamic "all" tier, e.g. "Cap every map"
    unit?: string           // short noun for the "N <unit> to go" countdown, e.g. "hours"
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
    cap_type: number
}

export interface UserCapsPage {
    total: number
    items: UserCapRow[]
}

export type CapFilter = 'all' | 'verified' | 'certified' | 'casual'

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
    sort?: 'added' | 'time' | 'map'
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
