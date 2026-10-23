import { ApiError, type MatchSidesBody, type MatchSidesErrorCode, type StreamSideBlockedReason } from '@/app/utils/api'
import type { StreamMatch, StreamTeam } from '../../streamDesk'

export interface CamSidesTeam {
    id: string
    name: string
}

export interface SidesSwapControl {
    disabledReason: string | null
    confirmTitle: string
    confirmMessage: string
    body: MatchSidesBody
}

export interface CamSidesView {
    red: CamSidesTeam | null
    blue: CamSidesTeam | null
    tbc: boolean
    swap: SidesSwapControl | null
}

export interface SidesSwappedNotice {
    matchId: string
    red: string
    blue: string
}

const BLOCKED_REASONS: Record<StreamSideBlockedReason, string> = {
    pick_ban_in_progress: 'Finish pick/ban first, or ask an admin.',
}

const UNKNOWN_BLOCKED_REASON = 'Swapping Red and Blue is blocked right now. Ask an admin.'

const SWAP_REFUSALS: Record<MatchSidesErrorCode, string> = {
    not_authorized: "Only this match's streamer, its match admin or a bracket manager can swap Red and Blue.",
    pick_ban_in_progress: BLOCKED_REASONS.pick_ban_in_progress,
    invalid_side: 'The teams in this match changed. Check them and try again.',
}

function sideTeam(team: StreamTeam | null): CamSidesTeam | null {
    return team ? { id: team.id, name: team.name } : null
}

function swapControl(match: StreamMatch, red: CamSidesTeam | null, blue: CamSidesTeam | null): SidesSwapControl | null {
    const controls = match.side_controls
    if (!controls?.can_swap || !red || !blue) return null
    return {
        disabledReason: controls.blocked_reason ? BLOCKED_REASONS[controls.blocked_reason] ?? UNKNOWN_BLOCKED_REASON : null,
        confirmTitle: 'Swap Red and Blue?',
        confirmMessage: `${red.name} becomes Blue, ${blue.name} becomes Red. Everything on stream follows.`,
        body: { red_team_id: blue.id },
    }
}

export function camSidesView(match: StreamMatch | null): CamSidesView | null {
    if (!match) return null
    const red = sideTeam(match.teams.a)
    const blue = sideTeam(match.teams.b)
    return {
        red,
        blue,
        tbc: match.side_status?.confirmed === false,
        swap: swapControl(match, red, blue),
    }
}

function isSwapRefusal(code: string | undefined): code is MatchSidesErrorCode {
    return code !== undefined && Object.hasOwn(SWAP_REFUSALS, code)
}

export function sidesSwapErrorMessage(error: unknown): string {
    if (error instanceof ApiError && isSwapRefusal(error.reason)) return SWAP_REFUSALS[error.reason]
    return error instanceof Error && error.message ? error.message : 'Could not swap Red and Blue.'
}

export function nextSidesSwappedNotice(
    notice: SidesSwappedNotice | null,
    previous: StreamMatch | null,
    current: StreamMatch | null,
): SidesSwappedNotice | null {
    if (!current || (notice && notice.matchId !== current.id)) return null
    if (!previous || previous.id !== current.id || previous.sides.a === current.sides.a) return notice
    return { matchId: current.id, red: current.teams.a?.name ?? 'Team A', blue: current.teams.b?.name ?? 'Team B' }
}
