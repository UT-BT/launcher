import type { PickBanPlanStep, PickBanSessionStatus } from '@/app/utils/api'
import { parseApiInstant } from '@/app/utils/timezone'
import { DECIDER_IMPACT, IMPACT, VS_HIT } from './pickBanBeats'
import { SOUND_HIT_MS, type PickBanSoundCueKind } from './pickBanSounds'
import { entranceMsFor, introStartsAt, revealedStepsAt, type PickBanClock, type PickBanViewState } from './pickBanView'

export interface PickBanSoundSchedule {
    delayMs: number
    offsetMs: number
}

export interface PickBanSoundCue {
    key: string
    kind: PickBanSoundCueKind
    schedule: PickBanSoundSchedule
}

export interface PickBanSoundCuesResult {
    cues: PickBanSoundCue[]
    played: ReadonlySet<string>
}

interface DueCue {
    key: string
    kind: PickBanSoundCueKind
    hitAt: number
}

export const STALE_HIT_MS = 100

const SOUNDING_STATUSES: PickBanSessionStatus[] = ['running', 'complete']

const HIT_SHARE: { [kind in PickBanSoundCueKind]: number } = {
    intro: VS_HIT,
    pick: IMPACT,
    ban: IMPACT,
    ban_down: IMPACT,
    decider: DECIDER_IMPACT,
}

export function soundScheduleAt(hitAt: number, fileHitMs: number, clock: number): PickBanSoundSchedule | null {
    if (clock - hitAt > STALE_HIT_MS) return null
    const fileStartsAt = hitAt - fileHitMs
    return {
        delayMs: Math.max(0, fileStartsAt - clock),
        offsetMs: Math.min(fileHitMs, Math.max(0, clock - fileStartsAt)),
    }
}

export function animationHitAt(kind: PickBanSoundCueKind, startsAt: number, entranceMs: number): number {
    return startsAt + HIT_SHARE[kind] * entranceMs
}

function cueKindOf(step: PickBanPlanStep): PickBanSoundCueKind {
    if (step.action === 'decider') return 'decider'
    if (step.action === 'pick') return 'pick'
    return step.segment === 'ban_down' ? 'ban_down' : 'ban'
}

function introCueOf(state: PickBanViewState, clock: number): DueCue | null {
    const startsAt = introStartsAt(state)
    if (startsAt === null || startsAt > clock || state.started_at === null) return null
    return { key: `intro:${state.started_at}`, kind: 'intro', hitAt: animationHitAt('intro', startsAt, entranceMsFor(state.pacing, 'intro')) }
}

function vetoCueOf(state: PickBanViewState, clock: number): DueCue | null {
    const veto = state.veto
    if (!veto?.active || veto.outcome !== 'vetoed') return null
    const resolvedAt = parseApiInstant(veto.resolved_at)
    const revealAt = parseApiInstant(veto.reveal_at)
    if (resolvedAt === null || revealAt === null || resolvedAt > clock) return null
    return { key: `veto:${veto.resolved_at}`, kind: 'ban', hitAt: revealAt }
}

function revealCueOf(state: PickBanViewState, step: PickBanPlanStep, clock: number): DueCue {
    const kind = cueKindOf(step)
    return {
        key: `${step.index}:${step.reveal_at}`,
        kind,
        hitAt: animationHitAt(kind, parseApiInstant(step.reveal_at) ?? clock, entranceMsFor(state.pacing, step.segment)),
    }
}

export function cuesToPlay(state: PickBanViewState, clock: PickBanClock, played: ReadonlySet<string>): PickBanSoundCuesResult {
    if (!SOUNDING_STATUSES.includes(state.status)) return { cues: [], played }
    const { clock: effectiveClock, revealed } = revealedStepsAt(state, clock)
    const due = [
        introCueOf(state, effectiveClock),
        vetoCueOf(state, effectiveClock),
        ...revealed.map((step) => revealCueOf(state, step, effectiveClock)),
    ]
    let next: Set<string> | null = null
    const cues: PickBanSoundCue[] = []
    for (const cue of due) {
        if (cue === null || played.has(cue.key)) continue
        if (next === null) next = new Set(played)
        next.add(cue.key)
        const schedule = soundScheduleAt(cue.hitAt, SOUND_HIT_MS[cue.kind], effectiveClock)
        if (schedule) cues.push({ key: cue.key, kind: cue.kind, schedule })
    }
    return { cues, played: next ?? played }
}
