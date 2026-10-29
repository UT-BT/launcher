import { expect, test, type Locator, type Page } from '@playwright/test'
import { mockApi, preseedCollapsedRail, railTiles, sidebarRail, sidebarToggle } from './sidebarRail'

const AUTH_KEY = 'utbt:webAuth:v1'
const MAPS_BADGE_LINE = '3 new since your last visit'

function floatingLayer(page: Page): Locator {
    return page.locator('body > div:not(#app)')
}

function tooltipWith(page: Page, text: string): Locator {
    return floatingLayer(page).filter({ hasText: text })
}

function tooltipLines(tooltip: Locator): Locator {
    return tooltip.locator(':scope > span > span')
}

function railLink(page: Page, name: string | RegExp): Locator {
    return sidebarRail(page).getByRole('navigation').getByRole('link', { name })
}

async function openCollapsed(page: Page) {
    await preseedCollapsedRail(page)
    await page.goto('/')
    await expect(sidebarToggle(page)).toHaveAccessibleName('Expand sidebar')
}

async function openExpanded(page: Page) {
    await page.goto('/')
    await expect(sidebarToggle(page)).toHaveAccessibleName('Collapse sidebar')
}

async function signInWithMapsBadge(page: Page) {
    await page.addInitScript(key => {
        localStorage.setItem(key, JSON.stringify({
            discordId: '100',
            username: 'tester',
            avatar: '',
            accessToken: 'token',
            refreshToken: 'refresh-token',
            expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
        }))
    }, AUTH_KEY)
    await page.route(/https:\/\/api\.utbt\.net\/(users\/me|v2\/summary\/badges|launcher\/activity\/latest)\/?(\?.*)?$/, async route => {
        const path = new URL(route.request().url()).pathname.replace(/\/$/, '')
        if (path === '/users/me') {
            await route.fulfill({ json: { success: true, data: { id: '100', alias: 'Tester', utbt_role: 0 } } })
            return
        }
        if (path === '/launcher/activity/latest') {
            await route.fulfill({ status: 404, json: { success: false } })
            return
        }
        await route.fulfill({
            json: {
                success: true,
                data: {
                    sections: { maps: { count: 3 }, world_records: { count: 0 }, events: { count: 0 }, news: { count: 0 } },
                    seen: { maps: null, world_records: null, events: null, news: null },
                    as_of: '2026-10-29T12:00:00Z',
                },
            },
        })
    })
}

async function box(locator: Locator) {
    const bounds = await locator.boundingBox()
    if (!bounds) throw new Error('element has no bounding box')
    return bounds
}

async function expectBesideRail(page: Page, tooltip: Locator, tile: Locator) {
    const railRight = await sidebarRail(page).evaluate(rail => rail.getBoundingClientRect().right)
    const tip = await box(tooltip)
    const anchor = await box(tile)
    expect(tip.x).toBeGreaterThanOrEqual(railRight)
    expect(Math.abs((tip.y + tip.height / 2) - (anchor.y + anchor.height / 2))).toBeLessThanOrEqual(2)
}

test.beforeEach(async ({ page, isMobile }) => {
    test.skip(isMobile, 'the collapsed rail only exists at desktop widths')
    await mockApi(page)
    await page.setViewportSize({ width: 1280, height: 900 })
})

test('focusing a rail item by keyboard shows its full label to the right of the rail', async ({ page }) => {
    await openCollapsed(page)
    const tiles = railTiles(page)
    const records = railLink(page, /World Records/)
    const names = await tiles.evaluateAll(links => links.map(link => link.textContent ?? ''))
    const index = names.findIndex(name => name.includes('World Records'))
    expect(index).toBeGreaterThan(0)

    await tiles.nth(index - 1).focus()
    await page.keyboard.press('Tab')
    await expect(records).toBeFocused()

    const tooltip = tooltipWith(page, 'World Records')
    await expect(tooltip).toHaveCount(1)
    await expect(tooltip).toBeVisible()
    await expect(tooltipLines(tooltip).first()).toHaveText('World Records')
    await expectBesideRail(page, tooltip, records)

    await page.keyboard.press('Tab')
    await expect(tooltip).toHaveCount(0)
})

test('hovering a rail item shows the same tooltip', async ({ page }) => {
    await openCollapsed(page)
    const records = railLink(page, /World Records/)
    await records.hover()

    const tooltip = tooltipWith(page, 'World Records')
    await expect(tooltip).toHaveCount(1)
    await expect(tooltipLines(tooltip)).toHaveText(['World Records'])
    await expectBesideRail(page, tooltip, records)

    await page.mouse.move(900, 450)
    await expect(tooltip).toHaveCount(0)
})

