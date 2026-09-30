import { expect, test, type Page } from '@playwright/test'
import { horizontalOverflow } from './layout'
import { openStreamPanel } from './streamPanels'

const SLUG = 'stream-cup'
const VIEWER_ID = '555555555555'

const EVENT = {
    id: 'event-1',
    slug: SLUG,
    name: 'Stream Cup 2026',
    summary: 'A cup for checking the Kit panel.',
    description: null,
    rules: null,
    team_size: 2,
    bracket_type: 'groups',
    status: 'active',
    signups_open: false,
    signup_opens_at: null,
    signup_closes_at: null,
    starts_at: null,
    ends_at: null,
    max_teams: 8,
    team_count: 0,
    registered_team_count: 0,
    created_at: null,
    published_at: null,
    predictions_enabled: false,
}

interface KitState {
    currentVersion: number
    downloadedVersion: number | null
    zipRequests: string[]
}

async function mockApi(page: Page, kit: KitState) {
    page.on('pageerror', error => console.error('BROWSER PAGE ERROR:', error.stack))

    await page.addInitScript(() => {
        localStorage.setItem('utbt:analyticsConsent:v1', 'denied')
        localStorage.setItem('utbt:webAuth:v1', JSON.stringify({
            discordId: '555555555555',
            username: 'rin',
            avatar: '',
            accessToken: 'kit-panel-token',
            refreshToken: 'kit-panel-refresh',
            expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        }))
    })

    await page.route(/https:\/\/(api|gateway)\.utbt\.net\/.*/, async route => {
        const url = new URL(route.request().url())

        if (url.hostname === 'gateway.utbt.net') {
            await route.fulfill({ json: [] })
            return
        }

        const path = url.pathname.replace(/\/$/, '')
        const kitPath = `/tournaments/${SLUG}/stream/${VIEWER_ID}/kit`

        if (path === '/users/me') {
            await route.fulfill({ json: { success: true, data: { id: VIEWER_ID, alias: 'Rin' } } })
            return
        }

        if (path === '/user_state') {
            await route.fulfill({ json: { success: true, data: { state: {}, seen: {}, updated_at: null } } })
            return
        }

        if (path === '/launcher/activity/latest') {
            await route.fulfill({ status: 404, json: { success: false, error: 'Not found' } })
            return
        }

        if (path === `/tournaments/${SLUG}`) {
            await route.fulfill({ json: { success: true, data: { tournament: EVENT } } })
            return
        }

        if (path === `/tournaments/${SLUG}/me`) {
            await route.fulfill({
                json: {
                    success: true,
                    data: { team: null, invitations: [], lfp: null, volunteer: null, pick_ban_session: null, is_streamer: true },
                },
            })
            return
        }

        if (path === `${kitPath}/info`) {
            await route.fulfill({
                json: {
                    success: true,
                    data: {
                        current_version: kit.currentVersion,
                        downloaded_version: kit.downloadedVersion,
                        default_folder: 'C:\\UTBT-StreamKit',
                    },
                },
            })
            return
        }

        if (path === kitPath) {
            kit.zipRequests.push(url.searchParams.get('folder') ?? '')
            kit.downloadedVersion = kit.currentVersion
            await route.fulfill({
                status: 200,
                contentType: 'application/zip',
                headers: { 'Content-Disposition': `attachment; filename="utbt-stream-kit-${SLUG}.zip"` },
                body: Buffer.from('PK'),
            })
            return
        }

        if (path === `/tournaments/${SLUG}/bracket`) {
            await route.fulfill({ json: { success: true, data: { published: false, format: { template: null, spec: null }, stages: [] } } })
            return
        }

        if (path === `/tournaments/${SLUG}/pick-ban/config`) {
            await route.fulfill({ json: { success: true, data: { stages: [] } } })
            return
        }

        if (path === `/tournaments/${SLUG}/teams` || path === `/tournaments/${SLUG}/lfp` || path === `/tournaments/${SLUG}/me/matches`) {
            await route.fulfill({ json: { success: true, data: { items: [] } } })
            return
        }

        await route.fulfill({ json: { success: true, data: [] } })
    })
}

