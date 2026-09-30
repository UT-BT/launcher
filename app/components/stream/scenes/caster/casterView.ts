import type { StreamHotState } from '../../data/streamHotState'
import { seriesScoreOf, type SeriesScoreView } from '../brb/brbView'

export const CASTER_CUTOUT = { x: 96, y: 184, width: 1152, height: 648 }

export interface CasterName {
    key: string
    userId: string | null
    name: string
}

export interface CasterView {
    webcam: boolean
    casters: CasterName[]
    score: SeriesScoreView | null
}

export function casterView(state: StreamHotState | null): CasterView {
    const match = state?.match ?? null
    const casters = (match?.casters ?? []).flatMap((caster, index): CasterName[] => {
        const name = caster.display_name?.trim()
        if (!name) return []
        return [{ key: caster.id ?? `text-${index}`, userId: caster.id, name }]
    })
    return {
        webcam: state?.desk.webcam_enabled ?? false,
        casters,
        score: match ? seriesScoreOf(match) : null,
    }
}
