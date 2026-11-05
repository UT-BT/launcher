import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { horizontalOverflow } from './layout'
import { mockApi } from './sidebarRail'

const HALLOWEEN_NIGHT = new Date(2026, 9, 31, 20, 0)
const SOUTHERN_AUTUMN = new Date(2026, 3, 20, 12, 0)
const SEASONS_CSS = readFileSync(resolve(__dirname, '../app/styles/seasons.css'), 'utf8')

function declared(css: string, selector: string, name: string): string {
    const block = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find(match => match[1].trim() === selector)!
    return block[2].match(new RegExp(String.raw`(?:^|[\s;])${name}\s*:\s*([^;]+);`))![1].trim()
}

async function resolvedColor(page: Page, value: string): Promise<string> {
    return page.evaluate(color => {
        const probe = document.createElement('div')
        probe.style.backgroundColor = color
        document.body.append(probe)
        const resolved = getComputedStyle(probe).backgroundColor
        probe.remove()
        return resolved
    }, value)
}

async function saveTheme(page: Page, themeId: string) {
    await page.addInitScript(id => localStorage.setItem('utbt:theme:v1', JSON.stringify({ id })), themeId)
}

async function openAppearance(page: Page) {
    await expect(page.locator('aside#app-navigation')).toBeAttached()
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('open-settings')))
    await page.getByRole('button', { name: 'Appearance', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Appearance' })).toBeVisible()
}

function themeCard(page: Page, label: string) {
    return page.getByRole('button', { name: new RegExp(`^${label}`) })
}

function hemisphereControl(page: Page) {
    return page.getByRole('group', { name: 'Hemisphere' })
}

test.beforeEach(async ({ page }) => {
    await mockApi(page)
})

test('the Seasonal card carries the New badge', async ({ page }) => {
    await page.goto('/')
    await openAppearance(page)
    await expect(themeCard(page, 'Seasonal').getByText('New', { exact: true })).toBeVisible()
    await expect(themeCard(page, 'UTBT Blue').getByText('New', { exact: true })).toHaveCount(0)
})

test('the hemisphere control shows only while Seasonal is the saved theme', async ({ page }) => {
    await page.goto('/')
    await openAppearance(page)
    await expect(hemisphereControl(page)).toHaveCount(0)
    await themeCard(page, 'Seasonal').click()
    await expect(hemisphereControl(page)).toBeVisible()
    await themeCard(page, 'UTBT Red').click()
    await expect(hemisphereControl(page)).toHaveCount(0)
})

test.describe('in Sydney', () => {
    test.use({ timezoneId: 'Australia/Sydney' })

    test('Auto names the detected hemisphere, and Northern persists across a reload', async ({ page }) => {
        await saveTheme(page, 'seasonal')
        await page.goto('/')
        await openAppearance(page)
        const auto = hemisphereControl(page).getByRole('button', { name: 'Auto (Southern)' })
        await expect(auto).toHaveAttribute('aria-pressed', 'true')
        await hemisphereControl(page).getByRole('button', { name: 'Northern' }).click()
        await expect(hemisphereControl(page).getByRole('button', { name: 'Northern' })).toHaveAttribute('aria-pressed', 'true')
        await expect.poll(() => page.evaluate(() => localStorage.getItem('utbt:hemisphere:v1'))).toBe('"north"')

        await page.reload()
        await openAppearance(page)
        await expect(hemisphereControl(page).getByRole('button', { name: 'Northern' })).toHaveAttribute('aria-pressed', 'true')
        await expect(hemisphereControl(page).getByRole('button', { name: 'Auto (Southern)' })).toHaveAttribute('aria-pressed', 'false')
    })

    test('in April the card names the southern autumn and shows its accent', async ({ page }) => {
        await page.addInitScript(() => localStorage.removeItem('utbt:seasonPin:v1'))
        await saveTheme(page, 'seasonal')
        await page.clock.setFixedTime(SOUTHERN_AUTUMN)
        await page.goto('/')
        await expect(page.locator('html')).toHaveAttribute('data-season', 'autumn')
        await openAppearance(page)
        const card = themeCard(page, 'Seasonal')
        await expect(card).toContainText('Now: Autumn · Southern hemisphere')
        const expected = await resolvedColor(page, declared(SEASONS_CSS, ":root[data-theme='seasonal'][data-season='autumn']", '--accent-500'))
        await expect(card.locator('span').first()).toHaveCSS('background-color', expected)
    })
})

for (const theme of ['classic', 'seasonal']) {
    test(`during Halloween the card names it and shows its accent on ${theme}`, async ({ page }) => {
        await page.addInitScript(() => localStorage.removeItem('utbt:seasonPin:v1'))
        await saveTheme(page, theme)
        await page.clock.setFixedTime(HALLOWEEN_NIGHT)
        await page.goto('/')
        await openAppearance(page)
        const card = themeCard(page, 'Seasonal')
        await expect(card).toContainText('Now: Halloween')
        const expected = await resolvedColor(page, declared(SEASONS_CSS, ":root[data-theme='seasonal'][data-season='halloween']", '--accent-500'))
        await expect(card.locator('span').first()).toHaveCSS('background-color', expected)
    })
}

test.describe('at 360 px', () => {
    test.use({ viewport: { width: 360, height: 780 } })

    test('the card and the hemisphere control fit with 44 px targets', async ({ page }) => {
        await saveTheme(page, 'seasonal')
        await page.goto('/')
        await openAppearance(page)
        await expect(hemisphereControl(page)).toBeVisible()
        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)
        for (const option of await hemisphereControl(page).getByRole('button').all()) {
            const box = (await option.boundingBox())!
            expect(box.height).toBeGreaterThanOrEqual(44)
            expect(box.width).toBeGreaterThanOrEqual(44)
        }
        const card = (await themeCard(page, 'Seasonal').boundingBox())!
        expect(card.x + card.width).toBeLessThanOrEqual(360)
    })
})

test.describe('at 360 px in Sydney in April', () => {
    test.use({ viewport: { width: 360, height: 780 }, timezoneId: 'Australia/Sydney' })

    test('the card names the season without overflowing the page', async ({ page }) => {
        await page.addInitScript(() => localStorage.removeItem('utbt:seasonPin:v1'))
        await saveTheme(page, 'seasonal')
        await page.clock.setFixedTime(SOUTHERN_AUTUMN)
        await page.goto('/')
        await openAppearance(page)
        await expect(themeCard(page, 'Seasonal').getByText('Now: Autumn · Southern hemisphere', { exact: true })).toBeVisible()
        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)
        const card = (await themeCard(page, 'Seasonal').boundingBox())!
        expect(card.x + card.width).toBeLessThanOrEqual(360)
    })
})
