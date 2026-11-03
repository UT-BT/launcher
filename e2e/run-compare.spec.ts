import { expect, test, type Page } from '@playwright/test'
import { runCompareFixture } from '../app/utils/fixtures/runCompareFixtures'
import { displayMapName } from '../app/utils/format'
import type { CapDetail } from '../app/utils/api'

const AVATAR = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')
const BASE = runCompareFixture('capDetailCandidates')
const MAP = BASE.cap.map
const FIERD = 'a1a1a1a1-0000-4000-8000-0000000000a1'
const BUN = 'b2b2b2b2-0000-4000-8000-0000000000b2'

function detailFor(id: string, user: string, alias: string, seconds: number, team: number): CapDetail {
    return {
        ...BASE,
        cap: { ...BASE.cap, id, user, alias, cap_time_seconds: seconds, team, active_title: null, disallowed: false },
        compare_candidates: [],
    }
}

const DETAILS = new Map<string, CapDetail>([
    [FIERD, detailFor(FIERD, '700000000000000001', 'fierd_6', 81.234, 0)],
    [BUN, detailFor(BUN, '700000000000000002', 'Bun`', 79.5, 1)],
])

async function mockApi(page: Page, gate: Promise<void> = Promise.resolve()) {
    await page.addInitScript(() => { localStorage.setItem('utbt:analyticsConsent:v1', 'denied') })
    await page.route(/https:\/\/cdn\.discordapp\.com\/.*/, route => route.fulfill({ contentType: 'image/png', body: AVATAR }))
    await page.route(/https:\/\/(api|gateway)\.utbt\.net\/.*/, async route => {
        const url = new URL(route.request().url())
        const path = url.pathname.replace(/\/$/, '')
        if (url.hostname === 'gateway.utbt.net') {
            if (/^\/users\/[^/]+\/avatar$/.test(path)) return route.fulfill({ contentType: 'image/png', body: AVATAR })
            return route.fulfill({ json: [] })
        }
        const detail = /^\/caps\/([^/]+)\/detail$/.exec(path)
        if (detail) {
            await gate
            const found = DETAILS.get(detail[1])
            if (!found) return route.fulfill({ status: 404, json: { success: false, error: 'Cap not found' } })
            return route.fulfill({ json: { success: true, data: found } })
        }
        return route.fulfill({ json: { success: true, data: [] } })
    })
}

function runList(page: Page) {
    return page.getByRole('list', { name: 'Runs' })
}

test.describe('the compare runs page', () => {
    test('lists both runs of a shared link and titles the tab after them', async ({ page }) => {
        await mockApi(page)
        await page.goto(`/compare?runs=${FIERD},${BUN}`)

        const rows = runList(page).getByRole('listitem')
        await expect(rows).toHaveCount(2)
        await expect(rows.nth(0)).toContainText('fierd_6')
        await expect(rows.nth(0)).toContainText('1:21.234')
        await expect(rows.nth(1)).toContainText('Bun`')
        await expect(rows.nth(1)).toContainText('1:19.500')
        await expect(page.getByRole('heading', { name: 'Compare Runs' })).toBeVisible()
        await expect(page).toHaveTitle(`fierd_6 vs Bun\` on ${displayMapName(MAP)} — UTBT.net`)
        await expect(page.getByRole('status')).toHaveCount(0)
        expect(new URL(page.url()).search).toBe(`?runs=${FIERD},${BUN}`)
    })

    test('drops a malformed id and a repeated run with one notice, and normalises the address in place', async ({ page }) => {
        let release = () => {}
        await mockApi(page, new Promise<void>(resolve => { release = resolve }))
        await page.goto('/news')
        await page.evaluate(path => { window.location.assign(path) }, `/compare?runs=${FIERD},not-a-cap,${BUN},${FIERD}&t=4.5`)
        await expect(page.getByRole('heading', { name: 'Compare Runs' })).toBeVisible()
        const lengthBefore = await page.evaluate(() => window.history.length)

        release()

        await expect(runList(page).getByRole('listitem')).toHaveCount(2)
        await expect(page.getByRole('status')).toHaveText('Dropped 1 malformed run id and 1 repeated run.')
        await expect.poll(() => new URL(page.url()).search).toBe(`?runs=${FIERD},${BUN}`)
        expect(await page.evaluate(() => window.history.length)).toBe(lengthBefore)
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(`/compare\\?runs=${[FIERD, BUN].sort().join(',')}$`))

        await page.goBack()
        await expect.poll(() => new URL(page.url()).pathname).toBe('/news')
    })

    test('shows the empty state with its notice when no run is valid', async ({ page }) => {
        await mockApi(page)
        await page.goto('/compare?runs=not-a-cap,c3c3c3c3-0000-4000-8000-0000000000c3')

        await expect(page.getByText('No runs to compare')).toBeVisible()
        await expect(page.getByRole('status')).toHaveText('Dropped 1 malformed run id and 1 run that could not be loaded.')
        await expect.poll(() => new URL(page.url()).search).toBe('')
        await expect(page).toHaveTitle('Compare Runs — UTBT.net')
    })
})
