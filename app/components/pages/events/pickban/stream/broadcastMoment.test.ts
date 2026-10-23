import { describe, expect, it } from 'vitest'
import { streamSidesFixture } from '@/app/utils/fixtures/streamSidesFixtures'
import { buildPickBanView, type PickBanView, type PickBanViewState } from '../pickBanView'
import { INTRO_MS, LEAD_MS, T0, asSpectator, locked, pickBanState, readAt, started, ELIGIBLE_MAPS } from '../pickBanFixtures'
import { pickBanVetoFixture } from '@/app/utils/fixtures/pickBanVetoFixtures'
import { broadcastBackdropLit, broadcastBoardOf, broadcastMomentOf, plateSideTagOf } from './broadcastMoment'

type ContractFixtureName = 'pickBanLobby' | 'pickBanLobbyUndetermined' | 'pickBanSideChoice' | 'pickBanSideSpotlight' | 'pickBanAdminSet'

function contractState(name: ContractFixtureName): PickBanViewState {
    const fixture = streamSidesFixture(name)
    return {
        ...fixture,
        viewer: { side: null, roster_captain: false },
        capabilities: { ...fixture.capabilities, acting_side: null, can_choose_side: false },
    }
}

function viewAt(state: PickBanViewState, serverTime = Date.parse(state.server_now)): PickBanView {
    return buildPickBanView(state, { clockOffsetMs: 0, now: serverTime })
}

const INTRO_END = T0 + LEAD_MS + INTRO_MS

describe('the broadcast moment for step 0', () => {
    it('spotlights the chooser while they pick, offering both colours with what each means', () => {
        expect(broadcastMomentOf(viewAt(contractState('pickBanSideChoice')))).toEqual({
            kind: 'side_choice',
            chooser: 'T04',
            options: [
                { color: 'red', tag: 'RED', lead: 'Ban 1st, pick 2nd' },
                { color: 'blue', tag: 'BLUE', lead: 'Ban 2nd, pick 1st' },
            ],
            reason: null,
        })
    })

    it('falls back to who acts first when the match has no planned steps', () => {
        const state = contractState('pickBanSideChoice')
        const moment = broadcastMomentOf(viewAt({ ...state, side: { ...state.side, cards: [] } }))

        expect(moment).toMatchObject({
            kind: 'side_choice',
            options: [
                { color: 'red', tag: 'RED', lead: 'Acts first' },
                { color: 'blue', tag: 'BLUE', lead: 'Acts second' },
            ],
        })
    })

    it('keeps the side choice on screen while the session is paused', () => {
        const state = contractState('pickBanSideChoice')
        const paused = { ...state, status: 'paused' as const, phase: 'paused' as const, paused: true, paused_at: state.server_now }

        expect(broadcastMomentOf(viewAt(paused, Date.parse(state.server_now) + 5_000))).toMatchObject({ kind: 'side_choice', chooser: 'T04' })
    })

    it('reveals the colour the chooser took, colour-coded with what it means', () => {
        expect(broadcastMomentOf(viewAt(contractState('pickBanSideSpotlight')))).toEqual({
            kind: 'side_reveal',
            reveal: { side: 'team_b', teamName: 'T04', color: 'red', text: 'T04 → RED · bans first' },
        })
    })

    it('hands over to the first lettered step once the reveal ends', () => {
        const state = contractState('pickBanSideSpotlight')

        expect(broadcastMomentOf(viewAt(state, Date.parse(state.phase_ends_at!)))).toBeNull()
    })

    it('shows the intro without a sides line while step 0 is still to come', () => {
        const state = contractState('pickBanSideChoice')

        expect(broadcastMomentOf(viewAt(state, Date.parse(state.intro_ends_at!) - 1_000))).toEqual({ kind: 'intro', sidesLine: null })
    })

    it('says the sides were set by an admin in the intro when step 0 is skipped', () => {
        const state = contractState('pickBanAdminSet')

        expect(broadcastMomentOf(viewAt(state, Date.parse(state.intro_ends_at!) - 1_000))).toEqual({ kind: 'intro', sidesLine: 'Sides set by admin' })
    })

    it('leaves the board on screen in the lobby and on an open turn', () => {
        expect(broadcastMomentOf(viewAt(contractState('pickBanLobby')))).toBeNull()
        expect(broadcastMomentOf(viewAt(contractState('pickBanAdminSet')))).toBeNull()
    })

    it('reveals a locked map in its spotlight', () => {
        const at = INTRO_END + 2_000
        const view = buildPickBanView(asSpectator(readAt(locked(started(), ELIGIBLE_MAPS[0], at), at + 2_000)), { clockOffsetMs: 0, now: at + 2_000 })

        expect(broadcastMomentOf(view)).toMatchObject({ kind: 'reveal', entry: { map: ELIGIBLE_MAPS[0] } })
    })
})

