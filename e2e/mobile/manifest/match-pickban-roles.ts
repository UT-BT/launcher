import { CAPTAIN, PICKBAN_EVENT_SLUG, PICKBAN_MATCH_ID } from '../fixtures/synthetic/pickban'
import { signedInStorage } from '../fixtures/synthetic/session'
import { shows } from './steps'
import type { MobileRouteEntry } from './types'

const path = `/events/${PICKBAN_EVENT_SLUG}/matches/${PICKBAN_MATCH_ID}`
const motionOff = { 'utbt:pickBanMotion:v1': JSON.stringify('off') }

export const matchPickbanCaptain: MobileRouteEntry = {
    view: 'match-pickban',
    id: 'match-pickban:captain',
    tier: 'role-gated',
    path,
    fixtures: 'match-pickban-captain',
    decorative: [],
    storage: { ...signedInStorage(CAPTAIN), ...motionOff },
    ready: shows(page => page.getByRole('region', { name: 'Your team’s controls' }).or(page.getByLabel('Your team’s controls')).first()),
}

export const matchPickbanManager: MobileRouteEntry = {
    view: 'match-pickban',
    id: 'match-pickban:manager',
    tier: 'role-gated',
    path,
    fixtures: 'match-pickban-manager',
    decorative: [],
    storage: { ...signedInStorage(), ...motionOff },
    ready: shows(page => page.getByRole('heading', { name: 'Match Control' })),
}
