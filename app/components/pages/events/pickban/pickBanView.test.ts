import { describe, expect, it } from 'vitest'
import type { PickBanState } from '@/app/utils/api'
import { buildPickBanView } from './pickBanView'
import {
    BAN_DOWN_SPOTLIGHT_MS,
    DECIDER_SPOTLIGHT_MS,
    ELIGIBLE_MAPS,
    HARD_MAP,
    INTRO_MS,
    LEAD_MS,
    SPOTLIGHT_MS,
    T0,
    asActingCaptain,
    asCaptain,
    asManager,
    asReplacedCaptain,
    asSpectator,
    asTeammate,
    iso,
    locked,
    lockedInTurn,
    paused,
    pickBanState,
    planOf,
    readAt,
    resumed,
    started,
    unlockAt,
} from './pickBanFixtures'

const [ALPHA, BRAVO, CHARLIE, DELTA, ECHO, FOXTROT, GOLF] = ELIGIBLE_MAPS
const INTRO_START = T0 + LEAD_MS
const INTRO_END = INTRO_START + INTRO_MS
const FIRST_LOCK = INTRO_END + 2_000

function viewAt(state: PickBanState, serverTime: number, clockOffsetMs = 0) {
    return buildPickBanView(state, { clockOffsetMs, now: serverTime - clockOffsetMs })
}

function cardOf(view: ReturnType<typeof viewAt>, map: string) {
    const card = view.cards.find((c) => c.map === map)
    if (!card) throw new Error(`no card ${map}`)
    return card
}

function firstBanLocked() {
    return locked(started(), ALPHA, FIRST_LOCK)
}

function beforeFinalBan() {
    return lockedInTurn(started(), [ALPHA, BRAVO, CHARLIE, DELTA, ECHO])
}

function completed() {
    return lockedInTurn(started(), [ALPHA, BRAVO, CHARLIE, DELTA, ECHO, FOXTROT])
}

describe('phase between polls', () => {
    it('keeps the lobby on screen through the reveal lead of Start, then counts the intro down', () => {
        const state = asSpectator(started())

        expect(viewAt(state, T0 + 1_000).phase).toBe('lobby')

        const intro = viewAt(state, INTRO_START + 1_000)
        expect(intro.phase).toBe('intro')
        expect(intro.countdown).toEqual({ endsAt: INTRO_END, remainingMs: INTRO_MS - 1_000, totalMs: INTRO_MS, frozen: false })

        const awaiting = viewAt(state, INTRO_END)
        expect(awaiting.phase).toBe('awaiting')
        expect(awaiting.countdown).toBeNull()
        expect(awaiting.turn).toMatchObject({
            stepIndex: 0, side: 'team_a', ab: 'A', action: 'ban', actorLabel: 'Crimson Cats', actionLabel: 'Crimson Cats bans',
        })
    })

    it('reads every timestamp through the clock offset', () => {
        const state = asSpectator(started())
        const localBehindServer = 30_000

        const view = viewAt(state, INTRO_START + 1_000, localBehindServer)

        expect(view.phase).toBe('intro')
        expect(view.countdown?.remainingMs).toBe(INTRO_MS - 1_000)
        expect(view.countdown?.endsAt).toBe(INTRO_END - localBehindServer)
        expect(buildPickBanView(state, { clockOffsetMs: 0, now: INTRO_START + 1_000 - localBehindServer }).phase).toBe('lobby')
    })

    it('reveals a lock-in at its reveal time, runs its spotlight, then awaits the next step without another poll', () => {
        const state = asSpectator(firstBanLocked())

        const inLead = viewAt(state, FIRST_LOCK + 1_000)
        expect(inLead.phase).toBe('awaiting')
        expect(inLead.turn?.stepIndex).toBe(0)
        expect(inLead.nextBoundaryAt).toBe(FIRST_LOCK + LEAD_MS)

        const revealed = viewAt(state, FIRST_LOCK + LEAD_MS)
        expect(revealed.phase).toBe('spotlight')
        expect(revealed.spotlight).toMatchObject({ index: 0, map: ALPHA, side: 'team_a', action: 'ban' })
        expect(revealed.countdown).toMatchObject({ remainingMs: SPOTLIGHT_MS, totalMs: SPOTLIGHT_MS })

        const next = viewAt(state, FIRST_LOCK + LEAD_MS + SPOTLIGHT_MS)
        expect(next.phase).toBe('awaiting')
        expect(next.spotlight).toBeNull()
        expect(next.turn).toMatchObject({ stepIndex: 1, side: 'team_b', action: 'ban', actionLabel: 'Azure Owls bans' })
    })

    it('says which map the awaited pick decides, and none for a ban', () => {
        const awaitingBan = asSpectator(readAt(started(), INTRO_END + 1_000))
        const bothBansIn = lockedInTurn(started(), [ALPHA, BRAVO])
        const awaitingPick = asSpectator(readAt(bothBansIn, unlockAt(bothBansIn) + 1_000))

        expect(viewAt(awaitingBan, INTRO_END + 1_000).turn).toMatchObject({ action: 'ban', mapNumber: null })
        expect(viewAt(awaitingPick, unlockAt(bothBansIn) + 1_000).turn).toMatchObject({
            stepIndex: 2, side: 'team_b', action: 'pick', mapNumber: 1, actionLabel: 'Azure Owls picks',
        })
    })

    it('shows no session at all when the match has never had one', () => {
        const view = viewAt(asSpectator(pickBanState({ id: null, status: 'none', phase: null, version: 0 })), T0)

        expect(view.phase).toBe('none')
        expect(view.turn).toBeNull()
        expect(view.timeline.every((entry) => entry.status === 'upcoming')).toBe(true)
    })
})

