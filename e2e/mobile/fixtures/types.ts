export type ApiHost = 'api' | 'gateway'

export interface FixtureReply {
    status?: number
    json?: unknown
}

export interface FixtureRoute {
    host: ApiHost
    path: string | RegExp
    reply: FixtureReply | ((url: URL) => FixtureReply)
}

export interface FixtureSet {
    name: string
    routes: FixtureRoute[]
}

export function ok(data: unknown): FixtureReply {
    return { json: { success: true, data } }
}

export function daysAgo(days: number): string {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}
