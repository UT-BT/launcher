import { viewToPath } from './routes'

const SITE_ORIGIN = (import.meta.env.VITE_SITE_ORIGIN || 'https://utbt.net').replace(/\/$/, '')

export interface MatchLinks {
    playerLink: string
    streamLink: string
}

export function matchStreamPath(eventSlug: string, matchId: string): string {
    return `${viewToPath('match-pickban', { eventSlug, matchId })}/stream`
}

export function buildMatchLinks(eventSlug: string, matchId: string): MatchLinks {
    return {
        playerLink: SITE_ORIGIN + viewToPath('match-pickban', { eventSlug, matchId }),
        streamLink: SITE_ORIGIN + matchStreamPath(eventSlug, matchId),
    }
}