describe('pause', () => {
    it('freezes the spotlight countdown for the whole pause', () => {
        const pausedAt = FIRST_LOCK + LEAD_MS + 3_500
        const state = asSpectator(paused(firstBanLocked(), pausedAt))

        for (const serverTime of [pausedAt + 1_000, pausedAt + 60_000]) {
            const view = viewAt(state, serverTime)
            expect(view.phase).toBe('paused')
            expect(view.countdown).toEqual({ endsAt: null, remainingMs: SPOTLIGHT_MS - 3_500, totalMs: SPOTLIGHT_MS, frozen: true })
            expect(view.nextBoundaryAt).toBeNull()
        }
        expect(viewAt(state, pausedAt + 1_000).banners).toContainEqual({ kind: 'paused', key: 'paused', since: pausedAt })
    })

    it('freezes the intro countdown when paused during the intro', () => {
        const state = asSpectator(paused(started(), INTRO_START + 2_000))

        expect(viewAt(state, INTRO_START + 50_000).countdown).toMatchObject({ remainingMs: INTRO_MS - 2_000, frozen: true })
    })

    it('carries on with the intro after a pause taken during it', () => {
        const resumedAt = INTRO_START + 2_000 + 45_000
        const state = asSpectator(resumed(paused(started(), INTRO_START + 2_000), resumedAt))

        const view = viewAt(state, resumedAt + 1_000)

        expect(view.phase).toBe('intro')
        expect(view.countdown).toMatchObject({ remainingMs: INTRO_MS - 3_000, totalMs: INTRO_MS, frozen: false })
        expect(viewAt(state, resumedAt + INTRO_MS - 2_000).phase).toBe('awaiting')
    })

    it('picks the countdown back up from where it froze once resumed', () => {
        const pausedAt = FIRST_LOCK + LEAD_MS + 3_500
        const resumedAt = pausedAt + 30_000
        const state = asSpectator(resumed(paused(firstBanLocked(), pausedAt), resumedAt))

        const view = viewAt(state, resumedAt + 1_000)

        expect(view.phase).toBe('spotlight')
        expect(view.countdown?.remainingMs).toBe(SPOTLIGHT_MS - 3_500 - 1_000)
    })

    it('keeps the stage on whatever the pause froze, so the paused overlay sits over it', () => {
        const duringSpotlight = asSpectator(paused(firstBanLocked(), FIRST_LOCK + LEAD_MS + 3_500))
        const duringIntro = asSpectator(paused(started(), INTRO_START + 2_000))
        const whileAwaiting = asSpectator(paused(readAt(started(), INTRO_END + 1_000), INTRO_END + 1_000))

        expect(viewAt(duringSpotlight, FIRST_LOCK + 60_000)).toMatchObject({ phase: 'paused', stagePhase: 'spotlight' })
        expect(viewAt(duringIntro, INTRO_START + 60_000)).toMatchObject({ phase: 'paused', stagePhase: 'intro' })
        expect(viewAt(whileAwaiting, INTRO_END + 60_000)).toMatchObject({ phase: 'paused', stagePhase: 'awaiting' })
        expect(viewAt(asSpectator(firstBanLocked()), FIRST_LOCK + LEAD_MS + 1_000).stagePhase).toBe('spotlight')
        expect(viewAt(asSpectator(pickBanState()), T0).stagePhase).toBe('lobby')
    })

    it('keeps a lock-in that was still inside its reveal lead hidden until the pause ends', () => {
        const pausedAt = FIRST_LOCK + 500
        const pausedState = asSpectator(paused(firstBanLocked(), pausedAt))

        const during = viewAt(pausedState, pausedAt + 60_000)
        expect(cardOf(during, ALPHA).state).toBe('available')
        expect(during.timeline[0]).toMatchObject({ status: 'current', map: null })

        const resumedAt = pausedAt + 60_000
        const resumedState = asSpectator(resumed(pausedState, resumedAt))
        expect(cardOf(viewAt(resumedState, resumedAt + 500), ALPHA).state).toBe('available')
        expect(cardOf(viewAt(resumedState, resumedAt + LEAD_MS - 500), ALPHA).state).toBe('banned')
    })
})

