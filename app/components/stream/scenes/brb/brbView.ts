import type { StreamHotState, StreamMatch, StreamSide } from '../../data/streamHotState'
import { drawnMapsText, formatLabel, mapNumber, seriesFlags, type SeriesFlag } from '../../sceneHelpers'

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

function captionLead(match: StreamMatch): string {
    const state = match.score.series_state
    if (state === 'drawn') return 'Series drawn'
    if (state === 'unresolved' && match.score.series.a === match.score.series.b) return 'Series level'
    return 'Series'
}

export function seriesScoreOf(match: StreamMatch): SeriesScoreView {
    const flags = seriesFlags(match)
    const team = (side: StreamSide): SeriesScoreTeam => ({
        name: match.teams[side]?.name ?? `Team ${side.toUpperCase()}`,
        wins: match.score.series[side],
        flags: flags[side],
    })
    const map = match.score.winner === null && match.score.current_map !== null ? `map ${mapNumber(match.score.current_map)}` : null
    const caption = [captionLead(match), map, drawnMapsText(match.score.drawn_maps), formatLabel(match)].filter(Boolean).join(' · ')
    return { a: team('a'), b: team('b'), caption }
}

export function brbView(state: StreamHotState | null): BrbView {
    const message = state?.desk.brb_message?.trim()
    return {
        message: message ? message : BRB_DEFAULT_MESSAGE,
        score: state?.match ? seriesScoreOf(state.match) : null,
    }
}
