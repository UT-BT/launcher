import { expect, test, type Locator, type Page } from '@playwright/test'
import { runCompareFixture } from '../app/utils/fixtures/runCompareFixtures'
import type { CapDetail, LeaderboardEntry, MapMetadata } from '../app/utils/api'
import { serveReplayVideos } from './replayVideos'
import { ALPHA, BRAVO, mockTeamRuns, TEAM_MAP, TEAM_POVS } from './teamRuns'

const AVATAR = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')
const BASE = runCompareFixture('capDetailCandidates')
const MAP = BASE.cap.map
const PHONE = { width: 390, height: 844 }
const NARROW_PHONE = { width: 360, height: 780 }
const TEAM_GRID = { width: 1280, height: 800 }

type Box = { x: number; y: number; width: number; height: number }

interface Run {
    id: string
    user: string
    alias: string
    seconds: number
    disallowed?: boolean
}

const DECL: Run = { id: 'd4d4d4d4-0000-4000-8000-0000000000d4', user: '700000000000000004', alias: 'Decl', seconds: 13 }
const SHX: Run = { id: 'e5e5e5e5-0000-4000-8000-0000000000e5', user: '700000000000000005', alias: 'ShX', seconds: 14.25 }
const FIERD: Run = { id: 'a1a1a1a1-0000-4000-8000-0000000000a1', user: '700000000000000001', alias: 'fierd_6', seconds: 81.234 }
const BLUEY: Run = { id: 'f6f6f6f6-0000-4000-8000-0000000000f6', user: '700000000000000008', alias: 'Bluey', seconds: 12.9, disallowed: true }

function metadata(name: string, requiredPlayers: number): MapMetadata {
    return {
        name, added: '2026-01-01T00:00:00Z', difficulty: 3, active: true, tags: '', author: 'Mapper',
        required_players: requiredPlayers, preceded_by: null, superseded_by: null,
    }
}

function entryOf(run: Run): LeaderboardEntry {
    return {
        id: run.id, map: MAP, user: run.user, alias: run.alias, cap_time_seconds: run.seconds,
        added: '2026-02-01T00:00:00Z', cap_type: 0, verified: true, team: 0, active_title: null, disallowed: run.disallowed ?? false,
    }
}

function detailOf(run: Run): CapDetail {
    return {
        ...BASE,
        cap: { ...BASE.cap, id: run.id, user: run.user, alias: run.alias, cap_time_seconds: run.seconds, team: 0, active_title: null, disallowed: false },
        checkpoints: BASE.checkpoints.map(checkpoint => ({
            ...checkpoint,
            cumulative: (checkpoint.cumulative * run.seconds) / BASE.cap.cap_time_seconds,
            segment: (checkpoint.segment * run.seconds) / BASE.cap.cap_time_seconds,
        })),
        compare_candidates: [],
    }
}

async function mockApi(page: Page, runs: readonly Run[]) {
    const maps = new Map([[MAP, metadata(MAP, 1)], [TEAM_MAP, metadata(TEAM_MAP, 2)]])
    const details = new Map(runs.map(run => [run.id, detailOf(run)]))
    await page.addInitScript(() => { localStorage.setItem('utbt:analyticsConsent:v1', 'denied') })
    await serveReplayVideos(page)
    await page.route(/https:\/\/cdn\.discordapp\.com\/.*/, route => route.fulfill({ contentType: 'image/png', body: AVATAR }))
    await page.route(/https:\/\/(api|gateway)\.utbt\.net\/.*/, route => {
        const url = new URL(route.request().url())
        const path = decodeURIComponent(url.pathname).replace(/\/$/, '')
        if (url.hostname === 'gateway.utbt.net') {
            if (/^\/users\/[^/]+\/avatar$/.test(path)) return route.fulfill({ contentType: 'image/png', body: AVATAR })
            return route.fulfill({ json: [] })
        }
        const map = /^\/maps\/([^/]+)$/.exec(path)
        if (map && maps.has(map[1])) return route.fulfill({ json: { success: true, data: maps.get(map[1]) } })
        if (path === `/caps/leaderboard/map/${MAP}`) return route.fulfill({ json: { success: true, data: runs.map(entryOf) } })
        const detail = /^\/caps\/([^/]+)\/detail$/.exec(path)
        if (detail) {
            const found = details.get(detail[1])
            if (!found) return route.fulfill({ status: 404, json: { success: false, error: 'Cap not found' } })
            return route.fulfill({ json: { success: true, data: found } })
        }
        return route.fulfill({ json: { success: true, data: path.endsWith('/count') ? { count: 0 } : [] } })
    })
}