describe('reveal gating', () => {
    it('hides any step still inside its reveal lead', () => {
        const state = asSpectator(firstBanLocked())

        const hidden = viewAt(state, FIRST_LOCK + LEAD_MS - 1)
        expect(cardOf(hidden, ALPHA).state).toBe('available')
        expect(hidden.timeline[0]).toMatchObject({ status: 'current', map: null, actedBy: null })

        const shown = viewAt(state, FIRST_LOCK + LEAD_MS)
        expect(cardOf(shown, ALPHA).state).toBe('banned')
        expect(shown.timeline[0]).toMatchObject({ status: 'revealed', map: ALPHA, actedBy: { id: '1000', display_name: 'Ada' } })
    })

    it('holds the automatic decider back until the ban before it has had its spotlight', () => {
        const before = beforeFinalBan()
        const finalLock = unlockAt(before) + 2_000
        const state = asSpectator(locked(before, FOXTROT, finalLock))
        const banReveal = finalLock + LEAD_MS
        const deciderReveal = banReveal + BAN_DOWN_SPOTLIGHT_MS
        expect(state.status).toBe('complete')

        const inLead = viewAt(state, finalLock + 1_000)
        expect(inLead.phase).toBe('awaiting')
        expect(cardOf(inLead, FOXTROT).state).toBe('available')

        const banSpotlight = viewAt(state, banReveal + 500)
        expect(banSpotlight.phase).toBe('spotlight')
        expect(banSpotlight.spotlight).toMatchObject({ index: 5, segment: 'ban_down', map: FOXTROT })
        expect(banSpotlight.countdown).toMatchObject({ remainingMs: BAN_DOWN_SPOTLIGHT_MS - 500, totalMs: BAN_DOWN_SPOTLIGHT_MS })
        expect(cardOf(banSpotlight, FOXTROT).state).toBe('banned')
        expect(cardOf(banSpotlight, GOLF).state).toBe('available')
        expect(banSpotlight.timeline[6]).toMatchObject({ status: 'current', map: null })
        expect(banSpotlight.summary[2].map).toBeNull()
        expect(banSpotlight.nextBoundaryAt).toBe(deciderReveal)

        const deciderSpotlight = viewAt(state, deciderReveal)
        expect(deciderSpotlight.phase).toBe('spotlight')
        expect(deciderSpotlight.spotlight).toMatchObject({ index: 6, segment: 'decider', map: GOLF })
        expect(deciderSpotlight.countdown).toMatchObject({ remainingMs: DECIDER_SPOTLIGHT_MS, totalMs: DECIDER_SPOTLIGHT_MS })
        expect(cardOf(deciderSpotlight, GOLF).state).toBe('decider')
        expect(deciderSpotlight.summary[2].map).toBe(GOLF)

        const done = viewAt(state, deciderReveal + DECIDER_SPOTLIGHT_MS)
        expect(done.phase).toBe('complete')
        expect(done.countdown).toBeNull()
        expect(done.turn).toBeNull()
    })

    it('reveals a decider-only plan as the intro ends', () => {
        const base = pickBanState()
        const decider = base.plan[base.plan.length - 1]
        const start = started(pickBanState({
            plan: [{ ...decider, index: 0, map_number: 1 }],
            pool: base.pool.filter((c) => c.map === GOLF || c.excluded),
            sequence: { preset_id: null, from_stage_key: null, ban_down: true, steps: [] },
        }))
        const state = asSpectator({
            ...start,
            status: 'complete',
            current_plan_index: null,
            completed_at: start.started_at,
            plan: [{ ...start.plan[0], map: GOLF, at: start.started_at, reveal_at: start.intro_ends_at }],
            spotlight_ends_at: iso(INTRO_END + DECIDER_SPOTLIGHT_MS),
        })

        expect(viewAt(state, T0 + 1_000).phase).toBe('lobby')

        const intro = viewAt(state, INTRO_END - 1)
        expect(intro.phase).toBe('intro')
        expect(intro.turn).toMatchObject({ action: 'decider', actionLabel: 'Decider', side: null })
        expect(cardOf(intro, GOLF).state).toBe('available')
        expect(intro.summary[0].map).toBeNull()

        const reveal = viewAt(state, INTRO_END)
        expect(reveal.phase).toBe('spotlight')
        expect(reveal.spotlight).toMatchObject({ segment: 'decider', map: GOLF })
        expect(cardOf(reveal, GOLF).state).toBe('decider')
        expect(reveal.summary).toEqual([expect.objectContaining({ mapNumber: 1, map: GOLF, decider: true })])

        expect(viewAt(state, INTRO_END + DECIDER_SPOTLIGHT_MS).phase).toBe('complete')
    })
})