describe('the RED and BLUE plate tags', () => {
    it('stay off the plates until the side is chosen', () => {
        const choice = viewAt(contractState('pickBanSideChoice'))

        expect(plateSideTagOf(choice, choice.teams.left)).toBeNull()
        expect(plateSideTagOf(choice, choice.teams.right)).toBeNull()
    })

    it('tag both plates from the reveal on', () => {
        const reveal = viewAt(contractState('pickBanSideSpotlight'))

        expect(reveal.teams.left?.name).toBe('T04')
        expect(plateSideTagOf(reveal, reveal.teams.left)).toEqual({ label: 'RED', tone: 'a' })
        expect(plateSideTagOf(reveal, reveal.teams.right)).toEqual({ label: 'BLUE', tone: 'b' })
    })

    it('tag both plates from the start when an admin set the side', () => {
        const state = contractState('pickBanAdminSet')
        const intro = viewAt(state, Date.parse(state.intro_ends_at!) - 1_000)

        expect(plateSideTagOf(intro, intro.teams.left)).toEqual({ label: 'RED', tone: 'a' })
        expect(plateSideTagOf(intro, intro.teams.right)).toEqual({ label: 'BLUE', tone: 'b' })
    })

    it('stay off while the side is unconfirmed, and off a missing team', () => {
        const lobby = viewAt(asSpectator(pickBanState()), T0 - 60_000)

        expect(plateSideTagOf(lobby, lobby.teams.left)).toBeNull()
        expect(plateSideTagOf(viewAt(contractState('pickBanSideSpotlight')), null)).toBeNull()
    })
})

describe('the lit half of the backdrop', () => {
    it('lights the team that just took its colour during the reveal', () => {
        expect(broadcastBackdropLit(viewAt(contractState('pickBanSideSpotlight')))).toBe('left')
    })

    it('lights nobody while the chooser picks', () => {
        expect(broadcastBackdropLit(viewAt(contractState('pickBanSideChoice')))).toBeNull()
    })

    it('lights the team on the clock during a lettered turn', () => {
        expect(broadcastBackdropLit(viewAt(asSpectator(readAt(started(), INTRO_END + 1_000)), INTRO_END + 1_000))).toBe('left')
    })
})

type VetoFixtureName = 'pickBanVetoChoice' | 'pickBanVetoSpotlightVetoed' | 'pickBanVetoSpotlightPlayed' | 'pickBanSideChoiceAfterVeto' | 'pickBanNoVeto'

const HARD_MAPS = ['Diplopia-V4', 'FuriumMineCE2', 'InventionCE2', 'Synchronize-vF2']

function vetoState(name: VetoFixtureName): PickBanViewState {
    const fixture = pickBanVetoFixture(name)
    return {
        ...fixture,
        viewer: { side: null, roster_captain: false },
        capabilities: { ...fixture.capabilities, acting_side: null, can_veto: false, can_choose_side: false, can_manage: false },
    }
}

function hardMapsOf(state: PickBanViewState) {
    return HARD_MAPS.map(map => ({ map, screenshotVersion: state.pool.find(card => card.map === map)?.screenshot_version ?? null }))
}

