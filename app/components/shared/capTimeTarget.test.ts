import { describe, expect, it } from 'vitest'
import { capTimeTarget } from './capTimeTarget'
import { pathToNav, viewToPath } from '@/app/components/navigation/routes'

const CAP_ID = '762aae22-12a2-4be2-9045-db197d676953'
const TEAM_CAP_ID = '3059e580-ef39-4cd4-9759-48dd6bda72c4'

describe('cap time link target', () => {
    it('sends a solo cap to the cap detail route', () => {
        expect(capTimeTarget(CAP_ID, null)).toEqual({ view: 'cap-detail', params: { capId: CAP_ID } })
    })

    it('sends a team cap to the team cap detail route', () => {
        expect(capTimeTarget(null, TEAM_CAP_ID)).toEqual({
            view: 'team-cap-detail',
            params: { teamCapId: TEAM_CAP_ID },
        })
    })

    it('prefers the team cap when a caller passes both', () => {
        expect(capTimeTarget(CAP_ID, TEAM_CAP_ID)?.view).toBe('team-cap-detail')
    })

    it('renders plain text when neither id is known', () => {
        expect(capTimeTarget(null, null)).toBeNull()
        expect(capTimeTarget(undefined, undefined)).toBeNull()
        expect(capTimeTarget('', '')).toBeNull()
    })

    it('never routes a team cap id through the solo cap page', () => {
        const target = capTimeTarget(undefined, TEAM_CAP_ID)!
        const path = viewToPath(target.view, target.params)

        expect(path).toBe(`/team-caps/${TEAM_CAP_ID}`)
        expect(pathToNav(path, '').view).toBe('team-cap-detail')
        expect(pathToNav(path, '').params.capId).toBeUndefined()
    })

    it('round-trips both kinds back to the id they were given', () => {
        for (const [capId, teamCapId, param, value] of [
            [CAP_ID, null, 'capId', CAP_ID],
            [null, TEAM_CAP_ID, 'teamCapId', TEAM_CAP_ID],
        ] as const) {
            const target = capTimeTarget(capId, teamCapId)!
            const parsed = pathToNav(viewToPath(target.view, target.params), '')
            expect(parsed.params[param]).toBe(value)
        }
    })
})
