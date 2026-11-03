import { describe, expect, it } from 'vitest'
import type { SoloRun } from '../loading/soloRuns'
import { composeCompareModel } from './compareModel'

const A = '0a0a0a0a-0000-4000-8000-00000000000a'
const B = '0b0b0b0b-0000-4000-8000-00000000000b'
const C = '0c0c0c0c-0000-4000-8000-00000000000c'
const D = '0d0d0d0d-0000-4000-8000-00000000000d'

function run(capId: string, alias: string, overrides: Partial<SoloRun> = {}): SoloRun {
    return {
        capId,
        user: `7000000000000000${capId.slice(0, 2)}`,
        alias,
        title: null,
        timeSeconds: 80,
        map: 'CTF-BT-NaliRealm',
        side: 0,
        hasGhost: true,
        zoneCheckpoints: null,
        checkpoints: [],
        disallowed: false,
        ...overrides,
    }
}

function loaded(...runs: [string, SoloRun | null][]) {
    return new Map(runs)
}

describe('while runs load', () => {
    it('waits for every listed run before listing, noticing or replacing', () => {
        const model = composeCompareModel({ query: `runs=${A},${B},bad`, runs: loaded([A, run(A, 'fierd_6')]) })
        expect(model.loading).toBe(true)
        expect(model.runs).toEqual([])
        expect(model.noticeLine).toBeNull()
        expect(model.title).toBeNull()
    })
})

describe('the loaded comparison', () => {
    it('lists the runs in add order and keeps an already normal address', () => {
        const fierd = run(A, 'fierd_6', { timeSeconds: 81.2 })
        const bun = run(B, 'Bun`', { timeSeconds: 79.9 })
        const model = composeCompareModel({ query: `runs=${A},${B}`, runs: loaded([A, fierd], [B, bun]) })

        expect(model.loading).toBe(false)
        expect(model.runs).toEqual([fierd, bun])
        expect(model.noticeLine).toBeNull()
        expect(model.query).toBe(`runs=${A},${B}`)
        expect(model.seekSeconds).toBeNull()
    })

    it('drops a run that is not a loadable cap, one on another map and a disallowed one, in one notice line', () => {
        const model = composeCompareModel({
            query: `runs=${A},${B},${C},${D}&ref=${C}`,
            runs: loaded(
                [A, null],
                [B, run(B, 'Bun`')],
                [C, run(C, 'Ghost', { map: 'CTF-BT-Other' })],
                [D, run(D, 'Cheat', { disallowed: true })],
            ),
        })

        expect(model.runs.map(r => r.capId)).toEqual([B])
        expect(model.query).toBe(`runs=${B}`)
        expect(model.noticeLine).toBe('Dropped 1 run that could not be loaded, 1 run on another map, 1 disallowed run and 1 reference outside the comparison.')
    })

    it('takes the map from the first valid run, not the first listed one', () => {
        const model = composeCompareModel({
            query: `runs=${A},${B},${C}`,
            runs: loaded([A, run(A, 'Cheat', { disallowed: true, map: 'CTF-BT-Other' })], [B, run(B, 'Bun`')], [C, run(C, 'fierd_6')]),
        })
        expect(model.runs.map(r => r.capId)).toEqual([B, C])
    })

    it('counts the decoding notices into the same line', () => {
        const model = composeCompareModel({
            query: `runs=${A},nope,${A},${B}&sync=fast&t=-1`,
            runs: loaded([A, run(A, 'fierd_6')], [B, run(B, 'Bun`')]),
        })
        expect(model.noticeLine).toBe('Dropped 1 malformed run id, 1 repeated run, 1 unknown sync mode and 1 invalid start time.')
        expect(model.query).toBe(`runs=${A},${B}`)
    })

    it('pluralises repeated reasons', () => {
        const model = composeCompareModel({
            query: `runs=${A},x,y,${A},${A}`,
            runs: loaded([A, run(A, 'fierd_6')]),
        })
        expect(model.noticeLine).toBe('Dropped 2 malformed run ids and 2 repeated runs.')
    })

    it('hands the start time over as the seed and drops it from the address', () => {
        const model = composeCompareModel({
            query: `runs=${A},${B}&sync=position&t=12.345`,
            runs: loaded([A, run(A, 'fierd_6')], [B, run(B, 'Bun`')]),
        })
        expect(model.seekSeconds).toBe(12.345)
        expect(model.query).toBe(`runs=${A},${B}&sync=position`)
        expect(model.noticeLine).toBeNull()
    })

    it('is empty with its notice when no listed run is valid', () => {
        const model = composeCompareModel({ query: `runs=nope,${A}`, runs: loaded([A, null]) })
        expect(model.loading).toBe(false)
        expect(model.runs).toEqual([])
        expect(model.query).toBe('')
        expect(model.title).toBeNull()
        expect(model.noticeLine).toBe('Dropped 1 malformed run id and 1 run that could not be loaded.')
    })

    it('is empty without a notice for a bare address', () => {
        const model = composeCompareModel({ query: '', runs: loaded() })
        expect(model.loading).toBe(false)
        expect(model.runs).toEqual([])
        expect(model.noticeLine).toBeNull()
    })
})

describe('the comparison title', () => {
    const names = ['fierd_6', 'Bun`', 'Decl', 'ShX'] as const
    const ids = [A, B, C, D]
    const all = loaded(...ids.map((id, index) => [id, run(id, names[index])] as [string, SoloRun]))

    function titleOf(count: number): string | null {
        return composeCompareModel({ query: `runs=${ids.slice(0, count).join(',')}`, runs: all }).title
    }

    it('names one run on its map', () => {
        expect(titleOf(1)).toBe('fierd_6 on NaliRealm')
    })

    it('names two runs as one against the other', () => {
        expect(titleOf(2)).toBe('fierd_6 vs Bun` on NaliRealm')
    })

    it('names the first two of three or more and counts the rest', () => {
        expect(titleOf(3)).toBe('fierd_6, Bun` and 1 more on NaliRealm')
        expect(titleOf(4)).toBe('fierd_6, Bun` and 2 more on NaliRealm')
    })

    it('falls back to the player id for a run without an alias', () => {
        const model = composeCompareModel({
            query: `runs=${A},${B}`,
            runs: loaded([A, run(A, 'fierd_6')], [B, run(B, 'x', { alias: null, user: '315881722375831553' })]),
        })
        expect(model.title).toBe('fierd_6 vs 315881722375831553 on NaliRealm')
    })
})
