import { useEffect, useRef, useState } from 'react'
import type { StreamSound } from '@/app/components/pages/events/pickban/stream/streamSound'
import { useSceneCues } from '../../useSceneCues'
import { WINNER_CUE_START, winnerCueStep, type WinnerCueSight } from './winnerCue'

export function useWinnerCue({ matchId, decided, active }: WinnerCueSight, sound: StreamSound, hitInMs: number): number {
    const cues = useSceneCues(sound)
    const memory = useRef(WINNER_CUE_START)
    const [reveals, setReveals] = useState(0)

    useEffect(() => {
        const step = winnerCueStep(memory.current, { matchId, decided, active })
        memory.current = step.memory
        if (!step.play) return
        cues.play('match-winner', hitInMs)
        setReveals(count => count + 1)
    }, [cues, matchId, decided, active, hitInMs])

    return reveals
}
