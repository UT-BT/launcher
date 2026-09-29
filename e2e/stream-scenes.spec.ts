import { expect, test, type Page } from '@playwright/test'
import { T0, asSpectator, iso, pickBanState } from '../app/components/pages/events/pickban/pickBanFixtures'

const SLUG = '2v2-cup-2026'
const STREAMER = '228152236587483136'
const OPTIONS = '?sound=0&motion=0'
const MAGENTA = { r: 255, g: 0, b: 255 }
const CORS = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': '*',
    'access-control-expose-headers': 'ETag, X-Server-Now',
}

const SCENES = [
    { id: 'starting-soon', label: 'Starting Soon' },
    { id: 'preview', label: 'Match Preview' },
    { id: 'pick-ban', label: 'Pick & Ban' },
    { id: 'betting', label: 'Betting' },
    { id: 'overlay', label: 'Match Overlay' },
    { id: 'intermission', label: 'Intermission' },
    { id: 'post-match', label: 'Post-match' },
    { id: 'standings', label: 'Standings' },
    { id: 'brb', label: 'BRB' },
    { id: 'ending', label: 'Ending' },
    { id: 'caster', label: 'Caster Cam' },
]

interface Box {
    x: number
    y: number
    width: number
    height: number
}

const scenePage = (scene: string) => `/stream/${SLUG}/${STREAMER}/${scene}${OPTIONS}`

async function serveApi(page: Page) {
    await page.route(/https:\/\/(api|gateway)\.utbt\.net\/.*/, async route => {
        const request = route.request()
        if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS })
        const url = new URL(request.url())
        if (url.pathname === '/tournaments/watch-cup/matches/match-1/pick-ban') {
            const state = asSpectator({ ...pickBanState(), server_now: iso(T0 - 60_000) })
            return route.fulfill({
                headers: { ...CORS, etag: `"v${state.version}"`, 'x-server-now': state.server_now },
                json: { success: true, data: state },
            })
        }
        return route.fulfill({ headers: CORS, json: { success: true, data: [] } })
    })
}

