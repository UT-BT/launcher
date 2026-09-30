import { EASE_IN, EASE_OUT, EASE_OVERSHOOT, type Bezier } from '@/app/components/broadcast/broadcastMotion'

export interface StingerBeat {
    delayMs: number
    durationMs: number
    ease: Bezier
}

export type StingerBeatName = 'slabAIn' | 'slabBIn' | 'flash' | 'plateIn' | 'logoIn' | 'titleIn' | 'brandOut' | 'slabsOut'

export const STINGER_FPS = 60

export const STINGER_DURATION_MS = 1200

export const STINGER_TRANSITION_MS = 600

export const STINGER_COVERED_FROM_MS = 420

export const STINGER_COVERED_UNTIL_MS = 880

export const STINGER_EVENT_NAME = 'UTBT 2v2 World Cup 2026'

export const STINGER_BEATS: Record<StingerBeatName, StingerBeat> = {
    slabAIn: { delayMs: 0, durationMs: 380, ease: EASE_OUT },
    slabBIn: { delayMs: 40, durationMs: 380, ease: EASE_OUT },
    flash: { delayMs: 380, durationMs: 380, ease: EASE_OUT },
    plateIn: { delayMs: 380, durationMs: 200, ease: EASE_OUT },
    logoIn: { delayMs: 430, durationMs: 240, ease: EASE_OVERSHOOT },
    titleIn: { delayMs: 480, durationMs: 240, ease: EASE_OUT },
    brandOut: { delayMs: 820, durationMs: 110, ease: EASE_IN },
    slabsOut: { delayMs: 880, durationMs: 280, ease: EASE_IN },
}

export function stingerFrameCount(): number {
    return Math.round((STINGER_DURATION_MS * STINGER_FPS) / 1000)
}

export function stingerFrameTimeMs(frame: number): number {
    return (frame * 1000) / STINGER_FPS
}

export function beatEndMs(beat: StingerBeat): number {
    return beat.delayMs + beat.durationMs
}

export function beatAnimation(keyframes: string, beat: StingerBeat): string {
    return `${keyframes} ${beat.durationMs}ms cubic-bezier(${beat.ease.join(', ')}) ${beat.delayMs}ms 1 normal both`
}
