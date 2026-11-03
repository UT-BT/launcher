import { expect, test, type Page } from '@playwright/test'
import { reopenOnDroppedModule } from './dev-server'
import { dataFrom } from './fixtures/data'
import { fixtureSetNamed } from './fixtures/index'
import { serveFixtureSet } from './fixtures/router'
import { scrollPositionProblems, topOfPageProblems, zoomVisualViewport } from './interactions'
import { capDetail } from './manifest/cap-detail'
import { maps } from './manifest/maps'
import type { MobileRouteEntry } from './manifest/types'
import { installProbe } from './rules/probe'
import { settleLayout } from './settle'

const OFFSET = 300

async function open(page: Page, entry: MobileRouteEntry) {
    await page.addInitScript(storage => {
        for (const [key, value] of Object.entries(storage)) localStorage.setItem(key, value)
    }, { 'utbt:analyticsConsent:v1': 'denied', ...entry.storage })
    await serveFixtureSet(page, entry.fixtures)
    await reopenOnDroppedModule(page, async () => {
        await page.goto(entry.path)
        await entry.ready(page, dataFrom(fixtureSetNamed(entry.fixtures)!))
    })
    await settleLayout(page)
    await installProbe(page)
}

async function leaveWindowOffset(page: Page, top: number): Promise<number> {
    return page.evaluate(offset => {
        document.body.style.height = '200%'
        window.scrollTo({ top: offset, behavior: 'instant' })
        return window.scrollY
    }, top)
}

async function leaveBodyOffset(page: Page, top: number): Promise<number> {
    return page.evaluate(offset => {
        document.getElementById('app')!.style.height = '200%'
        document.body.scrollTo({ top: offset, behavior: 'instant' })
        return document.body.scrollTop
    }, top)
}

const windowTop = (page: Page) => page.evaluate(() => window.scrollY)
const bodyTop = (page: Page) => page.evaluate(() => document.body.scrollTop)

test('after the zoom simulation returns to scale 1, the window is back at 0,0 and the page at its real top', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'only Chromium can change the page scale (agents/testing.md, Interaction specs)')
    await open(page, capDetail)

    await zoomVisualViewport(page, 2)
    expect(await leaveWindowOffset(page, OFFSET), 'the simulated pinch leaves the window offset').toBe(OFFSET)
    await settleLayout(page)
    expect(await windowTop(page), 'while zoomed in, the window stays where the pinch left it').toBe(OFFSET)

    await zoomVisualViewport(page, 1)
    await expect.poll(() => windowTop(page), { message: 'back at scale 1, the window is not left scrolled' }).toBe(0)
    await settleLayout(page)
    expect(await topOfPageProblems(page)).toEqual([])
})

test('at scale 1 the window and the shell around the page never stay scrolled', async ({ page }) => {
    await open(page, capDetail)

    expect(await leaveWindowOffset(page, OFFSET), 'the window can be offset').toBe(OFFSET)
    await expect.poll(() => windowTop(page), { message: 'the window offset is reset' }).toBe(0)

    expect(await leaveBodyOffset(page, OFFSET), 'the body can be offset').toBe(OFFSET)
    await expect.poll(() => bodyTop(page), { message: 'the body offset is reset' }).toBe(0)

    await settleLayout(page)
    expect(await topOfPageProblems(page)).toEqual([])
})

test('a window offset is kept while a text field has focus, and reset once focus leaves it', async ({ page }) => {
    await open(page, maps)
    const search = page.getByPlaceholder('Search for a map name or tag...')
    await search.tap()
    await expect(search).toBeFocused()

    expect(await leaveWindowOffset(page, OFFSET)).toBe(OFFSET)
    await settleLayout(page)
    expect(await windowTop(page), 'typing: the offset the keyboard may need is left alone').toBe(OFFSET)

    await search.blur()
    await expect.poll(() => windowTop(page), { message: 'focus left the field, so the offset is reset' }).toBe(0)
    await expect.poll(() => scrollPositionProblems(page)).toEqual([])
})
