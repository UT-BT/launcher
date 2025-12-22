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

export async function fetchUserProfile(accessToken: string): Promise<UserProfile | null> {
    try {
        const response = await fetch(`${API_BASE_URL}/users/me`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        })

        if (!response.ok) {
            console.error('Failed to fetch user profile:', response.statusText)
            return null
        }

        const json = await response.json()
        if (json.success && json.data) {
            return json.data as UserProfile
        }

        return null
    } catch (error) {
        console.error('Error fetching user profile:', error)
        return null
    }
}
