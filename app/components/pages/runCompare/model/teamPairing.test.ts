import { describe, expect, it } from 'vitest'
import { runCompareFixture } from '@/app/utils/fixtures/runCompareFixtures'
import { comparisonKey } from '../loading/comparisons'
import { comparisonKnots } from '../playback/syncTargets'
import type { CompareModel } from './compareModel'
import { RACE_CLOCK } from './positionModel'
import { editableSet, editSet, type SetEdit } from './setEdits'
import { DIFFERENT_ROUTE } from './teamVersus'
import { alignedComparisons, composeVersus, versusOf, type Versus } from './teamTestRuns'

const ALIGNED = versusOf('teamAligned')
const MIXED = versusOf('teamMixed')

const [GXLS, NETTLEZ] = ALIGNED.reference.members.map(run => run.capId)
const [FIERD, NIGHTWOLF] = ALIGNED.runner.members.map(run => run.capId)
const [BUN, FIERD_2, NAMELESS] = MIXED.reference.members.map(run => run.capId)
const [GIORGIO, KRAD, PATRIK] = MIXED.runner.members.map(run => run.capId)

function edited(versus: Versus, change: SetEdit, query = versus.query): string | null {
    return editSet(editableSet(composeVersus(versus, {}, query)), change).query
}

function pairsOf(model: CompareModel): string[] {
    return [...model.teams.pairing.teams.values()].flatMap(team => team.current.map(pair => `${pair.runner}:${pair.reference}`))
}

function xOf(model: CompareModel, capId: string): number {
    return model.race.layout.placed.find(placed => placed.slot.id === capId)!.rect.x
}

function laneOf(model: CompareModel, capId: string) {
    return model.lanes.lanes.find(lane => lane.capId === capId)!
}

function optionsOf(model: CompareModel, capId: string) {
    return model.teams.pairing.menus.get(capId)?.groups.flatMap(group => group.options.map(option => [option.run.alias, option.match, option.current])) ?? []
}

