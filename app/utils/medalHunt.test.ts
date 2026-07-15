import { describe, expect, it } from 'vitest'
import { buildOpportunities, parseDateTime, type Opportunity } from './medalHunt'
import type { BestCap, MapMetadata } from './api'
import fixture from './medalHunt.fixture.json'

type FixtureValue = number | string
type FixtureMap = Record<string, FixtureValue>
type FixtureCase = {
    name: string
    caps: BestCap[]
    maps: FixtureMap[]
    worldRecordDates: Record<string, string | null>
    expected: Record<string, FixtureValue | null>[]
}

const ABSENT = 'absent'

function wireValue(value: FixtureValue): FixtureValue {
    return value === ABSENT ? '' : value
}

function toMapMetadata(row: FixtureMap): MapMetadata {
    const out: Record<string, FixtureValue> = {}
    for (const [key, value] of Object.entries(row)) out[key] = wireValue(value)
    return out as unknown as MapMetadata
}

function byMapName(items: Opportunity[]): Map<string, Opportunity> {
    return new Map(items.map((item) => [item.mapName, item]))
}

describe('buildOpportunities golden fixture', () => {
    for (const testCase of fixture.cases as unknown as FixtureCase[]) {
        it(testCase.name, () => {
            const actual = buildOpportunities(
                testCase.caps,
                testCase.maps.map(toMapMetadata),
                testCase.worldRecordDates,
            )

            const actualByName = byMapName(actual)
            expect([...actualByName.keys()].sort()).toEqual(
                testCase.expected.map((row) => row.mapName as string).sort(),
            )

            for (const expected of testCase.expected) {
                const row = actualByName.get(expected.mapName as string)
                expect(row).toBeDefined()
                if (!row) continue

                expect(row.difficulty).toBe(wireValue(expected.difficulty as FixtureValue))
                expect(row.currentTime).toBe(expected.currentTime)
                expect(row.targetTime).toBe(expected.targetTime)
                expect(row.targetMedal).toBe(expected.targetMedal)
                expect(row.improvement).toBe(expected.improvement)
                expect(row.improvementPct).toBe(expected.improvementPct)
                expect(row.worldRecordAdded).toBe(expected.worldRecordAdded)
                expect(row.worldRecordAddedTime).toBe(
                    parseDateTime(expected.worldRecordAdded as string | null),
                )
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

    it('parses the wire format the API emits for a world-record date', () => {
        expect(parseDateTime('2026-01-02 03:04:05.123456')).toBeGreaterThan(0)
    })
})

describe('nextTarget epsilon boundary', () => {
    function opportunitiesFor(capTime: number, worldRecord: number): Opportunity[] {
        const map = {
            name: 'CTF-Boundary',
            difficulty: 1,
            required_players: 1,
            world_record: worldRecord,
        } as unknown as MapMetadata
        const cap: BestCap = { map: 'CTF-Boundary', cap_time_seconds: capTime, cap_type: 2, verified: true }
        return buildOpportunities([cap], [map], {})
    }

    it('drops a difference that is exactly the epsilon double', () => {
        expect(0.0015 - 0.001).toBe(0.0005)
        expect(opportunitiesFor(0.0015, 0.001)).toEqual([])
    })

    it('keeps a difference fractionally above the epsilon', () => {
        expect(opportunitiesFor(50.000500000001, 50)).toHaveLength(1)
    })

    it('keeps a nominal half-millisecond gap because binary64 puts it above the epsilon', () => {
        expect(50.0005 - 50).toBeGreaterThan(0.0005)
        expect(opportunitiesFor(50.0005, 50)).toHaveLength(1)
    })
})
