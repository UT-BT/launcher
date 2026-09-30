import { apiRequest } from '@/app/utils/api'
import { streamDeskError, streamDeskPath } from '../../streamDesk'

async function deskWrite(res: Response): Promise<string | null> {
    if (!res.ok) throw await streamDeskError(res)
    const json = await res.json()
    if (!json?.success) throw new Error('Invalid response format from server')
    return json.data?.desk?.current_match_id ?? null
}

export async function setCurrentMatch(accessToken: string, slug: string, streamerId: string, matchId: string | null): Promise<string | null> {
    return deskWrite(await apiRequest(streamDeskPath(slug, streamerId, '/current'), {
        token: accessToken,
        method: 'PUT',
        body: { match_id: matchId },
    }))
}

export async function moveToNextMatch(accessToken: string, slug: string, streamerId: string): Promise<string | null> {
    return deskWrite(await apiRequest(streamDeskPath(slug, streamerId, '/next'), { token: accessToken, method: 'POST' }))
}
