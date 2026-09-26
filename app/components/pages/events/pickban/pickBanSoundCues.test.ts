import { describe, expect, it } from 'vitest'
import type { PickBanPacing, PickBanState } from '@/app/utils/api'
import { DEFAULT_PICK_BAN_PACING } from '../manage/pickban/pickBanEditor'
import { DECIDER_IMPACT, IMPACT, VS_HIT } from './pickBanBeats'
import { STALE_HIT_MS, animationHitAt, cuesToPlay, soundScheduleAt } from './pickBanSoundCues'
import { SOUND_HIT_MS, type PickBanSoundCueKind } from './pickBanSounds'
import { buildPickBanView, entranceMsFor } from './pickBanView'
import {
    ELIGIBLE_MAPS,
    INTRO_MS,
    T0,
    exactFitPicks,
    locked,
    lockedInTurn,
    paused,
    resumed,
    started,
    undone,
    unlockAt,
} from './pickBanFixtures'

const [ALPHA, BRAVO, CHARLIE, DELTA, ECHO, FOXTROT] = ELIGIBLE_MAPS

const ON_BEAT = { delayMs: 0, offsetMs: 0 }

const ENTRANCE_OF_KIND = {
    intro: 'intro',
    pick: 'lettered',
    ban: 'lettered',
    ban_down: 'ban_down',
    decider: 'decider',
} as const

function cuesAt(state: PickBanState, now: number, played: ReadonlySet<string> = new Set()) {
    return cuesToPlay(state, { clockOffsetMs: 0, now }, played)
}

function primedPlayed(state: PickBanState, now: number): ReadonlySet<string> {
    return cuesAt(state, now).played
}

function ms(value: string | null): number {
    return Date.parse(value ?? '')
}

function introStartOf(state: PickBanState): number {
    return ms(state.intro_ends_at) - state.pacing.intro * 1000
}

function withPacing(state: PickBanState, pacing: Partial<PickBanPacing>): PickBanState {
    return { ...state, pacing: { ...state.pacing, ...pacing } }
}

function firstBanLocked(): PickBanState {
    return locked(started(), ALPHA, unlockAt(started()) + 2_000)
}

describe('soundScheduleAt', () => {
    it('waits when the file has to start later than now', () => {
        expect(soundScheduleAt(1_000, 300, 500)).toEqual({ delayMs: 200, offsetMs: 0 })
    })

    it('starts at once, part-way into the file, when the file’s start has passed but its hit has not', () => {
        expect(soundScheduleAt(1_000, 300, 800)).toEqual({ delayMs: 0, offsetMs: 100 })
    })

    it('starts right on the file’s hit when the animation hit passed no more than STALE_HIT_MS ago', () => {
        expect(soundScheduleAt(1_000, 300, 1_000 + STALE_HIT_MS)).toEqual({ delayMs: 0, offsetMs: 300 })
    })

    it('skips the sound once the animation hit is more than STALE_HIT_MS gone', () => {
        expect(soundScheduleAt(1_000, 300, 1_000 + STALE_HIT_MS + 1)).toBeNull()
    })
})

