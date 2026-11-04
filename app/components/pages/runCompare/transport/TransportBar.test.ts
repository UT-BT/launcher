import { describe, expect, it } from 'vitest'
import type { CapCheckpoint } from '@/app/utils/api'
import { runCompareFixture } from '@/app/utils/fixtures/runCompareFixtures'
import type { LoadedComparisons } from '../loading/comparisons'
import type { SoloRun } from '../loading/soloRuns'
import { composeCompareModel } from '../model/compareModel'
import { composeTeams, INDUSTRY } from '../model/teamTestRuns'
import { jumpLabel, SYNC_MODES } from './TransportBar'

const SHORT = runCompareFixture('short')
const RUNNER = SHORT.runner.cap_id
const REFERENCE = SHORT.reference.cap_id

function checkpoints(...crossings: [string, number][]): CapCheckpoint[] {
    return crossings.map(([zone, cumulative], i) => ({ zone, cumulative, segment: cumulative - (crossings[i - 1]?.[1] ?? 0) }))
}

function run(capId: string, timeSeconds: number, zones: CapCheckpoint[]): SoloRun {
    return {
        capId,
        user: `7000000000000000${capId.slice(0, 2)}`,
        alias: capId.slice(0, 4),
        title: null,
        timeSeconds,
        map: 'CTF-BT-NaliRealm',
        side: 0,
        hasGhost: true,
        zoneCheckpoints: null,
        checkpoints: zones,
        disallowed: false,
    }
}

function cuesOf(comparisons: LoadedComparisons) {
    const runs = [
        run(RUNNER, SHORT.runner.cap_time_ms / 1000, checkpoints(['Door', 3.2], ['Hall', 7.5])),
        run(REFERENCE, SHORT.reference.cap_time_ms / 1000, checkpoints(['Door', 3], ['Hall', 7])),
    ]
    return composeCompareModel({
        query: `runs=${RUNNER},${REFERENCE}`,
        runs: new Map(runs.map(entry => [entry.capId, entry])),
        comparisons,
    }).cues.points
}

describe('the jump menu', () => {
    it('reads Jump to Sector when every cue is a sector', () => {
        const points = cuesOf(new Map([[`${RUNNER}:${REFERENCE}`, SHORT]]))

        expect(new Set(points.map(point => point.kind))).toEqual(new Set(['sector']))
        expect(jumpLabel(points)).toBe('Jump to Sector')
    })

    it('reads Jump to Zone on a team run, whose cues are its zones', () => {
        const points = composeTeams(`runs=${INDUSTRY.teamCapId}`, [INDUSTRY]).cues.points

        expect(new Set(points.map(point => point.kind))).toEqual(new Set(['zone']))
        expect(jumpLabel(points)).toBe('Jump to Zone')
    })

    it('reads Jump To when sectors and zones are both offered', () => {
        const points = cuesOf(new Map([[`${RUNNER}:${REFERENCE}`, null]]))

        expect(new Set(points.map(point => point.kind))).toEqual(new Set(['sector', 'zone']))
        expect(jumpLabel(points)).toBe('Jump To')
    })
})

describe('the sync switch', () => {
    it('offers Race and Same Spot, in that order', () => {
        expect(SYNC_MODES).toEqual([{ mode: 'race', label: 'Race' }, { mode: 'position', label: 'Same Spot' }])
    })
})
