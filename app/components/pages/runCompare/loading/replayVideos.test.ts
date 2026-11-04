import { describe, expect, it } from 'vitest'
import type { ReplayVideo } from '@/app/utils/api'
import { readVideosInOrder } from './replayVideos'

interface PendingRead {
    capId: string
    settle: (video: ReplayVideo | null) => void
}

function fakeReads() {
    const pending: PendingRead[] = []
    const started: string[] = []
    const read = (capId: string) => new Promise<ReplayVideo | null>(resolve => {
        started.push(capId)
        pending.push({ capId, settle: resolve })
    })
    const settle = async (capId: string, video: ReplayVideo | null) => {
        const index = pending.findIndex(p => p.capId === capId)
        pending.splice(index, 1)[0].settle(video)
        await new Promise(resolve => setTimeout(resolve, 0))
    }
    return { read, settle, started, inFlight: () => pending.map(p => p.capId) }
}

function video(capId: string): ReplayVideo {
    return { source: 'utrecorder', mp4_url: `https://media.test/${capId}.mp4`, view_url: null, fps: 60 }
}

describe('reading the replay videos of a comparison', () => {
    it('reads three at a time in the given order', async () => {
        const reads = fakeReads()
        const results: [string, ReplayVideo | null][] = []
        readVideosInOrder(['a', 'b', 'c', 'd', 'e'], reads.read, (capId, found) => results.push([capId, found]))

        expect(reads.inFlight()).toEqual(['a', 'b', 'c'])
        await reads.settle('b', video('b'))
        expect(reads.inFlight()).toEqual(['a', 'c', 'd'])
        await reads.settle('a', null)
        expect(reads.started).toEqual(['a', 'b', 'c', 'd', 'e'])
        expect(results).toEqual([['b', video('b')], ['a', null]])
    })

    it('starts nothing more and reports nothing once cancelled', async () => {
        const reads = fakeReads()
        const results: string[] = []
        const cancel = readVideosInOrder(['a', 'b', 'c', 'd'], reads.read, capId => results.push(capId))

        cancel()
        await reads.settle('a', video('a'))

        expect(reads.started).toEqual(['a', 'b', 'c'])
        expect(results).toEqual([])
    })
})
