import type { Page, Request } from '@playwright/test'
import { DESKTOP_APP_DOWNLOAD_URL } from '../app/constants/desktopApp'
import {
    DESKTOP_PROMO_DISMISSED_STORAGE_KEY,
    DESKTOP_SEEN_STORAGE_KEY,
} from '../app/components/desktopPromo/desktopPromoStorage'
import type { UserProfile } from '../app/utils/api'

export { DESKTOP_APP_DOWNLOAD_URL, DESKTOP_PROMO_DISMISSED_STORAGE_KEY, DESKTOP_SEEN_STORAGE_KEY }

export const WINDOWS_11_USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
export const MACOS_USER_AGENT =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const DAY_MS = 24 * 60 * 60 * 1000
export const RECENT_DAYS = 1
export const STALE_DAYS = 91
const SEED_AGE_DAYS = { recent: RECENT_DAYS, fresh: RECENT_DAYS, stale: STALE_DAYS }

export function daysAgo(days: number): string {
    return new Date(Date.now() - days * DAY_MS).toISOString()
}

const apiPath = (url: string) => new URL(url).pathname.replace(/\/$/, '')

export type UsersMeVariant = 'absent' | 'null' | 'recent' | 'stale'
export type DesktopSeenSeed = 'cleared' | 'null' | 'fresh' | 'stale'
export type DismissalSeed = 'cleared' | 'fresh' | 'stale'

export interface DesktopPromoSeed {
    consent?: 'granted' | 'denied'
    signedIn?: boolean
    desktopSeen?: DesktopSeenSeed
    dismissed?: DismissalSeed
}

type UsersMeData = Pick<UserProfile, 'id' | 'alias' | 'utbt_role' | 'last_desktop_seen_at'>

export function usersMeData(variant: UsersMeVariant): UsersMeData {
    const profile: UsersMeData = { id: '100', alias: 'Tester', utbt_role: 0 }
    if (variant === 'absent') return profile
    if (variant === 'null') return { ...profile, last_desktop_seen_at: null }
    return { ...profile, last_desktop_seen_at: daysAgo(SEED_AGE_DAYS[variant]) }
}

const SEEDED_FLAG = 'e2e:desktopPromoSeeded'

export async function seedDesktopPromo(page: Page, seed: DesktopPromoSeed = {}) {
    const desktopSeen = seed.desktopSeen ?? 'cleared'
    const dismissed = seed.dismissed ?? 'cleared'
    await page.addInitScript(
        (values) => {
            if (sessionStorage.getItem(values.flag)) return
            sessionStorage.setItem(values.flag, '1')
            localStorage.setItem('utbt:analyticsConsent:v1', values.consent)
            if (values.signedIn) {
                localStorage.setItem(
                    'utbt:webAuth:v1',
                    JSON.stringify({
                        discordId: '100',
                        username: 'tester',
                        avatar: '',
                        accessToken: 'token',
                        refreshToken: 'refresh-token',
                        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
                    })
                )
            }
            if (values.desktopSeen === undefined) localStorage.removeItem(values.desktopSeenKey)
            else localStorage.setItem(values.desktopSeenKey, JSON.stringify(values.desktopSeen))
            if (values.dismissedAt === undefined) localStorage.removeItem(values.dismissedKey)
            else localStorage.setItem(values.dismissedKey, JSON.stringify(values.dismissedAt))
        },
        {
            flag: SEEDED_FLAG,
            consent: seed.consent ?? 'denied',
            signedIn: seed.signedIn ?? false,
            desktopSeenKey: DESKTOP_SEEN_STORAGE_KEY,
            dismissedKey: DESKTOP_PROMO_DISMISSED_STORAGE_KEY,
            desktopSeen:
                desktopSeen === 'cleared'
                    ? undefined
                    : desktopSeen === 'null'
                      ? null
                      : daysAgo(SEED_AGE_DAYS[desktopSeen]),
            dismissedAt: dismissed === 'cleared' ? undefined : daysAgo(SEED_AGE_DAYS[dismissed]),
        }
    )
}

const USERS_ME_AND_LATEST_ACTIVITY_ROUTE = /https:\/\/api\.utbt\.net\/(users\/me|launcher\/activity\/latest)\/?(\?.*)?$/

export async function routeUsersMe(page: Page, variant: UsersMeVariant, beforeResponse?: Promise<void>) {
    const data = usersMeData(variant)
    await page.route(USERS_ME_AND_LATEST_ACTIVITY_ROUTE, async (route) => {
        if (apiPath(route.request().url()) !== '/users/me') {
            await route.fulfill({ status: 404, json: { success: false } })
            return
        }
        if (beforeResponse) await beforeResponse
        await route.fulfill({ json: { success: true, data } })
    })
    return data
}

export async function routeDelayedUsersMe(page: Page, variant: UsersMeVariant) {
    let release = () => {}
    const released = new Promise<void>((resolve) => {
        release = resolve
    })
    let markRequested = () => {}
    const requested = new Promise<void>((resolve) => {
        markRequested = resolve
    })
    page.on('request', (request) => {
        if (apiPath(request.url()) === '/users/me') markRequested()
    })
    const data = await routeUsersMe(page, variant, released)
    return { data, requested, release }
}

export async function routeDesktopAppDownload(page: Page) {
    const requests: string[] = []
    await page.context().route(DESKTOP_APP_DOWNLOAD_URL, async (route) => {
        requests.push(route.request().url())
        await route.fulfill({
            status: 200,
            headers: {
                'content-type': 'application/octet-stream',
                'content-disposition': 'attachment; filename="utbt-launcher-setup.exe"',
            },
            body: 'MZ',
        })
    })
    return requests
}

type TelemetryPayload = { outcomes?: Record<string, number> }

const isSessionFlush = (request: Request) =>
    request.method() === 'POST' && apiPath(request.url()) === '/launcher/activity/session'

export function recordTelemetryFlushes(page: Page) {
    const payloads: TelemetryPayload[] = []
    page.on('request', (request) => {
        if (isSessionFlush(request)) payloads.push((request.postDataJSON() ?? {}) as TelemetryPayload)
    })
    return {
        async flushedOutcomes(): Promise<Record<string, number>> {
            await page.evaluate(() => window.dispatchEvent(new Event('pagehide')))
            return payloads.at(-1)?.outcomes ?? {}
        },
    }
}
