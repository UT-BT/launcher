import { expect, test, type BrowserContext } from '@playwright/test'
import type { MapMetadata } from '../app/utils/api'

const V1 = 'CTF-BT-Chain-v1'
const V2 = 'CTF-BT-Chain-v2'
const V3 = 'CTF-BT-Chain-v3'

function mapPayload(name: string, preceded_by: string | null, superseded_by: string | null): MapMetadata {
    return {
        name,
        added: '2026-01-01T00:00:00Z',
        difficulty: 3,
        active: name === V3,
        tags: '',
        author: 'Mapper',
        required_players: 1,
        preceded_by,
        superseded_by,
    }
}

const MAPS: Record<string, MapMetadata> = {
    [V1]: mapPayload(V1, null, V2),
    [V2]: mapPayload(V2, V1, V3),
    [V3]: mapPayload(V3, V2, null),
}

const CAP_COUNTS: Record<string, number> = { [V1]: 4, [V2]: 0, [V3]: 7 }

async function serveApi(context: BrowserContext) {
    await context.route(/https:\/\/(api|gateway)\.utbt\.net\/.*/, async route => {
        const url = new URL(route.request().url())
        if (url.hostname === 'gateway.utbt.net') {
            await route.fulfill({ json: [] })
            return
        }
        const path = decodeURIComponent(url.pathname).replace(/\/$/, '')
        const mapName = path.startsWith('/maps/') ? path.slice('/maps/'.length) : null
        let data: unknown
        if (mapName && MAPS[mapName]) data = MAPS[mapName]
        else if (path === '/caps/count' && url.searchParams.has('map') && !url.searchParams.has('user')) {
            data = { count: CAP_COUNTS[url.searchParams.get('map') ?? ''] ?? 0 }
        } else if (path === '/v2/summary') {
            data = { global: { newMaps: 0, newRecords: 0 }, achievements: [], recentWorldRecords: [], newMaps: [], latestPatch: null }
        } else data = path.endsWith('/count') ? { count: 0 } : []
        await route.fulfill({ json: { success: true, data } })
    })
}

test.beforeEach(async ({ page, context }) => {
    page.on('pageerror', error => console.error('BROWSER PAGE ERROR:', error.message))
    await context.addInitScript(() => localStorage.setItem('utbt:analyticsConsent:v1', 'denied'))
    await serveApi(context)
    await page.goto(`/maps/${V2}`)
})

test('version pills with records are links to that version', async ({ page }) => {
    const v1 = page.getByRole('link', { name: 'v1', exact: true })
    const v3 = page.getByRole('link', { name: 'v3', exact: true })
    await expect(v1).toHaveAttribute('href', `/maps/${V1}`)
    await expect(v3).toHaveAttribute('href', `/maps/${V3}`)
    await expect(page.getByText('v2', { exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'v2', exact: true })).toHaveCount(0)
})

test('a version pill without records is not a link', async ({ page }) => {
    await page.goto(`/maps/${V3}`)
    await expect(page.getByRole('link', { name: 'v1', exact: true })).toHaveAttribute('href', `/maps/${V1}`)
    await expect(page.getByText('v2', { exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'v2', exact: true })).toHaveCount(0)
})

test('middle-clicking a version pill opens it in a new tab', async ({ page, context }) => {
    const v1 = page.getByRole('link', { name: 'v1', exact: true })
    await expect(v1).toHaveAttribute('href', `/maps/${V1}`)
    const [tab] = await Promise.all([
        context.waitForEvent('page'),
        v1.click({ button: 'middle' }),
    ])
    await tab.waitForURL(url => url.pathname === `/maps/${V1}`)
    await expect(tab.getByRole('link', { name: 'v3', exact: true })).toHaveAttribute('href', `/maps/${V3}`)
    await expect(page).toHaveURL(new RegExp(`/maps/${V2}$`))
    await tab.close()
})

test('a plain click on a version pill opens it in place', async ({ page }) => {
    await page.getByRole('link', { name: 'v1', exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`/maps/${V1}$`))
    await expect(page.getByRole('link', { name: 'v2', exact: true })).toHaveCount(0)
})
