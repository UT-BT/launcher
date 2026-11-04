import { expect, test, type Locator, type Page } from '@playwright/test'
import { runCompareFixture } from '../app/utils/fixtures/runCompareFixtures'
import { displayMapName } from '../app/utils/format'
import type { CapDetail, LeaderboardEntry } from '../app/utils/api'
import { replayVideoUrl, serveReplayVideos } from './replayVideos'

const AVATAR = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')
const BASE = runCompareFixture('capDetailCandidates')
const MAP = BASE.cap.map
const OTHER_MAP = 'CTF-BT-OtherPlace'
const FIERD = 'a1a1a1a1-0000-4000-8000-0000000000a1'
const BUN = 'b2b2b2b2-0000-4000-8000-0000000000b2'
const DECL = 'd4d4d4d4-0000-4000-8000-0000000000d4'
const SHX = 'e5e5e5e5-0000-4000-8000-0000000000e5'

function detailFor(id: string, user: string, alias: string, seconds: number, cap: Partial<CapDetail['cap']> = {}): CapDetail {
    return { ...BASE, cap: { ...BASE.cap, id, user, alias, cap_time_seconds: seconds, team: 0, active_title: null, disallowed: false, ...cap }, compare_candidates: [] }
}

const DETAILS = new Map<string, CapDetail>([
    [FIERD, detailFor(FIERD, '700000000000000001', 'fierd_6', 81.234)],
    [BUN, detailFor(BUN, '700000000000000002', 'Bun`', 82.5)],
    [DECL, detailFor(DECL, '700000000000000004', 'Decl', 83, { has_ghost: false, zone_checkpoints: 'Door;Hall' })],
    [SHX, detailFor(SHX, '700000000000000005', 'ShX', 84.25, { has_ghost: false, zone_checkpoints: '' })],
])

const VIDEO_SOURCES: Record<string, 'utrecorder' | 'democonverter'> = { [FIERD]: 'utrecorder', [BUN]: 'democonverter' }

function entryOf({ cap }: CapDetail): LeaderboardEntry {
    return {
        map: cap.map,
        user: String(cap.user),
        cap_time_seconds: cap.cap_time_seconds,
        added: cap.added ?? '',
        alias: cap.alias ?? '',
        cap_type: cap.cap_type,
        verified: true,
        id: cap.id,
        team: cap.team,
        active_title: null,
        has_ghost: cap.has_ghost,
        zone_checkpoints: cap.zone_checkpoints ?? null,
        disallowed: false,
    }
}

const EXTRA_RECORDS = Array.from({ length: 12 }, (_, i) => ({
    cap_id: `c${String(i).padStart(7, '0')}-0000-4000-8000-000000000000`,
    user_id: `70000000000000010${i}`,
    map: `CTF-BT-Extra${i + 1}`,
    added: `2026-10-${String(20 - i).padStart(2, '0')}T12:00:00Z`,
    cap_time_seconds: 60 + i,
    alias: `Holder ${i + 1}`,
    active_title: null,
    members: null,
}))

const RECORDS = [
    { cap_id: FIERD, user_id: '700000000000000001', map: MAP, added: '2026-11-01T12:00:00Z', cap_time_seconds: 81.234, alias: 'fierd_6', active_title: null, members: null },
    { cap_id: BUN, user_id: '700000000000000002', map: OTHER_MAP, added: '2026-10-30T12:00:00Z', cap_time_seconds: 50, alias: 'Bun`', active_title: null, members: null },
    ...EXTRA_RECORDS,
]

