import { expect, test, type Page } from '@playwright/test'
import { horizontalOverflow } from './layout'

const SLUG = 'channel-cup'
const VIEWER = { id: '555555555555', alias: 'Rin' }

const EVENT = {
    id: 'event-1',
    slug: SLUG,
    name: 'Channel Cup 2026',
    summary: 'A cup for checking the channel controls.',
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

interface Server {
    streamUrl: string | null
    channel: string | null
    matchOnScreen: boolean
    channelWrites: unknown[]
    twitchWrites: unknown[]
    channelFailure: { code: string; error: string } | null
}

function deskPayload(server: Server) {
    return {
        server_now: new Date().toISOString().replace('Z', '+00:00'),
        event: { name: EVENT.name, slug: SLUG },
        streamer: { id: VIEWER.id, display_name: 'Streamer', channel: server.channel },
        desk: { brb_message: null, webcam_enabled: false, current_match_id: null },
        reason: server.matchOnScreen ? 'next' : 'none',
        match: server.matchOnScreen ? { id: 'm1', reason: 'next', stream_url: server.streamUrl } : null,
        assigned_matches: [],
        next_match: null,
    }
}

async function mockApi(page: Page, overrides: Partial<Server> = {}): Promise<Server> {
    const server: Server = {
        streamUrl: null,
        channel: 'https://twitch.tv/rin_plays',
        matchOnScreen: true,
        channelWrites: [],
        twitchWrites: [],
        channelFailure: null,
        ...overrides,
    }

    await page.addInitScript(() => {
        localStorage.setItem('utbt:analyticsConsent:v1', 'denied')
        localStorage.setItem('utbt:webAuth:v1', JSON.stringify({
            discordId: '555555555555',
            username: 'rin',
            avatar: '',
            accessToken: 'channel-token',
            refreshToken: 'channel-refresh',
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

        if (path === `/tournaments/${SLUG}/stream/${VIEWER.id}/desk` && request.method() === 'GET') {
            await route.fulfill({ json: { success: true, data: deskPayload(server) } })
            return
        }

        if (path === `/tournaments/${SLUG}/stream/matches/m1/channel` && request.method() === 'PUT') {
            const body = request.postDataJSON() as { choice: string; url?: string }
            server.channelWrites.push(body)
            if (server.channelFailure) {
                await route.fulfill({ status: 422, json: { success: false, error: server.channelFailure.error, code: server.channelFailure.code } })
                return
            }
            server.streamUrl = body.choice === 'mine' ? server.channel : body.choice === 'utbt' ? 'https://twitch.tv/utbt' : body.url ?? null
            await route.fulfill({ json: { success: true, data: { channel: { match_id: 'm1', stream_url: server.streamUrl, choice: body.choice } } } })
            return
        }

        if (path === '/users/me/twitch' && request.method() === 'PUT') {
            const body = request.postDataJSON() as { twitch: string | null }
            server.twitchWrites.push(body)
            server.channel = body.twitch
            await route.fulfill({ json: { success: true, data: { twitch_url: body.twitch } } })
            return
        }

        if (path === '/users/me') {
            await route.fulfill({ json: { success: true, data: { ...VIEWER, twitch_url: server.channel } } })
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

async function openChannel(page: Page) {
    await page.goto(`/events/${SLUG}?tab=stream`)
    await page.getByRole('button', { name: 'Channel', exact: true }).click()
    return {
        streaming: page.getByRole('region', { name: 'Streaming on' }),
        own: page.getByRole('region', { name: 'Own Twitch channel' }),
    }
}

test('My channel and UTBT channel write straight away and show the new link', async ({ page }) => {
    const server = await mockApi(page)
    const { streaming } = await openChannel(page)
    const link = streaming.getByTestId('channel-current-link')
    await expect(link).toHaveText('No stream link set')

    await streaming.getByRole('button', { name: 'My channel' }).click()
    await expect(link).toHaveText('https://twitch.tv/rin_plays', { timeout: 1_000 })

    await streaming.getByRole('button', { name: 'UTBT channel' }).click()
    await expect(link).toHaveText('https://twitch.tv/utbt', { timeout: 1_000 })
    expect(server.channelWrites).toEqual([{ choice: 'mine' }, { choice: 'utbt' }])
})

test('Other URL validates before sending, then writes the trimmed link', async ({ page }) => {
    const server = await mockApi(page)
    const { streaming } = await openChannel(page)

    await streaming.getByRole('button', { name: 'Other URL' }).click()
    await streaming.getByLabel('Stream link').fill('example.com/live')
    await streaming.getByRole('button', { name: 'Use this link' }).click()
    await expect(streaming.getByRole('alert')).toContainText('http:// or https://')
    expect(server.channelWrites).toHaveLength(0)

    await streaming.getByLabel('Stream link').fill('  https://example.com/live  ')
    await streaming.getByRole('button', { name: 'Use this link' }).click()
    await expect(streaming.getByTestId('channel-current-link')).toHaveText('https://example.com/live', { timeout: 1_000 })
    expect(server.channelWrites).toEqual([{ choice: 'other', url: 'https://example.com/live' }])
})

test('My channel is disabled with a hint until a Twitch channel is set, and a server refusal shows its message', async ({ page }) => {
    const server = await mockApi(page, { channel: null })
    const { streaming } = await openChannel(page)

    await expect(streaming.getByRole('button', { name: 'My channel' })).toBeDisabled()
    await expect(streaming.getByText('Set your Twitch channel below to use this.')).toBeVisible()

    server.channelFailure = { code: 'invalid_url', error: 'Field \'url\' must be an http or https URL.' }
    await streaming.getByRole('button', { name: 'UTBT channel' }).click()
    await expect(streaming.getByRole('alert')).toHaveText('Field \'url\' must be an http or https URL.')
})

test('the own Twitch channel field normalises on save, rejects bad input and clears', async ({ page }) => {
    const server = await mockApi(page, { channel: null })
    const { streaming, own } = await openChannel(page)
    const field = own.getByLabel('Twitch channel')

    await field.fill('bad')
    await own.getByRole('button', { name: 'Save' }).click()
    await expect(own.getByRole('alert')).toContainText('4 to 25 letters')
    expect(server.twitchWrites).toHaveLength(0)

    await field.fill('https://www.twitch.tv/Rin_Plays/')
    await own.getByRole('button', { name: 'Save' }).click()
    await expect(field).toHaveValue('https://twitch.tv/rin_plays')
    await expect(streaming.getByRole('button', { name: 'My channel' })).toBeEnabled()
    expect(server.twitchWrites).toEqual([{ twitch: 'https://twitch.tv/rin_plays' }])

    await own.getByRole('button', { name: 'Clear' }).click()
    await expect(field).toHaveValue('')
    await expect(own.getByRole('button', { name: 'Clear' })).toBeDisabled()
    expect(server.twitchWrites[1]).toEqual({ twitch: null })
})

test('without a current match the streaming choice explains itself and the own channel still works', async ({ page }) => {
    await mockApi(page, { matchOnScreen: false })
    const { streaming, own } = await openChannel(page)

    await expect(streaming.getByText('No match is on your scenes right now.')).toBeVisible()
    await expect(streaming.getByRole('button', { name: 'UTBT channel' })).toHaveCount(0)
    await expect(own.getByLabel('Twitch channel')).toHaveValue('https://twitch.tv/rin_plays')
})

for (const viewport of [{ width: 390, height: 844 }, { width: 1920, height: 1080 }]) {
    test(`the channel controls fit ${viewport.width} px`, async ({ page }) => {
        await page.setViewportSize(viewport)
        await mockApi(page)
        const { streaming, own } = await openChannel(page)

        await streaming.getByRole('button', { name: 'Other URL' }).click()
        await expect(streaming.getByLabel('Stream link')).toBeVisible()
        await expect(own.getByLabel('Twitch channel')).toBeVisible()
        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)

        const box = await streaming.getByRole('button', { name: 'UTBT channel' }).boundingBox()
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(32)
    })
}
