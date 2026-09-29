import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'

const PAGE_COLOUR = [255, 0, 255]
const HARNESS = `/@fs/${path.resolve(__dirname, 'broadcastStageHarness.html').replace(/\\/g, '/').replace(/^\/+/, '')}`
const STAGE = { width: 1920, height: 1080 }
const PROBE = { left: 120, top: 80, width: 240, height: 90 }

interface Box {
    left: number
    top: number
    width: number
    height: number
}

interface Paint {
    outside: number
    stray: number
    corner: number[]
}

async function openStage(page: Page, variant: 'opaque' | 'transparent') {
    await page.goto(`${HARNESS}?variant=${variant}`)
    await expect(page.locator('[data-probe]')).toBeVisible()
    await page.evaluate(colour => {
        document.documentElement.style.background = `rgb(${colour.join(', ')})`
        document.body.style.background = 'transparent'
        ;(document.getElementById('app') as HTMLElement).style.background = 'transparent'
    }, PAGE_COLOUR)
}

async function probeBox(page: Page): Promise<Box> {
    return page.locator('[data-probe]').evaluate(element => {
        const { left, top, width, height } = element.getBoundingClientRect()
        return { left, top, width, height }
    })
}

async function paintAround(page: Page, probe: Box): Promise<Paint> {
    const png = (await page.screenshot()).toString('base64')
    return page.evaluate(async ({ png, probe, colour }) => {
        const image = new Image()
        image.src = `data:image/png;base64,${png}`
        await image.decode()
        const canvas = document.createElement('canvas')
        canvas.width = image.width
        canvas.height = image.height
        const context = canvas.getContext('2d') as CanvasRenderingContext2D
        context.drawImage(image, 0, 0)
        const { data } = context.getImageData(0, 0, image.width, image.height)
        const left = Math.floor(probe.left)
        const top = Math.floor(probe.top)
        const right = Math.ceil(probe.left + probe.width)
        const bottom = Math.ceil(probe.top + probe.height)
        let outside = 0
        let stray = 0
        for (let y = 0; y < image.height; y += 1) {
            for (let x = 0; x < image.width; x += 1) {
                if (x >= left && x < right && y >= top && y < bottom) continue
                outside += 1
                const at = (y * image.width + x) * 4
                if (data[at] !== colour[0] || data[at + 1] !== colour[1] || data[at + 2] !== colour[2]) stray += 1
            }
        }
        return { outside, stray, corner: [data[0], data[1], data[2]] }
    }, { png, probe, colour: PAGE_COLOUR })
}

test('the transparent stage paints no pixels of its own over a coloured page', async ({ page }) => {
    await openStage(page, 'transparent')
    const probe = await probeBox(page)
    expect(probe).toEqual(PROBE)

    const paint = await paintAround(page, probe)
    expect(paint.outside).toBe(STAGE.width * STAGE.height - PROBE.width * PROBE.height)
    expect(paint.stray).toBe(0)
})

test('the transparent stage still scales, with no letterbox, in a window that is not 16:9', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await openStage(page, 'transparent')
    const scale = Math.min(1280 / STAGE.width, 900 / STAGE.height)
    const probe = await probeBox(page)
    expect(probe.width).toBeCloseTo(PROBE.width * scale, 1)
    expect(probe.top).toBeCloseTo((900 - STAGE.height * scale) / 2 + PROBE.top * scale, 1)

    expect((await paintAround(page, probe)).stray).toBe(0)
})

test('the opaque stage letterboxes and paints its background over the same page', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await openStage(page, 'opaque')

    const paint = await paintAround(page, await probeBox(page))
    expect(paint.corner).toEqual([0, 0, 0])
    expect(paint.stray).toBe(paint.outside)
})
