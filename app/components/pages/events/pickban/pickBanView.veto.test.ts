import { describe, expect, it } from 'vitest'
import { pickBanVetoFixture, type PickBanVetoSuccessFixtures } from '@/app/utils/fixtures/pickBanVetoFixtures'
import { buildPickBanView, type PickBanViewState } from './pickBanView'

type VetoFixtureName = Exclude<keyof PickBanVetoSuccessFixtures, 'pickBanConfig'>

const HARD_MAPS = ['Diplopia-V4', 'FuriumMineCE2', 'InventionCE2', 'Synchronize-vF2']

function vetoState(name: VetoFixtureName): PickBanViewState {
    return pickBanVetoFixture(name)
}

function serverNowOf(state: PickBanViewState): number {
    return Date.parse(state.server_now)
}

function viewOf(state: PickBanViewState, serverTime = serverNowOf(state)) {
    return buildPickBanView(state, { clockOffsetMs: 0, now: serverTime })
}

function asCaptainOf(state: PickBanViewState, side: 'team_a' | 'team_b', canVeto = false): PickBanViewState {
    return {
        ...state,
        viewer: { side, roster_captain: true },
        capabilities: { ...state.capabilities, acting_side: side, can_veto: canVeto, can_choose_side: false },
    }
}

function asSpectator(state: PickBanViewState): PickBanViewState {
    return {
        ...state,
        viewer: { side: null, roster_captain: false },
        capabilities: { ...state.capabilities, acting_side: null, can_veto: false, can_choose_side: false },
    }
}

describe('veto: the choice', () => {
    const choice = vetoState('pickBanVetoChoice')

    it('runs the veto choice once the intro ends, before any side choice', () => {
        const view = viewOf(choice)

        expect(view.veto).toMatchObject({ phase: 'veto_choice', active: true, outcome: null })
        expect(view.side.phase).toBeNull()
        expect(view.phase).toBe('awaiting')
        expect(view.stagePhase).toBe('awaiting')
        expect(view.turn).toBeNull()
        expect(view.countdown).toBeNull()
        expect(view.timeline).toEqual([])
        expect(view.scene).toMatchObject({ key: 'veto-choice', kind: 'veto_choice' })
    })

    it('keeps the intro on screen until it ends, then opens the veto without another poll', () => {
        const introEnd = Date.parse(choice.intro_ends_at!)

        expect(viewOf(choice, introEnd - 1_000)).toMatchObject({ phase: 'intro', veto: { phase: null } })
        expect(viewOf(choice, introEnd)).toMatchObject({ phase: 'awaiting', veto: { phase: 'veto_choice' } })
    })

    it('keeps the veto choice open while paused', () => {
        const view = viewOf({ ...choice, status: 'paused', phase: 'paused', paused: true, paused_at: choice.server_now }, serverNowOf(choice) + 5_000)

        expect(view.phase).toBe('paused')
        expect(view.veto).toMatchObject({ phase: 'veto_choice', canVeto: false, viewerChooses: true })
    })

    it('shows "13 or 9 maps" while the plan waits for the veto', () => {
        const view = viewOf(choice)

        expect(view.veto?.poolLine).toBe('13 or 9 maps')
        expect(viewOf(vetoState('pickBanLobbyVeto')).veto?.poolLine).toBe('13 or 9 maps')
        expect(viewOf(vetoState('pickBanVetoSpotlightVetoed')).veto?.poolLine).toBeNull()
    })

    it('lists the Hard maps and what each choice leaves', () => {
        expect(viewOf(choice).veto).toMatchObject({ tag: 'Hard', maps: HARD_MAPS, poolSizes: { vetoed: 9, played: 13 } })
    })
})