function tick(page: Page, label: string): Locator {
    return page.getByRole('main').getByRole('checkbox', { name: new RegExp(`^Compare ${label}, `) })
}

function compareButton(page: Page): Locator {
    return page.getByRole('button', { name: /^Compare \(\d+\)$/ })
}

function overlaps(a: Box, b: Box): boolean {
    return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}

function lanes(page: Page): Locator {
    return page.getByRole('list', { name: 'Gap to the baseline' }).getByRole('listitem')
}

test.describe('map leaderboard selection', () => {
    test('two ticked solo runs open the compare page in leaderboard order, and Back keeps them ticked', async ({ page }) => {
        await mockApi(page, [FIERD, SHX, DECL, BLUEY])
        await page.goto(`/maps/${MAP}`)

        await expect(tick(page, 'fierd_6')).toBeVisible({ timeout: 15_000 })
        await expect(compareButton(page)).toHaveCount(0)
        await tick(page, 'fierd_6').click()
        await expect(compareButton(page)).toHaveText('Compare (1)')
        await tick(page, 'Decl').click()
        await expect(compareButton(page)).toHaveText('Compare (2)')
        const lengthBefore = await page.evaluate(() => window.history.length)

        await compareButton(page).click()

        await expect(lanes(page)).toHaveCount(2, { timeout: 15_000 })
        await expect(lanes(page).filter({ hasText: 'Decl' })).toHaveCount(1)
        await expect(lanes(page).filter({ hasText: 'fierd_6' })).toHaveCount(1)
        expect(new URL(page.url()).pathname).toBe('/compare')
        expect(new URL(page.url()).search).toBe(`?runs=${DECL.id},${FIERD.id}`)
        expect(await page.evaluate(() => window.history.length)).toBe(lengthBefore + 1)

        await page.goBack()

        await expect.poll(() => new URL(page.url()).pathname).toBe(`/maps/${MAP}`)
        await expect(tick(page, 'fierd_6')).toBeChecked()
        await expect(tick(page, 'Decl')).toBeChecked()
        await expect(tick(page, 'ShX')).not.toBeChecked()
        await expect(compareButton(page)).toHaveText('Compare (2)')
    })

    test('Compare Runs in the map header opens the compare start view with this map picked', async ({ page }) => {
        await mockApi(page, [FIERD, SHX, DECL, BLUEY])
        await page.goto(`/maps/${MAP}`)

        const link = page.getByRole('main').getByRole('link', { name: 'Compare Runs' })
        await expect(link).toBeVisible({ timeout: 15_000 })
        await link.click()

        await expect.poll(() => new URL(page.url()).pathname).toBe('/compare')
        expect(new URLSearchParams(new URL(page.url()).search).get('map')).toBe(MAP)
        await expect(page.getByRole('heading', { name: 'Pick Runs' })).toBeVisible()

        await page.goBack()
        await expect.poll(() => new URL(page.url()).pathname).toBe(`/maps/${MAP}`)
    })

    test('a disallowed run can not be ticked, and unticking the last run hides the button', async ({ page }) => {
        await mockApi(page, [FIERD, SHX, DECL, BLUEY])
        await page.goto(`/maps/${MAP}`)

        await expect(tick(page, 'Bluey')).toBeDisabled()
        await tick(page, 'ShX').click()
        await expect(compareButton(page)).toHaveText('Compare (1)')
        await tick(page, 'ShX').click()
        await expect(compareButton(page)).toHaveCount(0)
    })

    test('past ten runs the other boxes disable and a note says why, clear of the pagination', async ({ page, isMobile }) => {
        if (isMobile) await page.setViewportSize(NARROW_PHONE)
        const runs = Array.from({ length: 11 }, (_, index): Run => ({
            id: `c0c0c0${String(index).padStart(2, '0')}-0000-4000-8000-0000000000c0`,
            user: `7000000000000001${String(index).padStart(2, '0')}`,
            alias: `Runner ${index + 1}`,
            seconds: 20 + index,
        }))
        await mockApi(page, runs)
        await page.goto(`/maps/${MAP}`)
        await page.getByRole('button', { name: 'All', exact: true }).click()

        for (const run of runs.slice(0, 9)) await tick(page, `${run.alias}`).click()
        await expect(page.getByRole('status').filter({ hasText: 'at most' })).toHaveCount(0)
        await expect(tick(page, 'Runner 10')).toBeEnabled()
        await tick(page, 'Runner 10').click()

        await expect(compareButton(page)).toHaveText('Compare (10)')
        const note = page.getByRole('status').filter({ hasText: 'at most' })
        await expect(note).toHaveText('A comparison holds at most 10 runs. Untick one to choose another.')
        await page.getByRole('main').evaluate(main => main.scrollTo(0, main.scrollHeight))
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
        await page.waitForTimeout(300)
        const floating = [await note.boundingBox(), await compareButton(page).boundingBox()]
        const pager = [
            await page.getByRole('button', { name: '‹ Prev' }).last().boundingBox(),
            await page.getByRole('button', { name: 'Next ›' }).last().boundingBox(),
        ]
        for (const a of floating) for (const b of pager) expect(overlaps(a!, b!)).toBe(false)
        await page.getByRole('button', { name: 'Next ›' }).first().click()
        await expect(tick(page, 'Runner 11')).toBeDisabled()
        await page.getByRole('button', { name: '‹ Prev' }).first().click()
        await expect(tick(page, 'Runner 1')).toBeEnabled()
    })

    test('two team runs open as two rows', async ({ page }) => {
        await page.setViewportSize(TEAM_GRID)
        await mockApi(page, [])
        await mockTeamRuns(page, [ALPHA, BRAVO], { videos: TEAM_POVS })
        await page.goto(`/maps/${TEAM_MAP}`)

        await tick(page, 'Bravo One & Bravo Two').click()
        await tick(page, 'Alpha One & Alpha Two').click()
        await compareButton(page).click()

        await expect(page.getByRole('region', { name: 'Stage' }).locator('.run-compare-team-header')).toHaveCount(2)
        await expect(page).toHaveTitle(/^Alpha One & Alpha Two vs Bravo One & Bravo Two on /)
        expect(new URL(page.url()).search).toBe(`?runs=${ALPHA.teamCapId},${BRAVO.teamCapId}`)
    })
})

