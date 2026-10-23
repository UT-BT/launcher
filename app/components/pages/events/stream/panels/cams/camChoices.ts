import type { CamTeam } from '@/lib/stream-kit/cam-plan'
import type { StreamMatch, StreamSide } from '../../streamDesk'
import type { CamServerChoice, CamServerChoices, CamServerPasswords } from './camToolView'

export interface StoredCamServers {
    matchId: string | null
    teams: Readonly<Record<string, CamServerChoice>>
}

export interface StoredCamPasswords {
    teams: Readonly<Record<string, string>>
}

export const NO_STORED_CAM_SERVERS: StoredCamServers = { matchId: null, teams: {} }

export const NO_STORED_CAM_PASSWORDS: StoredCamPasswords = { teams: {} }

const STREAM_SIDE_OF: Record<CamTeam, StreamSide> = { A: 'a', B: 'b' }

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isServerChoice(value: unknown): value is CamServerChoice {
    if (!isRecord(value)) return false
    if (value.mode === 'detected') return true
    return (value.mode === 'list' || value.mode === 'typed') && typeof value.address === 'string'
}

function storedTeams(stored: unknown): Record<string, unknown> {
    return isRecord(stored) && isRecord(stored.teams) ? stored.teams : {}
}

function storedMatchId(stored: unknown): string | null {
    return isRecord(stored) && typeof stored.matchId === 'string' ? stored.matchId : null
}

function teamEntries<T>(teams: Record<string, unknown>, keep: (value: unknown) => value is T): Record<string, T> {
    return Object.fromEntries(Object.entries(teams).filter((entry): entry is [string, T] => keep(entry[1])))
}

function isPassword(value: unknown): value is string {
    return typeof value === 'string'
}

export function camTeamIds(match: StreamMatch | null): Record<CamTeam, string | null> {
    const teamOf = (team: CamTeam): string | null => {
        if (!match) return null
        const matchSide = match.sides[STREAM_SIDE_OF[team]]
        const found = [match.teams.a, match.teams.b].find(entry => entry?.match_side === matchSide)
        return found?.id ?? null
    }
    return { A: teamOf('A'), B: teamOf('B') }
}

function byLetter<T>(match: StreamMatch | null, teams: Record<string, T>, fallback: T): Record<CamTeam, T> {
    const ids = camTeamIds(match)
    const read = (team: CamTeam): T => {
        const id = ids[team]
        return id !== null && Object.hasOwn(teams, id) ? teams[id] : fallback
    }
    return { A: read('A'), B: read('B') }
}

function currentServerTeams(stored: unknown, match: StreamMatch | null): Record<string, CamServerChoice> {
    if (!match || storedMatchId(stored) !== match.id) return {}
    return teamEntries(storedTeams(stored), isServerChoice)
}

export function readCamServerChoices(stored: unknown, match: StreamMatch | null): CamServerChoices {
    return byLetter(match, currentServerTeams(stored, match), { mode: 'detected' })
}

export function storeCamServerChoice(stored: unknown, match: StreamMatch | null, team: CamTeam, choice: CamServerChoice): StoredCamServers {
    if (!match) return NO_STORED_CAM_SERVERS
    const id = camTeamIds(match)[team]
    const teams = currentServerTeams(stored, match)
    return { matchId: match.id, teams: id === null ? teams : { ...teams, [id]: choice } }
}

export function readCamPasswords(stored: unknown, match: StreamMatch | null): CamServerPasswords {
    return byLetter(match, teamEntries(storedTeams(stored), isPassword), '')
}

export function storeCamPassword(stored: unknown, match: StreamMatch | null, team: CamTeam, value: string): StoredCamPasswords {
    const id = camTeamIds(match)[team]
    const teams = teamEntries(storedTeams(stored), isPassword)
    return { teams: id === null ? teams : { ...teams, [id]: value } }
}
