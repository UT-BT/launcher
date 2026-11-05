import { expect, test, type Page } from '@playwright/test'
import { ROLE } from '../app/utils/roles'
import type {
    AdminServerConfig,
    AdminServerOperations,
    ServerConfigChange,
    ServerConfigErrorBody,
    ServerConfigPatchResult,
} from '../app/utils/api'
import {
    serverConfigErrorFixture,
    serverConfigFixture,
    serverConfigOperationsFixture,
    serverConfigPatchFixture,
} from '../app/utils/fixtures/serverConfigFixtures'

const VIEWER = { id: '555555555555', alias: 'Rin' }

const EU = '7c3e9d14-2a5b-4f68-8e01-3b9c4d5e6f01'
const EU_2 = '7c3e9d14-2a5b-4f68-8e01-3b9c4d5e6f04'
const US = '7c3e9d14-2a5b-4f68-8e01-3b9c4d5e6f02'

const CONFIGS: { [serverId: string]: AdminServerConfig } = {
    [EU]: serverConfigFixture('serverConfigResponse'),
    [EU_2]: serverConfigFixture('serverConfigResponseLegacy'),
    [US]: serverConfigFixture('serverConfigResponseUnmanaged'),
}

interface Patch {
    path: string
    body: unknown
}

interface Server {
    role: number
    patchReply: ServerConfigPatchResult
    patchError: { status: number; body: ServerConfigErrorBody } | null
    patches: Patch[]
    operationsReads: number
}

function operationsAfter(patches: Patch[]): AdminServerOperations {
    const operations = serverConfigOperationsFixture()
    const names = new Map(patches.flatMap(({ path, body }) => {
        const name = (body as ServerConfigChange).changes.server_name
        return name === undefined ? [] : [[path.split('/')[3], name] as const]
    }))
    return { ...operations, servers: operations.servers.map(row => ({ ...row, name: names.get(row.id) ?? row.name })) }
}

