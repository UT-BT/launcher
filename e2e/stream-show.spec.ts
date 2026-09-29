import { expect, test, type Page } from '@playwright/test'
import { horizontalOverflow } from './layout'

const SLUG = 'show-cup'
const VIEWER = { id: '555555555555', alias: 'Rin' }
const ANNA = { id: '333333333333', display_name: 'Anna Announces', avatar: '' }
const BEN = { id: '444444444444', display_name: 'Ben Booms', avatar: '' }

const EVENT = {
    id: 'event-1',
    slug: SLUG,
    name: 'Show Cup 2026',
    summary: 'A cup for checking the show controls.',
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

interface Caster {
    user: string | null
    name: string | null
}

interface Server {
    brb: string | null
    webcam: boolean
    casters: Caster[]
    hasMatch: boolean
    failNextWrite: boolean
    writes: { method: string; path: string; body: unknown }[]
}

function casterView(caster: Caster) {
    if (caster.user) {
        const volunteer = [ANNA, BEN].find(person => person.id === caster.user)
        return { id: caster.user, display_name: volunteer?.display_name ?? null, avatar: '' }
    }
    return { id: null, display_name: caster.name, avatar: null }
}

function deskPayload(streamerId: string, server: Server) {
    return {
        server_now: new Date().toISOString().replace('Z', '+00:00'),
        event: { name: EVENT.name, slug: SLUG },
        streamer: { id: streamerId, display_name: 'Streamer', channel: null },
        desk: { brb_message: server.brb, webcam_enabled: server.webcam, current_match_id: null },
        reason: server.hasMatch ? 'next' : 'none',
        match: server.hasMatch ? { id: 'm1', reason: 'next', casters: server.casters.map(casterView) } : null,
        assigned_matches: [],
        next_match: null,
    }
}

async function mockApi(page: Page): Promise<Server> {
    const server: Server = { brb: null, webcam: false, casters: [], hasMatch: true, failNextWrite: false, writes: [] }

    await page.addInitScript(() => {
        localStorage.setItem('utbt:analyticsConsent:v1', 'denied')
        localStorage.setItem('utbt:webAuth:v1', JSON.stringify({
            discordId: '555555555555',
            username: 'rin',
            avatar: '',
            accessToken: 'show-token',
            refreshToken: 'show-refresh',
            expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        }))
    })

    await page.route(/https:\/\/(api|gateway)\.utbt\.net\/.*/, async route => {
        const request = route.request()
        const url = new URL(request.url())
        if (url.hostname === 'gateway.utbt.net') {
            await route.fulfill({ json: [] })
            return
        }
        const path = url.pathname.replace(/\/$/, '')
        const method = request.method()
        const desk = path.match(new RegExp(`^/tournaments/${SLUG}/stream/(\\d+)/desk(/brb|/webcam)?$`))
        const casters = path.match(new RegExp(`^/tournaments/${SLUG}/stream/matches/([^/]+)/casters$`))

        if (desk && method === 'GET' && !desk[2]) {
            await route.fulfill({ json: { success: true, data: deskPayload(desk[1], server) } })
            return
        }

        if ((desk?.[2] || casters) && method === 'PUT') {
            server.writes.push({ method, path, body: request.postDataJSON() })
            if (server.failNextWrite) {
                server.failNextWrite = false
                await route.fulfill({ status: 422, json: { success: false, error: 'Field message is too long.', code: 'invalid_request' } })
                return
            }
            const body = request.postDataJSON()
            if (desk?.[2] === '/brb') {
                server.brb = body.message
                await route.fulfill({ json: { success: true, data: { desk: { brb_message: server.brb } } } })
            } else if (desk?.[2] === '/webcam') {
                server.webcam = body.enabled
                await route.fulfill({ json: { success: true, data: { desk: { webcam_enabled: server.webcam } } } })
            } else {
                server.casters = body.casters.map((entry: { user?: string; name?: string }) => ({ user: entry.user ?? null, name: entry.name ?? null }))
                await route.fulfill({ json: { success: true, data: { casters: server.casters } } })
            }
            return
        }

        if (path === `/tournaments/${SLUG}/stream/casting-volunteers`) {
            await route.fulfill({ json: { success: true, data: { volunteers: [ANNA, BEN] } } })
            return
        }
        if (path === '/users/me') {
            await route.fulfill({ json: { success: true, data: VIEWER } })
            return
        }
        if (path === '/user_state') {
            await route.fulfill({ json: { success: true, data: { state: {}, seen: {}, updated_at: null } } })
            return
        }
        if (path === '/launcher/activity/latest') {
            await route.fulfill({ status: 404, json: { success: false, error: 'Not found' } })
            return
        }
        if (path === `/tournaments/${SLUG}`) {
            await route.fulfill({ json: { success: true, data: { tournament: EVENT } } })
            return
        }
        if (path === `/tournaments/${SLUG}/me`) {
            await route.fulfill({
                json: {
                    success: true,
                    data: { team: null, invitations: [], lfp: null, volunteer: null, pick_ban_session: null, is_streamer: true },
                },
            })
            return
        }
        if (path === `/tournaments/${SLUG}/bracket`) {
            await route.fulfill({ json: { success: true, data: { published: false, format: { template: null, spec: null }, stages: [] } } })
            return
        }
        if (path === `/tournaments/${SLUG}/pick-ban/config`) {
            await route.fulfill({ json: { success: true, data: { stages: [] } } })
            return
        }
        if (path === `/tournaments/${SLUG}/teams` || path === `/tournaments/${SLUG}/lfp` || path === `/tournaments/${SLUG}/me/matches`) {
            await route.fulfill({ json: { success: true, data: { items: [] } } })
            return
        }
        if (path === '/v2/summary') {
            await route.fulfill({
                json: {
                    success: true,
                    data: { global: { newMaps: 0, newRecords: 0 }, achievements: [], recentWorldRecords: [], newMaps: [], latestPatch: null },
                },
            })
            return
        }
        await route.fulfill({ json: { success: true, data: [] } })
    })

    return server
}

async function openShow(page: Page) {
    await page.goto(`/events/${SLUG}?tab=stream`)
    await page.getByRole('navigation', { name: 'Stream panels' }).getByRole('button', { name: 'Show' }).click()
    await expect(page.getByRole('region', { name: 'BRB message' })).toBeVisible()
}

const brb = (page: Page) => page.getByRole('region', { name: 'BRB message' })
const casters = (page: Page) => page.getByRole('region', { name: 'Casters' })
const webcam = (page: Page) => page.getByRole('region', { name: 'Webcam frame' })

test('the BRB message shows its current value, saves trimmed, and clears', async ({ page }) => {
    const server = await mockApi(page)
    server.brb = 'Back soon'
    await openShow(page)

    const field = brb(page).getByLabel('Message')
    await expect(field).toHaveValue('Back soon')
    await expect(brb(page).getByRole('button', { name: 'Save message' })).toBeDisabled()

    await field.fill('  Fixing the lobby  ')
    await brb(page).getByRole('button', { name: 'Save message' }).click()
    await expect(brb(page).getByRole('button', { name: 'Save message' })).toBeDisabled()
    await expect(field).toHaveValue('Fixing the lobby')
    expect(server.writes[0]).toEqual({ method: 'PUT', path: `/tournaments/${SLUG}/stream/${VIEWER.id}/desk/brb`, body: { message: 'Fixing the lobby' } })

    await brb(page).getByRole('button', { name: 'Clear message' }).click()
    await expect(field).toHaveValue('')
    await expect(brb(page).getByRole('button', { name: 'Clear message' })).toHaveCount(0)
    expect(server.writes[1].body).toEqual({ message: null })
})

test('a rejected BRB message shows the error and keeps what was typed', async ({ page }) => {
    const server = await mockApi(page)
    await openShow(page)
    server.failNextWrite = true

    await brb(page).getByLabel('Message').fill('Too long')
    await brb(page).getByRole('button', { name: 'Save message' }).click()

    await expect(brb(page).getByRole('alert')).toHaveText('Field message is too long.')
    await expect(brb(page).getByLabel('Message')).toHaveValue('Too long')
    expect(server.brb).toBeNull()
})

test('the webcam toggle writes and reflects the server value', async ({ page }) => {
    const server = await mockApi(page)
    await openShow(page)

    const toggle = webcam(page).getByRole('switch', { name: 'Show a webcam frame' })
    await expect(toggle).toHaveAttribute('aria-checked', 'false')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-checked', 'true')
    expect(server.writes[0]).toEqual({ method: 'PUT', path: `/tournaments/${SLUG}/stream/${VIEWER.id}/desk/webcam`, body: { enabled: true } })

    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-checked', 'false')
    expect(server.writes[1].body).toEqual({ enabled: false })
})

test('casters can be picked from the volunteers or typed, then reordered and removed', async ({ page }) => {
    const server = await mockApi(page)
    await openShow(page)
    const section = casters(page)

    await expect(section.getByText('No casters named for this match.')).toBeVisible()
    await section.getByLabel('Casting volunteer').selectOption(ANNA.id)
    await section.getByRole('button', { name: 'Add volunteer' }).click()
    await expect(section.getByRole('list', { name: 'Casters' }).getByText(ANNA.display_name)).toBeVisible()
    expect(server.writes[0]).toEqual({ method: 'PUT', path: `/tournaments/${SLUG}/stream/matches/m1/casters`, body: { casters: [{ user: ANNA.id }] } })
    await expect(section.getByLabel('Casting volunteer').locator('option', { hasText: ANNA.display_name })).toHaveCount(0)

    await section.getByLabel('Or type a name').fill('  Guest Caster ')
    await section.getByRole('button', { name: 'Add name' }).click()
    const rows = section.getByRole('list', { name: 'Casters' }).getByRole('listitem')
    await expect(rows).toHaveCount(2)
    await expect(rows.nth(1)).toContainText('Guest Caster')
    expect(server.writes[1].body).toEqual({ casters: [{ user: ANNA.id }, { name: 'Guest Caster' }] })

    await section.getByRole('button', { name: 'Move Guest Caster up' }).click()
    await expect(rows.nth(0)).toContainText('Guest Caster')
    expect(server.writes[2].body).toEqual({ casters: [{ name: 'Guest Caster' }, { user: ANNA.id }] })

    await section.getByRole('button', { name: `Remove ${ANNA.display_name}` }).click()
    await expect(rows).toHaveCount(1)
    expect(server.writes[3].body).toEqual({ casters: [{ name: 'Guest Caster' }] })
})

test('the caster list stops at the cap', async ({ page }) => {
    const server = await mockApi(page)
    server.casters = [1, 2, 3, 4].map(index => ({ user: null, name: `Guest ${index}` }))
    await openShow(page)

    await expect(casters(page).getByText(/Up to 4 casters/)).toBeVisible()
    await expect(casters(page).getByLabel('Or type a name')).toHaveCount(0)
})

test('casters wait for a match on the scenes', async ({ page }) => {
    const server = await mockApi(page)
    server.hasMatch = false
    await openShow(page)

    await expect(casters(page).getByText(/Casters are set per match/)).toBeVisible()
    await expect(casters(page).getByRole('button', { name: 'Add name' })).toHaveCount(0)
})

test('a change made elsewhere shows within about 2 s', async ({ page }) => {
    const server = await mockApi(page)
    await openShow(page)

    server.brb = 'Set from another browser'
    server.webcam = true

    await expect(brb(page).getByLabel('Message')).toHaveValue('Set from another browser', { timeout: 2_600 })
    await expect(webcam(page).getByRole('switch')).toHaveAttribute('aria-checked', 'true')
})

for (const viewport of [{ width: 390, height: 844 }, { width: 1920, height: 1080 }]) {
    test(`the show controls fit ${viewport.width} px`, async ({ page }) => {
        await page.setViewportSize(viewport)
        const server = await mockApi(page)
        server.brb = 'A long pause message that keeps going so the field has to cope with plenty of text in it'
        server.casters = [{ user: ANNA.id, name: null }, { user: null, name: 'A guest caster with a rather long name' }]
        await openShow(page)

        await expect(casters(page).getByRole('list', { name: 'Casters' }).getByRole('listitem')).toHaveCount(2)
        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)

        for (const button of [
            casters(page).getByRole('button', { name: `Remove ${ANNA.display_name}` }),
            brb(page).getByRole('button', { name: 'Clear message' }),
            webcam(page).getByRole('switch'),
        ]) {
            const box = await button.boundingBox()
            expect(box?.height ?? 0).toBeGreaterThanOrEqual(viewport.width === 390 ? 36 : 32)
        }
    })
}
