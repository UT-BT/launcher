import { expect, test, type Locator, type Page } from '@playwright/test'
import { serveFixtureSet } from './mobile/fixtures/router'
import { capDetail, capDetailRivals } from './mobile/manifest/cap-detail'
import { settleLayout } from './mobile/settle'

const RIVALS = capDetailRivals()
const RIVAL = { capId: RIVALS[0].id, userId: RIVALS[0].user }
const FIRST_RIVAL_ALIAS = RIVALS[0].alias
const SLOWEST_RIVAL_CAP_ID = RIVALS.at(-1)!.id
const PATRON_BADGE = 'Tier 2 Patreon Supporter'

interface Point {
    x: number
    y: number
}

async function openCapPage(page: Page, query = '') {
    await page.addInitScript(rival => {
        localStorage.setItem('utbt:analyticsConsent:v1', 'denied')
        localStorage.setItem('utbt:patreon:v1', JSON.stringify({ tiers: { [rival]: 2 }, fetchedAtIso: new Date().toISOString() }))
    }, RIVAL.userId)
    await serveFixtureSet(page, capDetail.fixtures)
    await page.goto(`${capDetail.path}${query}`)
    await capDetail.ready(page)
    await settleLayout(page)
}

function compareRunButton(page: Page): Locator {
    return page.getByRole('button', { name: 'Compare Run' })
}

function picker(page: Page): Locator {
    return page.locator('[data-modal-backdrop] > div').filter({ has: page.getByRole('heading', { name: /^Compare run/ }) })
}

function supportModal(page: Page): Locator {
    return page.locator('[data-modal-backdrop] > div').filter({ has: page.getByRole('heading', { name: 'Support UTBT', exact: true }) })
}

function playableRows(dialog: Locator): Locator {
    return dialog.locator('[role="button"][aria-disabled="false"]')
}

async function waitForPickerRows(page: Page) {
    await expect(playableRows(picker(page)).filter({ hasText: FIRST_RIVAL_ALIAS })).toBeVisible()
}

function overlayField(page: Page, label: string): Locator {
    return page.getByRole('region', { name: 'Mobile diagnostics' })
        .locator('div')
        .filter({ has: page.getByRole('term').getByText(label, { exact: true }) })
        .getByRole('definition')
}

async function shellTop(page: Page): Promise<number> {
    return page.getByRole('main').evaluate(main => main.scrollTop)
}

async function scrollShellTo(page: Page, top: number) {
    await page.getByRole('main').evaluate((main, y) => main.scrollTo({ top: y, behavior: 'instant' }), top)
    await settleLayout(page)
}

async function shellRoom(page: Page): Promise<number> {
    return page.getByRole('main').evaluate(main => main.scrollHeight - main.clientHeight)
}

async function windowScroll(page: Page): Promise<Point> {
    return page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }))
}

async function centreOf(locator: Locator): Promise<Point> {
    const box = await locator.boundingBox()
    if (!box) throw new Error('element has no bounding box')
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

async function countWheels(page: Page) {
    await page.evaluate(() => {
        const counter = window as unknown as { __wheels: number }
        counter.__wheels = 0
        window.addEventListener('wheel', () => { counter.__wheels += 1 }, { capture: true, passive: true })
    })
}

async function wheelAt(page: Page, point: Point, deltaY: number) {
    const delivered = await page.evaluate(() => (window as unknown as { __wheels: number }).__wheels)
    await page.mouse.move(point.x, point.y)
    await page.mouse.wheel(0, deltaY)
    await page.waitForFunction(count => (window as unknown as { __wheels: number }).__wheels > count, delivered)
    await settleLayout(page)
}

async function swipeAt(page: Page, point: Point, deltaY: number) {
    const height = page.viewportSize()!.height
    const endY = Math.min(height - 5, Math.max(5, point.y - deltaY))
    const steps = 10
    const held = 10
    const start = Date.now() / 1000
    const frame = (index: number) => start + index * 0.016
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point], timestamp: frame(0) })
    for (let step = 1; step <= steps + held; step += 1) {
        const y = point.y + (endY - point.y) * Math.min(step, steps) / steps
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: point.x, y }], timestamp: frame(step) })
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [], timestamp: frame(steps + held + 1) })
    await cdp.detach()
    await settleLayout(page)
}

async function scrollGesturesAt(page: Page, point: Point, deltaY: number, isMobile: boolean) {
    await wheelAt(page, point, deltaY)
    if (isMobile) await swipeAt(page, point, deltaY)
}

async function expectShellScrollsUnder(page: Page, point: Point, isMobile: boolean) {
    await scrollShellTo(page, 0)
    if (isMobile) await swipeAt(page, point, 300)
    else await wheelAt(page, point, 300)
    await expect.poll(() => shellTop(page), 'the shell scroller follows the gesture once no modal is open').toBeGreaterThan(50)
}

