import { useEffect, useMemo, useRef } from 'react'
import type { PickBanState } from '@/app/utils/api'
import { cuesToPlay } from './pickBanSoundCues'
import { createPickBanSoundPlayer } from './pickBanSoundPlayer'

export interface UsePickBanSoundOptions {
    state: PickBanState | null
    clockOffsetMs: number
    muted: boolean
}

export function usePickBanSound({ state, clockOffsetMs, muted }: UsePickBanSoundOptions): void {
    const stateRef = useRef(state)
    stateRef.current = state
    const offsetRef = useRef(clockOffsetMs)
    offsetRef.current = clockOffsetMs
    const playedRef = useRef<ReadonlySet<string>>(new Set())

    const player = useMemo(() => createPickBanSoundPlayer(), [])

    useEffect(() => {
        void player.preload()
        return () => player.dispose()
    }, [player])

    useEffect(() => {
        const unlock = () => player.unlock()
        window.addEventListener('pointerdown', unlock, { once: true })
        window.addEventListener('keydown', unlock, { once: true })
        return () => {
            window.removeEventListener('pointerdown', unlock)
            window.removeEventListener('keydown', unlock)
        }
    }, [player])

    useEffect(() => {
        if (muted) {
            playedRef.current = new Set()
            return
        }
        let primed = false
        let frame = requestAnimationFrame(function tick() {
            const current = stateRef.current
            if (current) {
                const result = cuesToPlay(current, { clockOffsetMs: offsetRef.current, now: Date.now() }, playedRef.current)
                playedRef.current = result.played
                if (primed) for (const cue of result.cues) player.play(cue.kind)
                primed = true
            }
            frame = requestAnimationFrame(tick)
        })
        return () => cancelAnimationFrame(frame)
    }, [player, muted])
}
