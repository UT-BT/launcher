import type { EventMatchMode, PredictionMarketStatus, RawActiveTitle } from '@/app/utils/api'
import { streamMatchReadPath, type BracketSide, type StreamLineupSlot, type StreamSide } from '../../data/streamHotState'

export type PreviewStageKind = 'groups' | 'swiss' | 'single_elim'
export type PreviewOutcome = 'win' | 'loss' | 'draw'

export interface PreviewTeamRef {
    id: string
    name: string
    seed: number | null
    status: string | null
}

export interface PreviewRound {
    no: number | null
    label: string | null
}

export interface PreviewMember {
    id: string
    display_name: string | null
    avatar: string
    title: RawActiveTitle | null
    captain: boolean
    career_caps: number
    wr_count: number
    solo_wrs: number
    team_wrs: number
    cup_caps: number
}

export interface PreviewCupRunEntry {
    match_id: string
    stage: { key: string; name: string }
    round: PreviewRound
    opponent: PreviewTeamRef | null
    result: PreviewOutcome | null
    score: { for: number | null; against: number | null }
    status: 'complete' | 'forfeit'
    scheduled_at: string | null
}

export interface PreviewTeam {
    id: string
    name: string
    match_side: BracketSide
    stage_seed: number | null
    pre_cup_seed: number | null
    members: PreviewMember[]
    cup_run: PreviewCupRunEntry[]
}

export interface PreviewGroupRow {
    rank: number
    team_id: string
    team: PreviewTeamRef
    seed: number | null
    played: number
    wins: number
    draws: number
    losses: number
    points: number
    maps_won: number
    maps_lost: number
    map_diff: number
    side: StreamSide | null
}

export interface PreviewSwissRow {
    team_id: string
    team: PreviewTeamRef
    seed: number | null
    wins: number
    losses: number
    status: 'active' | 'qualified' | 'eliminated'
    side: StreamSide | null
}

export interface PreviewSlot {
    team: PreviewTeamRef | null
    label: string | null
    side: StreamSide | null
    score: number | null
    winner: boolean
}

export interface PreviewStageMatch {
    id: string
    round: PreviewRound
    ordinal: number | null
    status: string
    scheduled_at: string | null
    current: boolean
    is_draw: boolean
    slots: [PreviewSlot, PreviewSlot]
    winner_to_match_id: string | null
}

interface PreviewStageViewBase {
    stage: { key: string; name: string }
}

export interface PreviewGroupsView extends PreviewStageViewBase {
    kind: 'groups'
    group: { id: string; name: string } | null
    rows: PreviewGroupRow[]
}

export interface PreviewSwissView extends PreviewStageViewBase {
    kind: 'swiss'
    round: PreviewRound
    wins_to_qualify: number
    losses_to_eliminate: number
    rows: PreviewSwissRow[]
    pairings: PreviewStageMatch[]
}

export interface PreviewEliminationView extends PreviewStageViewBase {
    kind: 'single_elim'
    rounds: { no: number | null; label: string | null; matches: PreviewStageMatch[] }[]
    path: Record<StreamSide, string[]>
    winner_path: string[]
}

export interface PreviewOtherStageView extends PreviewStageViewBase {
    kind: string
}

export type PreviewStageView = PreviewGroupsView | PreviewSwissView | PreviewEliminationView | PreviewOtherStageView

export interface PreviewMatchSummary {
    match_id: string
    stage: string | null
    round_label: string | null
    opponent: string | null
    outcome: PreviewOutcome | null
    score: number | null
    opponent_score: number | null
    scheduled_at: string | null
}

export interface PreviewRecord {
    win: number
    loss: number
    draw: number
}

export interface PreviewSideInsights {
    team_id: string
    name: string | null
    record: PreviewRecord
    form: PreviewMatchSummary[]
}

export interface PreviewInsights {
    available: boolean
    teams?: Record<StreamSide, PreviewSideInsights | null>
    head_to_head?: { played: number; record: PreviewRecord; matches: PreviewMatchSummary[] } | null
}

export interface PreviewOdds {
    status: PredictionMarketStatus
    draws_allowed: boolean
    price: { a: number | null; b: number | null; draw: number | null }
    pool_stake: number
    position_count: number
    closes_at: string | null
}

export interface StreamPreview {
    server_now: string
    match: {
        id: string
        stage: { key: string; name: string; kind: string }
        group: { id: string; name: string } | null
        round: PreviewRound
        best_of: number
        mode: EventMatchMode
        caps_to_win: number | null
        status: string
        scheduled_at: string | null
    }
    sides: Record<StreamSide, BracketSide>
    teams: Record<StreamSide, PreviewTeam | null>
    lineup: Record<StreamLineupSlot, string | null>
    stage_view: PreviewStageView
    insights: PreviewInsights
    predictions_enabled: boolean
    odds: PreviewOdds | null
}

export function previewReadPath(eventSlug: string, matchId: string): string {
    return streamMatchReadPath(eventSlug, matchId, 'preview')
}
