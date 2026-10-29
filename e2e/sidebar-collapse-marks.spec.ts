import { expect, test, type Locator, type Page } from '@playwright/test'
import { mockApi, preseedCollapsedRail, railTiles, sidebarRail, sidebarToggle } from './sidebarRail'

const AUTH_KEY = 'utbt:webAuth:v1'
const CUP_SLUG = '2v2-cup-2026'
const TEAM_ID = 'team-1'
const MARK_RING_PX = 2
const CUP_LIVE_DAY = new Date(2026, 10, 20, 12, 0)
const VIEWPORTS = [
    { width: 1280, height: 900 },
    { width: 1024, height: 720 },
]

interface Box {
    left: number
    top: number
    right: number
    bottom: number
}

function railLink(page: Page, name: string | RegExp): Locator {
    return sidebarRail(page).getByRole('navigation').getByRole('link', { name })
}

function cupTile(page: Page): Locator {
    return railLink(page, /2v2 World Cup 2026/)
}

async function signInWithRailBadges(page: Page, cupMatchesToSchedule = 1) {
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
    await page.route(/https:\/\/api\.utbt\.net\/(users\/me|v2\/summary\/badges|launcher\/activity\/latest|me\/schedule|me\/tournaments)\/?(\?.*)?$/, async route => {
        const path = new URL(route.request().url()).pathname.replace(/\/$/, '')
        if (path === '/users/me') {
            await route.fulfill({ json: { success: true, data: { id: '100', alias: 'Tester', utbt_role: 0 } } })
            return
        }
        if (path === '/launcher/activity/latest') {
            await route.fulfill({ status: 404, json: { success: false } })
            return
        }
        if (path === '/me/schedule') {
            await route.fulfill({
                json: {
                    success: true,
                    data: {
                        items: Array.from({ length: cupMatchesToSchedule }, (_, index) => ({
                            tournament: { id: 'cup', slug: CUP_SLUG, name: '2v2 World Cup 2026' },
                            match: { id: `match-${index + 1}`, team_a: { id: TEAM_ID, name: 'Testers' }, team_b: { id: 'team-2', name: 'Rivals' } },
                            slot_window: null,
                            schedulable: true,
                            reason: null,
                            whose_turn: null,
                            proposal: null,
                        })),
                    },
                },
            })
            return
        }
        if (path === '/me/tournaments') {
            await route.fulfill({
                json: {
                    success: true,
                    data: {
                        items: [{
                            tournament: { id: 'cup', slug: CUP_SLUG, name: '2v2 World Cup 2026' },
                            team: { id: TEAM_ID, name: 'Testers' },
                            membership_status: 'active',
                            pick_ban_session: { match_id: 'match-1', status: 'lobby' },
                        }],
                    },
                },
            })
            return
        }
        await route.fulfill({
            json: {
                success: true,
                data: {
                    sections: { maps: { count: 3 }, world_records: { count: 120 }, events: { count: 0 }, news: { count: 0 } },
                    seen: { maps: null, world_records: null, events: null, news: null },
                    as_of: '2026-10-29T12:00:00Z',
                },
            },
        })
    })
}

async function boxOf(locator: Locator, inflateBy = 0): Promise<Box> {
    const bounds = await locator.boundingBox()
    if (!bounds) throw new Error('element has no bounding box')
    return {
        left: bounds.x - inflateBy,
        top: bounds.y - inflateBy,
        right: bounds.x + bounds.width + inflateBy,
        bottom: bounds.y + bounds.height + inflateBy,
    }
}

function centre(box: Box) {
    return { x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2 }
}

function intersects(a: Box, b: Box): boolean {
    return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
}

