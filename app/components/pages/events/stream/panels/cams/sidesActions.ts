import { apiRequest, type MatchSides, type MatchSidesBody } from '@/app/utils/api'
import { streamDeskError } from '../../streamDesk'
import { matchBroadcastPath, type BroadcastTarget } from '../match/scoreActions'

function isMatchSides(value: unknown): value is MatchSides {
    if (!value || typeof value !== 'object') return false
    const sides = value as Partial<MatchSides>
    return typeof sides.red_team_id === 'string' && typeof sides.blue_team_id === 'string'
}

export async function setMatchSides({ accessToken, slug, matchId }: BroadcastTarget, body: MatchSidesBody): Promise<MatchSides> {
    const res = await apiRequest(matchBroadcastPath(slug, matchId, '/sides'), { token: accessToken, method: 'PUT', body })
    if (!res.ok) throw await streamDeskError(res)
    const json = await res.json()
    if (!json?.success || !isMatchSides(json.data)) throw new Error('Invalid response format from server')
    return json.data
}
