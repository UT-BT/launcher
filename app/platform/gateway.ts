import { GATEWAY_BASE_URL, asArray, asNum, asStr, type ServerRuleset } from '@/app/utils/api'
import type { Server } from '@/app/utils/server-utils'
import { IS_WEB } from './target'

const SERVER_RULESETS: readonly ServerRuleset[] = ['casual', 'certified']

const asRuleset = (value: unknown): ServerRuleset =>
    SERVER_RULESETS.find(ruleset => ruleset === value) ?? 'casual'

const asRegion = (value: unknown): string | null =>
    typeof value === 'string' && value !== '' ? value : null

const asFlag = (value: unknown): boolean | null =>
    typeof value === 'boolean' ? value : null

async function fetchGatewayJson<T>(path: string): Promise<T> {
    const response = await fetch(`${GATEWAY_BASE_URL}${path}`)
    if (!response.ok) {
        throw new Error(`Gateway request ${path} failed with status ${response.status}`)
    }
    return response.json() as Promise<T>
}

export function normaliseGatewayServers(raw: unknown): Server[] {
    return asArray<any>(raw)
        .filter(server => server && typeof server === 'object' && (server.id != null || server.ip != null || server.hostname != null))
        .map(server => ({
            ...server,
            id: server.id != null
                ? String(server.id)
                : server.ip != null
                    ? `${asStr(server.ip)}:${asNum(server.hostport)}`
                    : asStr(server.hostname),
            ip: asStr(server.ip),
            hostname: asStr(server.hostname),
            hostport: asNum(server.hostport),
            map_name: asStr(server.map_name),
            player_count: asNum(server.player_count),
            max_players: asNum(server.max_players),
            spectators: asNum(server.spectators),
            time_limit_minutes: asNum(server.time_limit_minutes),
            remaining_time_seconds: asNum(server.remaining_time_seconds),
            goal_team_score: asNum(server.goal_team_score),
            red_team_score: asNum(server.red_team_score),
            blue_team_score: asNum(server.blue_team_score),
            certified_records: Boolean(server.certified_records),
            ruleset: asRuleset(server.ruleset),
            region: asRegion(server.region),
            tournament: asFlag(server.tournament),
            password_protected: asFlag(server.password_protected),
            players: asArray<any>(server.players)
                .filter(player => player && typeof player === 'object')
                .map(player => ({
                    ...player,
                    id: player.id != null ? String(player.id) : '',
                    name: asStr(player.name),
                    ping: asNum(player.ping),
                    time: asNum(player.time),
                    team: asNum(player.team),
                    deaths: asNum(player.deaths),
                    is_spectator: Boolean(player.is_spectator),
                })),
        }))
}

export async function fetchGatewayServers(): Promise<Server[]> {
    const raw = IS_WEB
        ? await fetchGatewayJson<unknown>('/server-info')
        : await window.conveyor.game.fetchServers()
    return normaliseGatewayServers(raw)
}

export function fetchGatewayPatrons<T = unknown>(): Promise<T> {
    if (!IS_WEB) return window.conveyor.game.fetchPatrons() as Promise<T>
    return fetchGatewayJson<T>('/patreon')
}
