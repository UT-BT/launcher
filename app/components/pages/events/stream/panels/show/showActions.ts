import { apiRequest } from '@/app/utils/api'
import { streamDeskError, streamDeskPath, type StreamPerson } from '../../streamDesk'
import type { CasterPayloadEntry } from './casterList'

export type CastingVolunteer = StreamPerson

async function readData(res: Response): Promise<Record<string, unknown>> {
    if (!res.ok) throw await streamDeskError(res)
    const json = await res.json()
    if (!json?.success) throw new Error('Invalid response format from server')
    return json.data ?? {}
}

function casterPath(slug: string, matchId: string): string {
    return `/tournaments/${encodeURIComponent(slug)}/stream/matches/${encodeURIComponent(matchId)}/casters`
}

export async function setBrbMessage(accessToken: string, slug: string, streamerId: string, message: string | null): Promise<string | null> {
    const data = await readData(await apiRequest(streamDeskPath(slug, streamerId, '/brb'), {
        token: accessToken,
        method: 'PUT',
        body: { message },
    }))
    return (data.desk as { brb_message?: string | null } | undefined)?.brb_message ?? null
}

export async function setWebcamFrame(accessToken: string, slug: string, streamerId: string, enabled: boolean): Promise<boolean> {
    const data = await readData(await apiRequest(streamDeskPath(slug, streamerId, '/webcam'), {
        token: accessToken,
        method: 'PUT',
        body: { enabled },
    }))
    return (data.desk as { webcam_enabled?: boolean } | undefined)?.webcam_enabled ?? enabled
}

export async function setMatchCasters(accessToken: string, slug: string, matchId: string, casters: CasterPayloadEntry[]): Promise<void> {
    await readData(await apiRequest(casterPath(slug, matchId), {
        token: accessToken,
        method: 'PUT',
        body: { casters },
    }))
}

export async function fetchCastingVolunteers(accessToken: string, slug: string, signal?: AbortSignal): Promise<CastingVolunteer[]> {
    const data = await readData(await apiRequest(`/tournaments/${encodeURIComponent(slug)}/stream/casting-volunteers`, {
        token: accessToken,
        signal,
    }))
    if (!Array.isArray(data.volunteers)) throw new Error('Invalid response format from server')
    return data.volunteers as CastingVolunteer[]
}