describe('overriding a pairing', () => {
    it('swaps both pairs when the displaced members are on one side, and moves the tiles into the new columns', () => {
        const query = edited(ALIGNED, { kind: 'pair', capId: FIERD, partner: GXLS })

        expect(query).toBe(`${ALIGNED.query}&pair=${FIERD}:${GXLS},${NIGHTWOLF}:${NETTLEZ}`)
        const model = composeVersus(ALIGNED, {}, query!)
        expect(pairsOf(model)).toEqual([`${FIERD}:${GXLS}`, `${NIGHTWOLF}:${NETTLEZ}`])
        expect(xOf(model, FIERD)).toBe(xOf(model, GXLS))
        expect(xOf(model, NIGHTWOLF)).toBe(xOf(model, NETTLEZ))
        expect(model.noticeLine).toBeNull()
    })

    it('drops the overrides once the choice gives back the suggested pairing', () => {
        const swapped = edited(ALIGNED, { kind: 'pair', capId: FIERD, partner: GXLS })!

        expect(edited(ALIGNED, { kind: 'pair', capId: GXLS, partner: NIGHTWOLF }, swapped)).toBe(ALIGNED.query)
    })

    it('leaves a displaced member unpaired when it has nobody to swap with', () => {
        const query = edited(MIXED, { kind: 'pair', capId: PATRIK, partner: BUN })

        expect(query).toBe(`${MIXED.query}&pair=${PATRIK}:${BUN},${KRAD}:${FIERD_2}`)
        const model = composeVersus(MIXED, {}, query!)
        expect(pairsOf(model)).toEqual([`${PATRIK}:${BUN}`, `${KRAD}:${FIERD_2}`])
        expect(xOf(model, PATRIK)).toBe(xOf(model, BUN))
        expect(xOf(model, GIORGIO)).toBeGreaterThan(xOf(model, KRAD))
        expect(laneOf(model, GIORGIO).badges).toContain('Time only')
    })

    it('offers only the other team\'s members on the same side, with their route or zone match and the current pair marked', () => {
        const model = composeVersus(MIXED)

        expect(optionsOf(model, PATRIK)).toEqual([['Bun` #OF', 'route match 29 %', false], ['fierd_2', null, false]])
        expect(optionsOf(model, KRAD)).toEqual([['Bun` #OF', 'zone match 100 %', false], ['fierd_2', 'zone match 60 %', true]])
        expect(optionsOf(model, BUN)).toEqual([['GiorgiO.pX5', 'route match 41 %', true], ['<Krad.pX4', 'zone match 100 %', false], ['PatriK.pX3', 'route match 29 %', false]])
        expect(model.teams.pairing.menus.has(NAMELESS)).toBe(false)
    })

    it('never pairs members across sides, from the menu or from the link', () => {
        expect(edited(MIXED, { kind: 'pair', capId: PATRIK, partner: NAMELESS })).toBe(MIXED.query)

        const linked = composeVersus(MIXED, {}, `${MIXED.query}&pair=${PATRIK}:${NAMELESS}`)
        expect(pairsOf(linked)).toEqual([`${GIORGIO}:${BUN}`, `${KRAD}:${FIERD_2}`])
        expect(linked.query).toBe(MIXED.query)
        expect(linked.noticeLine).toBe('Dropped 1 pairing outside the comparison.')
        expect(laneOf(linked, PATRIK).badges).toContain('Time only')
    })

    it('reads the pairwise comparison for an override pair whose route match is aligned, and the zone delta otherwise', () => {
        const comparison = { ...ALIGNED.comparison, candidates: ALIGNED.comparison.candidates.map(candidate => ({ ...candidate, score: 0.8 })) }
        const swapped = { ...ALIGNED, comparison }
        const model = composeVersus(swapped, {}, `${ALIGNED.query}&pair=${FIERD}:${GXLS},${NIGHTWOLF}:${NETTLEZ}`)
        expect(model.lanes.requests).toEqual([{ runner: FIERD, reference: GXLS }, { runner: NIGHTWOLF, reference: NETTLEZ }])

        const routes = composeVersus(ALIGNED, {}, `${ALIGNED.query}&pair=${FIERD}:${GXLS},${NIGHTWOLF}:${NETTLEZ}`)
        expect(routes.lanes.requests).toEqual([])
        expect(laneOf(routes, FIERD).badges).toContain(DIFFERENT_ROUTE)

        const zones = composeVersus(MIXED, {}, `${MIXED.query}&pair=${KRAD}:${BUN},${GIORGIO}:${FIERD_2}`)
        expect(zones.lanes.requests).toEqual([])
        expect(laneOf(zones, KRAD).rung).toBe('zones')
        expect(laneOf(zones, GIORGIO).rung).toBe('zones')
    })
})

describe('normalising pair and drive against the set', () => {
    it('keeps an override written reference first, in runner-first order', () => {
        const model = composeVersus(ALIGNED, {}, `${ALIGNED.query}&pair=${GXLS}:${FIERD}`)

        expect(model.query).toBe(`${ALIGNED.query}&pair=${FIERD}:${GXLS}`)
        expect(pairsOf(model)).toEqual([`${FIERD}:${GXLS}`])
        expect(model.noticeLine).toBeNull()
    })

    it('drops a pairing inside one team, a runner paired twice, and a driving pair on the reference team', () => {
        const model = composeVersus(ALIGNED, {}, `${ALIGNED.query}&pair=${FIERD}:${NIGHTWOLF},${FIERD}:${GXLS},${NIGHTWOLF}:${GXLS}&drive=${GXLS}`)

        expect(model.query).toBe(`${ALIGNED.query}&pair=${NIGHTWOLF}:${GXLS}`)
        expect(pairsOf(model)).toEqual([`${NIGHTWOLF}:${GXLS}`])
        expect(model.noticeLine).toBe('Dropped 1 repeated pairing, 1 pairing outside the comparison and 1 driving pair outside the comparison.')
    })

    it('drops overrides and the driving pair when their members leave the set', () => {
        const query = `${ALIGNED.query}&pair=${FIERD}:${GXLS}&drive=${FIERD}`

        expect(edited(ALIGNED, { kind: 'remove', capId: FIERD }, query)).toBe(`runs=${ALIGNED.reference.teamCapId}&ref=${ALIGNED.reference.teamCapId}`)
    })

    it('stores the chosen driving pair, and keeps it while the reference team stays', () => {
        const query = edited(ALIGNED, { kind: 'drive', capId: NIGHTWOLF })

        expect(query).toBe(`${ALIGNED.query}&drive=${NIGHTWOLF}`)
        expect(edited(ALIGNED, { kind: 'pin', capId: FIERD }, query!)).toBe(`runs=${ALIGNED.runner.teamCapId},${ALIGNED.reference.teamCapId}&ref=${ALIGNED.runner.teamCapId}`)

        const fastestFirst = `runs=${ALIGNED.runner.teamCapId},${ALIGNED.reference.teamCapId}&drive=${GXLS}`
        expect(edited(ALIGNED, { kind: 'pin', capId: FIERD }, fastestFirst)).toBe(`runs=${ALIGNED.runner.teamCapId},${ALIGNED.reference.teamCapId}&ref=${ALIGNED.runner.teamCapId}&drive=${GXLS}`)
    })
})