async function expectNoAppShell(page: Page) {
    await expect(page.locator('aside')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Accept analytics' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Login with Discord/ })).toHaveCount(0)
}

async function robotsDirectives(page: Page): Promise<string[]> {
    return page.locator('head meta[name="robots"]').evaluateAll(tags => tags.map(tag => tag.getAttribute('content') ?? ''))
}

async function strayPixels(page: Page, exclude: Box): Promise<number> {
    const png = await page.screenshot({ omitBackground: true })
    return page.evaluate(
        async ({ data, box, colour }) => {
            const image = new Image()
            image.src = `data:image/png;base64,${data}`
            await image.decode()
            const canvas = document.createElement('canvas')
            canvas.width = image.width
            canvas.height = image.height
            const context = canvas.getContext('2d')
            if (!context) throw new Error('no 2d context')
            context.fillStyle = `rgb(${colour.r}, ${colour.g}, ${colour.b})`
            context.fillRect(0, 0, canvas.width, canvas.height)
            context.drawImage(image, 0, 0)
            const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
            let stray = 0
            for (let y = 0; y < canvas.height; y++) {
                for (let x = 0; x < canvas.width; x++) {
                    if (x >= box.x && x < box.x + box.width && y >= box.y && y < box.y + box.height) continue
                    const index = (y * canvas.width + x) * 4
                    if (pixels[index] !== colour.r || pixels[index + 1] !== colour.g || pixels[index + 2] !== colour.b) stray++
                }
            }
            return stray
        },
        { data: png.toString('base64'), box: exclude, colour: MAGENTA }
    )
}

async function paintDocumentFromSiteCss(page: Page) {
    await page.addInitScript(() => {
        document.addEventListener('DOMContentLoaded', () => {
            const style = document.createElement('style')
            style.textContent = 'html, body, #app { background: rgb(12, 34, 56) }'
            document.head.append(style)
        })
    })
}

async function placeholderBox(page: Page, scene: string): Promise<Box> {
    const box = await page.locator(`[data-stream-scene="${scene}"]`).boundingBox()
    if (!box) throw new Error(`${scene} placeholder has no box`)
    const x = Math.floor(box.x)
    const y = Math.floor(box.y)
    return { x, y, width: Math.ceil(box.x + box.width) - x, height: Math.ceil(box.y + box.height) - y }
}

test.beforeEach(async ({ page }) => {
    await serveApi(page)
})

test('every scene URL renders its own placeholder with no app shell and noindex', async ({ page, isMobile }) => {
    test.skip(isMobile)
    for (const scene of SCENES) {
        await page.goto(scenePage(scene.id))
        const placeholder = page.locator(`[data-stream-scene="${scene.id}"]`)
        await expect(placeholder, scene.id).toBeVisible()
        await expect(placeholder.getByRole('heading', { level: 1 }), scene.id).toHaveText(scene.label)
        await expectNoAppShell(page)
        expect(await robotsDirectives(page), scene.id).toEqual(['noindex'])
    }
})

test('a scene URL with an unknown scene id shows the plain unknown scene page, not the app', async ({ page, isMobile }) => {
    test.skip(isMobile)
    await page.goto(scenePage('scoreboard'))
    await expect(page.getByRole('heading', { name: 'Unknown scene' })).toBeVisible()
    await expect(page.locator('[data-stream-scene-unknown="scoreboard"]')).toContainText('starting-soon')
    await expect(page.locator('[data-stream-scene]')).toHaveCount(0)
    await expectNoAppShell(page)
    expect(await robotsDirectives(page)).toEqual(['noindex'])
})

test('a stream path with missing or extra segments falls through to the app', async ({ page, isMobile }) => {
    test.skip(isMobile)
    for (const path of [`/stream/${SLUG}/${STREAMER}`, `/stream/${SLUG}/${STREAMER}/overlay/extra`]) {
        await page.goto(path)
        await expect(page.locator('aside'), path).toHaveCount(1)
        await expect(page.locator('[data-stream-scene]'), path).toHaveCount(0)
        await expect(page.getByRole('heading', { name: 'Unknown scene' }), path).toHaveCount(0)
        expect(await robotsDirectives(page), path).toEqual(['index,follow'])
    }
})

test('the overlay and caster cam pages paint nothing over a coloured background, even when site CSS paints the document', async ({ page, isMobile }) => {
    test.skip(isMobile)
    await paintDocumentFromSiteCss(page)
    await page.setViewportSize({ width: 1920, height: 1080 })
    for (const scene of ['overlay', 'caster']) {
        await page.goto(scenePage(scene))
        await expect(page.locator(`[data-stream-scene="${scene}"]`)).toBeVisible()
        const backgrounds = await page.evaluate(() =>
            [document.documentElement, document.body, document.getElementById('app')].map(element => getComputedStyle(element!).backgroundColor)
        )
        expect(backgrounds, scene).toEqual(['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0)'])
        expect(await strayPixels(page, await placeholderBox(page, scene)), scene).toBe(0)
    }
})

test('an opaque scene paints the whole canvas, so the transparency check can fail', async ({ page, isMobile }) => {
    test.skip(isMobile)
    await paintDocumentFromSiteCss(page)
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto(scenePage('brb'))
    const box = await placeholderBox(page, 'brb')
    expect(await strayPixels(page, box)).toBe(1920 * 1080 - box.width * box.height)
})

test('the per-match pick/ban stream page still loads its own root, with noindex', async ({ page, isMobile }) => {
    test.skip(isMobile)
    await page.goto(`/events/watch-cup/matches/match-1/stream${OPTIONS}`)
    await expect(page.getByRole('region', { name: 'Crimson Cats' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Azure Owls' })).toBeVisible()
    await expect(page.locator('[data-stream-scene]')).toHaveCount(0)
    await expectNoAppShell(page)
    expect(await robotsDirectives(page)).toEqual(['noindex'])
})
