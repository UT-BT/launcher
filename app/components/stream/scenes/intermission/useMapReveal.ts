import { useEffect, useState } from 'react'
import type { StreamSound } from '@/app/components/pages/events/pickban/stream/streamSound'
import type { StreamMatch } from '../../data/streamHotState'
import { useSceneCadence } from '../../data/useStreamData'
import { useSceneCues } from '../../useSceneCues'
import { advanceMapReveal, initialMapReveal, type MapRevealState } from './intermissionView'

const REVEAL_HIT_MS = 350
const REVEAL_STAGGER_MS = 900

export type MapReveal = MapRevealState['reveal']

export function revealDelayS(reveal: MapReveal, ordinal: number): number {
    const index = reveal?.ordinals.indexOf(ordinal) ?? -1
    return (REVEAL_HIT_MS + Math.max(index, 0) * REVEAL_STAGGER_MS) / 1000
}

export function useMapReveal(match: StreamMatch, sound: StreamSound): MapReveal {
    const cues = useSceneCues(sound)
    const { active } = useSceneCadence()
    const [state, setState] = useState(() => initialMapReveal(match.id, match.score))
    const next = active ? advanceMapReveal(state, match.id, match.score) : state
    if (next !== state) setState(next)
    const reveal = next.reveal

    useEffect(() => {
        if (!reveal) return
        reveal.ordinals.forEach((_, index) => cues.play('map-win', REVEAL_HIT_MS + index * REVEAL_STAGGER_MS))
    }, [reveal, cues])

    return reveal
}