async function activate(target: Locator, isMobile: boolean) {
    if (isMobile) await target.tap()
    else await target.click()
}

test.describe('scroll lock', () => {
    test('wheel and touch scrolling over an open modal leave the shell scroller where it was', async ({ page, isMobile }) => {
        await openCapPage(page)
        await countWheels(page)
        expect(await shellRoom(page), 'the page is long enough to scroll').toBeGreaterThan(400)
        await scrollShellTo(page, 200)
        const contentPoint = await centreOf(page.getByRole('main'))

        await activate(compareRunButton(page), isMobile)
        await waitForPickerRows(page)
        const before = await shellTop(page)

        const panel = picker(page)
        await scrollGesturesAt(page, await centreOf(panel), 600, isMobile)
        await scrollGesturesAt(page, await centreOf(panel), -600, isMobile)
        const heading = await centreOf(panel.getByRole('heading', { name: /^Compare run/ }))
        await scrollGesturesAt(page, heading, 600, isMobile)
        await scrollGesturesAt(page, heading, -600, isMobile)
        if (!isMobile) {
            const size = page.viewportSize()!
            await scrollGesturesAt(page, { x: size.width - 8, y: size.height - 8 }, 600, isMobile)
        }

        expect(await shellTop(page), 'the shell scroller did not move').toBe(before)
        expect(await windowScroll(page), 'the window did not scroll').toEqual({ x: 0, y: 0 })

        await activate(panel.getByRole('button', { name: 'Close modal' }), isMobile)
        await expect(panel).toHaveCount(0)
        await expectShellScrollsUnder(page, contentPoint, isMobile)
    })

    test('stacked modals share one lock: it holds until the last one closes, and the overlay shows the count', async ({ page, isMobile }) => {
        await openCapPage(page, '?debug=mobile')
        await countWheels(page)
        await expect(overlayField(page, 'Scroll locks')).toHaveText('0')

        await compareRunButton(page).focus()
        await page.keyboard.press('Enter')
        await waitForPickerRows(page)
        await expect(overlayField(page, 'Scroll locks')).toHaveText('1')

        const badge = picker(page).getByRole('button', { name: PATRON_BADGE, exact: true })
        await badge.focus()
        await page.keyboard.press('Enter')
        await expect(supportModal(page)).toBeVisible()
        await expect(overlayField(page, 'Scroll locks')).toHaveText('2')

        await page.keyboard.press('Escape')
        await expect(supportModal(page)).toHaveCount(0)
        await expect(picker(page)).toBeVisible()
        await expect(overlayField(page, 'Scroll locks')).toHaveText('1')
        const before = await shellTop(page)
        await scrollGesturesAt(page, await centreOf(picker(page)), 600, isMobile)
        expect(await shellTop(page), 'the page behind the remaining modal stays still').toBe(before)

        await page.keyboard.press('Escape')
        await expect(picker(page)).toHaveCount(0)
        await expect(overlayField(page, 'Scroll locks')).toHaveText('0')

        await page.getByRole('region', { name: 'Mobile diagnostics' }).getByRole('button', { name: 'Close' }).click()
        await expectShellScrollsUnder(page, await centreOf(page.getByRole('main')), isMobile)
    })

    test('a route change while a modal is open frees the page', async ({ page, isMobile }) => {
        await openCapPage(page, '?debug=mobile')
        await countWheels(page)

        await compareRunButton(page).focus()
        await page.keyboard.press('Enter')
        await waitForPickerRows(page)
        await expect(overlayField(page, 'Scroll locks')).toHaveText('1')

        await page.evaluate(capId => window.dispatchEvent(new CustomEvent('open-cap', { detail: { capId } })), RIVAL.capId)
        await expect(page).toHaveURL(new RegExp(`/caps/${RIVAL.capId}$`))
        await capDetail.ready(page)
        await expect(picker(page)).toHaveCount(0)
        await expect(overlayField(page, 'Scroll locks')).toHaveText('0')

        await page.getByRole('region', { name: 'Mobile diagnostics' }).getByRole('button', { name: 'Close' }).click()
        await settleLayout(page)
        await expectShellScrollsUnder(page, await centreOf(page.getByRole('main')), isMobile)
    })
})

