import { expect, test, type Page } from '@playwright/test'
import { dataFrom } from './mobile/fixtures/data'
import { fixtureSetNamed } from './mobile/fixtures'
import { serveFixtureSet } from './mobile/fixtures/router'
import { maps } from './mobile/manifest/maps'

const API_HOSTS = /https:\/\/(api|gateway)\.utbt\.net\/.*/
const SIZES = [{ width: 1280, height: 800 }, { width: 1920, height: 1080 }]

async function openMaps(page: Page): Promise<URL[]> {
    const api: URL[] = []
    page.on('request', request => {
        if (API_HOSTS.test(request.url())) api.push(new URL(request.url()))
    })
    await page.addInitScript(storage => {
        localStorage.setItem('utbt:analyticsConsent:v1', 'denied')
        for (const [key, value] of Object.entries(storage)) localStorage.setItem(key, value)
    }, maps.storage ?? {})
    await serveFixtureSet(page, maps.fixtures)
    await page.goto(maps.path)
    await maps.ready(page, dataFrom(fixtureSetNamed(maps.fixtures)!))
    return api
}

async function stillFrames(page: Page) {
    await page.waitForFunction(() => {
        const main = document.querySelector('main')!
        const state = window as unknown as { __still?: { signature: string; frames: number } }
        const signature = `${main.scrollTop},${main.scrollHeight},${document.getElementsByTagName('*').length}`
        if (state.__still?.signature === signature) state.__still.frames += 1
        else state.__still = { signature, frames: 0 }
        return state.__still.frames >= 3
    }, undefined, { polling: 'raf' })
}

async function touchPointerDrag(page: Page, from: { x: number; y: number }, distance: number) {
    await page.evaluate(({ from, distance }) => {
        const target = document.elementFromPoint(from.x, from.y)!
        const fire = (type: string, y: number) => target.dispatchEvent(new PointerEvent(type, {
            pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: from.x, clientY: y, bubbles: true, cancelable: true,
        }))
        fire('pointerdown', from.y)
        for (let step = 1; step <= 12; step += 1) fire('pointermove', from.y + distance * step / 12)
        fire('pointerup', from.y + distance)
    }, { from, distance })
}

for (const size of SIZES) {
    test.describe(`${size.width}x${size.height}`, () => {
        test.use({ viewport: size })

        test('desktop has no pull-to-refresh: a mouse or touch drag down at the top of Maps shows no indicator and refreshes nothing', async ({ page, isMobile }) => {
            test.skip(isMobile, 'desktop only')
            const api = await openMaps(page)
            await stillFrames(page)
            const heading = (await page.getByRole('heading', { name: 'Maps', exact: true }).first().boundingBox())!
            const from = { x: heading.x + heading.width / 2, y: heading.y + heading.height / 2 }
            const before = api.length

            await page.mouse.move(from.x, from.y)
            await page.mouse.down()
            for (let step = 1; step <= 12; step += 1) await page.mouse.move(from.x, from.y + step * 20)
            await stillFrames(page)
            await expect(page.getByRole('progressbar', { name: 'Pull to refresh' })).toHaveCount(0)
            await page.mouse.up()
            await stillFrames(page)
            await touchPointerDrag(page, from, 240)
            await stillFrames(page)

            await expect(page.getByRole('status', { name: 'Refreshing' })).toHaveCount(0)
            expect(api.slice(before).map(url => url.pathname), 'nothing is refetched').toEqual([])
            expect(await page.getByRole('main').evaluate(main => main.scrollTop)).toBe(0)
        })
    })
}
