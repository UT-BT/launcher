import { describe, expect, it } from 'vitest'
import type { ReplayVideo } from '@/app/utils/api'
import { startRowVideoPool } from './rowVideos'

function video(capId: string): ReplayVideo {
    return { source: 'utrecorder', mp4_url: `https://media.test/${capId}.mp4`, view_url: null, fps: 60 }
}

function fakeReads() {
    const pending = new Map<string, (video: ReplayVideo | null) => void>()
    const started: string[] = []
    const read = (capId: string) => new Promise<ReplayVideo | null>(resolve => {
        started.push(capId)
        pending.set(capId, resolve)
    })
    const finish = async (capId: string, value: ReplayVideo | null = video(capId)) => {
        pending.get(capId)!(value)
        pending.delete(capId)
        await Promise.resolve()
        await Promise.resolve()
    }
    return { read, started, pending, finish }
}

describe('row video reads', () => {
    it('read three at a time, visible rows first', async () => {
        const reads = fakeReads()
        const read: [string, ReplayVideo | null][] = []
        startRowVideoPool(() => ['v1', 'v2', 'v3', 'v4', 'h1', 'h2'], reads.read, (capId, value) => read.push([capId, value]))

        expect(reads.started).toEqual(['v1', 'v2', 'v3'])
        await reads.finish('v2', null)
        expect(reads.started).toEqual(['v1', 'v2', 'v3', 'v4'])
        expect(read).toEqual([['v2', null]])
        expect(reads.pending.size).toBe(3)
    })

    it('take the new order for the next reads when the visible rows change', async () => {
        const reads = fakeReads()
        let order = ['a', 'b', 'c', 'd', 'e', 'f']
        const pool = startRowVideoPool(() => order, reads.read, () => {})
        order = ['f', 'e', 'a', 'b', 'c', 'd']
        pool.wake()

        await reads.finish('a')
        expect(reads.started).toEqual(['a', 'b', 'c', 'f'])
        await reads.finish('b')
        expect(reads.started).toEqual(['a', 'b', 'c', 'f', 'e'])
    })

    it('start again when rows arrive after every read finished, and never read a row twice', async () => {
        const reads = fakeReads()
        let order = ['a']
        const pool = startRowVideoPool(() => order, reads.read, () => {})
        await reads.finish('a')
        order = ['a', 'b']
        pool.wake()
        pool.wake()
        expect(reads.started).toEqual(['a', 'b'])
    })

    it('stop reporting once stopped', async () => {
        const reads = fakeReads()
        const read: string[] = []
        const pool = startRowVideoPool(() => ['a', 'b', 'c', 'd'], reads.read, capId => read.push(capId))
        pool.stop()
        await reads.finish('a')
        expect(read).toEqual([])
        expect(reads.started).toEqual(['a', 'b', 'c'])
    })
})
