import { canRunDesktopInstaller } from '@/app/platform'
import type { UserProfile } from '@/app/utils/api'

export const DESKTOP_PROMO_WINDOW_MS = 90 * 24 * 60 * 60 * 1000

export type DesktopPromoAccount =
  | { status: 'signed-out' }
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'loaded'; lastDesktopSeenAt?: string | null }

export interface DesktopPromoInput {
  capability: boolean
  userAgent: string
  account: DesktopPromoAccount
  storedDesktopSeen: string | null | undefined
  storedDismissedAt: string | undefined
  now: number
}

export interface DesktopPromoView {
  eligible: boolean
  ambientVisible: boolean
}

type Recency = 'recent' | 'not-recent' | 'unknown'

const withinWindow = (iso: string, now: number): boolean | undefined => {
  const at = Date.parse(iso)
  return Number.isNaN(at) ? undefined : now - at <= DESKTOP_PROMO_WINDOW_MS
}

function desktopRecency(account: DesktopPromoAccount, storedDesktopSeen: string | null | undefined, now: number): Recency {
  if (account.status === 'loading' || account.status === 'error') return 'unknown'
  if (account.status === 'loaded') {
    if (account.lastDesktopSeenAt === undefined) return 'unknown'
    if (account.lastDesktopSeenAt === null) return 'not-recent'
    const recent = withinWindow(account.lastDesktopSeenAt, now)
    if (recent === undefined) return 'unknown'
    return recent ? 'recent' : 'not-recent'
  }
  if (typeof storedDesktopSeen !== 'string') return 'not-recent'
  return withinWindow(storedDesktopSeen, now) ? 'recent' : 'not-recent'
}

export function desktopPromoView(input: DesktopPromoInput): DesktopPromoView {
  const eligible = input.capability
    && canRunDesktopInstaller(input.userAgent)
    && desktopRecency(input.account, input.storedDesktopSeen, input.now) === 'not-recent'
  const dismissed = input.storedDismissedAt !== undefined && withinWindow(input.storedDismissedAt, input.now) === true
  return { eligible, ambientVisible: eligible && !dismissed }
}

export function desktopPromoAccount(profile: UserProfile | undefined): DesktopPromoAccount {
  if (!profile?.accessToken) return { status: 'signed-out' }
  if (profile.last_desktop_seen_at === undefined) return { status: 'loaded' }
  return { status: 'loaded', lastDesktopSeenAt: profile.last_desktop_seen_at }
}
