import { expect, test, type Page } from '@playwright/test'

const SLUG = 'guard-cup'
const EVENT_NAME = 'Guard Cup 2026'

const EVENT = {
    id: 'event-guard',
    slug: SLUG,
    name: EVENT_NAME,
    summary: 'A cup for checking unsaved work on browser Back.',
    description: null,
    rules: null,
    team_size: 2,
    bracket_type: 'groups',
    status: 'active',
    signups_open: false,
    signup_opens_at: null,
    signup_closes_at: null,
    starts_at: null,
    ends_at: null,
    max_teams: 8,
    team_count: 0,
    registered_team_count: 0,
    created_at: null,
    published_at: null,
    predictions_enabled: false,
}

const BRACKET = { published: false, format: { template: null, spec: null }, stages: [] }

async function mockApi(page: Page) {
    await page.addInitScript(() => {
        localStorage.setItem('utbt:analyticsConsent:v1', 'denied')
        localStorage.setItem('utbt:webAuth:v1', JSON.stringify({
            discordId: '555555555555',
            username: 'rin',
            avatar: '',
            accessToken: 'guard-token',
            refreshToken: 'guard-refresh',
            expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        }))
    })

    await page.route(/https:\/\/(api|gateway)\.utbt\.net\/.*/, async route => {
        const url = new URL(route.request().url())
        if (url.hostname === 'gateway.utbt.net') {
            await route.fulfill({ json: [] })
            return
        }
        const path = url.pathname.replace(/\/$/, '')
        const reply = (data: unknown) => route.fulfill({ json: { success: true, data } })

        if (path === '/users/me') return reply({ id: '555555555555', alias: 'Rin' })
        if (path === '/user_state') return reply({ state: {}, seen: {}, updated_at: null })
        if (path === '/launcher/activity/latest') {
            await route.fulfill({ status: 404, json: { success: false, error: 'Not found' } })
            return
        }
        if (path === '/tournaments') return reply({ items: [EVENT] })
        if (path === `/tournaments/${SLUG}`) return reply({ tournament: EVENT })
        if (path === `/tournaments/${SLUG}/me`) {
            return reply({
                team: null, invitations: [], lfp: null, volunteer: null, pick_ban_session: null,
                can_manage: true, can_manage_bracket: true, is_streamer: false,
            })
        }
        if (path === `/tournaments/${SLUG}/bracket`) return reply(BRACKET)
        if (path === `/tournaments/${SLUG}/pick-ban/config`) return reply({ stages: [] })
        if (path.startsWith('/tournaments/')) return reply({ items: [] })
        if (path === '/v2/summary') {
            return reply({ global: { newMaps: 0, newRecords: 0 }, achievements: [], recentWorldRecords: [], newMaps: [], latestPatch: null })
        }
        return reply(path.endsWith('/count') ? { count: 0 } : [])
    })
}

const eventCard = (page: Page) => page.getByRole('link', { name: new RegExp(EVENT_NAME) })
const eventHeading = (page: Page) => page.getByRole('heading', { name: EVENT_NAME })
const leaveConfirm = (page: Page) => page.getByRole('heading', { name: 'Leave without saving?' })
const unsavedNotice = (page: Page) => page.getByText('Unsaved changes.')
const historyLength = (page: Page) => page.evaluate(() => window.history.length)

async function openEventFromList(page: Page) {
    await page.goto('/events')
    await eventCard(page).click()
    await expect(page).toHaveURL(`/events/${SLUG}`)
    await expect(eventHeading(page)).toBeVisible()
}

async function editFormat(page: Page) {
    await page.getByRole('button', { name: 'Manage', exact: true }).click()
    await page.getByRole('button', { name: 'Format', exact: true }).click()
    await page.getByRole('button', { name: /Tournament format/ }).click()
    await page.getByRole('button', { name: 'Add stage' }).click()
    await expect(unsavedNotice(page)).toBeVisible()
}

test('browser Back from unsaved work asks first: No keeps the page and its URL, Leave goes back', async ({ page }) => {
    await mockApi(page)
    await openEventFromList(page)
    await editFormat(page)
    const entries = await historyLength(page)

    await page.goBack()
    await expect(leaveConfirm(page)).toBeVisible()
    await expect(page).toHaveURL(`/events/${SLUG}`)

    await page.getByRole('button', { name: 'No', exact: true }).click()
    await expect(leaveConfirm(page)).toHaveCount(0)
    await expect(page).toHaveURL(`/events/${SLUG}`)
    await expect(unsavedNotice(page)).toBeVisible()
    expect(await historyLength(page)).toBe(entries)

    await page.goBack()
    await expect(leaveConfirm(page)).toBeVisible()
    await page.getByRole('button', { name: 'Leave', exact: true }).click()
    await expect(leaveConfirm(page)).toHaveCount(0)
    await expect(page).toHaveURL('/events')
    await expect(eventCard(page)).toBeVisible()
    expect(await historyLength(page)).toBe(entries)

    await page.goForward()
    await expect(page).toHaveURL(`/events/${SLUG}`)
    await expect(eventHeading(page)).toBeVisible()
    await expect(unsavedNotice(page)).toHaveCount(0)
    await expect(leaveConfirm(page)).toHaveCount(0)
})

test('browser Forward from unsaved work asks first the same way', async ({ page }) => {
    await mockApi(page)
    await openEventFromList(page)
    await page.getByRole('button', { name: 'All events' }).click()
    await expect(page).toHaveURL('/events')
    await page.goBack()
    await expect(page).toHaveURL(`/events/${SLUG}`)
    await editFormat(page)

    await page.goForward()
    await expect(leaveConfirm(page)).toBeVisible()
    await expect(page).toHaveURL(`/events/${SLUG}`)
    await page.getByRole('button', { name: 'No', exact: true }).click()
    await expect(unsavedNotice(page)).toBeVisible()
    await expect(page).toHaveURL(`/events/${SLUG}`)

    await page.goForward()
    await expect(leaveConfirm(page)).toBeVisible()
    await page.getByRole('button', { name: 'Leave', exact: true }).click()
    await expect(page).toHaveURL('/events')
    await expect(eventCard(page)).toBeVisible()
})

test('a jump several entries back is put back whole and replayed on Leave', async ({ page }) => {
    await mockApi(page)
    await openEventFromList(page)
    await page.getByRole('button', { name: 'All events' }).click()
    await expect(page).toHaveURL('/events')
    await eventCard(page).click()
    await expect(page).toHaveURL(`/events/${SLUG}`)
    await editFormat(page)
    const entries = await historyLength(page)

    await page.evaluate(() => window.history.go(-3))
    await expect(leaveConfirm(page)).toBeVisible()
    await expect(page).toHaveURL(`/events/${SLUG}`)
    await page.getByRole('button', { name: 'Leave', exact: true }).click()
    await expect(page).toHaveURL('/events')
    await expect(eventCard(page)).toBeVisible()
    expect(await historyLength(page)).toBe(entries)

    await page.goForward()
    await expect(page).toHaveURL(`/events/${SLUG}`)
    await expect(eventHeading(page)).toBeVisible()
})

test('with nothing unsaved, browser Back and Forward move at once', async ({ page }) => {
    await mockApi(page)
    await openEventFromList(page)

    await page.goBack()
    await expect(page).toHaveURL('/events')
    await expect(eventCard(page)).toBeVisible()
    await expect(leaveConfirm(page)).toHaveCount(0)

    await page.goForward()
    await expect(page).toHaveURL(`/events/${SLUG}`)
    await expect(eventHeading(page)).toBeVisible()
    await expect(leaveConfirm(page)).toHaveCount(0)
})
