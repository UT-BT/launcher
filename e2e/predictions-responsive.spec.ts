import { expect, test } from '@playwright/test'

/**
 * The prediction surfaces at a phone width.
 *
 * Hard rule: a table or card never makes the page scroll sideways. These screens
 * are dense — odds, countdowns, stakes, chips — so they are the easiest place in
 * the app to break that by accident, and the hardest to notice on a desktop.
 */

const SLUG = 'mobile-cup'

function market(id: string, overrides: Record<string, unknown> = {}) {
    return {
        id,
        match_id: `match-${id}`,
        stage_id: 'stage-1',
        status: 'open',
        outcome: null,
        draws_allowed: true,
        price_a: 0.62,
        price_b: 0.11,
        price_draw: 0.27,
        opening_price_a: 0.58,
        opening_price_b: 0.14,
        opening_price_draw: 0.28,
        pool_stake: 12500,
        position_count: 9,
        liquidity_b: 9110,
        manual_override: null,
        closes_at: new Date(Date.now() + 45 * 60_000).toISOString(),
        closed_at: null,
        resolved_at: null,
        settles_at: null,
        settled_at: null,
        outcome_reason: null,
        result_key: 'open',
        your_position: null,
        team_a: { id: 'team-a', name: 'Respawn Repeat Regret', seed: 1, status: 'registered' },
        team_b: { id: 'team-b', name: 'Sandbagging Sorcerers', seed: 2, status: 'registered' },
        match: {
            id: `match-${id}`,
            round_no: 1,
            round_label: 'Group A — Round 1',
            ordinal: 0,
            status: 'scheduled',
            scheduled_at: new Date(Date.now() + 45 * 60_000).toISOString(),
            best_of: 4,
            score_a: null,
            score_b: null,
        },
        ...overrides,
    }
}

const EVENT = {
    id: 'event-1',
    slug: SLUG,
    name: 'Mobile Cup 2026',
    summary: 'A cup for checking narrow viewports.',
    description: null,
    rules: null,
    team_size: 2,
    status: 'active',
    signups_open: false,
    signup_opens_at: null,
    signup_closes_at: null,
    starts_at: null,
    ends_at: null,
    max_teams: null,
    registered_team_count: 8,
    created_at: null,
    published_at: null,
    predictions_enabled: true,
}

const PREDICTIONS = {
    enabled: true,
    bracket_published: true,
    config: {
        enabled: true,
        initial_grant: 10000,
        min_stake: 10,
        max_stake_pct: 25,
        liquidity_b: 9110,
        close_buffer_seconds: 0,
        settlement_hold_minutes: 30,
        roster_bets_allowed: true,
        void_on_result_while_open: true,
        staff_only: false,
        updated_at: null,
    },
    stages: [{ id: 'stage-1', stage_key: 'groups', name: 'Group Stage', kind: 'groups', ordinal: 0 }],
    markets: [
        market('1'),
        market('2', { status: 'closed', closes_at: new Date(Date.now() - 60_000).toISOString() }),
        market('3', {
            status: 'settled',
            outcome: 'void',
            outcome_reason: 'A result was entered while predictions were still open, '
                + 'so the match could have been watched to the end first.',
        }),
    ],
    wallet: null,
}

test.beforeEach(async ({ page }) => {
    page.on('pageerror', error => console.error('BROWSER PAGE ERROR:', error.message))

    await page.route(/https:\/\/(api|gateway)\.utbt\.net\/.*/, async route => {
        const url = new URL(route.request().url())

        if (url.hostname === 'gateway.utbt.net') {
            await route.fulfill({ json: [] })
            return
        }

        const path = url.pathname.replace(/\/$/, '')

        if (path === `/tournaments/${SLUG}`) {
            await route.fulfill({ json: { success: true, data: { tournament: EVENT } } })
            return
        }

        if (path === `/tournaments/${SLUG}/predictions`) {
            await route.fulfill({ json: { success: true, data: PREDICTIONS } })
            return
        }

        if (path === `/tournaments/${SLUG}/bracket`) {
            await route.fulfill({
                json: { success: true, data: { stages: [], format: { spec: null, template: null }, published: true } },
            })
            return
        }

        if (path === `/tournaments/${SLUG}/me`) {
            await route.fulfill({
                json: { success: true, data: { team: null, invitations: [], lfp: null, volunteer: null } },
            })
            return
        }

        if (path === `/tournaments/${SLUG}/teams` || path === `/tournaments/${SLUG}/lfp`) {
            await route.fulfill({ json: { success: true, data: { items: [] } } })
            return
        }

        if (path === '/v2/summary') {
            await route.fulfill({
                json: {
                    success: true,
                    data: {
                        global: { newMaps: 0, newRecords: 0 },
                        achievements: [], recentWorldRecords: [], newMaps: [], latestPatch: null,
                    },
                },
            })
            return
        }

        await route.fulfill({ json: { success: true, data: [] } })
    })
})

async function horizontalOverflow(page: import('@playwright/test').Page): Promise<number> {
    return page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
}

test('the predictions tab fits a phone', async ({ page, isMobile }) => {
    test.skip(!isMobile)

    await page.goto(`/events/${SLUG}?tab=predictions`)

    await expect(page.getByText('Respawn Repeat Regret').first()).toBeVisible()
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)
})

test('a settled market explains its refund without overflowing', async ({ page, isMobile }) => {
    test.skip(!isMobile)

    await page.goto(`/events/${SLUG}?tab=predictions`)

    await expect(page.getByText(/still open/i).first()).toBeVisible()
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)
})

test('expanding a matchup keeps the page within the viewport', async ({ page, isMobile }) => {
    test.skip(!isMobile)

    await page.goto(`/events/${SLUG}?tab=predictions`)

    const toggle = page.getByRole('button', { name: /form and head-to-head/i }).first()
    await expect(toggle).toBeVisible()
    await toggle.click()

    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)
})
