import { viewToPath } from './routes'

const SITE_ORIGIN = (import.meta.env.VITE_SITE_ORIGIN || 'https://utbt.net').replace(/\/$/, '')

export interface MatchLinks {
    playerLink: string
    streamLink: string
}

export interface StreamRouteParams {
    eventSlug: string
    matchId: string
}

export function matchStreamPath(eventSlug: string, matchId: string): string {
    return `${viewToPath('match-pickban', { eventSlug, matchId })}/stream`
}

function decodeSegment(segment: string): string {
    try {
        return decodeURIComponent(segment)
    } catch {
        return segment
    }
}

export function parseStreamPath(pathname: string): StreamRouteParams | null {
    const segments = pathname.split('/').filter(Boolean)
    if (segments.length !== 5) return null
    const [head, eventSlug, matches, matchId, stream] = segments
    if (head !== 'events' || matches !== 'matches' || stream !== 'stream') return null
    return { eventSlug: decodeSegment(eventSlug), matchId: decodeSegment(matchId) }
}

export function buildMatchLinks(eventSlug: string, matchId: string): MatchLinks {
    return {
        playerLink: SITE_ORIGIN + viewToPath('match-pickban', { eventSlug, matchId }),
        streamLink: SITE_ORIGIN + matchStreamPath(eventSlug, matchId),
    }
}
