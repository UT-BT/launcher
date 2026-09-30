import { isDiscordId } from './discord-id'

export type TeamSide = 'A' | 'B'

export interface DetectionPlayer {
    id: string
    is_spectator?: boolean
}

export interface DetectionServer {
    players: readonly DetectionPlayer[]
}

export type TeamRosters = Record<TeamSide, readonly (string | null | undefined)[]>

export interface DetectedServer<S> {
    server: S
    count: number
}

export interface FoundRosterMember<S> {
    discordId: string
    servers: S[]
}

export interface TeamServerDetection<S> {
    servers: DetectedServer<S>[]
    best: S | null
    members: FoundRosterMember<S>[]
}

function serversHolding<S extends DetectionServer>(servers: readonly S[], discordId: string): S[] {
    return servers.filter(server => server.players.some(player => player.id === discordId && !player.is_spectator))
}

function detectTeam<S extends DetectionServer>(servers: readonly S[], roster: TeamRosters[TeamSide]): TeamServerDetection<S> {
    const discordIds = [...new Set(roster.filter(isDiscordId))]
    const members = discordIds
        .map(discordId => ({ discordId, servers: serversHolding(servers, discordId) }))
        .filter(member => member.servers.length > 0)
    const detected = servers
        .map(server => ({ server, count: members.filter(member => member.servers.includes(server)).length }))
        .filter(entry => entry.count > 0)
        .sort((a, b) => b.count - a.count)
    return { servers: detected, best: detected[0]?.server ?? null, members }
}

export function detectTeamServers<S extends DetectionServer>(servers: readonly S[], rosters: TeamRosters): Record<TeamSide, TeamServerDetection<S>> {
    return {
        A: detectTeam(servers, rosters.A),
        B: detectTeam(servers, rosters.B),
    }
}