describe('cuesToPlay', () => {
    it('fires nothing before the intro or any step has begun', () => {
        const state = started()
        const result = cuesAt(state, introStartOf(state) - 1)
        expect(result.cues).toEqual([])
    })

    it('returns the same played set, with no new allocation, when nothing is newly due', () => {
        const state = started()
        const played = new Set<string>()

        const result = cuesAt(state, introStartOf(state) - 1, played)

        expect(result.played).toBe(played)
    })

    it('returns the same played set once every due cue is already in it', () => {
        const state = firstBanLocked()
        const revealAt = ms(state.plan[0].reveal_at)
        const played = cuesAt(state, revealAt + 10).played

        const result = cuesAt(state, revealAt + 20, played)

        expect(result.played).toBe(played)
    })

    it('puts each file’s hit where the animation hits at the default pacing, which the fixtures use', () => {
        expect(started().pacing).toEqual(DEFAULT_PICK_BAN_PACING)
        for (const kind of Object.keys(SOUND_HIT_MS) as PickBanSoundCueKind[]) {
            const entranceMs = entranceMsFor(DEFAULT_PICK_BAN_PACING, ENTRANCE_OF_KIND[kind])
            expect(animationHitAt(kind, 0, entranceMs)).toBeCloseTo(SOUND_HIT_MS[kind], 6)
        }
    })

    it('fires a ban cue exactly at a lettered ban’s reveal_at, not before, on the beat', () => {
        const state = firstBanLocked()
        const revealAt = ms(state.plan[0].reveal_at)

        const before = cuesAt(state, revealAt - 1)
        expect(before.cues).toEqual([])

        const at = cuesAt(state, revealAt, before.played)
        expect(at.cues).toEqual([{ key: `0:${state.plan[0].reveal_at}`, kind: 'ban', schedule: ON_BEAT }])
    })

    it('gives each step the cue of what it reveals, each on the beat at the default pacing', () => {
        const complete = lockedInTurn(started(), [ALPHA, BRAVO, CHARLIE, DELTA, ECHO, FOXTROT])
        let played: ReadonlySet<string> = new Set()
        const cues = complete.plan.flatMap((step) => {
            const result = cuesAt(complete, ms(step.reveal_at), played)
            played = result.played
            return result.cues
        })

        expect(cues.map((cue) => cue.kind)).toEqual(['ban', 'ban', 'pick', 'pick', 'ban_down', 'ban_down', 'decider'])
        expect(cues.map((cue) => cue.schedule)).toEqual(complete.plan.map(() => ON_BEAT))
        expect(complete.plan[6].automatic).toBe(true)
        for (const step of complete.plan) expect(played.has(`${step.index}:${step.reveal_at}`)).toBe(true)
        expect(played.has(`intro:${complete.started_at}`)).toBe(true)
    })

    it('gives a pick locked automatically as the last map standing the pick cue', () => {
        const state = lockedInTurn(started(exactFitPicks()), [ALPHA, BRAVO, CHARLIE])
        const auto = state.plan[3]
        expect(auto.automatic).toBe(true)

        const played = primedPlayed(state, ms(auto.reveal_at) - 500)
        const result = cuesAt(state, ms(auto.reveal_at), played)

        expect(result.cues).toEqual([{ key: `3:${auto.reveal_at}`, kind: 'pick', schedule: ON_BEAT }])
    })

    it('starts the file part-way in when a shorter pacing brings the hit forward, so the hit still lands on the impact', () => {
        const state = withPacing(firstBanLocked(), { spotlight: 4 })
        const revealAt = ms(state.plan[0].reveal_at)
        const sceneEntranceMs = buildPickBanView(state, { clockOffsetMs: 0, now: revealAt }).scene.entranceMs
        expect(sceneEntranceMs).toBe(800)
        const leadMs = SOUND_HIT_MS.ban - IMPACT * sceneEntranceMs

        const atReveal = cuesAt(state, revealAt)
        expect(atReveal.cues[0].schedule.delayMs).toBe(0)
        expect(atReveal.cues[0].schedule.offsetMs).toBeCloseTo(leadMs, 6)

        const aFrameLate = cuesAt(state, revealAt + 16)
        expect(aFrameLate.cues[0].schedule.offsetMs).toBeCloseTo(leadMs + 16, 6)
    })

    it('waits to start the file when a longer pacing pushes the hit back', () => {
        const complete = withPacing(lockedInTurn(started(), [ALPHA, BRAVO, CHARLIE, DELTA, ECHO, FOXTROT]), { decider_spotlight: 11 })
        const deciderRevealAt = ms(complete.plan[6].reveal_at)
        const played = primedPlayed(complete, deciderRevealAt - 500)

        const result = cuesAt(complete, deciderRevealAt, played)

        expect(result.cues).toHaveLength(1)
        expect(result.cues[0].kind).toBe('decider')
        expect(result.cues[0].schedule.offsetMs).toBe(0)
        expect(result.cues[0].schedule.delayMs).toBeCloseTo(DECIDER_IMPACT * 2_200 - SOUND_HIT_MS.decider, 6)
    })

    it('never replays a cue on a refresh, remount or 304 that keeps the same reveal_at', () => {
        const state = firstBanLocked()
        const revealAt = ms(state.plan[0].reveal_at)

        const played = primedPlayed(state, revealAt - 500)
        const first = cuesAt(state, revealAt + 10, played)
        expect(first.cues).toHaveLength(1)

        const second = cuesAt(state, revealAt + 5_000, first.played)
        expect(second.cues).toEqual([])

        const third = cuesAt(state, revealAt + 5_000, second.played)
        expect(third.cues).toEqual([])
    })

    it('marks steps already revealed at load as played, without sounding', () => {
        const state = lockedInTurn(started(), [ALPHA, BRAVO])
        const loadTime = unlockAt(state) + 1

        const primed = primedPlayed(state, loadTime)
        const next = cuesAt(state, loadTime + 1, primed)

        expect(next.cues).toEqual([])
    })

    it('plays again for a new lock at the same plan index after an undo', () => {
        const firstLock = firstBanLocked()
        const firstRevealAt = ms(firstLock.plan[0].reveal_at)
        const played = cuesAt(firstLock, firstRevealAt + 10).played

        const afterUndo = undone(firstLock, firstRevealAt + 5_000)
        const stillPlayed = cuesAt(afterUndo, firstRevealAt + 5_100, played)
        expect(stillPlayed.cues).toEqual([])

        const relocked = locked(afterUndo, BRAVO, firstRevealAt + 6_000)
        const secondRevealAt = ms(relocked.plan[0].reveal_at)
        const before = cuesAt(relocked, secondRevealAt - 1, stillPlayed.played)
        expect(before.cues).toEqual([])

        const after = cuesAt(relocked, secondRevealAt, before.played)
        expect(after.cues).toEqual([{ key: `0:${relocked.plan[0].reveal_at}`, kind: 'ban', schedule: ON_BEAT }])
    })

    it('never sounds an undone step, even once its old reveal_at has since passed', () => {
        const firstLock = firstBanLocked()
        const firstRevealAt = ms(firstLock.plan[0].reveal_at)
        const afterUndo = undone(firstLock, firstRevealAt + 1_000)

        const result = cuesAt(afterUndo, firstRevealAt + 10_000)
        expect(result.cues).toEqual([])
    })

    it('waits for the decider’s own delayed reveal, not the preceding ban’s', () => {
        const beforeDecider = lockedInTurn(started(), [ALPHA, BRAVO, CHARLIE, DELTA, ECHO, FOXTROT])
        const lastBan = beforeDecider.plan[5]
        const deciderStep = beforeDecider.plan[6]
        const lastBanRevealAt = ms(lastBan.reveal_at)
        const deciderRevealAt = ms(deciderStep.reveal_at)
        expect(deciderRevealAt).toBeGreaterThan(lastBanRevealAt)

        const played = primedPlayed(beforeDecider, lastBanRevealAt - 500)
        const atBanReveal = cuesAt(beforeDecider, lastBanRevealAt + 10, played)
        expect(atBanReveal.cues.map((cue) => cue.kind)).toEqual(['ban_down'])

        const beforeDeciderReveal = cuesAt(beforeDecider, deciderRevealAt - 1, atBanReveal.played)
        expect(beforeDeciderReveal.cues).toEqual([])

        const atDeciderReveal = cuesAt(beforeDecider, deciderRevealAt, beforeDeciderReveal.played)
        expect(atDeciderReveal.cues).toEqual([{ key: `6:${deciderStep.reveal_at}`, kind: 'decider', schedule: ON_BEAT }])
    })

    it('still sounds a reveal detected up to STALE_HIT_MS past its hit, starting on the file’s hit', () => {
        const state = firstBanLocked()
        const hitAt = ms(state.plan[0].reveal_at) + IMPACT * entranceMsFor(state.pacing, 'lettered')

        const result = cuesAt(state, hitAt + STALE_HIT_MS)
        expect(result.cues).toEqual([
            { key: `0:${state.plan[0].reveal_at}`, kind: 'ban', schedule: { delayMs: 0, offsetMs: SOUND_HIT_MS.ban } },
        ])
    })

    it('marks a reveal detected more than STALE_HIT_MS past its hit as played, without sounding', () => {
        const state = firstBanLocked()
        const hitAt = ms(state.plan[0].reveal_at) + IMPACT * entranceMsFor(state.pacing, 'lettered')
        const key = `0:${state.plan[0].reveal_at}`

        const result = cuesAt(state, hitAt + STALE_HIT_MS + 1)
        expect(result.cues).toEqual([])
        expect(result.played.has(key)).toBe(true)
    })

    it('freezes the reveal gate while paused, and honours the shifted reveal_at after resume', () => {
        const state = firstBanLocked()
        const revealAt = ms(state.plan[0].reveal_at)
        const pausedState = paused(state, revealAt - 200)

        const stillFrozen = cuesAt(pausedState, revealAt + 60_000)
        expect(stillFrozen.cues).toEqual([])

        const resumedState = resumed(pausedState, revealAt + 60_000)
        const shiftedRevealAt = ms(resumedState.plan[0].reveal_at)
        expect(shiftedRevealAt).toBeGreaterThan(revealAt)

        const beforeShifted = cuesAt(resumedState, shiftedRevealAt - 1, stillFrozen.played)
        expect(beforeShifted.cues).toEqual([])

        const afterShifted = cuesAt(resumedState, shiftedRevealAt, beforeShifted.played)
        expect(afterShifted.cues).toEqual([{ key: `0:${resumedState.plan[0].reveal_at}`, kind: 'ban', schedule: ON_BEAT }])
    })

    it('sounds nothing while paused, even a step revealed just before the pause', () => {
        const state = firstBanLocked()
        const revealAt = ms(state.plan[0].reveal_at)
        const pausedState = paused(state, revealAt + 10)
        const played = new Set<string>()

        const result = cuesAt(pausedState, revealAt + 20, played)

        expect(result.cues).toEqual([])
        expect(result.played).toBe(played)
    })

    it('sounds nothing once the session is cancelled or voided', () => {
        const state = firstBanLocked()
        const revealAt = ms(state.plan[0].reveal_at)

        expect(cuesAt({ ...state, status: 'cancelled' }, revealAt).cues).toEqual([])
        expect(cuesAt({ ...state, status: 'voided' }, revealAt).cues).toEqual([])
    })
})

