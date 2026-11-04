import { expect, test } from '@playwright/test'
import { reopenOnDroppedModule } from './dev-server'
import { serveFixtureSet } from './fixtures/router'
import {
    checkModal,
    closeModal,
    rotate,
    scrollPositionProblems,
    scrollToTop,
    swipeScroll,
    tapCentre,
    topOfPageProblems,
    zoomVisualViewport,
} from './interactions'
import { capDetail } from './manifest/cap-detail'
import { MODAL_ROOT } from './manifest/types'
import { installProbe } from './rules/probe'
import { settleLayout } from './settle'

const watchReplay = capDetail.modals!.find(modal => modal.id === 'watch-replay')!
const ZOOM = 2

test.beforeEach(async ({ page }) => {
    page.on('pageerror', error => console.error('BROWSER PAGE ERROR:', error.message))
})

test('owner repro: the replay video modal, landscape, zoom, portrait, then close, menu and scroll all work', async ({ page }) => {
    test.slow()

    await page.addInitScript(() => localStorage.setItem('utbt:analyticsConsent:v1', 'denied'))
    await serveFixtureSet(page, capDetail.fixtures)
    await reopenOnDroppedModule(page, async () => {
        await page.goto(capDetail.path)
        await capDetail.ready(page)
    })
    await settleLayout(page)
    await installProbe(page)

    await test.step('open the replay video on the cap page', async () => {
        await watchReplay.open(page)
        await settleLayout(page)
        expect.soft((await checkModal(page, MODAL_ROOT)).problems, 'portrait: the modal fits and its close control can be tapped').toEqual([])
    })

    await test.step('rotate to landscape', async () => {
        const size = await rotate(page)
        expect.soft((await checkModal(page, MODAL_ROOT)).problems, `${size}: the modal fits and its close control can be tapped`).toEqual([])
    })

    await test.step('zoom in and back out', async () => {
        const zoomed = await zoomVisualViewport(page, ZOOM)
        test.info().annotations.push({
            type: 'zoom simulation',
            description: zoomed
                ? `the visual viewport was scaled to ${ZOOM} and back to 1 (no pan: headless Chromium ignores synthesized pinch and scroll gestures)`
                : 'this engine has no page-scale API, so the zoom step was skipped',
        })
        if (zoomed) await zoomVisualViewport(page, 1)
        expect.soft(await scrollPositionProblems(page), 'after zooming back to scale 1 the window and the page are not offset').toEqual([])
        expect.soft((await checkModal(page, MODAL_ROOT)).problems, 'after zooming back: the modal fits and its close control can be tapped').toEqual([])
    })

    await test.step('rotate back to portrait', async () => {
        const size = await rotate(page)
        expect.soft((await checkModal(page, MODAL_ROOT)).problems, `${size}: the modal fits and its close control can be tapped`).toEqual([])
    })

    await test.step('close the modal with its close control', async () => {
        const check = await checkModal(page, MODAL_ROOT)
        expect(check.close?.reachable, 'the close control can be tapped').toBe(true)
        const { closed, notes } = await closeModal(page, MODAL_ROOT)
        expect(notes, 'tapping the close control closes the modal').toEqual([])
        expect(closed).toBe(true)
    })

    await test.step('open the menu', async () => {
        expect(await tapCentre(page, 'button[aria-label="Open navigation"]'), 'the hamburger can be tapped').toBeNull()
        const navigation = page.locator('aside#app-navigation')
        await expect(page.getByRole('button', { name: 'Open navigation', exact: true })).toHaveAttribute('aria-expanded', 'true')
        await expect.poll(() => navigation.evaluate(element => {
            const rect = element.getBoundingClientRect()
            const area = window.__mobileProbe.visualViewport()
            return rect.left >= area.left - 1 && rect.right <= area.left + area.width + 1
        }), { message: 'the drawer slides fully into the visible area' }).toBe(true)
        await settleLayout(page)
        const outside = await navigation.evaluate(element => {
            const rect = element.getBoundingClientRect()
            const area = window.__mobileProbe.visualViewport()
            return { x: (rect.right + area.left + area.width) / 2, y: area.top + area.height / 2 }
        })
        await page.touchscreen.tap(outside.x, outside.y)
        await expect(navigation).toHaveAttribute('inert', '')
        await settleLayout(page)
    })

    await test.step('scroll the page down and back to the top', async () => {
        const moves = await swipeScroll(page, 600, 'page')
        expect(moves.map(move => move.scroller), 'a swipe scrolls the page').toEqual(['the shell scroller (main)'])
        await settleLayout(page)
        await scrollToTop(page)
        expect(await topOfPageProblems(page), 'scrolling to the top reaches the real top').toEqual([])
    })
})
