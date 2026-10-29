import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { horizontalOverflow } from './layout'
import { mockApi, preseedCollapsedRail, sidebarRail, sidebarToggle } from './sidebarRail'

const AUTH_KEY = 'utbt:webAuth:v1'
const EXPIRED = 'Your session expired. Please log in again.'
const PLAYER_ID = '123456789012345678'
const PLAYER_NAME = 'Tester'
const TITLE = 'Speed Demon'

async function storeRejectedSession(page: Page) {
    await page.addInitScript(key => {
        if (sessionStorage.getItem('e2e:seeded')) return
        sessionStorage.setItem('e2e:seeded', '1')
        localStorage.setItem(key, JSON.stringify({
            discordId: '100',
            username: 'tester',
            avatar: '',
            accessToken: 'dead-token',
            refreshToken: 'refresh-token',
            expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
        }))
    }, AUTH_KEY)
    await page.route(/https:\/\/api\.utbt\.net\/(users\/me|launcher\/activity\/latest)\/?(\?.*)?$/, route =>
        route.fulfill({ status: 401, json: { success: false, reason: 'Invalid authentication for this endpoint.' } }))
    await page.route(/https:\/\/api\.utbt\.net\/auth\/discord\/refresh\/?(\?.*)?$/, route =>
        route.fulfill({ status: 400, json: { success: false, error: 'invalid_grant' } }))
}

async function signIn(page: Page) {
    await page.addInitScript(([authKey, playerId]) => {
        localStorage.setItem(authKey, JSON.stringify({
            discordId: '100',
            username: 'tester',
            avatar: '',
            accessToken: 'valid-token',
            refreshToken: 'refresh-token',
            expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
        }))
        localStorage.setItem('utbt:patreon:v1', JSON.stringify({ tiers: { [playerId]: 2 }, fetchedAtIso: new Date().toISOString() }))
    }, [AUTH_KEY, PLAYER_ID] as const)
    await page.route(/https:\/\/api\.utbt\.net\/users\/me\/?(\?.*)?$/, route => route.fulfill({
        json: {
            success: true,
            data: {
                id: PLAYER_ID,
                alias: PLAYER_NAME,
                utbt_role: 0,
                active_title: { id: '1', name: TITLE, color: '255,0,0', color_r: 255, color_g: 0, color_b: 0, rarity: 5 },
            },
        },
    }))
    await page.route(/https:\/\/api\.utbt\.net\/launcher\/activity\/latest\/?(\?.*)?$/, route =>
        route.fulfill({ status: 404, json: { success: false } }))
}

function profileTrigger(page: Page) {
    return sidebarRail(page).getByRole('button', { name: new RegExp(PLAYER_NAME) })
}

async function expectProfileHeader(page: Page) {
    const menu = page.getByRole('menu')
    await expect(menu).toBeVisible()
    await expect(menu.getByText(PLAYER_NAME, { exact: true })).toBeVisible()
    await expect(menu).toContainText('Tier 2 Patreon Supporter')
    await expect(menu.getByText(TITLE, { exact: true })).toHaveCSS('color', 'rgb(255, 0, 0)')
    await expect(menu.getByRole('menuitem', { name: 'Change Title' })).toBeVisible()
    await expect(menu.getByRole('menuitem', { name: 'Sign out' })).toBeVisible()

    const results = await new AxeBuilder({ page })
        .include('[role="menu"]')
        .disableRules(['color-contrast'])
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze()
    expect(results.violations.filter(v => ['critical', 'serious'].includes(v.impact ?? ''))).toEqual([])
    return menu
}

async function interceptDiscordLogin(page: Page) {
    const attempts: string[] = []
    await page.route(/https:\/\/discord\.com\/.*/, async route => {
        attempts.push(route.request().url())
        await route.fulfill({ status: 204 })
    })
    return attempts
}

function loginButton(page: Page) {
    return sidebarRail(page).getByRole('button', { name: 'Login with Discord' })
}

async function openCollapsed(page: Page) {
    await preseedCollapsedRail(page)
    await page.goto('/')
    await expect(sidebarToggle(page)).toHaveAccessibleName('Expand sidebar')
}

test.beforeEach(async ({ page, isMobile }) => {
    test.skip(isMobile, 'the rail only exists at desktop widths')
    await mockApi(page)
})

test('signed out on the collapsed rail, the Discord login is a square button inside the rail', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await openCollapsed(page)

    const button = loginButton(page)
    await expect(button).toBeVisible()
    await expect(button).toHaveAccessibleName('Login with Discord')

    const box = await button.boundingBox()
    const rail = await sidebarRail(page).boundingBox()
    expect(box).not.toBeNull()
    expect(rail).not.toBeNull()
    expect(Math.abs(box!.width - box!.height)).toBeLessThanOrEqual(1)
    expect(box!.x).toBeGreaterThanOrEqual(rail!.x)
    expect(box!.x + box!.width).toBeLessThanOrEqual(rail!.x + rail!.width)
    expect(box!.y + box!.height).toBeLessThanOrEqual(rail!.y + rail!.height)
})

