import type { StreamHotState, StreamMatch, StreamSide } from '../../data/streamHotState'
import { formatLabel, mapNumber, seriesFlags, type SeriesFlag } from '../../sceneHelpers'

export const BRB_DEFAULT_MESSAGE = 'We’ll be right back — stay tuned.'

export interface SeriesScoreTeam {
    name: string
    wins: number
    flags: SeriesFlag[]
}

export interface SeriesScoreView {
    a: SeriesScoreTeam
    b: SeriesScoreTeam
    caption: string
}

export interface BrbView {
    message: string
    score: SeriesScoreView | null
}

export function seriesScoreOf(match: StreamMatch): SeriesScoreView {
    const flags = seriesFlags(match)
    const team = (side: StreamSide): SeriesScoreTeam => ({
        name: match.teams[side]?.name ?? `Team ${side.toUpperCase()}`,
        wins: match.score.series[side],
        flags: flags[side],
    })
    const map = match.score.winner === null && match.score.current_map !== null ? `map ${mapNumber(match.score.current_map)}` : null
    return { a: team('a'), b: team('b'), caption: ['Series', map, formatLabel(match)].filter(Boolean).join(' · ') }
}

export function brbView(state: StreamHotState | null): BrbView {
    const message = state?.desk.brb_message?.trim()
    return {
        message: message ? message : BRB_DEFAULT_MESSAGE,
        score: state?.match ? seriesScoreOf(state.match) : null,
    }
}
