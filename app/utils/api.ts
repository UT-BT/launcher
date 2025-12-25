import { AuthConfig } from '@/lib/main/config'

export interface UserTitle {
    id: string
    name: string
    color: string // "r,g,b"
    color_r: number
    color_g: number
    color_b: number
    rarity: number
}

export interface LauncherActivity {
    id: number
    user_id: number
    launcher_version: string
    os_platform: string
    os_release: string
    os_arch: string
    created_at: string
}

export interface UserProfile extends AuthConfig {
    active_title?: UserTitle | null
    alias?: string | null
    latest_activity?: LauncherActivity | null
}

export interface Map {
    name: string
    added: string
    difficulty: number
    active: boolean
    tags?: string
    author: string | number
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

export async function fetchMaps(accessToken: string, limit: number, offset: number, sort?: string): Promise<Map[]> {
    try {
        const columns = "name,added,difficulty,tags,author"
        const sortParam = sort ? `&sort=${sort}` : ''
        const response = await fetch(`${API_BASE_URL}/maps/?active=true&limit=${limit}&offset=${offset}&columns=${columns}&${sortParam}`, {
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

export async function fetchMapsCount(accessToken: string): Promise<number> {
    try {
        const response = await fetch(`${API_BASE_URL}/maps/count/?active=true`, {
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
