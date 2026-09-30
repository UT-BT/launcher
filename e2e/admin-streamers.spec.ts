import { expect, test, type Page } from '@playwright/test'
import { horizontalOverflow } from './layout'

const VIEWER = { id: '555555555555', alias: 'Rin' }
const ROLE_MODERATOR = 1
const ROLE_CUP_ADMIN = 3

interface Assignment {
    match_id: string
    event: { slug: string; name: string }
    label: string
    scheduled_at: string | null
}

interface Member {
    user_id: string
    display_name: string
    avatar: string
    twitch_url: string | null
    added_by: { id: string; display_name: string } | null
    added_at: string
    note: string | null
    upcoming_assignments: Assignment[]
}

interface Suggestion {
    user_id: string
    display_name: string
    avatar: string
    twitch_url: string | null
    event: { slug: string; name: string }
    signed_up_at: string
}

interface Server {
    role: number
    roster: Member[]
    suggestions: Suggestion[]
    puts: { userId: string; body: unknown }[]
    deletes: string[]
}

const SUMMER = { slug: 'summer-cup', name: 'Summer Cup 2026' }
const AUTUMN = { slug: 'autumn-cup', name: 'Autumn Cup 2026' }

const PLAYERS = [
    { id: '111111111111', alias: 'Nova', twitch_url: 'https://twitch.tv/nova' },
    { id: '222222222222', alias: 'Kestrel', twitch_url: null },
    { id: '333333333333', alias: 'Orbit', twitch_url: 'https://www.twitch.tv/orbit_tv' },
]

function avatar(userId: string) {
    return `https://cdn.example.test/avatars/${userId}.webp`
}

function member(userId: string, alias: string, twitchUrl: string | null, overrides: Partial<Member> = {}): Member {
    return {
        user_id: userId,
        display_name: alias,
        avatar: avatar(userId),
        twitch_url: twitchUrl,
        added_by: { id: VIEWER.id, display_name: VIEWER.alias },
        added_at: '2026-09-20T18:00:00+00:00',
        note: null,
        upcoming_assignments: [],
        ...overrides,
    }
}

function sorted(roster: Member[]) {
    return [...roster].sort((a, b) => a.display_name.localeCompare(b.display_name))
}

function playerRow(player: typeof PLAYERS[number]) {
    return {
        id: player.id, alias: player.alias, registered_at: null, utbt_role: 0, active_title: null,
        banned: false, ban_reason: null, ban_expires: null, rank: 0, points: 0,
        world_records: 0, champion_medals: 0,
    }
}

