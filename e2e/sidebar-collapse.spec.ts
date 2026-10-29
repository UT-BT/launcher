import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { horizontalOverflow } from './layout'
import {
    SIDEBAR_COLLAPSED_KEY,
    centreX,
    contentAreaCentreX,
    mockApi,
    overflowingRailText,
    preseedCollapsedRail,
    railTiles,
    railWidth,
    sidebarRail,
    sidebarToggle,
} from './sidebarRail'

const MODES = ['expanded', 'collapsed'] as const
type Mode = typeof MODES[number]

async function openSidebarOffsetDialog(page: Page) {
    await expect(sidebarRail(page)).toBeAttached()
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('open-patreon')))
    const panel = page.locator('[data-modal-backdrop] > div').filter({ has: page.getByRole('heading', { name: 'Support UTBT' }) })
    await expect(panel).toBeVisible()
    return panel
}

async function openInMode(page: Page, mode: Mode, path = '/') {
    if (mode === 'collapsed') await preseedCollapsedRail(page)
    await page.goto(path)
    await expect(sidebarToggle(page)).toHaveAccessibleName(mode === 'collapsed' ? 'Expand sidebar' : 'Collapse sidebar')
}

async function storedPreference(page: Page) {
    return page.evaluate(key => localStorage.getItem(key), SIDEBAR_COLLAPSED_KEY)
}

test.beforeEach(async ({ page }) => {
    await mockApi(page)
})

for (const mode of MODES) {
    for (const width of [1024, 1920]) {
        test(`a sidebar-offset dialog is centred beside the ${mode} sidebar at ${width}px`, async ({ page, isMobile }) => {
            test.skip(isMobile, 'the sidebar only takes space at desktop widths')
            await page.setViewportSize({ width, height: 900 })
            await openInMode(page, mode)
            const railRight = await sidebarRail(page).evaluate(rail => rail.getBoundingClientRect().right)
            expect(railRight).toBeGreaterThan(mode === 'collapsed' ? 70 : 200)

            const panel = await openSidebarOffsetDialog(page)
            const contentCentre = await contentAreaCentreX(page)
            await expect.poll(async () => Math.abs(await centreX(panel) - contentCentre)).toBeLessThanOrEqual(1)
        })
    }
}

test('a sidebar-offset dialog is centred over the full viewport at 390px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')

    const panel = await openSidebarOffsetDialog(page)
    const viewportCentre = await page.evaluate(() => document.documentElement.clientWidth / 2)
    await expect.poll(async () => Math.abs(await centreX(panel) - viewportCentre)).toBeLessThanOrEqual(1)
})