describe('Locked in', () => {
    it('shows the side that just acted its step as Locked in, without revealing it', () => {
        const state = firstBanLocked()

        const actor = viewAt(asCaptain(state, 'team_a'), FIRST_LOCK + 500)
        expect(actor.timeline[0]).toMatchObject({ status: 'locked_in', map: null })
        expect(cardOf(actor, ALPHA)).toMatchObject({ state: 'available', lockedIn: true, selectable: false })
        expect(actor.turn).toMatchObject({ stepIndex: 0, viewerActs: true, lockedIn: true })
        expect(actor.affordances.canLock).toBe(false)
        expect(actor.spotlight).toBeNull()

        for (const other of [asCaptain(state, 'team_b'), asSpectator(state), asTeammate(state, 'team_a'), asManager(state)]) {
            const view = viewAt(other, FIRST_LOCK + 500)
            expect(view.timeline[0].status).toBe('current')
            expect(view.cards.some((c) => c.lockedIn)).toBe(false)
            expect(view.turn?.lockedIn).toBe(false)
        }

        expect(viewAt(asCaptain(state, 'team_a'), FIRST_LOCK + LEAD_MS).timeline[0].status).toBe('revealed')
    })
})

describe('cards', () => {
    it('gives every plan segment its card state, acting team and step number', () => {
        const view = viewAt(asSpectator(completed()), T0 + 3_600_000)

        const states = Object.fromEntries(view.cards.map((c) => [c.map, [c.state, c.side, c.ab, c.segment, c.stepNumber, c.mapNumber]]))
        expect(states).toEqual({
            [ALPHA]: ['banned', 'team_a', 'A', 'lettered', 1, null],
            [BRAVO]: ['banned', 'team_b', 'B', 'lettered', 2, null],
            [CHARLIE]: ['picked', 'team_b', 'B', 'lettered', 3, 1],
            [DELTA]: ['picked', 'team_a', 'A', 'lettered', 4, 2],
            [ECHO]: ['banned', 'team_b', 'B', 'ban_down', 5, null],
            [FOXTROT]: ['banned', 'team_a', 'A', 'ban_down', 6, null],
            [GOLF]: ['decider', null, null, 'decider', 7, 3],
            [HARD_MAP]: ['excluded', null, null, null, null, null],
        })
        expect(view.cards.map((c) => c.key)).toEqual([...ELIGIBLE_MAPS, HARD_MAP])
    })

    it('shows excluded maps with their reason and never lets them be chosen', () => {
        const view = viewAt(asCaptain(readAt(started(), INTRO_END + 1_000), 'team_a'), INTRO_END + 1_000)

        expect(cardOf(view, HARD_MAP)).toMatchObject({
            state: 'excluded',
            selectable: false,
            exclusion: {
                tag: 'Hard',
                min_pre_cup_seed: 10,
                triggered_by: [{ side: 'team_b', team_id: 'team-azure', pre_cup_seed: 12 }],
            },
        })
        expect(cardOf(view, ALPHA).selectable).toBe(true)
        expect(cardOf(view, ALPHA).exclusion).toBeNull()
    })

    it('explains in words which team triggered an exclusion', () => {
        const state = asSpectator(pickBanState())
        const hard = state.pool.find((c) => c.map === HARD_MAP)!
        const bothTriggered = {
            ...state,
            pool: state.pool.map((c) => (c.map === HARD_MAP ? {
                ...hard,
                exclusion: {
                    ...hard.exclusion!,
                    triggered_by: [
                        { side: 'team_a' as const, team_id: 'team-crimson', pre_cup_seed: 11 },
                        ...hard.exclusion!.triggered_by,
                    ],
                },
            } : c)),
        }

        expect(cardOf(viewAt(state, T0), HARD_MAP).exclusionReason)
            .toBe('Hard maps are excluded because Azure Owls has pre-cup seed 12 (10 or higher).')
        expect(cardOf(viewAt(bothTriggered, T0), HARD_MAP).exclusionReason)
            .toBe('Hard maps are excluded because Crimson Cats has pre-cup seed 11 and Azure Owls has pre-cup seed 12 (10 or higher).')
        expect(cardOf(viewAt(state, T0), ALPHA).exclusionReason).toBeNull()
    })

    it("flags the acting side's selection preview for every viewer", () => {
        const awaiting = readAt(started(), INTRO_END + 1_000)
        const previewing = { ...awaiting, selection_preview: { side: 'team_a' as const, map: BRAVO, at: awaiting.server_now } }

        for (const viewer of [asSpectator(previewing), asCaptain(previewing, 'team_b'), asManager(previewing)]) {
            const view = viewAt(viewer, INTRO_END + 1_500)
            expect(view.cards.filter((c) => c.previewed).map((c) => c.map)).toEqual([BRAVO])
        }
    })

    it('ignores a selection preview that is not for the step being awaited', () => {
        const awaiting = readAt(started(), INTRO_END + 1_000)
        const wrongSide = { ...awaiting, selection_preview: { side: 'team_b' as const, map: BRAVO, at: awaiting.server_now } }
        const stale = { ...firstBanLocked(), selection_preview: { side: 'team_b' as const, map: BRAVO, at: awaiting.server_now } }

        expect(viewAt(asSpectator(wrongSide), INTRO_END + 1_500).cards.some((c) => c.previewed)).toBe(false)
        expect(viewAt(asSpectator(stale), FIRST_LOCK + LEAD_MS + 1_000).cards.some((c) => c.previewed)).toBe(false)
    })
})