describe('the broadcast moment for the Hard-map veto', () => {
    it('leaves the board on screen while the teams decide', () => {
        expect(broadcastMomentOf(viewAt(vetoState('pickBanVetoChoice')))).toBeNull()
    })

    it('announces the team that vetoed the Hard maps, with the four maps to stamp and who chooses the side next', () => {
        const state = vetoState('pickBanVetoSpotlightVetoed')

        expect(broadcastMomentOf(viewAt(state))).toEqual({
            kind: 'veto_reveal',
            tag: 'Hard',
            reveal: {
                outcome: 'vetoed',
                side: 'team_b',
                teamName: 'T15',
                text: 'T15 veto the Hard maps',
                mapCount: 9,
                revealAt: Date.parse(state.veto!.reveal_at!),
            },
            maps: hardMapsOf(state),
            next: 'T15 choose their side',
        })
    })

    it('announces that the Hard maps stay in when every eligible team plays them', () => {
        const state = vetoState('pickBanVetoSpotlightPlayed')

        expect(broadcastMomentOf(viewAt(state))).toEqual({
            kind: 'veto_reveal',
            tag: 'Hard',
            reveal: {
                outcome: 'played',
                side: null,
                teamName: null,
                text: 'Hard maps stay in',
                mapCount: 13,
                revealAt: Date.parse(state.veto!.reveal_at!),
            },
            maps: hardMapsOf(state),
            next: 'T16 choose their side',
        })
    })

    it('holds the announcement until the veto spotlight ends, then spotlights the side choice', () => {
        const state = vetoState('pickBanVetoSpotlightVetoed')
        const end = Date.parse(state.phase_ends_at!)

        expect(broadcastMomentOf(viewAt(state, end - 1))).toMatchObject({ kind: 'veto_reveal' })
        expect(broadcastMomentOf(viewAt(state, end))).toMatchObject({ kind: 'side_choice', chooser: 'T15' })
    })

    it('names the first step next when the side was already set', () => {
        const state = vetoState('pickBanVetoSpotlightVetoed')
        const sideSet = { ...state, side: { ...state.side, red: 'team_a' as const, confirmed: true, source: 'admin' as const } }

        expect(broadcastMomentOf(viewAt(sideSet))).toMatchObject({ kind: 'veto_reveal', next: 'T04 to ban' })
    })

    it('has no veto moment without a choice rule', () => {
        const state = vetoState('pickBanVetoSpotlightVetoed')

        expect(broadcastMomentOf(viewAt({ ...state, veto: null }))?.kind).not.toBe('veto_reveal')
    })

    it('has no veto moment when nobody is eligible', () => {
        const state = vetoState('pickBanNoVeto')

        expect(broadcastMomentOf(viewAt(state))).toMatchObject({ kind: 'side_choice', chooser: 'T07' })
    })

    it('gives the side choice after a veto the reason the chooser chooses', () => {
        expect(broadcastMomentOf(viewAt(vetoState('pickBanSideChoiceAfterVeto')))).toMatchObject({
            kind: 'side_choice',
            chooser: 'T15',
            reason: 'T15 choose: lower group finish (4th vs 3rd)',
        })
    })

    it('keeps the side choice without a reason in a stage without a choice rule', () => {
        expect(broadcastMomentOf(viewAt(contractState('pickBanSideChoice')))).toMatchObject({ kind: 'side_choice', reason: null })
    })

    it('lights the half of the team that vetoed, and nobody when the maps stay in', () => {
        expect(broadcastBackdropLit(viewAt(vetoState('pickBanVetoSpotlightVetoed')))).toBe('right')
        expect(broadcastBackdropLit(viewAt(vetoState('pickBanVetoSpotlightPlayed')))).toBeNull()
        expect(broadcastBackdropLit(viewAt(vetoState('pickBanVetoChoice')))).toBeNull()
    })
})

describe('the broadcast board', () => {
    it('keeps the vetoed maps on the board, stamped, and out of the excluded line', () => {
        const view = viewAt(vetoState('pickBanSideChoiceAfterVeto'))
        const board = broadcastBoardOf(view.cards)

        expect(board.cards).toHaveLength(13)
        expect(board.cards.filter(card => card.vetoedBy !== null).map(card => card.map)).toEqual(HARD_MAPS)
        expect(board.excludedLines).toEqual([])
    })

    it('shows the pending Hard cards on the board while the teams decide', () => {
        const board = broadcastBoardOf(viewAt(vetoState('pickBanVetoChoice')).cards)

        expect(board.cards.filter(card => card.pendingChoice).map(card => card.map)).toEqual(HARD_MAPS)
    })

    it('lists automatically excluded maps under the board, as before', () => {
        const view = viewAt(vetoState('pickBanSideChoiceAfterVeto'))
        const auto = view.cards.map(card => (card.vetoedBy ? { ...card, vetoedBy: null, vetoedByName: null } : card))
        const board = broadcastBoardOf(auto)

        expect(board.cards).toHaveLength(9)
        expect(board.excludedLines).toEqual(['Hard maps are out: Diplopia-V4 · FuriumMineCE2 · InventionCE2 · Synchronize-vF2'])
    })
})
