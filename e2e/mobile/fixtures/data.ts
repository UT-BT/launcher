import type { ApiHost, FixtureReply, FixtureRoute, FixtureSet } from './types'

export interface FixtureData {
    api(path: string, query?: string): unknown
    gateway(path: string, query?: string): unknown
}

export function requestPath(url: URL): string {
    return url.pathname.replace(/\/$/, '') || '/'
}

export function hostOf(url: URL): ApiHost {
    return url.hostname.startsWith('gateway.') ? 'gateway' : 'api'
}

function matches(route: FixtureRoute, url: URL): boolean {
    if (route.host !== hostOf(url)) return false
    const path = requestPath(url)
    return typeof route.path === 'string' ? route.path === path : route.path.test(path)
}

export function replyFor(set: FixtureSet, url: URL): FixtureReply | null {
    const route = set.routes.find(candidate => matches(candidate, url))
    if (!route) return null
    return typeof route.reply === 'function' ? route.reply(url) : route.reply
}

function urlOf(host: ApiHost, path: string, query: string): URL {
    return new URL(`https://${host}.utbt.net${path}${query ? `?${query}` : ''}`)
}

export function dataFrom(set: FixtureSet): FixtureData {
    return {
        api: (path, query = '') => {
            const json = replyFor(set, urlOf('api', path, query))?.json as { data?: unknown } | undefined
            return json?.data
        },
        gateway: (path, query = '') => replyFor(set, urlOf('gateway', path, query))?.json,
    }
}
