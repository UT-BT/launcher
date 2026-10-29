import { expect, test, type Locator, type Page } from '@playwright/test'
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

type Box = { x: number, y: number, width: number, height: number }

function boxesOverlap(a: Box, b: Box) {
    return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}

async function toggleLayout(page: Page) {
    const rail = sidebarRail(page)
    const box = async (locator: Locator) => {
        const found = await locator.boundingBox()
        if (!found) throw new Error('element has no bounding box')
        return found
    }
    const actionLocators = await rail.getByRole('link', { name: /Join Server/ }).all()
    return {
        rail: await box(rail),
        toggle: await box(sidebarToggle(page)),
        logo: await box(rail.getByRole('img', { name: 'UTBT Logo' })),
        actions: await Promise.all(actionLocators.map(box)),
    }
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

    for (const { width, height } of [{ width: 1280, height: 900 }, { width: 1024, height: 720 }]) {
        test(`the toggle sits in the sidebar's top-left corner at the same position in both modes at ${width}x${height}`, async ({ page }) => {
            await page.setViewportSize({ width, height })
            await page.goto('/')
            await expect(sidebarToggle(page)).toHaveAccessibleName('Collapse sidebar')
            const expanded = await toggleLayout(page)

            await sidebarToggle(page).click()
            await expect(sidebarToggle(page)).toHaveAccessibleName('Expand sidebar')
            await expect.poll(() => railWidth(page)).toBeLessThanOrEqual(81)
            const collapsed = await toggleLayout(page)

            expect(Math.abs(collapsed.toggle.x - expanded.toggle.x)).toBeLessThanOrEqual(1)
            expect(Math.abs(collapsed.toggle.y - expanded.toggle.y)).toBeLessThanOrEqual(1)
            expect(Math.abs(collapsed.toggle.width - expanded.toggle.width)).toBeLessThanOrEqual(1)
            expect(Math.abs(collapsed.toggle.height - expanded.toggle.height)).toBeLessThanOrEqual(1)

            for (const layout of [expanded, collapsed]) {
                expect(Math.abs(layout.toggle.x + layout.toggle.width / 2 - layout.rail.x - 40)).toBeLessThanOrEqual(1)
                expect(layout.toggle.y - layout.rail.y).toBeGreaterThanOrEqual(0)
                expect(layout.toggle.y - layout.rail.y).toBeLessThanOrEqual(24)
                expect(boxesOverlap(layout.toggle, layout.logo)).toBe(false)
                expect(layout.actions.length).toBeGreaterThan(0)
                for (const action of layout.actions) expect(boxesOverlap(layout.toggle, action)).toBe(false)
            }
            expect(collapsed.toggle.y + collapsed.toggle.height).toBeLessThanOrEqual(collapsed.logo.y)
        })
    }

    test('the toggle is a small icon-only button that keeps its names, state and right-side Ctrl+B tooltip in both modes', async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 900 })
        await page.goto('/')
        const toggle = sidebarToggle(page)

        for (const { name, expanded } of [{ name: 'Collapse sidebar', expanded: 'true' }, { name: 'Expand sidebar', expanded: 'false' }]) {
            await expect(toggle).toHaveAccessibleName(name)
            await expect(toggle).toHaveAttribute('aria-expanded', expanded)
            await expect(toggle).toHaveAttribute('aria-controls', 'app-navigation')
            expect((await toggle.innerText()).trim()).toBe('')
            const box = (await toggle.boundingBox())!
            expect(box.width).toBeLessThanOrEqual(40)
            expect(Math.abs(box.width - box.height)).toBeLessThanOrEqual(1)

            await toggle.hover()
            const tooltip = page.getByText(`${name} (Ctrl+B)`, { exact: true })
            await expect(tooltip).toBeVisible()
            await expect.poll(async () => (await tooltip.boundingBox())!.x).toBeGreaterThanOrEqual(box.x + box.width)
            const tooltipBox = (await tooltip.boundingBox())!
            expect(tooltipBox.y).toBeLessThan(box.y + box.height)
            expect(tooltipBox.y + tooltipBox.height).toBeGreaterThan(box.y)

            await toggle.click()
        }
    })

    test('the toggle is the first control in the sidebar', async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 900 })
        for (const mode of MODES) {
            await openInMode(page, mode)
            const first = await sidebarRail(page).evaluate(rail => rail.querySelector<HTMLElement>('button, a[href]')?.getAttribute('aria-label'))
            expect(first).toBe(mode === 'collapsed' ? 'Expand sidebar' : 'Collapse sidebar')
        }
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
    await expect(sidebarRail(page).locator('button[aria-controls="app-navigation"]')).toHaveCount(0)
    expect(await storedPreference(page)).toBe('true')
})
