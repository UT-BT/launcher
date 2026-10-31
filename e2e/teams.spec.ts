import { expect, test, type Page, type Request } from '@playwright/test'

const VIEWER_ID = '100'
const TEAM_ID = 'team-1'

type Member = { user: string; role: 'owner' | 'admin' | 'member'; status: 'active' | 'invited' | 'blocked' }

function team(overrides: { is_open?: boolean; members?: Member[] } = {}) {
    const members = (overrides.members ?? [{ user: '200', role: 'owner', status: 'active' }]).map(m => ({
        ...m,
        alias: `Player ${m.user}`,
        raw_alias: `Player ${m.user}`,
        joined_at: '2026-01-01T00:00:00Z',
        tag: 'RX',
        tag_position: 'prefix',
        tag_number: null,
        tag_hidden: false,
    }))
    return {
        id: TEAM_ID,
        name: 'Rocket Express',
        tag: 'RX',
        tag_position: 'prefix',
        tag_style: 'plain',
        tag_spaced: true,
        is_open: overrides.is_open ?? true,
        owner: members.find(m => m.role === 'owner')?.user ?? '200',
        owner_alias: 'Player 200',
        member_count: members.filter(m => m.status === 'active').length,
        has_avatar: false,
        avatar_updated: null,
        added: '2026-01-01T00:00:00Z',
        stats: { caps: 0, world_records: 0, playtime_seconds: 0, spectator_seconds: 0, ranks: {} },
        members,
    }
}

interface TeamsApi {
    detail: ReturnType<typeof team>
    myTeam: ReturnType<typeof team> | null
    holdDirectory?: Promise<void>
    requests: Request[]
}

async function signIn(page: Page) {
    await page.addInitScript(() => {
        localStorage.setItem('utbt:analyticsConsent:v1', 'denied')
        localStorage.setItem('utbt:webAuth:v1', JSON.stringify({
            discordId: '100',
            username: 'tester',
            avatar: '',
            accessToken: 'token',
            refreshToken: 'refresh-token',
            expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
        }))
    })
}

async function serveTeamsApi(page: Page, api: TeamsApi) {
    await page.route(/https:\/\/(api|gateway)\.utbt\.net\/.*/, async route => {
        const request = route.request()
        api.requests.push(request)
        const url = new URL(request.url())
        if (url.hostname === 'gateway.utbt.net') {
            await route.fulfill({ json: [] })
            return
        }
        const path = url.pathname.replace(/\/$/, '')
        const ok = (data: unknown) => route.fulfill({ json: { success: true, data } })
        if (path === '/users/me') return ok({ id: VIEWER_ID, alias: 'Tester', utbt_role: 0 })
        if (path === '/launcher/activity/latest') return route.fulfill({ status: 404, json: { success: false } })
        if (path === '/me/team') return ok({ team: api.myTeam })
        if (path === '/me/invitations') return ok([])
        if (path === '/teams') {
            if (api.holdDirectory) await api.holdDirectory
            return ok({ total: 1, ranked_teams: 1, teams: [api.detail] })
        }
        if (path === `/teams/${TEAM_ID}`) return ok(api.detail)
        if (path === `/teams/${TEAM_ID}/join` || path === `/teams/${TEAM_ID}/accept`) return ok(api.detail)
        if (path === `/teams/${TEAM_ID}/activity`) {
            return ok({ total: 0, caps: 0, world_records: 0, playtime: 0, playtime_seconds: 0, spectator_seconds: 0, ranks: {}, ranked_teams: 1, items: [] })
        }
        if (path === '/v2/summary') {
            return ok({ global: { newMaps: 0, newRecords: 0 }, achievements: [], recentWorldRecords: [], newMaps: [], latestPatch: null })
        }
        return ok(path.endsWith('/count') ? { count: 0 } : [])
    })
}

function profileFetches(api: TeamsApi): number {
    return api.requests.filter(r => new URL(r.url()).pathname === '/users/me').length
}

function directoryFetches(api: TeamsApi): number {
    return api.requests.filter(r => new URL(r.url()).pathname === '/teams/').length
}

test.beforeEach(async ({ page }) => {
    await signIn(page)
})

test('joining from the team page refreshes the signed-in profile', async ({ page }) => {
    const api: TeamsApi = { detail: team({ is_open: true }), myTeam: null, requests: [] }
    await serveTeamsApi(page, api)
    await page.goto(`/teams/${TEAM_ID}`)
    const join = page.getByRole('button', { name: 'Join', exact: true })
    await expect(join).toBeEnabled()
    await expect.poll(() => profileFetches(api)).toBeGreaterThan(0)
    const before = profileFetches(api)

    await join.click()

    await expect.poll(() => profileFetches(api)).toBeGreaterThan(before)
})

test('accepting an invite from the team page refreshes the signed-in profile', async ({ page }) => {
    const api: TeamsApi = {
        detail: team({
            is_open: false,
            members: [
                { user: '200', role: 'owner', status: 'active' },
                { user: VIEWER_ID, role: 'member', status: 'invited' },
            ],
        }),
        myTeam: null,
        requests: [],
    }
    await serveTeamsApi(page, api)
    await page.goto(`/teams/${TEAM_ID}`)
    const accept = page.getByRole('button', { name: 'Accept', exact: true })
    await expect(accept).toBeEnabled()
    await expect.poll(() => profileFetches(api)).toBeGreaterThan(0)
    const before = profileFetches(api)

    await accept.click()

    await expect.poll(() => profileFetches(api)).toBeGreaterThan(before)
})

test('the owner picking a non-image crest sees the validation message and nothing uploads', async ({ page }) => {
    const owned = team({ members: [{ user: VIEWER_ID, role: 'owner', status: 'active' }] })
    const api: TeamsApi = { detail: owned, myTeam: owned, requests: [] }
    await serveTeamsApi(page, api)
    await page.goto(`/teams/${TEAM_ID}`)
    const crestInput = page.locator('input[type="file"]')
    await expect(crestInput).toHaveAttribute('accept', 'image/png,image/jpeg,image/webp,image/gif')

    await crestInput.setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('not an image') })

    await expect(page.getByText('Choose a PNG, JPEG, WEBP or GIF image.')).toBeVisible()
    expect(api.requests.filter(r => r.method() === 'POST' && r.url().includes('/avatar'))).toHaveLength(0)
})

test('revisiting Teams paints the cached directory while it refreshes in the background', async ({ page }) => {
    const api: TeamsApi = { detail: team(), myTeam: null, requests: [] }
    await serveTeamsApi(page, api)
    await page.goto('/teams')
    await expect(page.getByText('Rocket Express')).toBeVisible()
    await page.getByText('Rocket Express').click()
    await expect(page.getByRole('heading', { name: 'Rocket Express' })).toBeVisible()

    let release!: () => void
    api.holdDirectory = new Promise<void>(resolve => { release = resolve })
    const fetchesBefore = directoryFetches(api)
    await page.goBack()

    await expect.poll(() => directoryFetches(api)).toBeGreaterThan(fetchesBefore)
    await expect(page.getByText('Rocket Express')).toBeVisible()
    await expect(page.getByText('Loading teams…')).toHaveCount(0)
    release()
    await expect(page.getByText('1 team', { exact: true })).toBeVisible()
})
