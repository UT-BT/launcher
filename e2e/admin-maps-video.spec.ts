import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { expect, test, type Page, type Request } from '@playwright/test'
import { horizontalOverflow } from './layout'

const MAP = 'CTF-BT+[LUN]HANGTIME!!!-V2'
const MAP_PATH = encodeURIComponent(MAP)
const VIDEO_ROUTE = `/admin/maps/${MAP_PATH}/video`
const VERSION = '2026-09-30T12:00:00+00:00'
const NEXT_VERSION = '2026-09-30T13:30:00+00:00'
const STAFF = { id: '555555555555', alias: 'Rin', utbt_role: 1 }
const WEBM_HEADER = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x82, 0x84, 0x77, 0x65, 0x62, 0x6d])

function mapRow(video: string | null) {
    return {
        name: MAP,
        active: true,
        difficulty: 5,
        tags: null,
        url: null,
        changelog: null,
        author_str: 'Lun',
        author_ref: null,
        author_alias: null,
        superseded_by: null,
        preceded_by: null,
        added: '2026-01-01T00:00:00+00:00',
        required_players: 1,
        has_screenshot: false,
        screenshot_updated: null,
        has_video: video !== null,
        video_updated_at: video,
    }
}

function videoUrl(version: string): string {
    return `https://api.utbt.net/videos/${MAP_PATH}.webm?v=${encodeURIComponent(version)}`
}

async function openMapForm(page: Page, video: string | null) {
    const videoRequests: Request[] = []
    let row = mapRow(video)

    page.on('pageerror', error => console.error('BROWSER PAGE ERROR:', error.stack))

    await page.addInitScript(() => {
        localStorage.setItem('utbt:analyticsConsent:v1', 'denied')
        localStorage.setItem('utbt:adminState:v1', JSON.stringify({ activeSection: 'maps-management' }))
        localStorage.setItem('utbt:webAuth:v1', JSON.stringify({
            discordId: '555555555555',
            username: 'rin',
            avatar: '',
            accessToken: 'admin-maps-token',
            refreshToken: 'admin-maps-refresh',
            expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        }))
    })

    await page.route(/https:\/\/(api|gateway)\.utbt\.net\/.*/, async route => {
        const request = route.request()
        const url = new URL(request.url())

        if (url.hostname === 'gateway.utbt.net') {
            await route.fulfill({ json: [] })
            return
        }

        const pathname = url.pathname.replace(/\/$/, '')

        if (pathname.startsWith('/videos/')) {
            await route.fulfill({ contentType: 'video/webm', body: WEBM_HEADER })
            return
        }
        if (pathname.startsWith('/screenshots/') || pathname.endsWith('/avatar')) {
            await route.fulfill({ status: 404, body: '' })
            return
        }
        if (pathname === VIDEO_ROUTE) {
            videoRequests.push(request)
            row = request.method() === 'DELETE' ? mapRow(null) : mapRow(NEXT_VERSION)
            await route.fulfill({ json: { success: true, data: row } })
            return
        }
        if (pathname === '/users/me') {
            await route.fulfill({ json: { success: true, data: STAFF } })
            return
        }
        if (pathname === '/user_state') {
            await route.fulfill({ json: { success: true, data: { state: {}, seen: {}, updated_at: null } } })
            return
        }
        if (pathname === '/admin/maps') {
            await route.fulfill({ json: { success: true, data: { items: [row] } } })
            return
        }
        if (pathname === '/admin/maps/count') {
            await route.fulfill({ json: { success: true, data: { count: 1 } } })
            return
        }
        if (pathname === '/admin/maps/tags') {
            await route.fulfill({ json: { success: true, data: { items: [] } } })
            return
        }
        if (pathname === '/admin/mapvote') {
            await route.fulfill({
                json: { success: true, data: { announcement: '', last_regenerated_at: null, cooldown_seconds_remaining: 0, can_regenerate: true } },
            })
            return
        }
        if (pathname === '/admin/maps/difficulty-sync/preview') {
            await route.fulfill({ json: { success: true, data: { changes: [] } } })
            return
        }
        await route.fulfill({ status: 404, json: { success: false, error: 'Not found' } })
    })

    await page.goto('/admin')
    await page.getByTitle('Edit map').first().click()
    const control = page.getByTestId('map-video-control')
    await expect(control).toBeVisible()

    return { control, videoRequests }
}

function confirmDialog(page: Page) {
    return page.locator('[data-modal-backdrop]').filter({ hasText: 'Scenes fall back to the screenshot.' }).last()
}