test('a login error shows in a popover beside the collapsed Discord button and clears on the next click', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await storeRejectedSession(page)
    const attempts = await interceptDiscordLogin(page)
    await openCollapsed(page)

    const button = loginButton(page)
    const popover = page.getByRole('alert').filter({ hasText: EXPIRED })
    await expect(popover).toBeVisible()
    await expect(button).toHaveAccessibleDescription(EXPIRED)

    const buttonBox = await button.boundingBox()
    const popoverBox = await popover.boundingBox()
    const railRight = await sidebarRail(page).evaluate(rail => rail.getBoundingClientRect().right)
    expect(buttonBox).not.toBeNull()
    expect(popoverBox).not.toBeNull()
    expect(popoverBox!.x).toBeGreaterThanOrEqual(railRight)
    expect(popoverBox!.x - (buttonBox!.x + buttonBox!.width)).toBeLessThanOrEqual(40)
    expect(popoverBox!.y).toBeLessThan(buttonBox!.y + buttonBox!.height)
    expect(popoverBox!.y + popoverBox!.height).toBeGreaterThan(buttonBox!.y)
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)

    await button.click()
    await expect(popover).toHaveCount(0)
    await expect(page.getByText(EXPIRED)).toHaveCount(0)
    await expect.poll(() => attempts.length).toBeGreaterThan(0)
    await expect(button).toBeVisible()
})

test('the expanded sidebar keeps the full-width Discord button and its inline login error', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await storeRejectedSession(page)
    await page.goto('/')
    await expect(sidebarToggle(page)).toHaveAccessibleName('Collapse sidebar')

    const button = loginButton(page)
    await expect(button).toBeVisible()
    await expect(button).toContainText('Login with Discord')
    await expect(sidebarRail(page).getByText(EXPIRED)).toBeVisible()
    await expect(page.getByRole('alert').filter({ hasText: EXPIRED })).toHaveCount(0)

    const box = await button.boundingBox()
    expect(box!.width).toBeGreaterThan(box!.height * 3)
})

for (const withError of [false, true]) {
    test(`signed out on the collapsed rail at 1024px, nothing overflows${withError ? ' with a login error showing' : ''}`, async ({ page }) => {
        await page.setViewportSize({ width: 1024, height: 768 })
        if (withError) await storeRejectedSession(page)
        await openCollapsed(page)
        await expect(loginButton(page)).toBeVisible()
        if (withError) await expect(page.getByRole('alert').filter({ hasText: EXPIRED })).toBeVisible()

        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)
        expect(await sidebarRail(page).evaluate(rail => rail.scrollWidth - rail.clientWidth)).toBeLessThanOrEqual(0)
    })
}

test('the collapsed signed-out card keeps the expanded card height, so the toggle stays put', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto('/')
    const expanded = await loginButton(page).evaluate(button => button.closest('aside')!.lastElementChild!.getBoundingClientRect().height)

    await sidebarToggle(page).click()
    await expect(sidebarToggle(page)).toHaveAccessibleName('Expand sidebar')
    const collapsed = await loginButton(page).evaluate(button => button.closest('aside')!.lastElementChild!.getBoundingClientRect().height)

    expect(Math.abs(collapsed - expanded)).toBeLessThanOrEqual(1)
})

test.describe('signed in', () => {
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 900 })
        await signIn(page)
    })

    test('on the collapsed rail the avatar is a named, keyboard-reachable trigger whose menu opens to the right, bottom-aligned', async ({ page }) => {
        await openCollapsed(page)
        const trigger = profileTrigger(page)
        await expect(trigger).toBeVisible()
        await expect(trigger).toHaveAccessibleName(new RegExp(PLAYER_NAME))
        await expect(trigger.getByRole('img', { name: 'Avatar' })).toBeVisible()

        const railRight = await sidebarRail(page).evaluate(rail => rail.getBoundingClientRect().right)
        const triggerBox = await trigger.boundingBox()
        expect(triggerBox!.x + triggerBox!.width).toBeLessThanOrEqual(railRight)

        await trigger.focus()
        await expect(trigger).toBeFocused()
        await page.keyboard.press('Enter')
        const menu = await expectProfileHeader(page)

        await expect.poll(async () => (await menu.boundingBox())!.x).toBeGreaterThanOrEqual(railRight)
        const menuBox = await menu.boundingBox()
        expect(Math.abs(menuBox!.y + menuBox!.height - (triggerBox!.y + triggerBox!.height))).toBeLessThanOrEqual(8)
        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)
    })

    test('in the expanded sidebar the card and its menu keep their place above the card, with the same header', async ({ page }) => {
        await page.goto('/')
        await expect(sidebarToggle(page)).toHaveAccessibleName('Collapse sidebar')
        const card = sidebarRail(page).getByText(TITLE, { exact: true })
        await expect(card).toBeVisible()
        await expect(sidebarRail(page).getByText(PLAYER_NAME, { exact: true })).toBeVisible()

        await card.click()
        const menu = await expectProfileHeader(page)
        const cardBox = await card.boundingBox()
        await expect.poll(async () => { const box = (await menu.boundingBox())!; return box.y + box.height }).toBeLessThanOrEqual(cardBox!.y)
    })

    test('the collapsed card keeps the expanded card height and nothing overflows the rail', async ({ page }) => {
        await page.goto('/')
        const lastCard = () => sidebarRail(page).evaluate(rail => rail.lastElementChild!.getBoundingClientRect().height)
        await expect(sidebarRail(page).getByText(TITLE, { exact: true })).toBeVisible()
        const expanded = await lastCard()

        await sidebarToggle(page).click()
        await expect(sidebarToggle(page)).toHaveAccessibleName('Expand sidebar')
        await expect(profileTrigger(page)).toBeVisible()
        expect(Math.abs(await lastCard() - expanded)).toBeLessThanOrEqual(1)
        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)
        expect(await sidebarRail(page).evaluate(rail => rail.scrollWidth - rail.clientWidth)).toBeLessThanOrEqual(0)

        const results = await new AxeBuilder({ page })
            .include('aside#app-navigation')
            .disableRules(['color-contrast'])
            .withTags(['wcag2a', 'wcag2aa'])
            .analyze()
        expect(results.violations.filter(v => ['critical', 'serious'].includes(v.impact ?? ''))).toEqual([])
    })
})
