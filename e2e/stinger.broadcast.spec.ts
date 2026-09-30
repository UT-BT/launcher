import { expect, test, type Page } from '@playwright/test'
import {
    STINGER_COVERED_FROM_MS,
    STINGER_COVERED_UNTIL_MS,
    STINGER_EVENT_NAME,
    STINGER_TRANSITION_MS,
    stingerFrameCount,
    stingerFrameTimeMs,
} from '../app/components/stream/stinger/stingerTimeline'

const STINGER_PAGE = '/components/stream/stinger/stinger.html?render=1'

interface Coverage {
    pixels: number
    painted: number
    opaque: number
}

async function openStinger(page: Page) {
    await page.goto(STINGER_PAGE)
    await page.waitForFunction(() => window.stinger?.ready === true)
}

async function coverageAt(page: Page, ms: number): Promise<Coverage> {
    await page.evaluate(at => window.stinger?.seek(at), ms)
    const png = (await page.screenshot({ omitBackground: true, animations: 'allow' })).toString('base64')
    return page.evaluate(async png => {
        const image = new Image()
        image.src = `data:image/png;base64,${png}`
        await image.decode()
        const canvas = document.createElement('canvas')
        canvas.width = image.width
        canvas.height = image.height
        const context = canvas.getContext('2d') as CanvasRenderingContext2D
        context.drawImage(image, 0, 0)
        const { data } = context.getImageData(0, 0, image.width, image.height)
        let painted = 0
        let opaque = 0
        for (let index = 3; index < data.length; index += 4) {
            if (data[index] > 0) painted += 1
            if (data[index] === 255) opaque += 1
        }
        return { pixels: image.width * image.height, painted, opaque }
    }, png)
}

test.describe('stinger', () => {
    test('starts and ends with nothing on screen', async ({ page }) => {
        await openStinger(page)
        expect((await coverageAt(page, 0)).painted).toBe(0)
        expect((await coverageAt(page, stingerFrameTimeMs(stingerFrameCount() - 1))).painted).toBe(0)
    })

    test('covers every pixel around the transition point', async ({ page }) => {
        await openStinger(page)
        for (const ms of [STINGER_COVERED_FROM_MS, STINGER_TRANSITION_MS, STINGER_COVERED_UNTIL_MS]) {
            const coverage = await coverageAt(page, ms)
            expect(coverage.pixels).toBe(1920 * 1080)
            expect(coverage.opaque, `opaque pixels at ${ms} ms`).toBe(coverage.pixels)
        }
    })

    test('shows the event name at the transition point', async ({ page }) => {
        await openStinger(page)
        await page.evaluate(at => window.stinger?.seek(at), STINGER_TRANSITION_MS)
        await expect(page.getByText(STINGER_EVENT_NAME)).toBeVisible()
    })
})
