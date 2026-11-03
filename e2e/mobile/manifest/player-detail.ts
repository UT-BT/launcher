import type { Page } from '@playwright/test'
import { listed, opensWhenShown, rowsOf, shows, tap, watchRun } from './steps'
import type { MobileRouteEntry, MobileSubView, PageStep } from './types'

export const PLAYER_ID = '778035658224697377'

const ANY_TEXT = /\w/

function tabButton(page: Page, name: RegExp) {
    return page.getByRole('button', { name })
}

function tableTab(id: string, label: string, name: RegExp, cards: string, empty: RegExp): MobileSubView {
    return {
        id,
        label,
        open: tap(page => tabButton(page, name)),
        ready: shows(page => page.getByRole('list', { name: cards }).filter({ hasText: ANY_TEXT })
            .or(page.locator('table tbody tr').filter({ hasText: ANY_TEXT }))
            .or(page.getByText(empty))
            .first()),
    }
}

const achievementsShown: PageStep = listed({
    rows: data => rowsOf(data.api('/v2/achievements/definitions'), 'achievements'),
    label: row => row.name,
    empty: 'No achievements to show yet.',
})

export const playerDetail: MobileRouteEntry = {
    view: 'player-detail',
    tier: 'public',
    path: `/players/${PLAYER_ID}`,
    fixtures: 'player-detail',
    decorative: [],
    ready: shows(page => page.getByRole('list', { name: 'Caps' }).filter({ hasText: ANY_TEXT })
        .or(page.locator('table tbody tr').filter({ hasText: ANY_TEXT }))
        .or(page.getByText(/^No caps/))
        .first()),
    stress: { pr: 'single-row' },
    modals: [
        {
            id: 'reviews-written',
            label: 'Reviews written',
            open: opensWhenShown(page => page.getByRole('button', { name: 'View all' }).first(), /^Reviews Written/),
        },
        {
            id: 'favorite-maps',
            label: 'Favorite maps',
            open: opensWhenShown(page => page.getByRole('button', { name: 'View all' }).nth(1), /^Favorite Maps/),
        },
        watchRun,
    ],
    subViews: [
        tableTab('disallowed', 'Disallowed', /^Disallowed/, 'Disallowed caps', /^No disallowed caps/),
        { ...tableTab('personal-bests', 'Personal Bests', /^Personal Bests/, 'Personal bests', /^No personal bests/), stress: { pr: 'long-text' }, modals: [watchRun] },
        {
            ...tableTab('world-records', 'World Records', /^World Records/, 'World records', /^No world records/),
            stress: { pr: 'most-columns' },
            modals: [
                {
                    id: 'wr-progression',
                    label: 'World record progression',
                    open: opensWhenShown(page => page.getByRole('button', { name: 'View WR progression' }), /^World Record Progression/),
                },
            ],
        },
        tableTab('playtime', 'Playtime by Map', /^Playtime by Map$/, 'Playtime by map', /^No playtime/),
        tableTab('uncapped', 'Uncapped Maps', /^Uncapped Maps/, 'Uncapped maps', /no uncapped maps/),
        { id: 'achievements', label: 'Achievements', open: tap(page => tabButton(page, /^Achievements$/)), ready: achievementsShown },
        tableTab('maps-authored', 'Maps Authored', /^Maps Authored/, 'Authored maps', /^No maps/),
    ],
}
