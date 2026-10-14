import { expect, test } from '@playwright/test'
import { horizontalOverflow } from './layout'

const SLUG = 'achievements-cup'

const EVENT = {
    id: 'event-1',
    slug: SLUG,
    name: 'Achievements Cup 2026',
    summary: 'A cup for checking the achievements tab.',
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
    registered_team_count: 18,
    created_at: null,
    published_at: null,
    predictions_enabled: true,
    achievements_enabled: true,
}

const ALIASES = [
    'Respawn Repeat Regret', 'Sandbagging Sorcerers', 'Kappa', 'Bunnyhopper', 'Flagrunner',
    'Lagswitch Larry', 'Dodgejumper', 'Capmaster', 'Speedrun Steve', 'Wallrider', 'Translocator',
]

function player(index: number, value: number | null, overrides: Record<string, unknown> = {}) {
    return {
        user_id: String(290062867452133377n + BigInt(index)),
        alias: ALIASES[index % ALIASES.length],
        title: null,
        value,
        settled: 15,
        qualifies: true,
        awarded: false,
        ...overrides,
    }
}

function entry(code: string, name: string, kind: string, overrides: Record<string, unknown> = {}) {
    return {
        code,
        name,
        description: `${name} — a description long enough to wrap on a phone and still read cleanly.`,
        goal: '',
        icon: 'Eye',
        unit: '',
        level: 3,
        title: { name, rarity: 3, color_r: 132, color_g: 96, color_b: 205 },
        unlocks_mid_event: false,
        measure: { kind, label: null },
        threshold: 1,
        min_settled: null,
        awaiting_final: false,
        names_hidden: false,
        qualifying_count: 0,
        awarded_count: 0,
        qualifying: [],
        chasing: [],
        you: null,
        ...overrides,
    }
}

const BOARD = {
    event: {
        key: 'cup-2026-predictions',
        name: 'Achievements Cup 2026',
        opens_at: null,
        closes_at: null,
        finalised_at: null,
        state: 'live',
    },
    finalised: false,
    participants: 57,
    achievements: [
        entry('cup_2026_prophet', 'The Prophet', 'coins', {
            qualifying_count: 1,
            qualifying: [player(0, 50805)],
            chasing: [player(1, 34323, { qualifies: false }), player(2, 34016, { qualifies: false })],
            you: { value: 34016, settled: 14, qualifies: false, awarded: false },
        }),
        entry('cup_2026_smart_money', 'Smart Money', 'signed_percent', { min_settled: 20 }),
        entry('cup_2026_percentage_player', 'Percentage Player', 'percent', {
            threshold: 65,
            min_settled: 20,
            chasing: [player(3, 86.7, { qualifies: false }), player(4, 78.6, { qualifies: false, settled: 14 })],
        }),
        entry('cup_2026_against_the_odds', 'Against the Odds', 'count', {
            unlocks_mid_event: true,
            threshold: 2,
            qualifying_count: 2,
            qualifying: [player(5, 3), player(6, 2, { awarded: true })],
            chasing: [player(7, 1, { qualifies: false })],
        }),
        entry('cup_2026_net_positive', 'Net Positive', 'signed_coins', {
            qualifying_count: 11,
            qualifying: ALIASES.map((_, index) => player(index, 40805 - index * 3000)),
            chasing: [player(1, -92, { qualifies: false })],
        }),
        entry('cup_2026_skin_in_the_game', 'Skin in the Game', 'flag', {
            unlocks_mid_event: true,
            awaiting_final: true,
        }),
    ],
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

        if (path === `/tournaments/${SLUG}/predictions/achievements`) {
            await route.fulfill({ json: { success: true, data: BOARD } })
            return
        }

        if (path === `/tournaments/${SLUG}/predictions`) {
            await route.fulfill({
                json: {
                    success: true,
                    data: { enabled: true, awaiting_bracket: false, config: null, stages: [], markets: [], wallet: null },
                },
            })
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

        await route.fulfill({ json: { success: true, data: [] } })
    })
})

test('the achievements tab lists who is qualifying and fits a phone', async ({ page }) => {
    await page.goto(`/events/${SLUG}?tab=achievements`)

    await expect(page.getByText('The Prophet').first()).toBeVisible()
    await expect(page.getByText('Opens once the final is drawn')).toBeVisible()
    await expect(page.getByText('Awarded when the event ends').first()).toBeVisible()
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)
})

test('expanding a long qualifying list keeps the page within the viewport', async ({ page }) => {
    await page.goto(`/events/${SLUG}?tab=achievements`)

    const expand = page.getByRole('button', { name: 'Show all 11' })
    await expect(expand).toBeVisible()
    await expand.click()

    await expect(page.getByRole('button', { name: 'Show fewer' })).toBeVisible()
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)
})