async function mockApi(page: Page) {
    await page.addInitScript(() => { localStorage.setItem('utbt:analyticsConsent:v1', 'denied') })
    await serveReplayVideos(page)
    await page.route(/https:\/\/cdn\.discordapp\.com\/.*/, route => route.fulfill({ contentType: 'image/png', body: AVATAR }))
    await page.route(/https:\/\/(api|gateway)\.utbt\.net\/.*/, async route => {
        const url = new URL(route.request().url())
        const path = url.pathname.replace(/\/$/, '')
        if (url.hostname === 'gateway.utbt.net') {
            if (/^\/users\/[^/]+\/avatar$/.test(path)) return route.fulfill({ contentType: 'image/png', body: AVATAR })
            const replay = /^\/replays\/([^/]+)$/.exec(path)
            const source = replay ? VIDEO_SOURCES[replay[1]] : undefined
            if (replay && source) return route.fulfill({ json: { source, mp4_url: replayVideoUrl(replay[1]), view_url: null, fps: 60 } })
            return route.fulfill({ json: [] })
        }
        if (path === '/v2/world_records') return route.fulfill({ json: { success: true, data: RECORDS } })
        if (path.startsWith('/maps/fuzzy/')) {
            return route.fulfill({ json: { success: true, data: [{ name: MAP, added: '', difficulty: 3, active: true, author: 'someone', required_players: 1 }] } })
        }
        if (path === `/maps/${MAP}`) return route.fulfill({ json: { success: true, data: { name: MAP, required_players: 1 } } })
        if (path === `/caps/leaderboard/map/${MAP}`) return route.fulfill({ json: { success: true, data: [...DETAILS.values()].map(entryOf) } })
        const detail = /^\/caps\/([^/]+)\/detail$/.exec(path)
        if (detail) {
            const found = DETAILS.get(detail[1])
            if (!found) return route.fulfill({ status: 404, json: { success: false, error: 'Cap not found' } })
            return route.fulfill({ json: { success: true, data: found } })
        }
        return route.fulfill({ json: { success: true, data: [] } })
    })
}

function leaderboard(page: Page): Locator {
    return page.getByRole('list', { name: 'Leaderboard' })
}

function leaderboardRow(page: Page, alias: string): Locator {
    return leaderboard(page).getByRole('listitem').filter({ hasText: alias })
}

function tray(page: Page): Locator {
    return page.getByRole('region', { name: 'Selected Runs' })
}

function filtersButton(page: Page): Locator {
    return page.getByRole('button', { name: /^Filters/ })
}

async function chooseFilter(page: Page, name: string) {
    await filtersButton(page).click()
    await page.getByRole('menuitemradio', { name, exact: true }).click()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('menu')).toHaveCount(0)
}

function helpDialog(page: Page): Locator {
    return page.locator('[data-modal-backdrop]').filter({ has: page.getByRole('heading', { name: 'How Compare Works' }) })
}

