import { streamMatchReadPath, type StreamSide } from '../../data/streamHotState'

export type BracketOutcome = 'next_match' | 'eliminated' | 'finished'
export type SwissStatus = 'active' | 'qualified' | 'eliminated'

export interface PostMatchNextMatch {
    id: string
    stage: { key: string; name: string }
    round: { no: number | null; label: string | null }
    scheduled_at: string | null
}

export interface BracketConsequenceTeam {
    team_id: string
    outcome: BracketOutcome
    next_match: PostMatchNextMatch | null
}

export interface GroupConsequenceTeam {
    team_id: string
    position: number
    of: number
    played: number
    wins: number
    draws: number
    losses: number
    points: number
}

export interface SwissConsequenceTeam {
    team_id: string
    wins: number
    losses: number
    status: SwissStatus
}

interface ConsequenceOf<Kind extends string, Team> {
    kind: Kind
    winner: StreamSide | null
    group: { id: string; name: string } | null
    teams: Record<StreamSide, Team | null>
}

export type PostMatchConsequence =
    | ConsequenceOf<'bracket', BracketConsequenceTeam>
    | ConsequenceOf<'group', GroupConsequenceTeam>
    | ConsequenceOf<'swiss', SwissConsequenceTeam>

export interface PostMatchRead {
    server_now: string
    match_id: string
    official: boolean
    consequence: PostMatchConsequence | null
}

export function postMatchReadPath(eventSlug: string, matchId: string): string {
    return streamMatchReadPath(eventSlug, matchId, 'post-match')
}