describe('the driving pair', () => {
    const SHORT = runCompareFixture('short')
    const ALIGNED_READ = runCompareFixture('aligned')
    const comparisons = new Map([
        [comparisonKey({ runner: FIERD, reference: NETTLEZ }), ALIGNED_READ],
        [comparisonKey({ runner: NIGHTWOLF, reference: GXLS }), SHORT],
    ])
    const position = `${ALIGNED.query}&sync=position`

    it('defaults to the aligned pair with the highest route match', () => {
        const model = composeVersus(ALIGNED, { comparisons }, position)

        expect(model.teams.pairing.drives.get(ALIGNED.runner.teamCapId)).toEqual({ driver: FIERD, choices: [NIGHTWOLF, FIERD] })
        expect(model.sync.links).toEqual([{ capId: ALIGNED.runner.teamCapId, reference: ALIGNED.reference.teamCapId, knots: comparisonKnots(ALIGNED_READ) }])
        expect(model.sync.raceClock).toEqual([])
    })

    it('follows the pair stored in drive', () => {
        const model = composeVersus(ALIGNED, { comparisons }, `${position}&drive=${NIGHTWOLF}`)

        expect(model.teams.pairing.drives.get(ALIGNED.runner.teamCapId)?.driver).toBe(NIGHTWOLF)
        expect(model.sync.links).toEqual([{ capId: ALIGNED.runner.teamCapId, reference: ALIGNED.reference.teamCapId, knots: comparisonKnots(SHORT) }])
    })

    it('falls back to the default when the stored pair can\'t drive', () => {
        const query = `${ALIGNED.query}&sync=position&pair=${NIGHTWOLF}:${NETTLEZ},${FIERD}:${GXLS}&drive=${NIGHTWOLF}`
        const model = composeVersus(ALIGNED, {}, query)

        expect(model.teams.pairing.drives.get(ALIGNED.runner.teamCapId)).toEqual({ driver: null, choices: [] })
        expect(model.sync.links).toEqual([])
    })

    it('leaves a team with no aligned pair on Race, marked Race clock', () => {
        const failed = composeVersus(ALIGNED, { comparisons: alignedComparisons(ALIGNED, null) }, position)
        const row = failed.teams.rows.find(entry => entry.teamCapId === ALIGNED.runner.teamCapId)!

        expect(failed.sync.links).toEqual([])
        expect(failed.sync.raceClock).toEqual([FIERD, NIGHTWOLF])
        expect(row.badges).toContain(RACE_CLOCK)
        expect(row.lane?.badges).toContain(RACE_CLOCK)
        expect(laneOf(failed, FIERD).badges).toContain(RACE_CLOCK)
        expect(laneOf(failed, GXLS).badges).not.toContain(RACE_CLOCK)

        const mixed = composeVersus(MIXED, {}, `${MIXED.query}&sync=position`)
        expect(mixed.sync.raceClock).toEqual([GIORGIO, KRAD, PATRIK])
    })

    it('shows no Race clock while the driving pair\'s comparison is still being read, nor in Race', () => {
        expect(composeVersus(ALIGNED, { comparisons: new Map() }, position).sync.raceClock).toEqual([])
        expect(composeVersus(ALIGNED, { comparisons: alignedComparisons(ALIGNED, null) }).sync.raceClock).toEqual([])
    })
})