test.describe('map leaderboard selection on a phone', () => {
    test.use({ viewport: PHONE })

    test('the cards carry the checkbox, and the button sits above the tab bar, clear of the pagination', async ({ page, isMobile }) => {
        test.skip(!isMobile, 'touch cards and the tab bar are phone layouts')
        await mockApi(page, [FIERD, SHX, DECL, BLUEY])
        await page.goto(`/maps/${MAP}`)

        const cards = page.getByRole('main').getByRole('list', { name: 'Map leaderboard' })
        await expect(cards).toBeVisible()
        await expect(page.getByRole('main').getByRole('table')).toHaveCount(0)
        const card = cards.getByRole('listitem').filter({ hasText: 'fierd_6' })
        await expect(card.getByRole('checkbox')).toHaveCount(1)
        const target = await card.locator('label:has(input[type="checkbox"])').boundingBox()
        expect(target!.width).toBeGreaterThanOrEqual(44)
        expect(target!.height).toBeGreaterThanOrEqual(44)

        await card.getByRole('checkbox').tap()
        await expect(card.getByRole('checkbox')).toBeChecked()
        expect(new URL(page.url()).pathname).toBe(`/maps/${MAP}`)

        const button = compareButton(page)
        await expect(button).toHaveText('Compare (1)')
        await page.getByRole('main').evaluate(main => main.scrollTo(0, main.scrollHeight))
        await page.waitForTimeout(300)
        const [box, bar, pager] = [
            await button.boundingBox(),
            await page.getByRole('navigation', { name: 'Tab bar' }).boundingBox(),
            await page.getByLabel('Rows per page').boundingBox(),
        ]
        expect(box!.height).toBeGreaterThanOrEqual(44)
        expect(box!.y + box!.height).toBeLessThanOrEqual(bar!.y)
        expect(pager!.y + pager!.height <= box!.y || pager!.y >= box!.y + box!.height || pager!.x + pager!.width <= box!.x).toBe(true)

        await button.tap()

        await expect(page.getByRole('region', { name: 'Runs' })).toBeVisible()
        expect(new URL(page.url()).search).toBe(`?runs=${FIERD.id}`)
    })
})
