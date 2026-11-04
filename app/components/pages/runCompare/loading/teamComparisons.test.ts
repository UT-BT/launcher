import { describe, expect, it } from 'vitest'
import type { TeamComparison } from '@/app/utils/api'
import { runCompareFixture } from '@/app/utils/fixtures/runCompareFixtures'
import { readTeamComparisons } from './teamComparisons'

const ALIGNED = runCompareFixture('teamAligned')
const RUNNER = ALIGNED.runner.team_cap_id
const REFERENCE = ALIGNED.reference.team_cap_id

function fakeRead(answer: (runner: string, reference: string) => Promise<TeamComparison | null>) {
    const signals: AbortSignal[] = []
    const read = (runner: string, reference: string, signal: AbortSignal) => {
        signals.push(signal)
        return answer(runner, reference)
    }
    return { read, signals }
}

const flush = () => new Promise(resolve => setTimeout(resolve, 0))

describe('reading the team comparisons of a set', () => {
    it('reports the body of each team read against the reference team', async () => {
        const seen: [string, TeamComparison | null][] = []
        const { read } = fakeRead(async () => ALIGNED)
        readTeamComparisons([{ runner: RUNNER, reference: REFERENCE }], read, (key, body) => seen.push([key, body]))
        await flush()

        expect(seen).toEqual([[`${RUNNER}:${REFERENCE}`, ALIGNED]])
    })

    it('treats a failed read, and a body for other team runs, as no team read', async () => {
        const seen: [string, TeamComparison | null][] = []
        const other = 'abab0009-0000-4000-8000-0000000000a9'
        const { read } = fakeRead(async runner => {
            if (runner === other) throw new Error('offline')
            return ALIGNED
        })
        readTeamComparisons([{ runner: REFERENCE, reference: RUNNER }, { runner: other, reference: REFERENCE }], read, (key, body) => seen.push([key, body]))
        await flush()

        expect(seen).toEqual([[`${REFERENCE}:${RUNNER}`, null], [`${other}:${REFERENCE}`, null]])
    })

    it('cancels its reads when the set changes, and reports none of them', async () => {
        const seen: string[] = []
        let release: (body: TeamComparison) => void = () => {}
        const { read, signals } = fakeRead(() => new Promise(resolve => { release = resolve }))
        const cancel = readTeamComparisons([{ runner: RUNNER, reference: REFERENCE }], read, key => seen.push(key))

        cancel()
        release(ALIGNED)
        await flush()

        expect(signals.map(signal => signal.aborted)).toEqual([true])
        expect(seen).toEqual([])
    })
})