async function expectTidyMarks(tile: Locator) {
    const tileBox = await boxOf(tile)
    const iconCentre = centre(await boxOf(tile.locator('svg').first()))
    const captionElement = tile.getByTestId('rail-caption')
    const caption = await captionElement.textContent() ?? ''
    const captionBox = await boxOf(captionElement)
    const marks = await tile.locator('[data-testid^="rail-mark-"]').all()
    expect(marks.length).toBeGreaterThan(0)

    const boxes: Box[] = []
    for (const mark of marks) {
        const kind = await mark.getAttribute('data-testid')
        const markBox = await boxOf(mark, MARK_RING_PX)
        const label = `${caption} ${kind}`
        expect(markBox.left, label).toBeGreaterThanOrEqual(tileBox.left)
        expect(markBox.top, label).toBeGreaterThanOrEqual(tileBox.top)
        expect(markBox.right, label).toBeLessThanOrEqual(tileBox.right)
        expect(markBox.bottom, label).toBeLessThanOrEqual(tileBox.bottom)
        expect(intersects(markBox, captionBox), `${label} clears the caption`).toBe(false)

        const markCentre = centre(markBox)
        const left = kind === 'rail-mark-live'
        const up = kind !== 'rail-mark-lobby'
        expect(markCentre.x < iconCentre.x, `${label} is on the ${left ? 'left' : 'right'}`).toBe(left)
        expect(markCentre.y < iconCentre.y, `${label} is ${up ? 'above' : 'below'} the icon centre`).toBe(up)

        for (const other of boxes) expect(intersects(markBox, other), `${label} clears the other marks`).toBe(false)
        boxes.push(markBox)
    }
}

async function expectEveryTileTidy(page: Page, cupCount = '1') {
    await expect(railLink(page, /^Maps\b/).getByTestId('rail-mark-count')).toHaveText('3')
    await expect(railLink(page, /World Records/).getByTestId('rail-mark-count')).toHaveText('99+')
    await expect(cupTile(page).getByTestId('rail-mark-count')).toHaveText(cupCount)
    await expect(cupTile(page).getByTestId('rail-mark-live')).toBeVisible()
    await expect(cupTile(page).getByTestId('rail-mark-lobby')).toBeVisible()

    for (const tile of await railTiles(page).all()) {
        if (await tile.locator('[data-testid^="rail-mark-"]').count() === 0) continue
        await expectTidyMarks(tile)
    }
}

test.beforeEach(async ({ page, isMobile }) => {
    test.skip(isMobile, 'the collapsed rail only exists at desktop widths')
    await page.clock.setFixedTime(CUP_LIVE_DAY)
    await mockApi(page)
    await preseedCollapsedRail(page)
})

for (const viewport of VIEWPORTS) {
    test(`every rail mark keeps its own corner inside its tile at ${viewport.width}x${viewport.height}`, async ({ page }) => {
        await signInWithRailBadges(page)
        await page.setViewportSize(viewport)
        await page.goto('/')
        await expect(sidebarToggle(page)).toHaveAccessibleName('Expand sidebar')

        await expectEveryTileTidy(page)

        await cupTile(page).hover()
        await expectTidyMarks(cupTile(page))
    })

    test(`the active cup tile keeps its marks tidy at ${viewport.width}x${viewport.height}`, async ({ page }) => {
        await signInWithRailBadges(page)
        await page.setViewportSize(viewport)
        await page.goto('/')
        await expect(sidebarToggle(page)).toHaveAccessibleName('Expand sidebar')

        await cupTile(page).click()
        await expect(page).toHaveURL(new RegExp(`/events/${CUP_SLUG}$`))
        await page.mouse.move(viewport.width - 10, viewport.height - 10)

        await expectEveryTileTidy(page)
    })
}

for (const { count, shown } of [{ count: 88, shown: '88' }, { count: 120, shown: '99+' }]) {
    for (const viewport of VIEWPORTS) {
        test(`a ${shown} count on a live cup keeps clear of the Live dot at ${viewport.width}x${viewport.height}`, async ({ page }) => {
            await signInWithRailBadges(page, count)
            await page.setViewportSize(viewport)
            await page.goto('/')
            await expect(sidebarToggle(page)).toHaveAccessibleName('Expand sidebar')

            await expectEveryTileTidy(page, shown)
        })
    }
}

test('rail tiles stay at least 44px tall with single-line captions when marked', async ({ page }) => {
    await signInWithRailBadges(page)
    await page.setViewportSize({ width: 1024, height: 720 })
    await page.goto('/')
    await expect(cupTile(page).getByTestId('rail-mark-live')).toBeVisible()

    for (const tile of await railTiles(page).all()) {
        const tileBox = await boxOf(tile)
        expect(tileBox.bottom - tileBox.top).toBeGreaterThanOrEqual(44)
    }
    const caption = await boxOf(cupTile(page).getByTestId('rail-caption'))
    expect(caption.bottom - caption.top).toBeLessThan(16)
})
