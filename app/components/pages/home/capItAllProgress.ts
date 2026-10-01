import { apiGet, type CapItAllRow } from '@/app/utils/api'

export type CapItAllProgress = Pick<CapItAllRow, 'rank' | 'team_caps'>

export interface CapItAllProgressCache {
    userId: string
    alias: string
    fetchedAt: number
    data: CapItAllProgress | null
}

export const CAP_IT_ALL_CACHE_MS = 5 * 60 * 1000

interface ProgressSearchPage {
    total: number
    items: Array<{ user_id: string | number; rank: unknown; team_caps: unknown }>
}

function countOrNull(value: unknown): number | null {
    if (typeof value !== 'number' && typeof value !== 'string') return null
    if (value === '') return null
    const count = Number(value)
    return Number.isSafeInteger(count) && count >= 0 ? count : null
}

// The existing API searches aliases, not IDs. Bound the work for common aliases
// and only accept the signed-in user's ID, never the first name match.
export async function fetchCapItAllProgress(
    token: string,
    userId: string,
    alias: string,
    signal: AbortSignal,
): Promise<CapItAllProgress | null> {
    const search = alias.trim()
    if (!search) return null

    let offset = 0
    for (let page = 0; page < 3; page++) {
        signal.throwIfAborted()
        const query = new URLSearchParams({ search, limit: '50', offset: String(offset) })
        const result = await apiGet<ProgressSearchPage>(`/v2/leaderboards/cap_it_all?${query}`, { token, signal })
        signal.throwIfAborted()
        if (!Array.isArray(result.items)) return null
        const self = result.items.find(row => row != null && String(row.user_id) === userId)
        if (self) {
            const rank = countOrNull(self.rank)
            const teamCaps = countOrNull(self.team_caps)
            return rank !== null && teamCaps !== null ? { rank, team_caps: teamCaps } : null
        }
        offset += result.items.length
        if (result.items.length === 0 || offset >= result.total) break
    }
    // Missing/ambiguous results are unavailable, not a fabricated zero or rank.
    return null
}
