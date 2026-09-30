import { apiRequest } from '@/app/utils/api'
import { streamDeskError } from '../../streamDesk'
import { LINEUP_SLOTS, type LineupSlots } from './lineupView'

export interface StreamLineup {
    matchId: string
    lineup: LineupSlots
    effective: LineupSlots
}

export function streamLineupPath(slug: string, matchId: string): string {
    return `/tournaments/${encodeURIComponent(slug)}/stream/matches/${encodeURIComponent(matchId)}/lineup`
}

function slotsOf(value: unknown): LineupSlots | null {
    if (!value || typeof value !== 'object') return null
    const record = value as Record<string, unknown>
    if (!LINEUP_SLOTS.every(slot => record[slot] === null || typeof record[slot] === 'string')) return null
    return { a1: record.a1 as string | null, a2: record.a2 as string | null, b1: record.b1 as string | null, b2: record.b2 as string | null }
}

async function lineupOf(res: Response): Promise<StreamLineup> {
    if (!res.ok) throw await streamDeskError(res)
    const json = await res.json()
    const lineup = slotsOf(json?.data?.lineup)
    const effective = slotsOf(json?.data?.effective)
    if (!json?.success || typeof json.data?.match_id !== 'string' || !lineup || !effective) {
        throw new Error('Invalid response format from server')
    }
    return { matchId: json.data.match_id, lineup, effective }
}

export async function fetchStreamLineup(accessToken: string, slug: string, matchId: string, signal?: AbortSignal): Promise<StreamLineup> {
    return lineupOf(await apiRequest(streamLineupPath(slug, matchId), { token: accessToken, signal }))
}

export async function saveStreamLineup(
    accessToken: string,
    slug: string,
    matchId: string,
    lineup: LineupSlots,
    opts: { onlyIfEmpty?: boolean } = {},
): Promise<StreamLineup> {
    return lineupOf(await apiRequest(streamLineupPath(slug, matchId), {
        token: accessToken,
        method: 'PUT',
        body: opts.onlyIfEmpty ? { ...lineup, only_if_empty: true } : lineup,
    }))
}