describe('veto: what each captain can do', () => {
    const choice = vetoState('pickBanVetoChoice')

    it('lets an eligible captain who hasn’t chosen veto or play', () => {
        const view = viewOf(choice)

        expect(view.veto).toMatchObject({
            canVeto: true,
            viewerEligible: true,
            viewerChoice: null,
            viewerChooses: true,
            waiting: null,
        })
    })

    it('tells an eligible captain who has chosen who they are waiting for', () => {
        const view = viewOf(asCaptainOf(choice, 'team_a'))

        expect(view.veto).toMatchObject({
            canVeto: false,
            viewerEligible: true,
            viewerChoice: 'play',
            viewerChooses: false,
            waiting: 'Waiting for T16',
        })
    })

    it('tells a captain whose team isn’t eligible who is deciding', () => {
        const lobby = vetoState('pickBanLobbyVeto')
        const deciding = { ...lobby, status: 'running' as const, phase: 'veto_choice' as const, intro_ends_at: lobby.server_now }
        const view = viewOf(asCaptainOf(deciding, 'team_a'))

        expect(view.veto).toMatchObject({
            phase: 'veto_choice',
            canVeto: false,
            viewerEligible: false,
            viewerChoice: null,
            viewerChooses: false,
            waiting: 'T15 are deciding on the Hard maps',
        })
    })

    it('names both teams while both are deciding', () => {
        const bothDeciding = { ...choice, veto: { ...choice.veto!, choices: { team_a: null, team_b: null } } }

        expect(viewOf(asSpectator(bothDeciding)).veto?.waiting).toBe('T12 and T16 are deciding on the Hard maps')
    })

    it('shows a spectator who is still deciding', () => {
        expect(viewOf(asSpectator(choice)).veto).toMatchObject({ viewerEligible: false, viewerChooses: false, waiting: 'T16 are deciding on the Hard maps' })
    })

    it('lists each eligible team’s choice', () => {
        expect(viewOf(choice).veto?.choices).toEqual([
            { side: 'team_a', teamName: 'T12', choice: 'play' },
            { side: 'team_b', teamName: 'T16', choice: null },
        ])
    })
})

describe('veto: the spotlight', () => {
    const vetoed = vetoState('pickBanVetoSpotlightVetoed')
    const played = vetoState('pickBanVetoSpotlightPlayed')
    const vetoedEnd = Date.parse(vetoed.phase_ends_at!)

    it('announces the veto, counting down to the payload’s phase end', () => {
        const view = viewOf(vetoed)

        expect(view.veto).toMatchObject({
            phase: 'veto_spotlight',
            outcome: 'vetoed',
            vetoedBy: 'team_b',
            vetoedByName: 'T15',
            canVeto: false,
            waiting: null,
            reveal: { outcome: 'vetoed', side: 'team_b', teamName: 'T15', text: 'T15 veto the Hard maps', mapCount: 9, revealAt: Date.parse(vetoed.veto!.reveal_at!) },
        })
        expect(view.phase).toBe('spotlight')
        expect(view.stagePhase).toBe('spotlight')
        expect(view.spotlight).toBeNull()
        expect(view.turn).toBeNull()
        expect(view.side.phase).toBeNull()
        expect(view.countdown).toEqual({ endsAt: vetoedEnd, remainingMs: 8_500, totalMs: 8_500, frozen: false })
        expect(view.nextBoundaryAt).toBe(vetoedEnd)
        expect(view.scene).toMatchObject({ key: 'veto-reveal', kind: 'veto_reveal' })
    })

    it('says the Hard maps stay in when every eligible team plays them', () => {
        expect(viewOf(played).veto).toMatchObject({
            phase: 'veto_spotlight',
            outcome: 'played',
            vetoedBy: null,
            reveal: { outcome: 'played', side: null, teamName: null, text: 'Hard maps stay in', mapCount: 13 },
        })
    })

    it('opens the side choice when the spotlight ends, without another poll', () => {
        const view = viewOf(vetoed, vetoedEnd)

        expect(view.veto).toMatchObject({ phase: null, reveal: null })
        expect(view.side).toMatchObject({ phase: 'side_choice', waiting: 'T15 are choosing their side' })
        expect(view.scene).toMatchObject({ key: 'side-choice', kind: 'side_choice', elapsedMs: 0 })
    })

    it('holds the spotlight while paused, from the reveal and the pacing', () => {
        const pausedAt = serverNowOf(vetoed) + 2_000
        const view = viewOf(
            { ...vetoed, status: 'paused', phase: 'paused', phase_ends_at: null, paused: true, paused_at: new Date(pausedAt).toISOString() },
            vetoedEnd + 30_000,
        )

        expect(view.phase).toBe('paused')
        expect(view.veto?.phase).toBe('veto_spotlight')
        expect(view.countdown).toMatchObject({ remainingMs: 6_500, frozen: true })
    })

    it('runs before the side step and the scene moves forwards through both', () => {
        const order = [viewOf(vetoState('pickBanVetoChoice')).scene, viewOf(vetoed).scene, viewOf(vetoed, vetoedEnd).scene].map((scene) => scene.position)

        expect(order).toEqual([...order].sort((a, b) => a - b))
        expect(new Set(order).size).toBe(3)
    })
})