test.describe('focus', () => {
    test('closing a modal returns focus to the control that opened it', async ({ page, isMobile }) => {
        await openCapPage(page)

        await activate(compareRunButton(page), isMobile)
        await waitForPickerRows(page)
        await activate(picker(page).getByRole('button', { name: 'Close modal' }), isMobile)

        await expect(picker(page)).toHaveCount(0)
        await expect(compareRunButton(page)).toBeFocused()
    })

    test('a modal opened from a modal returns focus inside the first one, which then returns it to its own opener', async ({ page }) => {
        await openCapPage(page)

        await compareRunButton(page).focus()
        await page.keyboard.press('Enter')
        await waitForPickerRows(page)
        const badge = picker(page).getByRole('button', { name: PATRON_BADGE, exact: true })
        await badge.focus()
        await page.keyboard.press('Enter')
        await expect(supportModal(page)).toBeVisible()
        await expect(supportModal(page).getByRole('button', { name: 'Close modal' })).toBeFocused()

        await page.keyboard.press('Escape')
        await expect(supportModal(page)).toHaveCount(0)
        await expect(badge).toBeFocused()

        await page.keyboard.press('Escape')
        await expect(picker(page)).toHaveCount(0)
        await expect(compareRunButton(page)).toBeFocused()
    })

    test('content added after opening joins the focus trap', async ({ page }) => {
        let releaseLeaderboard: () => void = () => undefined
        const leaderboardHeld = new Promise<void>(resolve => { releaseLeaderboard = resolve })
        await openCapPage(page)
        await page.route(/\/caps\/leaderboard\/map\//, async route => {
            await leaderboardHeld
            await route.fallback()
        })

        await compareRunButton(page).focus()
        await page.keyboard.press('Enter')
        const dialog = picker(page)
        await expect(dialog.getByText('Loading leaderboard…')).toBeVisible()
        const close = dialog.getByRole('button', { name: 'Close modal' })
        await expect(close).toBeFocused()

        releaseLeaderboard()
        await waitForPickerRows(page)
        const rows = playableRows(dialog)
        await expect(rows).toHaveCount(RIVALS.length)

        await page.keyboard.press('Tab')
        await expect(rows.first()).toBeFocused()

        const stops: string[] = []
        for (let step = 0; step < 12; step += 1) {
            await page.keyboard.press('Tab')
            stops.push(await page.evaluate(() => {
                const active = document.activeElement
                const panel = [...document.querySelectorAll('[data-modal-backdrop]')].at(-1)?.firstElementChild
                if (!active || !panel?.contains(active)) return `outside: ${active?.tagName ?? 'none'}`
                return active.getAttribute('aria-label') ?? active.textContent?.trim().slice(0, 20) ?? active.tagName
            }))
        }
        expect(stops.filter(stop => stop.startsWith('outside')), 'Tab never leaves the modal').toEqual([])
        expect(stops, 'Tab wraps back to the close button').toContain('Close modal')

        await close.focus()
        await page.keyboard.press('Shift+Tab')
        await expect(rows.last()).toBeFocused()
    })

    test('Tab from a clicked row that is not a tab stop wraps inside the modal', async ({ page }) => {
        await openCapPage(page)
        await page.route(new RegExp(`/replays/${SLOWEST_RIVAL_CAP_ID}$`), route => route.fulfill({ status: 404, json: {} }))

        await compareRunButton(page).focus()
        await page.keyboard.press('Enter')
        await waitForPickerRows(page)
        const unplayable = picker(page).locator('[role="button"][aria-disabled="true"]')
        await expect(unplayable).toHaveCount(1)

        const row = await centreOf(unplayable)
        await page.mouse.click(row.x, row.y)
        await expect(unplayable).toBeFocused()
        await page.keyboard.press('Tab')
        await expect(picker(page).getByRole('button', { name: 'Close modal' })).toBeFocused()
    })

    test('opening a modal leaves the window at 0 and the page where it was', async ({ page }) => {
        await openCapPage(page)
        await scrollShellTo(page, 200)

        await compareRunButton(page).evaluate(button => (button as HTMLElement).focus({ preventScroll: true }))
        await page.keyboard.press('Enter')
        await waitForPickerRows(page)
        await expect(picker(page).getByRole('button', { name: 'Close modal' })).toBeFocused()
        await settleLayout(page)

        expect(await windowScroll(page)).toEqual({ x: 0, y: 0 })
        expect(await shellTop(page)).toBe(200)
    })

    test('returning focus to an opener the page has scrolled half out of view does not scroll the page', async ({ page }) => {
        await openCapPage(page)
        const opener = compareRunButton(page)
        const clipped = await page.getByRole('main').evaluate((main, button) => {
            const mainTop = main.getBoundingClientRect().top
            const box = button!.getBoundingClientRect()
            return Math.round(main.scrollTop + box.top - mainTop + box.height / 2)
        }, await opener.elementHandle())
        await scrollShellTo(page, clipped)
        expect(await shellTop(page)).toBe(clipped)

        await opener.evaluate(button => (button as HTMLElement).focus({ preventScroll: true }))
        await page.keyboard.press('Enter')
        await waitForPickerRows(page)
        await page.keyboard.press('Escape')
        await expect(picker(page)).toHaveCount(0)

        await expect(opener).toBeFocused()
        await settleLayout(page)
        expect(await shellTop(page), 'the page did not jump to reveal the opener').toBe(clipped)
        expect(await windowScroll(page)).toEqual({ x: 0, y: 0 })
    })
})
