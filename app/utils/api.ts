import type { AuthConfig } from '@/lib/main/config'

const GATEWAY_BASE_URL = import.meta.env.DEV ? 'http://127.0.0.1:5000' : 'https://gateway.utbt.net'

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
}


// const API_BASE_URL = import.meta.env.DEV ? 'http://localhost:5000' : 'https://api.utbt.net'
const API_BASE_URL = 'http://api.utbt.net'

export async function fetchUserProfile(accessToken: string): Promise<UserProfile> {
    try {
        const response = await fetch(`${API_BASE_URL}/users/me`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        })

        if (!response.ok) {
            throw new Error(`Failed to fetch user profile: ${response.statusText} (${response.status})`)
        }

        const json = await response.json()
        if (json.success && json.data) {
            return json.data as UserProfile
        }

        throw new Error('Invalid response format from server')
    } catch (error) {
        console.error('Error fetching user profile:', error)
        throw error
    }
}

export async function downloadDemo(capId: string): Promise<ArrayBuffer> {
    const response = await fetch(`${API_BASE_URL}/demos/${encodeURIComponent(capId)}`)
    if (!response.ok) {
        throw new Error(`Demo download failed: ${response.statusText} (${response.status})`)
    }
    return await response.arrayBuffer()
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
    try {
        const qs = buildMapQuery(params)

        const response = await fetch(`${API_BASE_URL}/maps/?${qs}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        })

        if (!response.ok) {
            throw new Error(`Failed to fetch maps: ${response.statusText} (${response.status})`)
        }

        const json = await response.json()
        if (json.success && json.data) {
            return json.data as Map[]
        }

        throw new Error('Invalid response format from server')
    } catch (error) {
        console.error('Error fetching maps:', error)
        throw error
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
        const response = await fetch(`${API_BASE_URL}/caps/capped_maps/${userId}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        })

        if (!response.ok) {
            throw new Error(`Failed to fetch best caps: ${response.statusText} (${response.status})`)
        }

        const json = await response.json()
        if (json.success && Array.isArray(json.data)) {
            return json.data as BestCap[]
        }

        return []
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
        const limitParam = limit !== undefined ? `?limit=${limit}` : ''
        const response = await fetch(`${API_BASE_URL}/maps/fuzzy/${encodeURIComponent(partialName)}${limitParam}`, {
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
