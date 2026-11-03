import { describe, expect, it } from 'vitest'
import type { CapComparison } from '@/app/utils/api'
import { runCompareFixture } from '@/app/utils/fixtures/runCompareFixtures'
import { readComparisons } from './comparisons'

interface PendingRead {
    key: string
    signal: AbortSignal
    settle: (comparison: CapComparison | null) => void
    fail: (error: Error) => void
}

function fakeReads() {
    const pending: PendingRead[] = []
    const read = (runner: string, reference: string, signal: AbortSignal) => new Promise<CapComparison | null>((resolve, reject) => {
        pending.push({ key: `${runner}:${reference}`, signal, settle: resolve, fail: reject })
    })
    const find = (key: string) => pending.find(p => p.key === key)!
    const flush = () => new Promise(resolve => setTimeout(resolve, 0))
    return {
        read,
        signalOf: (key: string) => find(key).signal,
        settle: async (key: string, comparison: CapComparison | null) => { find(key).settle(comparison); await flush() },
        fail: async (key: string) => { find(key).fail(new Error('offline')); await flush() },
        inFlight: () => pending.map(p => p.key),
    }
}

describe('reading the comparisons of a set', () => {
    it('reads every requested pair at once and reports each as it lands', async () => {
        const reads = fakeReads()
        const results: [string, CapComparison | null][] = []
        const aligned = runCompareFixture('aligned')
        readComparisons([{ runner: 'a', reference: 'r' }, { runner: 'b', reference: 'r' }], reads.read, (key, c) => results.push([key, c]))

        expect(reads.inFlight()).toEqual(['a:r', 'b:r'])
        await reads.settle('b:r', aligned)
        await reads.settle('a:r', null)

        expect(results).toEqual([['b:r', aligned], ['a:r', null]])
    })

    it('treats a read that throws as a failed comparison', async () => {
        const reads = fakeReads()
        const results: [string, CapComparison | null][] = []
        readComparisons([{ runner: 'a', reference: 'r' }], reads.read, (key, c) => results.push([key, c]))

        await reads.fail('a:r')

        expect(results).toEqual([['a:r', null]])
    })

    it('cancels every read when the set changes and ignores what lands afterwards', async () => {
        const reads = fakeReads()
        const results: string[] = []
        const cancel = readComparisons([{ runner: 'a', reference: 'r' }], reads.read, key => results.push(key))

        cancel()
        expect(reads.signalOf('a:r').aborted).toBe(true)
        await reads.settle('a:r', runCompareFixture('aligned'))

        expect(results).toEqual([])
    })
})