test.describe('the collapsible rail', () => {
    test.beforeEach(({ isMobile }) => {
        test.skip(isMobile, 'the rail only exists at desktop widths')
    })

    test('starts expanded, collapses to a captioned rail with the toggle and expands again', async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 900 })
        await page.goto('/')
        const toggle = sidebarToggle(page)
        const worldRecords = sidebarRail(page).getByRole('link', { name: 'World Records' })

        await expect(toggle).toHaveAccessibleName('Collapse sidebar')
        await expect(toggle).toHaveAttribute('aria-expanded', 'true')
        await expect(worldRecords.getByText('World Records', { exact: true })).toBeVisible()
        expect(await railWidth(page)).toBeGreaterThan(200)
        expect(await storedPreference(page)).toBeNull()

        await toggle.click()
        await expect(toggle).toHaveAccessibleName('Expand sidebar')
        await expect(toggle).toHaveAttribute('aria-expanded', 'false')
        await expect.poll(() => railWidth(page)).toBeLessThanOrEqual(81)
        await expect(worldRecords.getByText('Records', { exact: true })).toBeVisible()
        await expect(sidebarRail(page).getByRole('link', { name: 'Maps' }).getByText('Maps', { exact: true })).toBeVisible()

        await toggle.click()
        await expect(toggle).toHaveAccessibleName('Collapse sidebar')
        await expect.poll(() => railWidth(page)).toBeGreaterThan(200)
        await expect(worldRecords.getByText('World Records', { exact: true })).toBeVisible()
    })

    test('remembers the collapsed rail across a reload', async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 900 })
        await page.goto('/')
        await sidebarToggle(page).click()
        await expect(sidebarToggle(page)).toHaveAccessibleName('Expand sidebar')

        await page.reload()
        await expect(sidebarToggle(page)).toHaveAccessibleName('Expand sidebar')
        expect(await railWidth(page)).toBeLessThanOrEqual(81)
    })

    test('a stored collapsed preference paints the rail collapsed from the first frame', async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 900 })
        await preseedCollapsedRail(page)
        await page.addInitScript(() => {
            const widths: number[] = []
            Object.assign(window, { railWidths: widths })
            const sample = () => {
                const rail = document.querySelector('aside#app-navigation')
                if (rail) widths.push(rail.getBoundingClientRect().width)
                if (widths.length < 20) requestAnimationFrame(sample)
            }
            requestAnimationFrame(sample)
        })
        await page.goto('/')
        await expect(sidebarToggle(page)).toHaveAccessibleName('Expand sidebar')

        await expect.poll(() => page.evaluate(() => (window as unknown as { railWidths: number[] }).railWidths.length)).toBeGreaterThan(0)
        const widths = await page.evaluate(() => (window as unknown as { railWidths: number[] }).railWidths)
        expect(Math.max(...widths)).toBeLessThanOrEqual(81)
    })

    test('an unreadable stored preference falls back to the expanded sidebar', async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 900 })
        await page.addInitScript(key => localStorage.setItem(key, 'collapsed'), SIDEBAR_COLLAPSED_KEY)
        await page.goto('/')
        await expect(sidebarToggle(page)).toHaveAccessibleName('Collapse sidebar')
        expect(await railWidth(page)).toBeGreaterThan(200)
    })

    test('Ctrl+B toggles the rail, but not while typing in a search box or with another modifier', async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 900 })
        await page.goto('/players')
        const toggle = sidebarToggle(page)
        const search = page.getByPlaceholder('Search for a player...')
        await expect(toggle).toHaveAccessibleName('Collapse sidebar')
        await expect(search).toBeVisible()

        await page.evaluate(() => window.addEventListener('keydown', event => {
            Object.assign(window, { lastKeyPrevented: event.defaultPrevented })
        }))
        await page.keyboard.press('Control+b')
        await expect(toggle).toHaveAccessibleName('Expand sidebar')
        expect(await page.evaluate(() => (window as unknown as { lastKeyPrevented: boolean }).lastKeyPrevented)).toBe(true)
        expect(await storedPreference(page)).toBe('true')
        await expect.poll(() => railWidth(page)).toBeLessThanOrEqual(81)

        await page.keyboard.press('Control+b')
        await expect(toggle).toHaveAccessibleName('Collapse sidebar')

        await page.keyboard.press('Control+Shift+b')
        await page.keyboard.press('Control+Alt+b')
        await expect(toggle).toHaveAccessibleName('Collapse sidebar')

        await search.fill('nov')
        await search.press('Control+b')
        await expect(toggle).toHaveAccessibleName('Collapse sidebar')
        await expect(search).toHaveValue('nov')
        expect(await railWidth(page)).toBeGreaterThan(200)
    })

    test('the toggle icon keeps its screen position in both modes', async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 900 })
        await page.goto('/')
        const icon = sidebarToggle(page).locator('svg')
        const expanded = await icon.boundingBox()

        await sidebarToggle(page).click()
        await expect(sidebarToggle(page)).toHaveAccessibleName('Expand sidebar')
        await expect.poll(() => railWidth(page)).toBeLessThanOrEqual(81)
        const collapsed = await icon.boundingBox()

        expect(expanded).not.toBeNull()
        expect(collapsed).not.toBeNull()
        expect(Math.abs(collapsed!.x - expanded!.x)).toBeLessThanOrEqual(1)
        expect(Math.abs(collapsed!.y - expanded!.y)).toBeLessThanOrEqual(1)
    })

    for (const { width, height } of [{ width: 1024, height: 900 }, { width: 1920, height: 1080 }, { width: 1024, height: 720 }]) {
        for (const mode of MODES) {
            test(`the ${mode} sidebar fits without horizontal overflow at ${width}x${height}`, async ({ page }) => {
                await page.setViewportSize({ width, height })
                await openInMode(page, mode)

                expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)
                expect(await sidebarRail(page).evaluate(rail => rail.scrollWidth - rail.clientWidth)).toBeLessThanOrEqual(0)
                if (mode === 'expanded') return

                expect(await railWidth(page)).toBeLessThanOrEqual(81)
                expect(await overflowingRailText(page)).toEqual([])
                const tiles = railTiles(page)
                const heights = await tiles.evaluateAll(links => links.map(link => link.getBoundingClientRect().height))
                expect(heights.length).toBeGreaterThan(10)
                for (const tileHeight of heights) expect(tileHeight).toBeGreaterThanOrEqual(44)

                const lastTile = tiles.last()
                await lastTile.scrollIntoViewIfNeeded()
                await expect(lastTile).toBeInViewport()
            })
        }
    }

    test('collapsed items keep their full names, real links and section structure for assistive tech', async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 900 })
        await openInMode(page, 'collapsed')
        const rail = sidebarRail(page)

        await expect(rail.getByRole('link', { name: 'World Records' })).toHaveAccessibleName(/^Records\b.*\bWorld Records\b/)
        await expect(rail.getByRole('link', { name: 'World Records' })).toHaveAttribute('href', '/world-records')
        const cupLink = rail.getByRole('link', { name: '2v2 World Cup 2026' })
        await expect(cupLink).toHaveAccessibleName(/^2v2 Cup\b/)
        await expect(cupLink).toHaveAttribute('href', '/events/2v2-cup-2026')
        await expect(rail.getByRole('link', { name: 'Maps' })).toHaveAttribute('href', '/maps')

        for (const title of ['Main', 'UTBT.net', 'Leaderboards']) {
            const heading = rail.getByRole('heading', { name: title })
            await expect(heading).toHaveCount(1)
            expect((await heading.boundingBox())?.width ?? 0).toBeLessThanOrEqual(1)
        }

        await rail.getByRole('link', { name: 'Maps' }).click()
        await expect(page).toHaveURL(/\/maps$/)
        await expect(sidebarToggle(page)).toHaveAccessibleName('Expand sidebar')
    })

    test('the collapsed rail has no serious accessibility violations', async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 900 })
        await openInMode(page, 'collapsed')
        const results = await new AxeBuilder({ page })
            .include('aside#app-navigation')
            .disableRules(['color-contrast'])
            .withTags(['wcag2a', 'wcag2aa'])
            .analyze()
        expect(results.violations.filter(v => ['critical', 'serious'].includes(v.impact ?? ''))).toEqual([])
    })

    test('narrowing to a phone width shows the full drawer and widening restores the collapsed rail', async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 900 })
        await openInMode(page, 'collapsed')

        await page.setViewportSize({ width: 390, height: 844 })
        await page.getByRole('button', { name: 'Open navigation' }).click()
        const worldRecords = sidebarRail(page).getByRole('link', { name: 'World Records' })
        await expect(worldRecords.getByText('World Records', { exact: true })).toBeVisible()
        await expect(sidebarToggle(page)).toHaveCount(0)
        await page.keyboard.press('Escape')

        await page.setViewportSize({ width: 1280, height: 900 })
        await expect(sidebarToggle(page)).toHaveAccessibleName('Expand sidebar')
        await expect.poll(() => railWidth(page)).toBeLessThanOrEqual(81)
        expect(await storedPreference(page)).toBe('true')
    })
})

test('a phone keeps the full drawer, with no toggle or shortcut, whatever the stored preference', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await preseedCollapsedRail(page)
    await page.goto('/')

    await page.keyboard.press('Control+b')
    await page.getByRole('button', { name: 'Open navigation' }).click()
    const worldRecords = sidebarRail(page).getByRole('link', { name: 'World Records' })
    await expect(worldRecords.getByText('World Records', { exact: true })).toBeVisible()
    await expect(sidebarToggle(page)).toHaveCount(0)
    expect(await storedPreference(page)).toBe('true')
})