describe('timeline', () => {
    it("names each step's team and carries a revealed map's screenshot version", () => {
        const versioned = (state: PickBanState) => ({
            ...state,
            pool: state.pool.map((c) => ({ ...c, screenshot_version: `v-${c.map}` })),
        })
        const state = asSpectator(versioned(firstBanLocked()))

        const inLead = viewAt(state, FIRST_LOCK + 1_000)
        expect(inLead.timeline[0]).toMatchObject({ actorLabel: 'Crimson Cats', map: null, screenshotVersion: null })
        expect(inLead.timeline[6]).toMatchObject({ actorLabel: 'Decider', action: 'decider' })

        const revealed = viewAt(state, FIRST_LOCK + LEAD_MS)
        expect(revealed.timeline[0]).toMatchObject({ actorLabel: 'Crimson Cats', map: ALPHA, screenshotVersion: `v-${ALPHA}` })
        expect(revealed.spotlight).toMatchObject({ map: ALPHA, screenshotVersion: `v-${ALPHA}` })

        const done = viewAt(asSpectator(versioned(completed())), T0 + 3_600_000)
        expect(done.summary.map((entry) => entry.screenshotVersion)).toEqual([`v-${CHARLIE}`, `v-${DELTA}`, `v-${GOLF}`])
        expect(viewAt(asSpectator(versioned(pickBanState())), T0).summary.every((entry) => entry.screenshotVersion === null)).toBe(true)
    })

    it('labels who acts at every step: the team, its letter while the team is undecided, or the decider', () => {
        const undecidedB = pickBanState({ teams: { ...pickBanState().teams, team_b: null } })

        const view = viewAt(asSpectator(undecidedB), T0)

        expect(view.timeline.map((entry) => [entry.actorLabel, entry.actionLabel])).toEqual([
            ['Crimson Cats', 'Crimson Cats bans'],
            ['Team B', 'Team B bans'],
            ['Team B', 'Team B picks'],
            ['Crimson Cats', 'Crimson Cats picks'],
            ['Team B', 'Team B bans'],
            ['Crimson Cats', 'Crimson Cats bans'],
            ['Decider', 'Decider'],
        ])
        expect(view.summary.map((entry) => entry.actorLabel)).toEqual(['Team B', 'Crimson Cats', 'Decider'])
    })
})

