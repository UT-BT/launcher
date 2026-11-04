import { describe, expect, it } from 'vitest'
import type { CompareModel } from './compareModel'
import { rowAudio, rowFocusAt } from './focusModel'
import { composeVersus, versusOf, WIDE } from './teamTestRuns'

const ALIGNED = versusOf('teamAligned')
const [FIERD, NIGHTWOLF] = ALIGNED.runner.members.map(run => run.capId)
const [GXLS, NETTLEZ] = ALIGNED.reference.members.map(run => run.capId)

function rectOf(model: CompareModel, capId: string) {
    return model.race.layout.placed.find(placed => placed.slot.id === capId)!.rect
}

describe('focusing a team row', () => {
    it('numbers the team rows in add order and skips a number past the rows', () => {
        const model = composeVersus(ALIGNED)

        expect(rowFocusAt(model.race, model.teams, 1)).toBe(ALIGNED.runner.teamCapId)
        expect(rowFocusAt(model.race, model.teams, 2)).toBe(ALIGNED.reference.teamCapId)
        expect(rowFocusAt(model.race, model.teams, 3)).toBeNull()
    })

    it('numbers only the team rows that have a tile', () => {
        const model = composeVersus(ALIGNED)
        const race = { ...model.race, tiles: model.race.tiles.filter(tile => tile.id !== FIERD && tile.id !== NIGHTWOLF) }

        expect(rowFocusAt(race, model.teams, 1)).toBe(ALIGNED.reference.teamCapId)
        expect(rowFocusAt(race, model.teams, 2)).toBeNull()
    })

    it('gives the row\'s tiles the stage and puts the other tiles in the strip', () => {
        const model = composeVersus(ALIGNED, { focus: ALIGNED.runner.teamCapId })
        const [fierd, nightwolf, gxls, nettlez] = [FIERD, NIGHTWOLF, GXLS, NETTLEZ].map(capId => rectOf(model, capId))

        expect(model.race.focused).toBe(ALIGNED.runner.teamCapId)
        expect(model.teams.rows.every(row => row.header === null)).toBe(true)
        expect(fierd.width).toBe(nightwolf.width)
        expect(fierd.width).toBeGreaterThan(gxls.width * 2)
        expect(nightwolf.x).toBe(fierd.x)
        expect(nightwolf.y).toBeLessThan(fierd.y)
        expect(gxls.x).toBe(nettlez.x)
        expect(gxls.x).toBeGreaterThan(fierd.x + fierd.width)
        for (const rect of [fierd, nightwolf, gxls, nettlez]) {
            expect(rect.x).toBeGreaterThanOrEqual(0)
            expect(rect.y).toBeGreaterThanOrEqual(0)
            expect(rect.x + rect.width).toBeLessThanOrEqual(WIDE.width + 0.001)
            expect(rect.y + rect.height).toBeLessThanOrEqual(WIDE.height + 0.001)
        }
    })

    it('moves the audio into the row unless it is already there', () => {
        const model = composeVersus(ALIGNED)

        expect(rowAudio(model.race, model.teams, ALIGNED.reference.teamCapId, NIGHTWOLF)).toBe(GXLS)
        expect(rowAudio(model.race, model.teams, ALIGNED.runner.teamCapId, FIERD)).toBe(FIERD)
    })
})
