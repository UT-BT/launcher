import { expect, test, type Page } from '@playwright/test'
import {
    STREAM_EVENT,
    streamHotState,
    streamMapScore,
    streamMaps,
    streamMatch,
    streamScore,
} from '../app/components/stream/data/streamFixtures'
import { expectSceneScreenshot, openScene, settleScene } from './streamHarness'

const CASTER_CUTOUT = { x: 96, y: 184, width: 1152, height: 648 }
const BRB_DEFAULT_MESSAGE = 'We’ll be right back — stay tuned.'

const SAMPLE_WEBCAM = `data:image/svg+xml,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff7a18"/><stop offset="1" stop-color="#19c2a0"/></linearGradient></defs><rect width="1920" height="1080" fill="url(#g)"/><circle cx="672" cy="508" r="190" fill="#fff" fill-opacity=".85"/><text x="672" y="760" font-size="72" text-anchor="middle" font-family="sans-serif" fill="#111">SAMPLE WEBCAM</text></svg>'
)}`

const MAPS = streamMaps(['CTF-Face', 'CTF-Coret', 'CTF-Dq', 'CTF-Niven'], ['a', 'b', 'a', 'b'])
const SCORE = streamScore([streamMapScore(1, [2, 1], 'a'), streamMapScore(2, [0, 2], 'b'), streamMapScore(3, [2, 0], 'a')], { current_map: 4 })
const CASTERS = [
    { id: '228152236587483001', display_name: 'Ada Lovelace', avatar: null },
    { id: null, display_name: 'Guest Caster', avatar: null },
]
const MATCH = streamMatch({ maps: MAPS, score: SCORE, casters: CASTERS })

const brb = (message: string | null) =>
    streamHotState({ desk: { brb_message: message, webcam_enabled: false }, match: MATCH })
const caster = (webcam: boolean) =>
    streamHotState({ desk: { brb_message: null, webcam_enabled: webcam }, match: MATCH })

async function putWebcamUnderPage(page: Page) {
    await page.evaluate(source => {
        const webcam = document.createElement('div')
        webcam.dataset.sampleWebcam = ''
        webcam.style.cssText = `position:fixed;inset:0;z-index:-1;background:url("${source}") 0 0 / 1920px 1080px no-repeat`
        document.body.prepend(webcam)
    }, SAMPLE_WEBCAM)
}

test('BRB shows the streamer message and the series score', async ({ page }) => {
    await openScene(page, 'brb', { hotState: brb('Back in five, grabbing water') })

    await expect(page.locator('[data-stream-scene="brb"]')).toBeVisible()
    await expect(page.locator('[data-brb-message]')).toHaveText('Back in five, grabbing water')
    const score = page.locator('[data-series-score]')
    await expect(score).toContainText('Crimson Cats')
    await expect(score).toContainText('Azure Owls')
    await expect(score).toContainText('Series · map 4')
    await expect(page.getByText(STREAM_EVENT.name)).toBeVisible()

    await expectSceneScreenshot(page, 'brb.png')
})

test('BRB falls back to a default line when there is no message', async ({ page }) => {
    await openScene(page, 'brb', { hotState: brb(null) })
    await expect(page.locator('[data-brb-message]')).toHaveText(BRB_DEFAULT_MESSAGE)
})

test('BRB follows a message change without a reload', async ({ page }) => {
    const api = await openScene(page, 'brb', { hotState: brb('First') })
    await expect(page.locator('[data-brb-message]')).toHaveText('First')
    api.setHotState(brb('Second'))
    await expect(page.locator('[data-brb-message]')).toHaveText('Second')
})