describe('final summary', () => {
    it('reserves one slot per played map in play order before anything is picked', () => {
        const view = viewAt(asSpectator(pickBanState()), T0)

        expect(view.summary.map((entry) => [entry.mapNumber, entry.side, entry.decider, entry.map])).toEqual([
            [1, 'team_b', false, null],
            [2, 'team_a', false, null],
            [3, null, true, null],
        ])
    })

    it('lists the maps in play order with who picked them and the decider last', () => {
        const state = completed()
        const shuffled = { ...state, plan: [...state.plan].reverse() }

        const view = viewAt(asSpectator(shuffled), T0 + 3_600_000)

        expect(view.summary.map((entry) => [entry.mapNumber, entry.map, entry.actorLabel, entry.decider])).toEqual([
            [1, CHARLIE, 'Azure Owls', false],
            [2, DELTA, 'Crimson Cats', false],
            [3, GOLF, 'Decider', true],
        ])
        expect(view.timeline.map((entry) => entry.index)).toEqual([0, 1, 2, 3, 4, 5, 6])
    })
})

describe('banners', () => {
    it('explains a voided session and its warnings', () => {
        const state = asSpectator(pickBanState({
            status: 'voided',
            phase: 'voided',
            end_reason: "The match's teams changed.",
            warnings: ['Results were already entered, so the map slots were left alone.'],
        }))

        const view = viewAt(state, T0)

        expect(view.phase).toBe('voided')
        expect(view.banners).toEqual([
            { kind: 'voided', key: 'voided', reason: "The match's teams changed." },
            { kind: 'warning', key: 'warning-0', message: 'Results were already entered, so the map slots were left alone.' },
        ])
    })

    it('explains a cancelled session', () => {
        const view = viewAt(asSpectator(pickBanState({ status: 'cancelled', phase: 'cancelled', end_reason: 'Match postponed.' })), T0)

        expect(view.phase).toBe('cancelled')
        expect(view.banners).toEqual([{ kind: 'cancelled', key: 'cancelled', reason: 'Match postponed.' }])
    })

    it('says how many bans the plan skipped', () => {
        const view = viewAt(asSpectator(pickBanState({ dropped_bans: 2 })), T0)

        expect(view.banners).toEqual([{ kind: 'skipped_bans', key: 'skipped_bans', count: 2 }])
    })

    it('places each skipped ban the payload lists before the plan index it would have preceded', () => {
        const bo5 = pickBanState({
            match: { ...pickBanState().match, best_of: 5 },
            sequence: {
                preset_id: 'bo5_ban_pick',
                from_stage_key: 'bracket',
                ban_down: true,
                steps: [
                    { actor: 'A', action: 'ban' },
                    { actor: 'B', action: 'ban' },
                    { actor: 'B', action: 'pick' },
                    { actor: 'A', action: 'pick' },
                    { actor: 'B', action: 'pick' },
                    { actor: 'A', action: 'pick' },
                    { actor: 'B', action: 'ban' },
                    { actor: 'A', action: 'ban' },
                ],
            },
            plan: planOf([
                ['A', 'ban', 'lettered', null],
                ['B', 'pick', 'lettered', 1],
                ['A', 'pick', 'lettered', 2],
                ['B', 'pick', 'lettered', 3],
                ['A', 'pick', 'lettered', 4],
                [null, 'decider', 'decider', 5],
            ]),
            dropped_bans: 3,
            skipped_bans: [
                { actor: 'B', before_index: 1 },
                { actor: 'B', before_index: 5 },
                { actor: 'A', before_index: 5 },
            ],
        })

        expect(viewAt(asSpectator(bo5), T0).skippedBans).toEqual([
            { key: 'skipped-0', actor: 'B', beforeIndex: 1 },
            { key: 'skipped-1', actor: 'B', beforeIndex: 5 },
            { key: 'skipped-2', actor: 'A', beforeIndex: 5 },
        ])
        expect(viewAt(asSpectator(pickBanState()), T0).skippedBans).toEqual([])
    })

    it('takes skipped bans from the payload rather than re-deriving them from the sequence', () => {
        const state = pickBanState({ sequence: null, dropped_bans: 1, skipped_bans: [{ actor: 'A', before_index: 0 }] })

        expect(viewAt(asSpectator(state), T0).skippedBans).toEqual([{ key: 'skipped-0', actor: 'A', beforeIndex: 0 }])
    })

    it('reads a structured warning by its message, falling back to its code', () => {
        const view = viewAt(asSpectator(pickBanState({
            warnings: [{ code: 'results_present', message: 'Results exist.' }, { code: 'results_present' }],
        })), T0)

        expect(view.banners.map((banner) => banner.kind === 'warning' && banner.message)).toEqual(['Results exist.', 'results_present'])
    })
})