test.describe('Maps Management fly-through video', () => {
    test('the preview plays the versioned video URL, muted', async ({ page }) => {
        const { control } = await openMapForm(page, VERSION)

        const video = control.locator('video')
        await expect(video).toHaveAttribute('src', videoUrl(VERSION))
        expect(await video.evaluate((element: HTMLVideoElement) => element.muted)).toBe(true)
        await expect(control.getByRole('button', { name: 'Replace video' })).toBeVisible()
    })

    test('a map without a video offers an upload and no preview', async ({ page }) => {
        const { control } = await openMapForm(page, null)

        await expect(control.locator('video')).toHaveCount(0)
        await expect(control.getByRole('button', { name: 'Upload video' })).toBeVisible()
        await expect(control.getByRole('button', { name: 'Remove video' })).toHaveCount(0)
    })

    test('an upload sends the file as multipart and shows the new version', async ({ page }) => {
        const { control, videoRequests } = await openMapForm(page, null)

        const uploaded = page.waitForRequest(request => request.url().endsWith(VIDEO_ROUTE) && request.method() === 'POST')
        await control.getByLabel('Fly-through video file').setInputFiles({ name: 'flythrough.webm', mimeType: 'video/webm', buffer: WEBM_HEADER })
        const request = await uploaded

        expect(request.headers()['content-type']).toMatch(/^multipart\/form-data; boundary=/)
        expect(request.headers()['authorization']).toBe('Bearer admin-maps-token')
        const body = request.postDataBuffer() ?? Buffer.alloc(0)
        expect(body.includes(Buffer.from('name="file"; filename="flythrough.webm"'))).toBe(true)
        expect(body.includes(WEBM_HEADER)).toBe(true)
        expect(videoRequests).toHaveLength(1)
        await expect(control.locator('video')).toHaveAttribute('src', videoUrl(NEXT_VERSION))
        await expect(page.getByText('reflect them until', { exact: false })).toHaveCount(0)
    })

    test('replacing uploads again and bumps the preview version', async ({ page }) => {
        const { control, videoRequests } = await openMapForm(page, VERSION)

        await control.getByLabel('Fly-through video file').setInputFiles({ name: 'take2.webm', mimeType: 'video/webm', buffer: WEBM_HEADER })

        await expect(control.locator('video')).toHaveAttribute('src', videoUrl(NEXT_VERSION))
        expect(videoRequests.map(request => request.method())).toEqual(['POST'])
    })

    test('a non-WebM file is refused in the browser without a request', async ({ page }) => {
        const { control, videoRequests } = await openMapForm(page, null)

        await control.getByLabel('Fly-through video file').setInputFiles({ name: 'original.mp4', mimeType: 'video/mp4', buffer: Buffer.from('mp4') })

        await expect(control.getByText('Map videos must be WebM files.', { exact: false })).toBeVisible()
        expect(videoRequests).toHaveLength(0)
    })

    test('a file over 150 MB is refused in the browser without a request', async ({ page }) => {
        const oversize = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'utbt-video-')), 'huge.webm')
        const handle = fs.openSync(oversize, 'w')
        fs.ftruncateSync(handle, 150 * 1024 * 1024 + 1)
        fs.closeSync(handle)

        try {
            const { control, videoRequests } = await openMapForm(page, null)

            await control.getByLabel('Fly-through video file').setInputFiles(oversize)

            await expect(control.getByText('Map videos must be 150 MB or smaller.', { exact: false })).toBeVisible()
            await page.waitForTimeout(250)
            expect(videoRequests).toHaveLength(0)
            await expect(control.locator('video')).toHaveCount(0)
        } finally {
            fs.rmSync(path.dirname(oversize), { recursive: true, force: true })
        }
    })

    test('remove asks first, then deletes and drops the preview', async ({ page }) => {
        const { control, videoRequests } = await openMapForm(page, VERSION)

        await control.getByRole('button', { name: 'Remove video' }).click()
        const question = page.getByText('Scenes fall back to the screenshot.', { exact: false })
        await expect(question).toBeVisible()
        expect(videoRequests).toHaveLength(0)

        await confirmDialog(page).getByRole('button', { name: 'Remove', exact: true }).click()

        await expect(question).toBeHidden()
        await expect(control.locator('video')).toHaveCount(0)
        await expect(control.getByRole('button', { name: 'Upload video' })).toBeVisible()
        expect(videoRequests.map(request => request.method())).toEqual(['DELETE'])
    })

    test('cancelling the removal keeps the video', async ({ page }) => {
        const { control, videoRequests } = await openMapForm(page, VERSION)

        await control.getByRole('button', { name: 'Remove video' }).click()
        await expect(page.getByText('Scenes fall back to the screenshot.', { exact: false })).toBeVisible()
        await confirmDialog(page).getByRole('button', { name: 'Cancel' }).click()

        await expect(control.locator('video')).toHaveAttribute('src', videoUrl(VERSION))
        expect(videoRequests).toHaveLength(0)
    })

    for (const viewport of [{ width: 390, height: 844 }, { width: 1920, height: 1080 }]) {
        test(`the control fits at ${viewport.width} px`, async ({ page }) => {
            await page.setViewportSize(viewport)
            const { control } = await openMapForm(page, VERSION)

            expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0)
            const box = await control.boundingBox()
            expect(box).not.toBeNull()
            expect(box!.x).toBeGreaterThanOrEqual(0)
            expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width)
            for (const name of ['Replace video', 'Remove video']) {
                const button = control.getByRole('button', { name })
                await button.scrollIntoViewIfNeeded()
                await expect(button).toBeInViewport()
                const buttonBox = await button.boundingBox()
                expect(buttonBox!.x + buttonBox!.width).toBeLessThanOrEqual(viewport.width)
            }
            const video = await control.locator('video').boundingBox()
            expect(video!.width).toBeLessThanOrEqual(viewport.width)
        })
    }
})
