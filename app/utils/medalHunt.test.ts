import { describe, expect, it } from 'vitest'
import { parseDateTime, toOpportunities } from './medalHunt'
import type { MedalHuntOpportunity } from './api'
import fixture from './medalHunt.fixture.json'

type FixtureCase = {
    name: string
    expected: Record<string, unknown>[]
}

const ABSENT = 'absent'

function toResponseRow(row: Record<string, unknown>): MedalHuntOpportunity {
    return {
        ...row,
        difficulty: row.difficulty === ABSENT ? '' : row.difficulty,
    } as unknown as MedalHuntOpportunity
}

describe('toOpportunities over the golden fixture responses', () => {
    for (const testCase of fixture.cases as unknown as FixtureCase[]) {
        it(testCase.name, () => {
            const response = testCase.expected.map(toResponseRow)
            const actual = toOpportunities(response)

            expect(actual).toHaveLength(response.length)

            for (const [index, row] of actual.entries()) {
                const want = response[index]
                expect(row.mapName).toBe(want.mapName)
                expect(row.difficulty).toBe(want.difficulty)
                expect(row.currentTime).toBe(want.currentTime)
                expect(row.targetTime).toBe(want.targetTime)
                expect(row.targetMedal).toBe(want.targetMedal)
                expect(row.improvement).toBe(want.improvement)
                expect(row.improvementPct).toBe(want.improvementPct)
                expect(row.worldRecordAdded).toBe(want.worldRecordAdded)
                expect(row.worldRecordAddedTime).toBe(parseDateTime(want.worldRecordAdded))
            }
        })
    }
})

describe('parseDateTime', () => {
    it('returns 0 for absent or unparseable values', () => {
        expect(parseDateTime(null)).toBe(0)
        expect(parseDateTime(undefined)).toBe(0)
        expect(parseDateTime('')).toBe(0)
        expect(parseDateTime('not-a-date')).toBe(0)
    })

    it('parses the offset-free wire format the API emits for a world-record date', () => {
        expect(parseDateTime('2026-01-02 03:04:05.123456')).toBeGreaterThan(0)
    })

    it('keeps a null world-record date sorting at epoch 0', () => {
        const rows = toOpportunities([
            { worldRecordAdded: null } as unknown as MedalHuntOpportunity,
            { worldRecordAdded: '2026-01-02 03:04:05.123456' } as unknown as MedalHuntOpportunity,
        ])
        expect(rows[0].worldRecordAddedTime).toBe(0)
        expect(rows[1].worldRecordAddedTime).toBeGreaterThan(0)
    })
})
