import { describe, expect, it } from 'vitest'
import { PICK_BAN_CONTRACT_CHOOSER_REASONS } from '@/app/utils/api'
import { pickBanVetoFixture } from '@/app/utils/fixtures/pickBanVetoFixtures'
import { chooserLine, chooserReasonText } from './chooserReasonCopy'

describe('chooser reason copy', () => {
    it('words every reason with the numbers behind it', () => {
        expect(chooserReasonText('lower_group_placing', { chooser: 4, other: 3 })).toBe('lower group finish (4th vs 3rd)')
        expect(chooserReasonText('lower_pre_cup_seed', { chooser: 16, other: 12 })).toBe('higher pre-cup seed (16 vs 12)')
        expect(chooserReasonText('lower_playoff_record', { chooser: { wins: 2, losses: 1 }, other: { wins: 2, losses: 0 } }))
            .toBe('worse playoff record (2-1 vs 2-0)')
        expect(chooserReasonText('direct_qualifier', null)).toBe('playoff qualifier vs direct qualifier')
        expect(chooserReasonText('admin', null)).toBe('named by an admin')
    })

    it('words every reason without numbers', () => {
        expect(PICK_BAN_CONTRACT_CHOOSER_REASONS.map((reason) => chooserReasonText(reason, null))).toEqual([
            'playoff qualifier vs direct qualifier',
            'worse playoff record',
            'lower group finish',
            'higher pre-cup seed',
            'named by an admin',
        ])
    })

    it('uses the right ordinal for any group finish', () => {
        expect(chooserReasonText('lower_group_placing', { chooser: 2, other: 1 })).toBe('lower group finish (2nd vs 1st)')
        expect(chooserReasonText('lower_group_placing', { chooser: 12, other: 11 })).toBe('lower group finish (12th vs 11th)')
        expect(chooserReasonText('lower_group_placing', { chooser: 23, other: 21 })).toBe('lower group finish (23rd vs 21st)')
    })

    it('leaves the numbers out when they don’t fit the reason', () => {
        expect(chooserReasonText('lower_group_placing', { chooser: { wins: 2, losses: 1 }, other: 3 })).toBe('lower group finish')
        expect(chooserReasonText('lower_playoff_record', { chooser: 4, other: 3 })).toBe('worse playoff record')
        expect(chooserReasonText('admin', { chooser: 4, other: 3 })).toBe('named by an admin')
    })

    it('keeps wording the reason the screens knew before', () => {
        expect(chooserReasonText('lower_knockout_differential', null)).toBe('lower knockout differential')
    })

    it('names the team that chooses', () => {
        expect(chooserLine("Hop n' Twerk", 'lower_group_placing', { chooser: 4, other: 3 })).toBe("Hop n' Twerk choose: lower group finish (4th vs 3rd)")
    })

    it('words the side block of every contract payload', () => {
        const lineOf = (name: 'pickBanLobbyVeto' | 'pickBanVetoChoice' | 'pickBanNoVeto' | 'pickBanDirectQualifier') => {
            const state = pickBanVetoFixture(name)
            const chooser = state.side.chooser!
            return chooserLine(state.teams[chooser]!.name, state.side.chooser_reason!, state.side.chooser_basis)
        }

        expect(lineOf('pickBanLobbyVeto')).toBe('T15 choose: lower group finish (4th vs 3rd)')
        expect(lineOf('pickBanVetoChoice')).toBe('T16 choose: higher pre-cup seed (16 vs 12)')
        expect(lineOf('pickBanNoVeto')).toBe('T07 choose: worse playoff record (2-1 vs 2-0)')
        expect(lineOf('pickBanDirectQualifier')).toBe('T09 choose: playoff qualifier vs direct qualifier')
    })
})
