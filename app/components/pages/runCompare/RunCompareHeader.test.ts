import { describe, expect, it } from 'vitest'
import type { SoloRun } from './loading/soloRuns'
import { composeCompareModel } from './model/compareModel'
import { composeTeams, INDUSTRY, testTeam } from './model/teamTestRuns'
import { compareSubtitle } from './RunCompareHeader'

const A = '0a0a0a0a-0000-4000-8000-00000000000a'
const B = '0b0b0b0b-0000-4000-8000-00000000000b'

function run(capId: string, timeSeconds: number): SoloRun {
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
        checkpoints: [],
        disallowed: false,
    }
}

function solo(runs: SoloRun[]) {
    return composeCompareModel({ query: `runs=${runs.map(entry => entry.capId).join(',')}`, runs: new Map(runs.map(entry => [entry.capId, entry])) })
}

describe('the line under the map name', () => {
    it('counts solo runs', () => {
        expect(compareSubtitle(solo([run(A, 80), run(B, 81)]))).toBe('Solo · 2 runs')
        expect(compareSubtitle(solo([run(A, 80)]))).toBe('Solo · 1 run')
    })

    it('gives the team size and counts team runs', () => {
        const other = testTeam(1, 70)

        expect(compareSubtitle(composeTeams(`runs=${INDUSTRY.teamCapId}`, [INDUSTRY]))).toBe('3-player · 1 team run')
        expect(compareSubtitle(composeTeams(`runs=${other.teamCapId},${testTeam(2, 72).teamCapId}`, [other, testTeam(2, 72)]))).toBe('2-player · 2 team runs')
    })
})
