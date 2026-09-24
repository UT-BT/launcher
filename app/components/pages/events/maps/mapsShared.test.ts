import { describe, expect, it } from 'vitest'
import { stagesWithPools, tagBadgeVariant } from './mapsShared'
import type { PickBanConfig, PickBanStageConfig } from '@/app/utils/api'

function stage(key: string, pool: PickBanStageConfig['pool']): PickBanStageConfig {
    return {
        key,
        name: key,
        best_of: 3,
        pick_ban: null,
        counts: null,
        sequence_mismatch: false,
        pool,
        pool_status: null,
    }
}

describe('stagesWithPools', () => {
    it('returns an empty array for a null config', () => {
        expect(stagesWithPools(null)).toEqual([])
    })

    it('returns an empty array when no stage has a pool', () => {
        const config: PickBanConfig = { stages: [stage('groups', []), stage('finals', [])] }
        expect(stagesWithPools(config)).toEqual([])
    })

    it('drops only the empty stages, keeping spec order', () => {
        const withPool = stage('finals', [{ map: 'CTF-BT-Foo', tags: [], screenshot_version: null }])
        const config: PickBanConfig = { stages: [stage('groups', []), withPool] }
        expect(stagesWithPools(config)).toEqual([withPool])
    })

    it('keeps every stage that has a pool, in the same order the API sent them', () => {
        const groups = stage('groups', [{ map: 'CTF-BT-Foo', tags: [], screenshot_version: null }])
        const finals = stage('finals', [{ map: 'CTF-BT-Bar', tags: [], screenshot_version: null }])
        const config: PickBanConfig = { stages: [groups, finals] }
        expect(stagesWithPools(config)).toEqual([groups, finals])
    })
})

describe('tagBadgeVariant', () => {
    it('flags a Hard tag as the warning variant, case-insensitively', () => {
        expect(tagBadgeVariant('Hard')).toBe('warning')
        expect(tagBadgeVariant('hard')).toBe('warning')
        expect(tagBadgeVariant('HARD')).toBe('warning')
    })

    it('treats every other tag as the default variant', () => {
        expect(tagBadgeVariant('Easy')).toBe('default')
        expect(tagBadgeVariant('Fun')).toBe('default')
        expect(tagBadgeVariant('Hardcore')).toBe('default')
    })
})