describe('veto: the pool', () => {
    function hardCards(view: ReturnType<typeof viewOf>) {
        return view.cards.filter((card) => HARD_MAPS.includes(card.map))
    }

    it('shows the Hard cards as pending while teams decide', () => {
        const view = viewOf(vetoState('pickBanVetoChoice'))

        expect(hardCards(view).map((card) => [card.state, card.pendingChoice, card.selectable])).toEqual(HARD_MAPS.map(() => ['available', true, false]))
        expect(view.cards.filter((card) => card.pendingChoice)).toHaveLength(4)
        expect(view.cards.map((card) => card.pendingLabel).filter(Boolean)).toEqual(HARD_MAPS.map(() => 'Hard?'))
        expect(hardCards(viewOf(vetoState('pickBanLobbyVeto'))).every((card) => card.pendingChoice)).toBe(true)
    })

    it('excludes the Hard cards after a veto, naming who vetoed them', () => {
        const view = viewOf(vetoState('pickBanVetoSpotlightVetoed'))

        for (const card of hardCards(view)) {
            expect(card).toMatchObject({
                state: 'excluded',
                pendingChoice: false,
                vetoedBy: 'team_b',
                vetoedByName: 'T15',
                exclusionReason: 'Hard maps are vetoed by T15.',
            })
        }
        expect(view.cards.filter((card) => card.state !== 'excluded')).toHaveLength(9)
    })

    it('leaves the Hard cards plain when they stay in', () => {
        const view = viewOf(vetoState('pickBanVetoSpotlightPlayed'))

        expect(hardCards(view).map((card) => [card.state, card.pendingChoice, card.vetoedBy, card.exclusionReason])).toEqual(
            HARD_MAPS.map(() => ['available', false, null, null]),
        )
    })

    it('names no veto on an exclusion the rules applied by themselves', () => {
        const state = vetoState('pickBanVetoSpotlightVetoed')
        const auto = {
            ...state,
            pool: state.pool.map((card) => (card.exclusion ? { ...card, exclusion: { ...card.exclusion, mode: 'auto' as const, vetoed_by: null } } : card)),
        }

        expect(hardCards(viewOf(auto))[0]).toMatchObject({
            state: 'excluded',
            vetoedBy: null,
            exclusionReason: 'Hard maps are excluded because T15 has pre-cup seed 15 (11 or higher).',
        })
    })
})

describe('veto: the timeline', () => {
    it('has no steps while the veto is unresolved', () => {
        expect(viewOf(vetoState('pickBanVetoChoice')).timeline).toEqual([])
        expect(viewOf(vetoState('pickBanLobbyVeto')).timeline).toEqual([])
    })

    it('runs 8 lettered steps and the decider on 9 maps', () => {
        const timeline = viewOf(vetoState('pickBanVetoSpotlightVetoed')).timeline

        expect(timeline.map((entry) => [entry.segment, entry.actor])).toEqual([
            ['lettered', 'A'],
            ['lettered', 'B'],
            ['lettered', 'B'],
            ['lettered', 'A'],
            ['lettered', 'B'],
            ['lettered', 'A'],
            ['lettered', 'B'],
            ['lettered', 'A'],
            ['decider', null],
        ])
    })

    it('adds the ban-down A, B, B, A on 13 maps', () => {
        const timeline = viewOf(vetoState('pickBanVetoSpotlightPlayed')).timeline

        expect(timeline).toHaveLength(13)
        expect(timeline.filter((entry) => entry.segment === 'ban_down').map((entry) => [entry.number, entry.actor, entry.color, entry.actionLabel])).toEqual([
            [9, 'A', 'red', 'T12 (Red) bans'],
            [10, 'B', 'blue', 'T16 (Blue) bans'],
            [11, 'B', 'blue', 'T16 (Blue) bans'],
            [12, 'A', 'red', 'T12 (Red) bans'],
        ])
        expect(timeline[12]).toMatchObject({ segment: 'decider', mapNumber: 5 })
    })

    it('keeps the 13-map timeline when nobody is eligible', () => {
        const view = viewOf(vetoState('pickBanNoVeto'))

        expect(view.veto).toMatchObject({ active: false, phase: null, eligible: [], poolLine: null })
        expect(view.timeline.filter((entry) => entry.segment === 'ban_down').map((entry) => entry.actor)).toEqual(['A', 'B', 'B', 'A'])
        expect(view.side.phase).toBe('side_choice')
    })

    it('has no veto view for a stage without a team choice', () => {
        expect(viewOf(vetoState('pickBanDirectQualifier')).veto).toBeNull()
    })
})

