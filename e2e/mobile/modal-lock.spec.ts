import { expect, test, type Page } from '@playwright/test'
import { reopenOnDroppedModule } from './dev-server'
import { serveFixtureSet } from './fixtures/router'
import { closeModal, swipeScroll } from './interactions'
import { capDetail, capDetailRivals } from './manifest/cap-detail'
import { MODAL_ROOT } from './manifest/types'
import { installProbe } from './rules/probe'
import { settleLayout } from './settle'

const RIVAL_USER_ID = capDetailRivals()[0].user
const PATRON_BADGE = 'Tier 2 Patreon Supporter'

async function openCapDetail(page: Page) {
    await page.addInitScript(() => localStorage.setItem('utbt:analyticsConsent:v1', 'denied'))
    await serveFixtureSet(page, capDetail.fixtures)
    await reopenOnDroppedModule(page, async () => {
        await page.goto(capDetail.path)
        await capDetail.ready(page)
    })
    await settleLayout(page)
    await installProbe(page)
}

async function scrollPositions(page: Page): Promise<{ main: number; window: number }> {
    return page.evaluate(() => ({ main: document.querySelector('main')!.scrollTop, window: window.scrollY }))
}

test('a sheet holds the page still, and closing it frees the page and returns focus to the tapped opener', async ({ page }) => {
    await openCapDetail(page)
    const opener = page.getByRole('button', { name: 'Compare Run' })
    await opener.scrollIntoViewIfNeeded()
    await settleLayout(page)
    const before = await scrollPositions(page)

    await opener.tap()
    await page.getByRole('heading', { name: /^Compare run/ }).waitFor()
    await settleLayout(page)
    expect(await scrollPositions(page), 'opening the sheet moved nothing').toEqual(before)

    const moves = await swipeScroll(page, 2000)
    await settleLayout(page)
    expect(moves.filter(move => move.path === 'main' || move.path === 'window'), 'a swipe over the sheet scrolls neither the shell nor the window').toEqual([])
    expect(await scrollPositions(page)).toEqual(before)

    const { closed, notes } = await closeModal(page, MODAL_ROOT)
    expect(closed, notes.join('; ')).toBe(true)
    await expect(opener).toBeFocused()
    expect(await scrollPositions(page), 'closing the sheet moved nothing').toEqual(before)

    const freed = await swipeScroll(page, 300, 'page')
    expect(freed.map(move => move.path), 'the shell scroller takes a swipe again').toEqual(['main'])
})

test('a sheet opened by a tapped button inside a sheet returns focus to that button, and then to the first opener', async ({ page }) => {
    await page.addInitScript(rival => {
        localStorage.setItem('utbt:patreon:v1', JSON.stringify({ tiers: { [rival]: 2 }, fetchedAtIso: new Date().toISOString() }))
    }, RIVAL_USER_ID)
    await openCapDetail(page)
    const opener = page.getByRole('button', { name: 'Compare Run' })
    await opener.tap()
    const picker = page.locator(MODAL_ROOT).filter({ has: page.getByRole('heading', { name: /^Compare run/ }) })
    await picker.getByRole('button', { name: PATRON_BADGE, exact: true }).waitFor()
    await picker.evaluate((backdrop, badgeName) => {
        const badge = backdrop.querySelector<HTMLElement>(`[aria-label="${badgeName}"]`)!
        const button = document.createElement('button')
        button.type = 'button'
        button.textContent = 'Support this rival'
        button.addEventListener('click', event => {
            event.stopPropagation()
            badge.click()
        })
        badge.closest('[role="button"]:not([aria-label])')!.before(button)
    }, PATRON_BADGE)
    await settleLayout(page)

    const nestedOpener = picker.getByRole('button', { name: 'Support this rival' })
    await nestedOpener.tap()
    const support = page.locator(MODAL_ROOT).filter({ has: page.getByRole('heading', { name: 'Support UTBT', exact: true }) })
    await support.waitFor()
    await settleLayout(page)
    await support.getByRole('button', { name: 'Close modal' }).tap()
    await expect(support).toHaveCount(0)
    await expect(nestedOpener, 'focus goes back to the button inside the first sheet, not to its panel').toBeFocused()

    const { closed, notes } = await closeModal(page, MODAL_ROOT)
    expect(closed, notes.join('; ')).toBe(true)
    await expect(opener).toBeFocused()
})
