import { expect, test, type Page } from '@playwright/test'
import { reopenOnDroppedModule } from './dev-server'
import { serveFixtureSet } from './fixtures/router'
import { checkModal, scrollPositionProblems, swipeScroll } from './interactions'
import { capDetail } from './manifest/cap-detail'
import { home } from './manifest/home'
import { MODAL_ROOT, type MobileRouteEntry } from './manifest/types'
import { installProbe } from './rules/probe'
import { settleLayout } from './settle'

const LANDSCAPE = { width: 844, height: 390 }

interface Box {
    left: number
    top: number
    width: number
    height: number
}

async function openEntry(page: Page, entry: MobileRouteEntry) {
    await page.addInitScript(() => localStorage.setItem('utbt:analyticsConsent:v1', 'denied'))
    await serveFixtureSet(page, entry.fixtures)
    await reopenOnDroppedModule(page, async () => {
        await page.goto(entry.path)
        await entry.ready(page)
    })
    await settleLayout(page)
    await installProbe(page)
}

async function resize(page: Page, size: { width: number; height: number }) {
    await page.setViewportSize(size)
    await settleLayout(page)
}

async function sheetAndVisibleArea(page: Page): Promise<{ sheet: Box; visible: Box; header: Box }> {
    return page.evaluate(selector => {
        const backdrop = [...document.querySelectorAll(selector)].at(-1)
        const sheet = backdrop?.firstElementChild
        const header = sheet?.firstElementChild
        if (!sheet || !header) throw new Error('no open modal with a header')
        const box = (element: Element) => {
            const rect = element.getBoundingClientRect()
            return { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
        }
        const area = window.__mobileProbe.visualViewport()
        return { sheet: box(sheet), visible: { left: area.left, top: area.top, width: area.width, height: area.height }, header: box(header) }
    }, MODAL_ROOT)
}

function expectSameBox(actual: Box, expected: Box, message: string) {
    for (const edge of ['left', 'top', 'width', 'height'] as const) {
        expect(Math.abs(actual[edge] - expected[edge]), `${message}: ${edge} is ${actual[edge]}, expected ${expected[edge]}`).toBeLessThanOrEqual(1)
    }
}

test('a page modal opens as a sheet over the top bar, filling the visible area in portrait and landscape', async ({ page }) => {
    await openEntry(page, capDetail)
    await capDetail.modals![0].open(page)
    await settleLayout(page)

    for (const size of [page.viewportSize()!, LANDSCAPE]) {
        await resize(page, size)
        const { sheet, visible } = await sheetAndVisibleArea(page)
        expectSameBox(sheet, visible, `${size.width}x${size.height}: the sheet fills the visible area`)
        expect((await checkModal(page, MODAL_ROOT)).problems, `${size.width}x${size.height}: the sheet and its close are on top`).toEqual([])
    }
})

test('only the sheet body scrolls; its header and close stay in view', async ({ page }) => {
    await openEntry(page, home)
    await resize(page, LANDSCAPE)
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('open-patreon')))
    await page.getByRole('heading', { name: 'Support UTBT' }).waitFor()
    await settleLayout(page)

    const before = await sheetAndVisibleArea(page)
    expectSameBox(before.sheet, before.visible, 'the sheet fills the visible area')

    const moves = await swipeScroll(page, 2000)
    await settleLayout(page)
    expect(moves.map(move => move.scroller), 'a swipe scrolls one scroller').toHaveLength(1)
    expect(moves[0].scroller, 'the swipe scrolls the sheet body').toMatch(/^an inner scroller/)
    expect(moves[0].to - moves[0].from, 'the body holds more than it shows').toBeGreaterThan(50)

    const after = await sheetAndVisibleArea(page)
    expectSameBox(after.header, before.header, 'the header stays where it was')
    expect(after.header.top, 'the header sits at the top of the visible area').toBeLessThanOrEqual(after.visible.top + 1)
    expect((await checkModal(page, MODAL_ROOT)).problems, 'the close is still visible and on top').toEqual([])
    expect(await scrollPositionProblems(page), 'the page behind the sheet did not scroll').toEqual([])
})
