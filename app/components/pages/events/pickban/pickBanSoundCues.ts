import type { PickBanPlanStep, PickBanState, PickBanStepAction } from '@/app/utils/api'
import { parseApiInstant } from '@/app/utils/timezone'
import type { PickBanClock } from './pickBanView'

export type PickBanSoundCueKind = 'lock_in' | 'ban' | 'decider'

export interface PickBanSoundCue {
    key: string
    kind: PickBanSoundCueKind
}

export interface PickBanSoundCuesResult {
    cues: PickBanSoundCue[]
    played: ReadonlySet<string>
}

const CUE_KIND_OF_ACTION: { [action in PickBanStepAction]: PickBanSoundCueKind } = {
    ban: 'ban',
    pick: 'lock_in',
    decider: 'decider',
}

function isExecuted(step: PickBanPlanStep): boolean {
    return step.map !== null
}

function revealAtOf(step: PickBanPlanStep): number | null {
    return parseApiInstant(step.reveal_at)
}

function isRevealed(step: PickBanPlanStep, clock: number): boolean {
    return isExecuted(step) && (revealAtOf(step) ?? -Infinity) <= clock
}

function effectiveClockOf(state: PickBanState, { clockOffsetMs, now }: PickBanClock): number {
    const frozenAt = state.status === 'paused' ? parseApiInstant(state.paused_at) : null
    const serverNow = now + clockOffsetMs
    return frozenAt === null ? serverNow : Math.min(serverNow, frozenAt)
}

function cueKeyOf(step: PickBanPlanStep): string {
    return `${step.index}:${step.reveal_at}`
}

export function cuesToPlay(state: PickBanState, clock: PickBanClock, played: ReadonlySet<string>): PickBanSoundCuesResult {
    const effectiveClock = effectiveClockOf(state, clock)
    const next = new Set(played)
    const cues: PickBanSoundCue[] = []
    const steps = [...state.plan].sort((a, b) => a.index - b.index)
    for (const step of steps) {
        if (!isRevealed(step, effectiveClock)) continue
        const key = cueKeyOf(step)
        if (next.has(key)) continue
        next.add(key)
        cues.push({ key, kind: CUE_KIND_OF_ACTION[step.action] })
    }
    return { cues, played: next }
}