async function openKitPanel(page: Page) {
    await page.goto(`/events/${SLUG}?tab=stream`)
    await openStreamPanel(page, 'Setup')
    await expect(page.getByRole('region', { name: 'Kit' })).toBeVisible()
}

test('a streamer who never downloaded the kit is asked to import it', async ({ page }) => {
    await mockApi(page, { currentVersion: 1, downloadedVersion: null, zipRequests: [] })
    await openKitPanel(page)

    await expect(page.getByRole('status').filter({ hasText: "haven't downloaded your kit" })).toBeVisible()
    await expect(page.getByLabel('Kit folder')).toHaveValue('C:\\UTBT-StreamKit')
    await expect(page.getByText('Visual changes to the scenes reach OBS automatically')).toBeVisible()
    await expect(page.getByText(/stream key/i)).toBeVisible()
    await expect(page.getByLabel(/stream key/i)).toHaveCount(0)
})

test('an outdated kit shows the re-import banner and a current kit does not', async ({ page }) => {
    await mockApi(page, { currentVersion: 3, downloadedVersion: 2, zipRequests: [] })
    await openKitPanel(page)
    await expect(page.getByRole('status').filter({ hasText: 'out of date' })).toBeVisible()
    await expect(page.getByRole('status').filter({ hasText: 'Scene Collection > Import' })).toBeVisible()
})

test('a current kit shows no banner', async ({ page }) => {
    await mockApi(page, { currentVersion: 2, downloadedVersion: 2, zipRequests: [] })
    await openKitPanel(page)
    await expect(page.getByRole('button', { name: 'Download kit' })).toBeVisible()
    await expect(page.getByRole('status')).toHaveCount(0)
})

test('the website downloads the ZIP for the chosen folder and the banner clears', async ({ page }) => {
    const kit: KitState = { currentVersion: 1, downloadedVersion: null, zipRequests: [] }
    await mockApi(page, kit)
    await openKitPanel(page)

    await page.getByLabel('Kit folder').fill('D:\\Streaming\\Kit')
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Download kit' }).click()

    expect((await download).suggestedFilename()).toBe(`utbt-stream-kit-${SLUG}.zip`)
    expect(kit.zipRequests).toEqual(['D:\\Streaming\\Kit'])
    await expect(page.getByText(`Saved utbt-stream-kit-${SLUG}.zip`)).toBeVisible()
    await expect(page.getByRole('status').filter({ hasText: "haven't downloaded your kit" })).toHaveCount(0)
})

test('an invalid folder shows an inline error and blocks the download', async ({ page }) => {
    const kit: KitState = { currentVersion: 1, downloadedVersion: null, zipRequests: [] }
    await mockApi(page, kit)
    await openKitPanel(page)

    await page.getByLabel('Kit folder').fill('kit\\folder')
    await expect(page.getByRole('alert').filter({ hasText: 'full Windows path' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Download kit' })).toBeDisabled()
    expect(kit.zipRequests).toEqual([])
})

test('the folder choice persists across reloads', async ({ page }) => {
    await mockApi(page, { currentVersion: 1, downloadedVersion: null, zipRequests: [] })
    await openKitPanel(page)

    await page.getByLabel('Kit folder').fill('E:\\OBS\\UTBT')
    await page.reload()
    await openStreamPanel(page, 'Setup')

    await expect(page.getByLabel('Kit folder')).toHaveValue('E:\\OBS\\UTBT')
})

for (const viewport of [{ width: 390, height: 844 }, { width: 1920, height: 1080 }]) {
    test(`the Kit panel fits at ${viewport.width}px`, async ({ page }) => {
        await page.setViewportSize(viewport)
        await mockApi(page, { currentVersion: 3, downloadedVersion: 2, zipRequests: [] })
        await openKitPanel(page)

        await expect(page.getByRole('button', { name: 'Download kit' })).toBeVisible()
        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)
    })
}