describe('affordances', () => {
    const awaitingA = readAt(started(), INTRO_END + 1_000)

    it('gives a spectator nothing to do', () => {
        const view = viewAt(asSpectator(awaitingA), INTRO_END + 1_000)

        expect(view.affordances).toEqual({ actingSide: null, canReady: false, isReady: false, canLock: false, manager: null })
        expect(view.cards.some((c) => c.selectable)).toBe(false)
    })

    it('lets a captain ready up in the lobby and shows whether their side is ready', () => {
        const lobby = asCaptain(pickBanState(), 'team_a')
        const ready = asCaptain(pickBanState({
            ready: { team_a: { id: '1000', display_name: 'Ada', at: '2026-09-26T19:55:00+00:00' }, team_b: null },
        }), 'team_a')

        expect(viewAt(lobby, T0).affordances).toMatchObject({ actingSide: 'team_a', canReady: true, isReady: false, canLock: false })
        expect(viewAt(ready, T0).affordances).toMatchObject({ canReady: true, isReady: true })
        expect(viewAt(ready, T0).teams.left).toMatchObject({ side: 'team_a', ready: { id: '1000' } })
    })

    it('lets a captain lock only on their own turn', () => {
        expect(viewAt(asCaptain(awaitingA, 'team_a'), INTRO_END + 1_000).affordances.canLock).toBe(true)
        expect(viewAt(asCaptain(awaitingA, 'team_b'), INTRO_END + 1_000).affordances.canLock).toBe(false)
    })

    it('gives a teammate and a replaced captain no controls, whatever their roster role', () => {
        for (const viewer of [asTeammate(awaitingA, 'team_a'), asReplacedCaptain(awaitingA, 'team_a')]) {
            const view = viewAt(viewer, INTRO_END + 1_000)
            expect(view.affordances).toMatchObject({ actingSide: null, canReady: false, canLock: false, manager: null })
            expect(view.cards.some((c) => c.selectable)).toBe(false)
        }
    })

    it('gives an acting captain the captain controls for their side', () => {
        const view = viewAt(asActingCaptain(awaitingA, 'team_a'), INTRO_END + 1_000)

        expect(view.affordances).toMatchObject({ actingSide: 'team_a', canLock: true })
        expect(view.turn?.viewerActs).toBe(true)
        expect(asReplacedCaptain(awaitingA, 'team_a').viewer.roster_captain).toBe(true)
    })

    it('unlocks the next captain the moment a spotlight or the intro ends, between polls', () => {
        const captainB = asCaptain(readAt(firstBanLocked(), FIRST_LOCK + LEAD_MS + 1_000), 'team_b')
        expect(captainB.capabilities.can_lock_now).toBe(false)
        expect(viewAt(captainB, FIRST_LOCK + LEAD_MS + SPOTLIGHT_MS - 1).affordances.canLock).toBe(false)
        expect(viewAt(captainB, FIRST_LOCK + LEAD_MS + SPOTLIGHT_MS).affordances.canLock).toBe(true)

        const captainA = asCaptain(started(), 'team_a')
        expect(viewAt(captainA, INTRO_END - 1).affordances.canLock).toBe(false)
        expect(viewAt(captainA, INTRO_END).affordances.canLock).toBe(true)
    })

    it('keeps the lock closed when the server refused it while awaiting', () => {
        const refused = { ...asCaptain(awaitingA, 'team_a'), capabilities: { ...asCaptain(awaitingA, 'team_a').capabilities, can_lock_now: false } }

        expect(viewAt(refused, INTRO_END + 1_000).affordances.canLock).toBe(false)
    })

    it('shows a manager the controls each status allows', () => {
        const controls = (state: PickBanState, serverTime = T0) => viewAt(asManager(state), serverTime).affordances.manager

        expect(controls(pickBanState({ id: null, status: 'none', phase: null }))).toMatchObject({ open: true, start: false, cancel: false })
        expect(controls(pickBanState({ blocking_reason: 'pool_too_small', blocking_reasons: ['pool_too_small'] }))).toMatchObject({
            open: false, start: true, startBlockedBy: 'pool_too_small', chooseA: true, swap: true, overrideSequence: true,
            handOver: true, cancel: true, pause: false, restart: false, actForSide: null,
        })
        expect(controls(awaitingA, INTRO_END + 1_000)).toMatchObject({
            start: false, chooseA: false, swap: true, pause: true, resume: false, undo: false, restart: true, cancel: true, actForSide: 'team_a',
        })
        const afterFirstStep = readAt(firstBanLocked(), FIRST_LOCK + 20_000)
        expect(controls(afterFirstStep, FIRST_LOCK + 20_000)).toMatchObject({ swap: false, undo: true, actForSide: 'team_b' })
        expect(controls(firstBanLocked(), FIRST_LOCK + LEAD_MS + 1_000)).toMatchObject({ actForSide: null })
        expect(controls(paused(firstBanLocked(), FIRST_LOCK + 5_000), FIRST_LOCK + 6_000)).toMatchObject({
            pause: false, resume: true, undo: true, actForSide: null,
        })
        expect(controls(completed(), T0 + 3_600_000)).toMatchObject({
            reopen: true, editFinal: true, restart: true, cancel: true, undo: false, pause: false, handOver: false,
        })
        expect(controls(pickBanState({ status: 'voided', phase: 'voided' }))).toMatchObject({ open: true, cancel: false, restart: false })
        expect(viewAt(asManager(awaitingA), INTRO_END + 1_000).affordances.canLock).toBe(false)
        expect(viewAt(asManager(awaitingA), INTRO_END + 1_000).cards.filter((c) => c.selectable)).toHaveLength(ELIGIBLE_MAPS.length)
    })
})