describe('veto: the side step after it', () => {
    const sideChoice = vetoState('pickBanSideChoiceAfterVeto')

    it('lets the weaker team choose from cards built on the 9-map plan', () => {
        const view = viewOf(sideChoice)

        expect(view.veto?.phase).toBeNull()
        expect(view.side).toMatchObject({ phase: 'side_choice', canChoose: true, viewerChooses: true, chooserName: 'T15' })
        expect(view.side.cards).toMatchObject([
            {
                color: 'red',
                title: 'Red · Side A',
                lead: 'Ban 1st, pick 2nd',
                steps: [
                    { number: 1, label: 'Ban' },
                    { number: 4, label: 'Pick map 2' },
                    { number: 6, label: 'Ban' },
                    { number: 8, label: 'Pick map 4' },
                ],
            },
            {
                color: 'blue',
                title: 'Blue · Side B',
                lead: 'Ban 2nd, pick 1st',
                steps: [
                    { number: 2, label: 'Ban' },
                    { number: 3, label: 'Pick map 1' },
                    { number: 5, label: 'Ban' },
                    { number: 7, label: 'Pick map 3' },
                ],
            },
        ])
        expect(view.side.cards.flatMap((card) => card.steps).some((step) => step.segment === 'ban_down')).toBe(false)
    })

    it('words why the chooser chooses', () => {
        expect(viewOf(sideChoice).side).toMatchObject({
            chooserReason: 'lower_group_placing',
            chooserBasis: { chooser: 4, other: 3 },
            chooserLine: 'T15 choose: lower group finish (4th vs 3rd)',
        })
        expect(viewOf(vetoState('pickBanNoVeto')).side.chooserLine).toBe('T07 choose: worse playoff record (2-1 vs 2-0)')
    })

    it('keeps the reasons the older screens don’t know out of chooserReason', () => {
        expect(viewOf(vetoState('pickBanDirectQualifier')).side).toMatchObject({
            chooserReason: null,
            chooserLine: 'T09 choose: playoff qualifier vs direct qualifier',
        })
    })
})

describe('veto: manager controls', () => {
    function asManager(state: PickBanViewState): PickBanViewState {
        return {
            ...state,
            viewer: { side: null, roster_captain: false },
            capabilities: { ...state.capabilities, can_manage: true, acting_side: null, can_veto: false, can_choose_side: false },
        }
    }

    it('acts for each eligible team that hasn’t chosen during the veto choice', () => {
        expect(viewOf(asManager(vetoState('pickBanVetoChoice'))).affordances.manager).toMatchObject({ actForVeto: ['team_b'], actForSideChoice: null, undo: false, undoTarget: null })
    })

    it('never acts for a team as a manager who plays in the match', () => {
        const state = asManager(vetoState('pickBanVetoChoice'))

        expect(viewOf({ ...state, viewer: { side: 'team_a', roster_captain: false } }).affordances.manager?.actForVeto).toEqual([])
    })

    it('undoes the veto once it resolved, and the side first once step 0 set it', () => {
        const vetoed = asManager(vetoState('pickBanVetoSpotlightVetoed'))
        const sideSet = { ...vetoed, side: { ...vetoed.side, red: 'team_b' as const, source: 'step0' as const, confirmed: true } }

        expect(viewOf(vetoed).affordances.manager).toMatchObject({ actForVeto: [], undo: true, undoTarget: 'veto' })
        expect(viewOf(sideSet).affordances.manager).toMatchObject({ undo: true, undoTarget: 'side' })
    })

    it('has nothing to undo when nobody was eligible and no step is in', () => {
        expect(viewOf(asManager(vetoState('pickBanNoVeto'))).affordances.manager).toMatchObject({ actForVeto: [], undo: false, undoTarget: null })
    })
})