async function mockApi(page: Page, overrides: Partial<Server> = {}): Promise<Server> {
    const server: Server = {
        role: ROLE_MODERATOR,
        roster: [
            member('444444444444', 'Vega', null, {
                note: 'Weekend streams',
                upcoming_assignments: [
                    { match_id: 'm-1', event: SUMMER, label: 'Alpha vs Bravo', scheduled_at: '2026-10-02T18:00:00+00:00' },
                    { match_id: 'm-2', event: AUTUMN, label: 'Winner of A1 vs TBD', scheduled_at: null },
                ],
            }),
        ],
        suggestions: [
            {
                user_id: PLAYERS[2].id, display_name: PLAYERS[2].alias, avatar: avatar(PLAYERS[2].id),
                twitch_url: PLAYERS[2].twitch_url, event: AUTUMN, signed_up_at: '2026-09-25T12:00:00+00:00',
            },
        ],
        puts: [],
        deletes: [],
        ...overrides,
    }

    await page.addInitScript(() => {
        localStorage.setItem('utbt:analyticsConsent:v1', 'denied')
        localStorage.setItem('utbt:adminState:v1', JSON.stringify({ activeSection: 'streamers' }))
        localStorage.setItem('utbt:webAuth:v1', JSON.stringify({
            discordId: '555555555555',
            username: 'rin',
            avatar: '',
            accessToken: 'admin-token',
            refreshToken: 'admin-refresh',
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
        const memberPath = path.match(/^\/admin\/streamers\/(\d+)$/)

        if (path === '/admin/streamers' && method === 'GET') {
            await route.fulfill({ json: { success: true, data: { items: sorted(server.roster) } } })
            return
        }
        if (path === '/admin/streamers/suggestions' && method === 'GET') {
            const onRoster = new Set(server.roster.map(item => item.user_id))
            await route.fulfill({ json: { success: true, data: { items: server.suggestions.filter(item => !onRoster.has(item.user_id)) } } })
            return
        }
        if (memberPath && method === 'PUT') {
            const userId = memberPath[1]
            const body = request.postDataJSON() as { note: string | null }
            server.puts.push({ userId, body })
            const existing = server.roster.find(item => item.user_id === userId)
            if (existing) {
                existing.note = body.note
            } else {
                const player = PLAYERS.find(item => item.id === userId)
                server.roster.push(member(userId, player?.alias ?? userId, player?.twitch_url ?? null, { note: body.note }))
            }
            await route.fulfill({ json: { success: true, data: { items: sorted(server.roster) } } })
            return
        }
        if (memberPath && method === 'DELETE') {
            server.deletes.push(memberPath[1])
            server.roster = server.roster.filter(item => item.user_id !== memberPath[1])
            await route.fulfill({ json: { success: true, data: { items: sorted(server.roster) } } })
            return
        }
        if (path === '/v2/players') {
            const search = (url.searchParams.get('search') ?? '').toLowerCase()
            const rows = PLAYERS.filter(player => player.alias.toLowerCase().includes(search)).map(playerRow)
            await route.fulfill({ json: { success: true, data: rows } })
            return
        }
        if (path === '/users/me') {
            await route.fulfill({ json: { success: true, data: { ...VIEWER, utbt_role: server.role, twitch_url: null } } })
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

function sectionPicker(page: Page) {
    return page.locator('select:has(option[value="streamers"])')
}

function confirmation(page: Page) {
    return page.locator('[data-modal-backdrop]')
}

async function openStreamers(page: Page) {
    await page.goto('/admin')
    await expect(page.getByRole('heading', { name: 'Streamers', exact: true })).toBeVisible()
    return {
        roster: page.getByRole('region', { name: 'Roster' }),
        suggestions: page.getByRole('region', { name: 'Suggestions' }),
    }
}

test('each roster row shows the Twitch channel or flags it missing, who added them and the note', async ({ page }) => {
    await mockApi(page, {
        roster: [
            member(PLAYERS[0].id, PLAYERS[0].alias, PLAYERS[0].twitch_url),
            member(PLAYERS[1].id, PLAYERS[1].alias, PLAYERS[1].twitch_url, { note: 'Needs a channel' }),
        ],
    })
    const { roster } = await openStreamers(page)

    const nova = roster.getByRole('listitem', { name: 'Nova' })
    await expect(nova.getByRole('link', { name: 'twitch.tv/nova' })).toHaveAttribute('href', 'https://twitch.tv/nova')
    await expect(nova.getByText('No Twitch channel')).toHaveCount(0)
    await expect(nova.getByText(`added by ${VIEWER.alias}`)).toBeVisible()

    const kestrel = roster.getByRole('listitem', { name: 'Kestrel' })
    await expect(kestrel.getByText('No Twitch channel')).toBeVisible()
    await expect(kestrel.getByLabel('Note for Kestrel')).toHaveValue('Needs a channel')
})

test('a player search adds a streamer to the roster', async ({ page }) => {
    const server = await mockApi(page)
    const { roster } = await openStreamers(page)

    await page.getByPlaceholder('Search players to add to the roster…').fill('nov')
    await page.getByRole('button', { name: /Nova/ }).click()

    await expect(roster.getByRole('listitem', { name: 'Nova' })).toBeVisible()
    expect(server.puts).toEqual([{ userId: PLAYERS[0].id, body: { note: null } }])
})

test('editing a note saves the trimmed text and clearing it sends null', async ({ page }) => {
    const server = await mockApi(page)
    const { roster } = await openStreamers(page)
    const vega = roster.getByRole('listitem', { name: 'Vega' })
    const note = vega.getByLabel('Note for Vega')
    const save = vega.getByRole('button', { name: 'Save note' })

    await expect(save).toBeDisabled()
    await note.fill('  Plays Sundays  ')
    await save.click()
    await expect(save).toBeDisabled()
    await expect(note).toHaveValue('Plays Sundays')

    await note.fill('')
    await note.press('Enter')
    await expect(note).toHaveValue('')
    await expect(save).toBeDisabled()

    expect(server.puts).toEqual([
        { userId: '444444444444', body: { note: 'Plays Sundays' } },
        { userId: '444444444444', body: { note: null } },
    ])
})

test('removing asks first and lists the upcoming assignments', async ({ page }) => {
    const server = await mockApi(page)
    const { roster } = await openStreamers(page)

    await roster.getByRole('listitem', { name: 'Vega' }).getByRole('button', { name: 'Remove' }).click()
    const dialog = confirmation(page)
    const upcoming = dialog.getByRole('list', { name: 'Upcoming assignments' })
    await expect(upcoming.getByRole('listitem')).toHaveCount(2)
    await expect(upcoming.getByRole('listitem').first()).toContainText('Summer Cup 2026 · Alpha vs Bravo · ')
    await expect(upcoming.getByRole('listitem').nth(1)).toHaveText('Autumn Cup 2026 · Winner of A1 vs TBD · Unscheduled')
    expect(server.deletes).toEqual([])

    await dialog.getByRole('button', { name: 'Remove' }).click()
    await expect(roster.getByRole('listitem', { name: 'Vega' })).toHaveCount(0)
    await expect(roster.getByText('Nobody is on the roster yet.')).toBeVisible()
    expect(server.deletes).toEqual(['444444444444'])
})

test('cancelling the removal keeps the streamer', async ({ page }) => {
    const server = await mockApi(page)
    const { roster } = await openStreamers(page)

    await roster.getByRole('listitem', { name: 'Vega' }).getByRole('button', { name: 'Remove' }).click()
    await confirmation(page).getByRole('button', { name: 'Cancel' }).click()

    await expect(roster.getByRole('listitem', { name: 'Vega' })).toBeVisible()
    expect(server.deletes).toEqual([])
})

test('Add on a suggestion puts them on the roster and takes them off the suggestions', async ({ page }) => {
    const server = await mockApi(page)
    const { roster, suggestions } = await openStreamers(page)
    const orbit = suggestions.getByRole('listitem', { name: 'Orbit' })
    await expect(orbit).toContainText('ticked Streaming for Autumn Cup 2026')

    await orbit.getByRole('button', { name: 'Add' }).click()

    await expect(roster.getByRole('listitem', { name: 'Orbit' })).toBeVisible()
    await expect(suggestions.getByRole('listitem', { name: 'Orbit' })).toHaveCount(0)
    await expect(suggestions.getByText('No suggestions right now.')).toBeVisible()
    expect(server.puts).toEqual([{ userId: PLAYERS[2].id, body: { note: null } }])
})

test('a Cup Admin does not see the Streamers section', async ({ page }) => {
    await mockApi(page, { role: ROLE_CUP_ADMIN })
    await page.goto('/admin')

    await expect(page.getByText("You don't have permission to view this section.")).toBeVisible()
    await expect(page.getByRole('button', { name: 'Streamers', exact: true })).toHaveCount(0)
    await expect(sectionPicker(page)).toHaveCount(0)
})

for (const viewport of [{ width: 390, height: 844 }, { width: 1920, height: 1080 }]) {
    test(`the Streamers section fits ${viewport.width} px`, async ({ page }) => {
        await page.setViewportSize(viewport)
        await mockApi(page)
        const { roster, suggestions } = await openStreamers(page)

        await expect(roster.getByRole('listitem', { name: 'Vega' })).toBeVisible()
        await expect(suggestions.getByRole('listitem', { name: 'Orbit' })).toBeVisible()
        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)

        const remove = await roster.getByRole('button', { name: 'Remove' }).boundingBox()
        expect(remove?.height ?? 0).toBeGreaterThanOrEqual(32)

        await roster.getByRole('button', { name: 'Remove' }).click()
        await expect(confirmation(page).getByRole('list', { name: 'Upcoming assignments' })).toBeVisible()
        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)
    })
}