describe('team panels', () => {
    it('puts A on the left, marks whose turn it is and counts who is online', () => {
        const state = asCaptain(readAt(started(), INTRO_END + 1_000), 'team_b')
        const swapped = { ...state, a_side: 'team_b' as const }

        const view = viewAt(state, INTRO_END + 1_000)
        expect(view.teams.left).toMatchObject({ side: 'team_a', ab: 'A', name: 'Crimson Cats', onTurn: true, viewerTeam: false, onlineCount: 2 })
        expect(view.teams.right).toMatchObject({ side: 'team_b', name: 'Azure Owls', onTurn: false, viewerTeam: true })
        expect(view.teams.left?.members).toBe(state.teams.team_a?.members)

        expect(viewAt(swapped, INTRO_END + 1_000).teams.left?.side).toBe('team_b')
    })
})

describe('match heading', () => {
    it('names the match A first, with its stage, round and best-of', () => {
        const state = asSpectator(pickBanState())

        expect(viewAt(state, T0).match).toEqual({
            title: 'Crimson Cats vs Azure Owls',
            stageName: 'Bracket',
            roundLabel: 'Semi-Finals',
            bestOf: 3,
        })
        expect(viewAt({ ...state, a_side: 'team_b' }, T0).match.title).toBe('Azure Owls vs Crimson Cats')
        expect(viewAt({ ...state, teams: { ...state.teams, team_b: null } }, T0).match.title).toBe('Crimson Cats vs TBD')
    })
})
