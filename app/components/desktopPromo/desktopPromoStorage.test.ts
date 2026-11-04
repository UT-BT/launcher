import { describe, expect, it } from 'vitest'
import {
  DESKTOP_PROMO_DISMISSED_STORAGE_KEY,
  DESKTOP_SEEN_STORAGE_KEY,
  readStoredDesktopSeen,
  readStoredDismissedAt,
  writeStoredDesktopSeen,
  writeStoredDismissedAt,
} from './desktopPromoStorage'

const memoryStorage = (initial: Record<string, string> = {}) => {
  const values = new Map(Object.entries(initial))
  return {
    values,
    get: () => ({
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value) },
    }),
  }
}

const throwingMethods = () => ({
  getItem: () => { throw new Error('blocked') },
  setItem: () => { throw new Error('quota') },
})

const throwingGetter = () => { throw new Error('SecurityError') }

describe('desktop-seen storage', () => {
  it('uses the versioned key', () => {
    expect(DESKTOP_SEEN_STORAGE_KEY).toBe('utbt:desktopSeen:v1')
  })

  it('reads nothing stored as undefined', () => {
    expect(readStoredDesktopSeen(memoryStorage().get)).toBeUndefined()
  })

  it('round-trips a timestamp and a never-used null as JSON', () => {
    const storage = memoryStorage()
    writeStoredDesktopSeen('2026-11-03T14:05:00+00:00', storage.get)
    expect(storage.values.get(DESKTOP_SEEN_STORAGE_KEY)).toBe('"2026-11-03T14:05:00+00:00"')
    expect(readStoredDesktopSeen(storage.get)).toBe('2026-11-03T14:05:00+00:00')
    writeStoredDesktopSeen(null, storage.get)
    expect(storage.values.get(DESKTOP_SEEN_STORAGE_KEY)).toBe('null')
    expect(readStoredDesktopSeen(storage.get)).toBeNull()
  })

  it('reads corrupt or wrongly shaped values as nothing stored', () => {
    expect(readStoredDesktopSeen(memoryStorage({ [DESKTOP_SEEN_STORAGE_KEY]: '{oops' }).get)).toBeUndefined()
    expect(readStoredDesktopSeen(memoryStorage({ [DESKTOP_SEEN_STORAGE_KEY]: '42' }).get)).toBeUndefined()
  })

  it('reads and writes through failing storage without throwing', () => {
    expect(readStoredDesktopSeen(throwingMethods)).toBeUndefined()
    expect(readStoredDesktopSeen(throwingGetter)).toBeUndefined()
    expect(() => writeStoredDesktopSeen(null, throwingMethods)).not.toThrow()
    expect(() => writeStoredDesktopSeen(null, throwingGetter)).not.toThrow()
  })
})

describe('dismissal storage', () => {
  it('uses the versioned key', () => {
    expect(DESKTOP_PROMO_DISMISSED_STORAGE_KEY).toBe('utbt:desktopPromoDismissed:v1')
  })

  it('round-trips the dismissal time as JSON', () => {
    const storage = memoryStorage()
    expect(readStoredDismissedAt(storage.get)).toBeUndefined()
    writeStoredDismissedAt('2026-11-03T12:00:00.000Z', storage.get)
    expect(storage.values.get(DESKTOP_PROMO_DISMISSED_STORAGE_KEY)).toBe('"2026-11-03T12:00:00.000Z"')
    expect(readStoredDismissedAt(storage.get)).toBe('2026-11-03T12:00:00.000Z')
  })

  it('reads corrupt, null or wrongly shaped values as no dismissal', () => {
    expect(readStoredDismissedAt(memoryStorage({ [DESKTOP_PROMO_DISMISSED_STORAGE_KEY]: '{oops' }).get)).toBeUndefined()
    expect(readStoredDismissedAt(memoryStorage({ [DESKTOP_PROMO_DISMISSED_STORAGE_KEY]: 'null' }).get)).toBeUndefined()
    expect(readStoredDismissedAt(memoryStorage({ [DESKTOP_PROMO_DISMISSED_STORAGE_KEY]: 'true' }).get)).toBeUndefined()
  })

  it('reads and writes through failing storage without throwing', () => {
    expect(readStoredDismissedAt(throwingMethods)).toBeUndefined()
    expect(readStoredDismissedAt(throwingGetter)).toBeUndefined()
    expect(() => writeStoredDismissedAt('2026-11-03T12:00:00.000Z', throwingMethods)).not.toThrow()
    expect(() => writeStoredDismissedAt('2026-11-03T12:00:00.000Z', throwingGetter)).not.toThrow()
  })
})
