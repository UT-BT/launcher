import { useEffect, useRef } from 'react'
import type { StreamSound } from '@/app/components/pages/events/pickban/stream/streamSound'
import type { StreamMatch } from '../../data/streamHotState'
import { useSceneCues } from '../../useSceneCues'
import { countdownCueDue, countdownMarkOf, type CountdownMark } from './startingSoonView'

export function useCountdownCue(match: StreamMatch, now: number, sound: StreamSound): void {
    const cues = useSceneCues(sound)
    const previous = useRef<CountdownMark | null>(null)
    const played = useRef<CountdownMark | null>(null)

    useEffect(() => {
        const next = countdownMarkOf(match, now)
        if (countdownCueDue(previous.current, next, played.current)) {
            cues.play('countdown-zero')
            played.current = next
        }
        previous.current = next
    }, [match, now, cues])
}