test('Caster Cam with the webcam on cuts a transparent hole at the cutout over the webcam', async ({ page }) => {
    await openScene(page, 'caster', { hotState: caster(true) })
    await expect(page.locator('[data-caster-frame]')).toBeVisible()
    await putWebcamUnderPage(page)
    await settleScene(page)

    await expect(page.locator('[data-caster]')).toHaveCount(2)
    await expect(page.getByText('Ada Lovelace')).toBeVisible()
    await expect(page.getByText('Guest Caster')).toBeVisible()

    const centre = { x: CASTER_CUTOUT.x + CASTER_CUTOUT.width / 2, y: CASTER_CUTOUT.y + CASTER_CUTOUT.height / 2 }
    const hitsFrame = await page.evaluate(
        ({ x, y }) => document.elementsFromPoint(x, y).some(element => element.hasAttribute('data-caster-frame')),
        centre
    )
    expect(hitsFrame).toBe(false)
    const corners = [
        [CASTER_CUTOUT.x - 1, CASTER_CUTOUT.y - 1],
        [CASTER_CUTOUT.x + CASTER_CUTOUT.width, CASTER_CUTOUT.y + CASTER_CUTOUT.height],
    ]
    for (const [x, y] of corners) {
        const covered = await page.evaluate(
            ([px, py]) => document.elementsFromPoint(px, py).some(element => element.hasAttribute('data-caster-frame')),
            [x, y]
        )
        expect(covered, `${x},${y}`).toBe(true)
    }

    await expectSceneScreenshot(page, 'caster-webcam.png')
    await expect(page).toHaveScreenshot('caster-webcam-cutout.png', { clip: CASTER_CUTOUT })
})

test('Caster Cam with the webcam off paints over the area, so a webcam underneath stays hidden', async ({ page }) => {
    await openScene(page, 'caster', { hotState: caster(false) })
    await expect(page.locator('[data-stream-scene="caster"]')).toBeVisible()
    await putWebcamUnderPage(page)
    await settleScene(page)

    await expect(page.locator('[data-caster-frame]')).toHaveCount(0)
    await expect(page.locator('[data-caster]')).toHaveCount(2)
    await expect(page.getByText('Ada Lovelace')).toBeVisible()

    await expectSceneScreenshot(page, 'caster-no-webcam.png')
    await expect(page).toHaveScreenshot('caster-no-webcam-cutout.png', { clip: CASTER_CUTOUT })
})

test('Caster Cam follows the webcam toggle without a reload', async ({ page }) => {
    const api = await openScene(page, 'caster', { hotState: caster(false) })
    await expect(page.locator('[data-stream-scene="caster"]')).toBeVisible()
    await expect(page.locator('[data-caster-frame]')).toHaveCount(0)
    api.setHotState(caster(true))
    await expect(page.locator('[data-caster-frame]')).toBeVisible()
})

test('Caster Cam with the webcam on leaves the page and the cutout unpainted even when site CSS paints the document', async ({ page }) => {
    await page.addInitScript(() => {
        document.addEventListener('DOMContentLoaded', () => {
            const style = document.createElement('style')
            style.textContent = 'html, body, #app { background: rgb(12, 34, 56) }'
            document.head.append(style)
        })
    })
    await openScene(page, 'caster', { hotState: caster(true) })
    await expect(page.locator('[data-caster-frame]')).toBeVisible()
    await settleScene(page)

    const backgrounds = await page.evaluate(() =>
        [document.documentElement, document.body, document.getElementById('app')].map(element => getComputedStyle(element!).backgroundColor)
    )
    expect(backgrounds).toEqual(['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0)'])

    const png = await page.screenshot({ omitBackground: true, clip: CASTER_CUTOUT })
    const opaque = await page.evaluate(async data => {
        const image = new Image()
        image.src = `data:image/png;base64,${data}`
        await image.decode()
        const canvas = document.createElement('canvas')
        canvas.width = image.width
        canvas.height = image.height
        const context = canvas.getContext('2d')
        if (!context) throw new Error('no 2d context')
        context.drawImage(image, 0, 0)
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
        let painted = 0
        for (let index = 3; index < pixels.length; index += 4) if (pixels[index] !== 0) painted++
        return painted
    }, png.toString('base64'))
    expect(opaque).toBe(0)
})
