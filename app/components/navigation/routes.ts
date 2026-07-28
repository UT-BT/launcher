import type { NavParams } from './NavigationContext'

export interface RouteTarget {
    view: string
    params: NavParams
}

export function viewToPath(view: string, params: NavParams): string {
    switch (view) {
        case 'home': return '/'
        case 'servers': return '/servers'
        case 'maps': return params.mapsNewOnly ? '/maps?new=1' : '/maps'
        case 'maps-detail': return `/maps/${encodeURIComponent(params.mapName ?? '')}`
        case 'players': return '/players'
        case 'player-detail': return `/players/${encodeURIComponent(String(params.playerId ?? ''))}`
        case 'teams': return '/teams'
        case 'team-detail': return `/teams/${encodeURIComponent(params.teamId ?? '')}`
        case 'events': return '/events'
        case 'event-detail': {
            const base = `/events/${encodeURIComponent(params.eventSlug ?? '')}`
            return params.eventTab ? `${base}?tab=${encodeURIComponent(params.eventTab)}` : base
        }
        case 'world-records': return '/world-records'
        case 'cap-it-all': return '/cap-it-all'
        case 'cap-detail': return `/caps/${encodeURIComponent(params.capId ?? '')}`
        case 'team-cap-detail': return `/team-caps/${encodeURIComponent(params.teamCapId ?? '')}`
        case 'achievements': return '/achievements'
        case 'news': return '/news'
        case 'news-detail': return `/news/${encodeURIComponent(String(params.newsId ?? ''))}`
        case 'admin': return '/admin'
        default: return '/'
    }
}

function decodeSegment(segment: string): string {
    try {
        return decodeURIComponent(segment)
    } catch {
        return segment
    }
}

export function pathToNav(pathname: string, search: string): RouteTarget {
    const segments = pathname.split('/').filter(Boolean).map(decodeSegment)
    const query = new URLSearchParams(search)

    if (segments.length === 0) return { view: 'home', params: {} }

    const [head, second] = segments
    switch (head) {
        case 'servers': return { view: 'servers', params: {} }
        case 'maps':
            if (second) return { view: 'maps-detail', params: { mapName: second } }
            return { view: 'maps', params: query.get('new') === '1' ? { mapsNewOnly: true } : {} }
        case 'players':
            if (second) return { view: 'player-detail', params: { playerId: second } }
            return { view: 'players', params: {} }
        case 'teams':
            if (second) return { view: 'team-detail', params: { teamId: second } }
            return { view: 'teams', params: {} }
        case 'events': {
            if (second) {
                const tab = query.get('tab')
                return { view: 'event-detail', params: { eventSlug: second, ...(tab ? { eventTab: tab } : {}) } }
            }
            return { view: 'events', params: {} }
        }
        case 'world-records': return { view: 'world-records', params: {} }
        case 'cap-it-all': return { view: 'cap-it-all', params: {} }
        case 'caps':
            if (second) return { view: 'cap-detail', params: { capId: second } }
            return { view: 'home', params: {} }
        case 'team-caps':
            if (second) return { view: 'team-cap-detail', params: { teamCapId: second } }
            return { view: 'home', params: {} }
        case 'achievements': return { view: 'achievements', params: {} }
        case 'news': {
            if (second) {
                const newsId = Number(second)
                if (Number.isFinite(newsId)) return { view: 'news-detail', params: { newsId } }
            }
            return { view: 'news', params: {} }
        }
        case 'admin': return { view: 'admin', params: {} }
        default: return { view: 'home', params: {} }
    }
}
