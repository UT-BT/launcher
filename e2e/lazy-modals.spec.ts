import { expect, test, type BrowserContext } from '@playwright/test'
import type { LeaderboardEntry, MapMetadata, WorldRecordProgressionEntry } from '../app/utils/api'
import { CAP_TYPE_UTBT_CERTIFIED } from '../app/utils/capTypes'

const MAP_NAME = 'CTF-BT-Lazy'
const DISTRIBUTION_MODULE = /\/CapTimeDistributionModal(\.tsx|-[\w-]+\.js)(\?|$)/
const PROGRESSION_MODULE = /\/WorldRecordProgressionModal(\.tsx|-[\w-]+\.js)(\?|$)/

const MAP: MapMetadata = {
    name: MAP_NAME,
    added: '2026-01-01T00:00:00Z',
    difficulty: 3,
    active: true,
    tags: '',
    author: 'Mapper',
    required_players: 1,
    preceded_by: null,
    superseded_by: null,
}

const LEADERBOARD: LeaderboardEntry[] = [41.2, 44.8, 52.5].map((time, index) => ({
    map: MAP_NAME,
    user: `user-${index}`,
    cap_time_seconds: time,
    added: '2026-02-01T00:00:00Z',
    alias: `Runner ${index + 1}`,
    cap_type: CAP_TYPE_UTBT_CERTIFIED,
    verified: true,
    id: `cap-${index}`,
}))

const PROGRESSION: WorldRecordProgressionEntry[] = [...LEADERBOARD].reverse().map(entry => ({
    cap_id: entry.id,
    user_id: entry.user,
    alias: entry.alias,
    cap_time_seconds: entry.cap_time_seconds,
    added: entry.added,
    active_title: null,
}))

async function serveApi(context: BrowserContext) {
    await context.route(/https:\/\/(api|gateway)\.utbt\.net\/.*/, async route => {
        const url = new URL(route.request().url())
        if (url.hostname === 'gateway.utbt.net') {
            await route.fulfill({ json: [] })
            return
        }
        const path = decodeURIComponent(url.pathname).replace(/\/$/, '')
        let data: unknown
        if (path === `/maps/${MAP_NAME}`) data = MAP
        else if (path === `/caps/leaderboard/map/${MAP_NAME}`) data = LEADERBOARD
        else if (path === `/v2/world_records/progression/${MAP_NAME}`) data = PROGRESSION
        else data = path.endsWith('/count') ? { count: 0 } : []
        await route.fulfill({ json: { success: true, data } })
    })
}

test.beforeEach(async ({ page, context }) => {
    page.on('pageerror', error => console.error('BROWSER PAGE ERROR:', error.message))
    await context.addInitScript(() => localStorage.setItem('utbt:analyticsConsent:v1', 'denied'))
    await serveApi(context)
})

test('a modal fetches its code on the first tap, shows a loading state, then opens', async ({ page }) => {
    const fetched: string[] = []
    page.on('request', request => {
        if (DISTRIBUTION_MODULE.test(request.url())) fetched.push(request.url())
    })
    let release = () => {}
    const held = new Promise<void>(resolve => { release = resolve })
    await page.route(DISTRIBUTION_MODULE, async route => {
        await held
        await route.continue()
    })

    await page.goto(`/maps/${MAP_NAME}`)
    const median = page.getByRole('button', { name: /Median Certified Time/ })
    await expect(median).toBeVisible()
    expect(fetched).toEqual([])

    await median.click()
    const loading = page.getByRole('status', { name: 'Loading' })
    await expect(loading).toBeVisible()
    expect(fetched).toHaveLength(1)

    release()
    const heading = page.getByRole('heading', { name: 'Certified Cap Distribution — Lazy' })
    await expect(heading).toBeVisible()
    await expect(loading).toHaveCount(0)

    await page.keyboard.press('Escape')
    await expect(heading).toHaveCount(0)
    await median.click()
    await expect(heading).toBeVisible()
    expect(fetched).toHaveLength(1)
})

test('a modal that was already lazy waits for its first open too', async ({ page }) => {
    const fetched: string[] = []
    page.on('request', request => {
        if (PROGRESSION_MODULE.test(request.url())) fetched.push(request.url())
    })

    await page.goto(`/maps/${MAP_NAME}`)
    const trigger = page.getByRole('button', { name: 'View world record history' })
    await expect(trigger).toBeVisible()
    expect(fetched).toEqual([])

    await trigger.click()
    await expect(page.getByRole('heading', { name: 'World Record Progression — Lazy' })).toBeVisible()
    expect(fetched).toHaveLength(1)
})
