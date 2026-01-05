import type { AuthConfig } from '@/lib/main/config'

const GATEWAY_BASE_URL = import.meta.env.DEV ? 'https://gateway.utbt.net' : 'https://gateway.utbt.net'

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
    title_id: number
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

export interface MapReview {
    id: number
    map_name: string
    user: string
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

const API_BASE_URL = import.meta.env.DEV ? 'http://localhost:5000' : 'http://api.utbt.net'

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

export async function uploadDemo(file: Blob, filename: string, accessToken: string): Promise<{ success: boolean; message?: string; reason?: string }> {
    try {
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
                // Use default message
            }
            throw new Error(errorMessage)
        }

        const json = await response.json()
        return json
    } catch (error) {
        throw error
    }
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

export async function fetchMaps(accessToken: string, limit: number, offset: number, sort?: string, difficulty?: number, active?: boolean): Promise<Map[]> {
    try {
        const columns = "name,added,difficulty,tags,author,author_str,author_ref,world_record,champion_medal,gold_medal,silver_medal,bronze_medal,active"
        let queryParams = `limit=${limit}&offset=${offset}&columns=${columns}`

        if (sort) queryParams += `&sort=${sort}`
        if (difficulty !== undefined) queryParams += `&difficulty=${difficulty}`
        if (active !== undefined) queryParams += `&active=${active}`
        else queryParams += `&active=true` // Default to active true if not specified, matching original logic but allowing override

        const response = await fetch(`${API_BASE_URL}/maps/?${queryParams}`, {
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

export async function fetchMapsCount(accessToken: string, addedSince?: string): Promise<number> {
    try {
        const addedSinceParam = addedSince ? `&added_since=${encodeURIComponent(addedSince)}` : ''
        const response = await fetch(`${API_BASE_URL}/maps/count/?active=true${addedSinceParam}`, {
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

export async function fetchTitles(accessToken: string, limit: number, offset: number, userId?: number): Promise<AssignedTitleV2[]> {
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
        if (json.success && json.data) {
            return json.data as AssignedTitleV2[]
        }

        throw new Error('Invalid response format from server')
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

export async function fetchMapsFuzzy(accessToken: string, partialName: string, limit: number = 10): Promise<Map[]> {
    try {
        const response = await fetch(`${API_BASE_URL}/maps/fuzzy/${encodeURIComponent(partialName)}?limit=${limit}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
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
        console.error('Error fetching fuzzy maps:', error)
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
        diff: string
        timeAgo: string
    }[]
    pendingReviews: {
        id: string
        mapName: string
        timeAgo: string
        metrics: { label: string, value: number }[]
    }[]
}

export interface SummaryCap {
    id: string
    mapName: string
    author: string
    difficulty: number
    time: number
    medal: string
    added: string
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