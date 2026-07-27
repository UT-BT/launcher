import { describe, expect, it, vi } from 'vitest'
import { loadPresets } from './filterPresets'

const { getSyncedMock } = vi.hoisted(() => ({ getSyncedMock: vi.fn() }))

vi.mock('@/app/utils/userState', () => ({
    getSynced: getSyncedMock,
    setSynced: vi.fn(),
    subscribeSynced: vi.fn(() => () => {}),
}))

const VALID = { id: 'a', name: 'Preset A', filters: { tiers: ['easy'] } }

describe('loadPresets', () => {
    it('returns [] when the synced value is not an array', () => {
        getSyncedMock.mockReturnValue({ not: 'an array' })
        expect(loadPresets('key')).toEqual([])
    })

    it('skips entries with a malformed base shape and keeps siblings', () => {
        getSyncedMock.mockReturnValue([
            null,
            'junk',
            { id: 1, name: 'bad id', filters: {} },
            { id: 'x', name: 2, filters: {} },
            { id: 'y', name: 'no filters' },
            { id: 'z', name: 'filters not object', filters: 'nope' },
            VALID,
        ])
        expect(loadPresets('key')).toEqual([VALID])
    })

    it('skips presets rejected by validate while siblings survive', () => {
        const other = { id: 'b', name: 'Preset B', filters: { tiers: ['unknown-tier'] } }
        getSyncedMock.mockReturnValue([VALID, other])
        const validate = (filters: unknown) =>
            Array.isArray((filters as { tiers?: unknown }).tiers) &&
            ((filters as { tiers: unknown[] }).tiers).every(t => t === 'easy')
        expect(loadPresets('key', undefined, validate)).toEqual([VALID])
    })

    it('applies migrate before validate', () => {
        getSyncedMock.mockReturnValue([{ id: 'c', name: 'Old', filters: { legacy: true } }])
        const migrate = () => ({ tiers: ['easy'] })
        const validate = (filters: unknown) => Array.isArray((filters as { tiers?: unknown }).tiers)
        const result = loadPresets('key', migrate, validate)
        expect(result).toHaveLength(1)
        expect(result[0].filters).toEqual({ tiers: ['easy'] })
    })

    it('survives a validate or migrate that throws', () => {
        getSyncedMock.mockReturnValue([VALID, { id: 'd', name: 'Boom', filters: {} }])
        const validate = (filters: unknown) => {
            if ((filters as { tiers?: unknown }).tiers === undefined) throw new Error('boom')
            return true
        }
        expect(loadPresets('key', undefined, validate)).toEqual([VALID])
    })
})