async function mockApi(page: Page, overrides: Partial<Server> = {}): Promise<Server> {
    const server: Server = {
        role: ROLE.ADMIN,
        patchReply: serverConfigPatchFixture('serverConfigPatchOk'),
        patchError: null,
        patches: [],
        operationsReads: 0,
        ...overrides,
    }

    await page.addInitScript(() => {
        localStorage.setItem('utbt:analyticsConsent:v1', 'denied')
        localStorage.setItem('utbt:adminState:v1', JSON.stringify({ activeSection: 'server-operations' }))
        localStorage.setItem('utbt:webAuth:v1', JSON.stringify({
            discordId: '555555555555',
            username: 'rin',
            avatar: '',
            accessToken: 'staff-token',
            refreshToken: 'staff-refresh',
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
        const config = path.match(/^\/admin\/servers\/([^/]+)\/config(\/basic)?$/)

        if (path === '/admin/servers/operations') {
            server.operationsReads += 1
            await route.fulfill({ json: { success: true, data: operationsAfter(server.patches) } })
            return
        }
        if (config && method === 'GET' && !config[2]) {
            await route.fulfill({ json: { success: true, data: CONFIGS[config[1]] } })
            return
        }
        if (config && method === 'PATCH') {
            server.patches.push({ path, body: request.postDataJSON() })
            if (server.patchError) await route.fulfill({ status: server.patchError.status, json: server.patchError.body })
            else await route.fulfill({ json: { success: true, data: server.patchReply } })
            return
        }
        if (path === '/admin/alerts') {
            await route.fulfill({
                json: { success: true, data: { items: [], open_count: 0, unresolved_count: 0, kinds: [], limit: 50, offset: 0 } },
            })
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

function modal(page: Page, title: string) {
    return page.locator('[data-modal-backdrop]').filter({ has: page.getByRole('heading', { name: title, exact: true }) })
}

async function openSettings(page: Page, serverName: string) {
    await page.goto('/admin')
    await expect(page.getByRole('heading', { name: 'Server Operations', exact: true })).toBeVisible()
    await page.getByRole('button', { name: `Actions for ${serverName}` }).filter({ visible: true }).first().click()
    await page.getByRole('menuitem', { name: 'Settings' }).click()
    const dialog = modal(page, 'Server settings')
    await expect(dialog.getByLabel('Server name')).toBeVisible()
    return dialog
}

test('an admin changes max players and saves it to apply when the server is empty', async ({ page }) => {
    const server = await mockApi(page, {
        patchReply: { ...serverConfigPatchFixture('serverConfigPatchOk'), apply: { mode: 'when_empty', restart: null } },
    })
    const dialog = await openSettings(page, 'BT Test Server 2 | EU')
    const save = dialog.getByRole('button', { name: 'Save', exact: true })

    await expect(dialog.getByLabel('Max players')).toHaveValue('12')
    await expect(save).toBeDisabled()
    await dialog.getByLabel('Max players').fill('129')
    await expect(dialog.getByText('From 1 to 128')).toBeVisible()
    await expect(save).toBeDisabled()
    await dialog.getByLabel('Max players').fill('14')
    await save.click()

    const confirm = modal(page, 'Save settings')
    await expect(confirm).toContainText('BT Test Server 2 | EU · player count unknown')
    await expect(confirm).toContainText('Changing: Max players.')
    await expect(confirm.getByRole('radio', { name: 'Apply when the server is empty' })).toBeChecked()
    await expect(confirm.getByRole('radio', { name: 'Apply now (restarts the server)' })).not.toBeChecked()
    await expect(confirm.getByRole('textbox')).toHaveCount(0)
    const readsBefore = server.operationsReads
    await confirm.getByRole('button', { name: 'Save', exact: true }).click()

    await expect(page.getByText('Saved. Applies when the server is empty')).toBeVisible()
    await expect(dialog).toHaveCount(0)
    expect(server.patches).toEqual([
        { path: `/admin/servers/${EU_2}/config`, body: { changes: { max_players: 14 }, apply: 'when_empty' } },
    ])
    await expect.poll(() => server.operationsReads).toBeGreaterThan(readsBefore)
})

test('a restart that fails after a save stays reported once the rows reload', async ({ page }) => {
    await mockApi(page, {
        patchReply: {
            ...serverConfigPatchFixture('serverConfigPatchOk'),
            apply: { mode: 'now', restart: { error: 'rate_limited', retry_after: 9 } },
        },
    })
    const dialog = await openSettings(page, 'BT Test Server 2 | EU')

    await dialog.getByLabel('Server name').fill('BT Test Server 2 | EU Renamed')
    await dialog.getByRole('button', { name: 'Save', exact: true }).click()
    const confirm = modal(page, 'Save settings')
    await confirm.getByRole('radio', { name: 'Apply now (restarts the server)' }).check()
    await confirm.getByRole('button', { name: 'Save', exact: true }).click()

    await expect(page.getByRole('button', { name: 'Actions for BT Test Server 2 | EU Renamed' }).filter({ visible: true }).first()).toBeVisible()
    await expect(page.getByText(
        'Saved, but the restart failed: another action just reached this server. Try again in 9 s.',
    )).toBeVisible()
})

test('a moderator sees max players read-only and changes the ruleset with a reason, applying now', async ({ page }) => {
    const server = await mockApi(page, { role: ROLE.MODERATOR })
    const dialog = await openSettings(page, 'BT Test Server | EU')

    await expect(dialog.getByText(
        'Only admins can change these. You can change the ruleset, the server name and the game password.',
    )).toBeVisible()
    await expect(dialog.getByLabel('Max players')).toBeDisabled()
    await expect(dialog.getByLabel('Region')).toBeDisabled()
    await expect(dialog.getByLabel('Game password')).toHaveAttribute('type', 'password')
    await dialog.getByRole('button', { name: 'Show password' }).click()
    await expect(dialog.getByLabel('Game password')).toHaveValue('example-pass')

    await dialog.getByRole('radio', { name: 'Casual' }).click()
    await expect(dialog.getByLabel('Max players')).toBeDisabled()
    await dialog.getByLabel('Server name').fill('[BT] Test Server #1 (EU) Casual')
    await dialog.getByRole('button', { name: 'Save', exact: true }).click()

    const confirm = modal(page, 'Save settings')
    await expect(confirm).toContainText('BT Test Server | EU · 3 of 16 players')
    await expect(confirm).toContainText('Ruleset: Certified to Casual. A team run is in progress.')
    const confirmSave = confirm.getByRole('button', { name: 'Save', exact: true })
    await expect(confirmSave).toBeDisabled()
    await confirm.getByPlaceholder('Why the ruleset changes').fill('Cup finished')
    await confirm.getByRole('radio', { name: 'Apply now (restarts the server)' }).check()
    await confirmSave.click()

    await expect(page.getByText('Saved. Restarting')).toBeVisible()
    expect(server.patches).toEqual([
        {
            path: `/admin/servers/${EU}/config/basic`,
            body: {
                changes: { server_name: '[BT] Test Server #1 (EU) Casual', ruleset: 'casual' },
                apply: 'now',
                reason: 'Cup finished',
            },
        },
    ])
})

test('a certified server shows the keys it sets as locked until the ruleset is switched to Casual', async ({ page }) => {
    await mockApi(page)
    const dialog = await openSettings(page, 'BT Test Server | EU')
    const locked = [
        dialog.getByLabel('Max players'),
        dialog.getByRole('switch', { name: 'Allow boosted caps' }),
        dialog.getByRole('switch', { name: 'Player collisions' }),
    ]

    for (const control of locked) await expect(control).toBeDisabled()
    await expect(dialog.getByText('Set by certified')).toHaveCount(3)
    await expect(dialog.getByLabel('Max spectators')).toBeEnabled()

    await dialog.getByRole('radio', { name: 'Casual' }).click()
    for (const control of locked) await expect(control).toBeEnabled()
    await expect(dialog.getByText('Set by certified')).toHaveCount(0)

    await dialog.getByRole('radio', { name: 'Certified' }).click()
    for (const control of locked) await expect(control).toBeDisabled()
})

test('a refused save keeps the dialog open and marks the fields the server names', async ({ page }) => {
    await mockApi(page, { patchError: { status: 400, body: serverConfigErrorFixture('serverConfigPatchInvalidValue') } })
    const dialog = await openSettings(page, 'BT Test Server 2 | EU')

    await dialog.getByLabel('Max players').fill('14')
    await dialog.getByRole('button', { name: 'Save', exact: true }).click()
    await modal(page, 'Save settings').getByRole('button', { name: 'Save', exact: true }).click()

    await expect(dialog.getByText('These values are not allowed for their settings.')).toBeVisible()
    await expect(dialog.getByText('The server does not accept this value')).toBeVisible()
    await expect(dialog.getByLabel('Max players')).toHaveAttribute('aria-invalid', 'true')
    await expect(modal(page, 'Save settings')).toHaveCount(0)
})