test.describe('the compare start view', () => {
    test('a bare /compare offers a map search, its help and the latest records, and a pick opens that map', async ({ page }) => {
        await mockApi(page)
        await page.goto('/compare')

        await expect(page.getByRole('heading', { level: 1, name: 'Compare Runs' })).toBeVisible()
        await expect(page.getByText('Watch runs of one map side by side', { exact: false })).toHaveCount(0)
        await expect(page.getByRole('list', { name: 'How it works' })).toHaveCount(0)
        const records = page.getByRole('list', { name: 'Latest World Records' })
        await expect(records.getByRole('button')).toHaveCount(12)
        await expect(records.getByRole('button').first()).toContainText(displayMapName(MAP))
        await page.getByRole('button', { name: 'Show More Records' }).click()
        await expect(records.getByRole('button')).toHaveCount(14)
        await expect(page.getByRole('button', { name: 'Show More Records' })).toHaveCount(0)

        await page.getByRole('button', { name: 'How it works' }).click()
        await expect(helpDialog(page)).toBeVisible()
        await expect(helpDialog(page)).toContainText('UTRecorder')
        await expect(helpDialog(page)).toContainText('DemoConverter')
        await page.keyboard.press('Escape')
        await expect(helpDialog(page)).toHaveCount(0)

        await page.getByRole('searchbox', { name: 'Search Maps' }).fill(displayMapName(MAP).slice(0, 4))
        await page.getByRole('list', { name: 'Maps' }).getByRole('button', { name: displayMapName(MAP) }).click()

        await expect(page).toHaveURL(`/compare?map=${MAP}`)
        await expect(page.getByRole('heading', { level: 1 })).toContainText(displayMapName(MAP))
        await expect(page.getByRole('heading', { name: 'Pick Runs' })).toBeVisible()

        await page.goBack()
        await expect(page).toHaveURL('/compare')
        await expect(page.getByRole('heading', { name: 'Pick a Map' })).toBeVisible()
    })

    test('runs on a map are ticked without leaving the page, Compare opens them, and Back brings the picks back', async ({ page }) => {
        await mockApi(page)
        await page.goto(`/compare?map=${MAP}`)

        const quickAdd = page.getByRole('group', { name: 'Quick Add' })
        await expect(quickAdd.getByRole('button', { name: 'World Record', exact: true })).toBeEnabled()
        await expect(quickAdd.getByRole('button', { name: 'Next Faster' })).toHaveCount(0)
        await expect(leaderboard(page).getByRole('listitem')).toHaveCount(4)
        await expect(tray(page)).toContainText('Select up to 10 runs to compare')
        await expect(tray(page).getByRole('button', { name: 'Compare' })).toBeDisabled()

        await page.getByRole('button', { name: 'Select Bun`' }).click()
        await expect(page.getByRole('button', { name: 'Select Bun`' })).toHaveAttribute('aria-pressed', 'true')
        await quickAdd.getByRole('button', { name: 'World Record', exact: true }).click()
        await expect(page.getByRole('button', { name: 'Select fierd_6' })).toHaveAttribute('aria-pressed', 'true')
        await expect(page).toHaveURL(`/compare?map=${MAP}`)
        await expect(tray(page)).toContainText('2 of 10 runs selected')
        await expect(page.getByRole('region', { name: 'Runs', exact: true })).toHaveCount(0)

        await tray(page).getByRole('button', { name: 'Compare' }).click()

        await expect(page).toHaveURL(`/compare?runs=${BUN},${FIERD}`)
        await expect(page.getByRole('heading', { name: 'Pick Runs' })).toHaveCount(0)
        await expect(page.getByRole('button', { name: 'Runs · 2' })).toBeVisible()
        await expect(page.getByRole('region', { name: 'Runs', exact: true })).toHaveCount(0)

        await page.goBack()
        await expect(page).toHaveURL(`/compare?map=${MAP}`)
        await expect(tray(page)).toContainText('2 of 10 runs selected')
        await expect(page.getByRole('button', { name: 'Select Bun`' })).toHaveAttribute('aria-pressed', 'true')
        await tray(page).getByRole('button', { name: 'Clear' }).click()
        await expect(tray(page)).toContainText('Select up to 10 runs to compare')
        await expect(page.getByRole('button', { name: 'Select Bun`' })).toHaveAttribute('aria-pressed', 'false')
    })

    test('the filters narrow the list by video source and run data, and the help says what each kind is', async ({ page }) => {
        await mockApi(page)
        await page.goto(`/compare?map=${MAP}`)
        await expect(leaderboard(page).getByRole('listitem')).toHaveCount(4)
        await expect(leaderboardRow(page, 'fierd_6').getByRole('img', { name: 'Has video' })).toBeVisible()
        await expect(leaderboardRow(page, 'Bun`')).toContainText('Older video')
        await expect(leaderboardRow(page, 'fierd_6')).not.toContainText('Older video')
        await expect(leaderboardRow(page, 'Decl')).toContainText('Checkpoints only')
        await expect(leaderboardRow(page, 'ShX')).toContainText('Final time only')
        await expect(filtersButton(page)).toHaveText('Filters')

        await chooseFilter(page, 'UTRecorder')
        await expect(leaderboard(page).getByRole('listitem')).toHaveCount(1)
        await expect(leaderboardRow(page, 'fierd_6')).toBeVisible()
        await expect(filtersButton(page)).toHaveText('Filters · 1')

        await chooseFilter(page, 'DemoConverter')
        await expect(leaderboard(page).getByRole('listitem')).toHaveCount(1)
        await expect(leaderboardRow(page, 'Bun`')).toBeVisible()

        await chooseFilter(page, 'No Video')
        await expect(leaderboard(page).getByRole('listitem')).toHaveCount(2)
        await expect(leaderboardRow(page, 'Decl')).toBeVisible()
        await expect(leaderboardRow(page, 'ShX')).toBeVisible()

        await chooseFilter(page, 'Checkpoints Only')
        await expect(leaderboard(page).getByRole('listitem')).toHaveCount(1)
        await expect(leaderboardRow(page, 'Decl')).toBeVisible()
        await expect(filtersButton(page)).toHaveText('Filters · 2')

        await filtersButton(page).click()
        await page.getByRole('menuitem', { name: 'Clear Filters' }).click()
        await expect(leaderboard(page).getByRole('listitem')).toHaveCount(4)
        await expect(filtersButton(page)).toHaveText('Filters')

        await page.getByRole('button', { name: 'About these runs' }).click()
        await expect(helpDialog(page)).toBeVisible()
        await expect(helpDialog(page)).toContainText('Checkpoints only')
        await expect(helpDialog(page)).toContainText('Legacy recording technology that may require custom syncing')
        await expect(helpDialog(page).getByRole('link', { name: 'UTRecorder' })).toHaveAttribute('href', 'https://recorder.utbt.net')
        await expect(helpDialog(page).getByRole('link', { name: 'DemoConverter' })).toHaveAttribute('href', 'https://democonverter.com')
        await helpDialog(page).getByRole('button', { name: 'Close modal' }).click()
        await expect(helpDialog(page)).toHaveCount(0)
    })

    test('a comparison you open is kept in Recent Comparisons, where it can be renamed, survives a reload, and can be removed', async ({ page }) => {
        await mockApi(page)
        await page.goto(`/compare?runs=${FIERD},${BUN}`)
        await expect(page.getByRole('button', { name: 'Runs · 2' })).toBeVisible()

        await page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: 'Compare Runs' }).click()
        await expect(page).toHaveURL('/compare')
        await expect(page.getByRole('heading', { name: 'Pick a Map' })).toBeVisible()

        const recent = page.getByRole('list', { name: 'Recent Comparisons' })
        await expect(recent.getByRole('listitem')).toHaveCount(1)
        await expect(recent).toContainText('fierd_6 vs Bun`')
        await expect(recent).toContainText(`${displayMapName(MAP)} · 2 runs`)

        await recent.getByRole('button', { name: 'Rename fierd_6 vs Bun`' }).click()
        const field = page.getByRole('textbox', { name: 'Comparison name' })
        await field.fill('Race night')
        await field.press('Enter')
        await expect(recent.getByRole('button', { name: /^Race night/ })).toBeVisible()

        await page.reload()
        await expect(recent.getByRole('button', { name: /^Race night/ })).toBeVisible()

        await recent.getByRole('button', { name: 'Rename Race night' }).click()
        await page.getByRole('textbox', { name: 'Comparison name' }).press('Escape')
        await expect(recent.getByRole('button', { name: /^Race night/ })).toBeVisible()

        await recent.getByRole('button', { name: /^Race night/ }).click()
        await expect(page).toHaveURL(`/compare?runs=${FIERD},${BUN}`)
        await page.goBack()

        await recent.getByRole('button', { name: 'Remove Race night' }).click()
        await expect(recent).toHaveCount(0)
        await expect(page.getByRole('heading', { name: 'Recent Comparisons' })).toHaveCount(0)
    })

    test('Change Map goes back to the search', async ({ page }) => {
        await mockApi(page)
        await page.goto(`/compare?map=${MAP}`)
        await page.getByRole('button', { name: 'Change Map' }).click()
        await expect(page).toHaveURL('/compare')
        await expect(page.getByRole('heading', { name: 'Pick a Map' })).toBeVisible()
    })
})
