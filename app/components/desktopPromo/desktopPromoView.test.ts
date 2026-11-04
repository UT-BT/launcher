import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { desktopPromoAccount, desktopPromoView, type DesktopPromoAccount, type DesktopPromoInput } from './desktopPromoView'

const NOW = '2026-11-03T12:00:00.000Z'
const WINDOWS_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
const MAC_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'

const daysAgo = (days: number) => new Date(Date.parse(NOW) - days * 24 * 60 * 60 * 1000).toISOString()

const input = (overrides: Partial<DesktopPromoInput> = {}): DesktopPromoInput => ({
  capability: true,
  userAgent: WINDOWS_UA,
  account: { status: 'signed-out' },
  storedDesktopSeen: undefined,
  storedDismissedAt: undefined,
  now: Date.now(),
  ...overrides,
})

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(NOW))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('desktopPromoView account states', () => {
  const cases: { name: string; account: DesktopPromoAccount; eligible: boolean }[] = [
    { name: 'signed out', account: { status: 'signed-out' }, eligible: true },
    { name: 'loading', account: { status: 'loading' }, eligible: false },
    { name: 'error', account: { status: 'error' }, eligible: false },
    { name: 'field absent', account: { status: 'loaded' }, eligible: false },
    { name: 'never used the desktop app', account: { status: 'loaded', lastDesktopSeenAt: null }, eligible: true },
    { name: 'used it 89 days ago', account: { status: 'loaded', lastDesktopSeenAt: daysAgo(89) }, eligible: false },
    { name: 'used it 91 days ago', account: { status: 'loaded', lastDesktopSeenAt: daysAgo(91) }, eligible: true },
    { name: 'used it today', account: { status: 'loaded', lastDesktopSeenAt: '2026-11-03T11:59:00+00:00' }, eligible: false },
    { name: 'an unreadable timestamp', account: { status: 'loaded', lastDesktopSeenAt: 'not a date' }, eligible: false },
  ]

  it.each(cases)('$name: eligible $eligible', ({ account, eligible }) => {
    expect(desktopPromoView(input({ account }))).toEqual({ eligible, ambientVisible: eligible })
  })

  it('ignores the stored desktop-seen value once signed in', () => {
    expect(desktopPromoView(input({
      account: { status: 'loaded', lastDesktopSeenAt: null },
      storedDesktopSeen: daysAgo(1),
    })).eligible).toBe(true)
    expect(desktopPromoView(input({
      account: { status: 'loaded', lastDesktopSeenAt: daysAgo(1) },
      storedDesktopSeen: null,
    })).eligible).toBe(false)
  })
})

describe('desktopPromoView stored desktop-seen when signed out', () => {
  const cases: { name: string; storedDesktopSeen: string | null | undefined; eligible: boolean }[] = [
    { name: 'nothing stored', storedDesktopSeen: undefined, eligible: true },
    { name: 'a stored never-used', storedDesktopSeen: null, eligible: true },
    { name: 'fresh', storedDesktopSeen: daysAgo(89), eligible: false },
    { name: 'stale', storedDesktopSeen: daysAgo(91), eligible: true },
  ]

  it.each(cases)('$name: eligible $eligible', ({ storedDesktopSeen, eligible }) => {
    expect(desktopPromoView(input({ storedDesktopSeen })).eligible).toBe(eligible)
  })
})

describe('desktopPromoView stored dismissal', () => {
  const cases: { name: string; storedDismissedAt: string | undefined; ambientVisible: boolean }[] = [
    { name: 'none', storedDismissedAt: undefined, ambientVisible: true },
    { name: 'fresh', storedDismissedAt: daysAgo(89), ambientVisible: false },
    { name: 'stale', storedDismissedAt: daysAgo(91), ambientVisible: true },
  ]

  it.each(cases)('$name: ambientVisible $ambientVisible and still eligible', ({ storedDismissedAt, ambientVisible }) => {
    expect(desktopPromoView(input({ storedDismissedAt }))).toEqual({ eligible: true, ambientVisible })
  })

  it('keeps ambient surfaces hidden when the visitor is not eligible, dismissed or not', () => {
    expect(desktopPromoView(input({ account: { status: 'loading' } }))).toEqual({ eligible: false, ambientVisible: false })
    expect(desktopPromoView(input({ capability: false, storedDismissedAt: daysAgo(91) }))).toEqual({ eligible: false, ambientVisible: false })
  })
})

describe('desktopPromoView capability and user agent', () => {
  it('is never eligible with the capability off', () => {
    expect(desktopPromoView(input({ capability: false }))).toEqual({ eligible: false, ambientVisible: false })
    expect(desktopPromoView(input({ capability: false, account: { status: 'loaded', lastDesktopSeenAt: null } }))).toEqual({ eligible: false, ambientVisible: false })
  })

  it.each([
    { name: 'macOS', userAgent: MAC_UA },
    { name: 'Android', userAgent: ANDROID_UA },
    { name: 'an empty user agent', userAgent: '' },
  ])('is never eligible on $name', ({ userAgent }) => {
    expect(desktopPromoView(input({ userAgent }))).toEqual({ eligible: false, ambientVisible: false })
    expect(desktopPromoView(input({ userAgent, account: { status: 'loaded', lastDesktopSeenAt: null } }))).toEqual({ eligible: false, ambientVisible: false })
  })
})

describe('desktopPromoAccount', () => {
  const auth = { discordId: '1', username: 'u', avatar: '', accessToken: 'token', refreshToken: 'r', expiresAt: 0 }

  it('maps no profile to signed out', () => {
    expect(desktopPromoAccount(undefined)).toEqual({ status: 'signed-out' })
  })

  it('maps a profile without an access token to signed out', () => {
    expect(desktopPromoAccount({ ...auth, accessToken: '' })).toEqual({ status: 'signed-out' })
  })

  it('maps a signed-in profile without the field to field absent', () => {
    expect(desktopPromoAccount(auth)).toEqual({ status: 'loaded' })
  })

  it('carries the field when the profile has it', () => {
    expect(desktopPromoAccount({ ...auth, last_desktop_seen_at: null })).toEqual({ status: 'loaded', lastDesktopSeenAt: null })
    expect(desktopPromoAccount({ ...auth, last_desktop_seen_at: '2026-11-03T14:05:00+00:00' }))
      .toEqual({ status: 'loaded', lastDesktopSeenAt: '2026-11-03T14:05:00+00:00' })
  })
})