describe('cuesToPlay: the intro', () => {
    it('plays the intro cue once, as the intro scene begins, on the beat at the default pacing', () => {
        const state = started()
        const introStart = introStartOf(state)
        expect(introStart).toBe(ms(state.intro_ends_at) - INTRO_MS)

        const before = cuesAt(state, introStart - 1)
        expect(before.cues).toEqual([])

        const at = cuesAt(state, introStart, before.played)
        expect(at.cues).toEqual([{ key: `intro:${state.started_at}`, kind: 'intro', schedule: ON_BEAT }])

        const later = cuesAt(state, introStart + 200, at.played)
        expect(later.cues).toEqual([])
        expect(later.played.has(`intro:${state.started_at}`)).toBe(true)
    })

    it('aligns the intro to the VS hit of the intro entrance', () => {
        const state = withPacing(started(), { intro: 6 })
        const introStart = introStartOf(state)

        const result = cuesAt(state, introStart)

        expect(result.cues[0].schedule.delayMs).toBeCloseTo(VS_HIT * 1_200 - SOUND_HIT_MS.intro, 6)
    })

    it('never replays the intro on a refresh or remount', () => {
        const state = started()
        const introStart = introStartOf(state)

        const remounted = primedPlayed(state, introStart + 10)
        const refreshed = cuesAt({ ...state, version: state.version + 1 }, introStart + 30, remounted)

        expect(refreshed.cues).toEqual([])
    })

    it('marks an intro detected more than STALE_HIT_MS past its hit as played, without sounding', () => {
        const state = started()
        const hitAt = introStartOf(state) + SOUND_HIT_MS.intro

        const result = cuesAt(state, hitAt + STALE_HIT_MS + 1)

        expect(result.cues).toEqual([])
        expect(result.played.has(`intro:${state.started_at}`)).toBe(true)
    })

    it('plays the intro again after a restart starts a new run', () => {
        const first = started()
        const played = cuesAt(first, introStartOf(first)).played

        const restarted = started(first, T0 + 60_000)
        const introStart = introStartOf(restarted)
        const result = cuesAt(restarted, introStart, played)

        expect(result.cues).toEqual([{ key: `intro:${restarted.started_at}`, kind: 'intro', schedule: ON_BEAT }])
    })

    it('holds an intro paused before it began until its shifted start after resume', () => {
        const state = started()
        const introStart = introStartOf(state)
        const pausedState = paused(state, introStart - 500)

        const whilePaused = cuesAt(pausedState, introStart + 1_000)
        expect(whilePaused.cues).toEqual([])

        const resumedState = resumed(pausedState, introStart + 10_000)
        const shiftedStart = introStartOf(resumedState)
        expect(shiftedStart).toBe(introStart + 10_500)

        const beforeShifted = cuesAt(resumedState, shiftedStart - 1, whilePaused.played)
        expect(beforeShifted.cues).toEqual([])

        const atShifted = cuesAt(resumedState, shiftedStart, beforeShifted.played)
        expect(atShifted.cues).toEqual([{ key: `intro:${state.started_at}`, kind: 'intro', schedule: ON_BEAT }])
    })
})