test('World Records captions as Records and its tooltip says World Records', async ({ page }) => {
    await openCollapsed(page)
    const records = railLink(page, /World Records/)
    await expect(records).toHaveAccessibleName(/^Records\b/)
    await records.hover()
    await expect(tooltipLines(tooltipWith(page, 'World Records'))).toHaveText(['World Records'])
})

test('a live cup link shows its full event name and Live in the tooltip and keeps Live in its name', async ({ page }) => {
    await page.clock.setFixedTime(new Date(2026, 10, 20, 12, 0))
    await openCollapsed(page)
    const cup = railLink(page, /2v2 World Cup 2026/)
    await expect(cup).toHaveAccessibleName(/^2v2 Cup\b.*2v2 World Cup 2026.*\bLive$/)
    await expect(cup).toHaveAttribute('href', '/events/2v2-cup-2026')

    await cup.hover()
    const tooltip = tooltipWith(page, '2v2 World Cup 2026')
    await expect(tooltipLines(tooltip)).toHaveText(['2v2 Cup', '2v2 World Cup 2026', 'Live'])
    await expectBesideRail(page, tooltip, cup)
})

test('a live cup link shows a dot before its caption that the finished event does not', async ({ page }) => {
    await page.clock.setFixedTime(new Date(2026, 10, 20, 12, 0))
    await openCollapsed(page)
    const caption = railLink(page, /2v2 World Cup 2026/).getByText('2v2 Cup', { exact: true })
    const liveCaption = await box(caption)
    const tile = await box(railLink(page, /2v2 World Cup 2026/))
    const centredWhenLive = Math.abs((liveCaption.x + liveCaption.width / 2) - (tile.x + tile.width / 2))

    await page.clock.setFixedTime(new Date(2026, 11, 1, 12, 0))
    await page.reload()
    await expect(sidebarToggle(page)).toHaveAccessibleName('Expand sidebar')
    const finishedCaption = await box(caption)
    expect(liveCaption.x - finishedCaption.x).toBeGreaterThanOrEqual(4)
    expect(Math.abs((finishedCaption.x + finishedCaption.width / 2) - (tile.x + tile.width / 2))).toBeLessThan(centredWhenLive)
})

test('a finished cup link drops Live from its tooltip and its name', async ({ page }) => {
    await page.clock.setFixedTime(new Date(2026, 11, 1, 12, 0))
    await openCollapsed(page)
    const cup = railLink(page, /2v2 World Cup 2026/)
    await expect(cup).not.toHaveAccessibleName(/Live/)

    await cup.hover()
    await expect(tooltipLines(tooltipWith(page, '2v2 World Cup 2026'))).toHaveText(['2v2 Cup', '2v2 World Cup 2026'])
})

test('a badged rail item lists its badge details in its only tooltip', async ({ page }) => {
    await signInWithMapsBadge(page)
    await openCollapsed(page)
    const maps = railLink(page, /^Maps\b/)
    await expect(maps).toHaveAccessibleName(new RegExp(MAPS_BADGE_LINE))

    await maps.locator('svg').first().hover()
    const tooltip = tooltipWith(page, MAPS_BADGE_LINE)
    await expect(tooltip).toHaveCount(1)
    await expect(tooltipLines(tooltip)).toHaveText(['Maps', MAPS_BADGE_LINE])
    await expectBesideRail(page, tooltip, maps)
})

test('in expanded mode the badge tooltip still opens on top and labels get no tooltip', async ({ page }) => {
    await signInWithMapsBadge(page)
    await openExpanded(page)
    const maps = railLink(page, /^Maps\b/)
    await expect(maps).toHaveAccessibleName(new RegExp(MAPS_BADGE_LINE))

    const icon = maps.locator('svg').first()
    await icon.hover()
    const tooltip = tooltipWith(page, MAPS_BADGE_LINE)
    await expect(tooltip).toHaveCount(1)
    await expect(tooltip).toHaveText(MAPS_BADGE_LINE)
    const tip = await box(tooltip)
    const glyph = await box(icon)
    expect(tip.y + tip.height).toBeLessThanOrEqual(glyph.y)

    await railLink(page, /World Records/).hover()
    await expect(tooltip).toHaveCount(0)
    await expect(tooltipWith(page, 'World Records')).toHaveCount(0)
})

test('the tooltip wrapper keeps the rail tile a full-width link', async ({ page }) => {
    await openCollapsed(page)
    const records = railLink(page, /World Records/)
    const href = await records.getAttribute('href')
    expect(href).toBeTruthy()
    const navWidth = await sidebarRail(page).getByRole('navigation').evaluate(nav => nav.clientWidth)
    const tile = await box(records)
    expect(tile.width).toBeGreaterThanOrEqual(navWidth - 16)

    await records.click({ position: { x: tile.width - 2, y: tile.height / 2 } })
    await expect(page).toHaveURL(new RegExp(`${href}$`))
})
