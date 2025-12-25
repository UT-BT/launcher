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

export interface UserProfile extends AuthConfig {
    active_title?: UserTitle | null
    alias?: string | null
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
