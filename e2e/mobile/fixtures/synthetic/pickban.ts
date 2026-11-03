import type { PickBanViewState } from '../../../../app/components/pages/events/pickban/pickBanView'
import { ROLE } from '../../../../app/utils/roles'
import { pickBanVetoFixture } from '../../../../app/utils/fixtures/pickBanVetoFixtures'
import { ok, type FixtureSet } from '../types'
import type { Person } from './people'
import { sessionRoutes } from './session'

export const PICKBAN_EVENT_SLUG = 'test-cup-pickban'
export const PICKBAN_EVENT_NAME = 'Test Cup 2026 Picks Edition'

const lobby: PickBanViewState = pickBanVetoFixture('pickBanLobbyVeto')

export const PICKBAN_MATCH_ID = lobby.match.id

export const CAPTAIN: Person = { id: '2010', alias: 'Player 2010', flag: 'de' }

const asCaptain: PickBanViewState = {
    ...lobby,
    viewer: { roster_captain: true, side: 'team_b' },
    capabilities: { ...lobby.capabilities, acting_side: 'team_b', can_manage: false, can_ready: true },
}

const asManager: PickBanViewState = {
    ...lobby,
    viewer: { roster_captain: false, side: null },
    capabilities: { ...lobby.capabilities, acting_side: null, can_manage: true, can_veto: false, can_choose_side: false, can_ready: false, can_lock_now: false },
}

function pickBanSet(name: string, state: PickBanViewState, role: number, viewer?: Person): FixtureSet {
    const base = `/tournaments/${PICKBAN_EVENT_SLUG}`
    return {
        name,
        routes: [
            ...sessionRoutes(role, viewer),
            { host: 'api', path: base, reply: ok({ tournament: { slug: PICKBAN_EVENT_SLUG, name: PICKBAN_EVENT_NAME } }) },
            { host: 'api', path: `${base}/matches/${PICKBAN_MATCH_ID}/pick-ban`, reply: ok(state) },
            { host: 'api', path: `${base}/pick-ban/config`, reply: ok(pickBanVetoFixture('pickBanConfig')) },
            { host: 'api', path: `${base}/admin/pick-ban/config`, reply: ok(pickBanVetoFixture('pickBanConfig')) },
        ],
    }
}

export const PICKBAN_CAPTAIN_SET = pickBanSet('match-pickban-captain', asCaptain, ROLE.USER, CAPTAIN)

export const PICKBAN_MANAGER_SET = pickBanSet('match-pickban-manager', asManager, ROLE.MODERATOR)
