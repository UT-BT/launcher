import { useEffect, useRef, useState } from 'react'
import type { PickBanState } from '@/app/utils/api'
import { cuesToPlay } from './pickBanSoundCues'
import { createPickBanSoundPlayer, type PickBanSoundPlayer } from './pickBanSoundPlayer'

export interface UsePickBanSoundOptions {
    state: PickBanState | null
    clockOffsetMs: number
    muted: boolean
    volume: number
}

export type PickBanSoundControls = Pick<PickBanSoundPlayer, 'unlock' | 'preview'>

const UNLOCK_EVENTS = ['pointerdown', 'pointerup', 'touchend', 'keydown'] as const

export function usePickBanSound({ state, clockOffsetMs, muted, volume }: UsePickBanSoundOptions): PickBanSoundControls {
    const stateRef = useRef(state)
    stateRef.current = state
    const offsetRef = useRef(clockOffsetMs)
    offsetRef.current = clockOffsetMs
    const playedRef = useRef<ReadonlySet<string>>(new Set())

    const [player] = useState(() => createPickBanSoundPlayer(volume))

    useEffect(() => {
        void player.preload()
        return () => player.dispose()
    }, [player])

    useEffect(() => {
        player.setVolume(volume)
    }, [player, volume])

    useEffect(() => {
        const unlock = () => player.unlock()
        for (const type of UNLOCK_EVENTS) window.addEventListener(type, unlock)
        return () => {
            for (const type of UNLOCK_EVENTS) window.removeEventListener(type, unlock)
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
                if (primed) for (const cue of result.cues) player.play(cue.kind, cue.schedule)
                primed = true
            }
            frame = requestAnimationFrame(tick)
        })
        return () => cancelAnimationFrame(frame)
    }, [player, muted])

    return player
}
