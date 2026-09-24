import type { PickBanPlanStep, PickBanState, PickBanStepAction } from '@/app/utils/api'
import { parseApiInstant } from '@/app/utils/timezone'
import { revealedStepsAt, type PickBanClock } from './pickBanView'

export type PickBanSoundCueKind = 'lock_in' | 'ban' | 'decider'

export interface PickBanSoundCue {
    key: string
    kind: PickBanSoundCueKind
}

export interface PickBanSoundCuesResult {
    cues: PickBanSoundCue[]
    played: ReadonlySet<string>
}

export const STALE_CUE_MS = 1_500

const CUE_KIND_OF_ACTION: { [action in PickBanStepAction]: PickBanSoundCueKind } = {
    ban: 'ban',
    pick: 'lock_in',
    decider: 'decider',
}

function cueKeyOf(step: PickBanPlanStep): string {
    return `${step.index}:${step.reveal_at}`
}

export function cuesToPlay(state: PickBanState, clock: PickBanClock, played: ReadonlySet<string>): PickBanSoundCuesResult {
    const { clock: effectiveClock, revealed } = revealedStepsAt(state, clock)
    let next: Set<string> | null = null
    const cues: PickBanSoundCue[] = []
    for (const step of revealed) {
        const key = cueKeyOf(step)
        if (played.has(key)) continue
        if (next === null) next = new Set(played)
        next.add(key)
        const revealAt = parseApiInstant(step.reveal_at) ?? effectiveClock
        if (effectiveClock - revealAt > STALE_CUE_MS) continue
        cues.push({ key, kind: CUE_KIND_OF_ACTION[step.action] })
    }
    return { cues, played: next ?? played }
}
