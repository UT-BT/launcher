import type { Page } from '@playwright/test'
import { MANAGED_EVENT_NAME, MANAGED_EVENT_SLUG } from '../fixtures/synthetic/event-manager'
import { signedInStorage } from '../fixtures/synthetic/session'
import { heading, modalHeading, shows, steps } from './steps'
import type { MobileRouteEntry, MobileSubView, PageStep } from './types'

function manageTabs(page: Page) {
    return page.getByRole('button', { name: 'Signups', exact: true }).locator('..')
}

function manageTab(id: string, label: string, ready: PageStep): MobileSubView {
    return {
        id,
        label: `Manage › ${label}`,
        open: async page => {
            await manageTabs(page).getByRole('button', { name: label, exact: true }).click()
        },
        ready: steps(heading(MANAGED_EVENT_NAME), ready),
    }
}

function text(value: string | RegExp): PageStep {
    return shows(page => page.getByText(value).filter({ visible: true }).first())
}

export const eventDetailManager: MobileRouteEntry = {
    view: 'event-detail',
    id: 'event-detail:manager',
    tier: 'role-gated',
    path: `/events/${MANAGED_EVENT_SLUG}?tab=manage`,
    fixtures: 'event-manager',
    storage: signedInStorage(),
    ready: steps(heading(MANAGED_EVENT_NAME), shows(page => manageTabs(page)), text('Volunteers')),
    subViews: [
        manageTab('format', 'Format', text('Tournament format')),
        manageTab('bracket', 'Bracket', text(/Group Stage/)),
        {
            ...manageTab('matches', 'Matches', shows(page => page.getByRole('region', { name: 'Matches' }).getByRole('heading', { name: 'Matches' }))),
            modals: [
                {
                    id: 'edit-match',
                    label: 'Edit match',
                    open: async page => {
                        await page.getByRole('region', { name: 'Matches' }).getByRole('button', { name: 'Edit' }).first().click()
                        await modalHeading(page, / vs /).waitFor()
                    },
                },
            ],
        },
        manageTab('pickban', 'Picks & Bans', shows(page => page.getByRole('region', { name: 'Match queue' }))),
        manageTab('schedule', 'Schedule', text('Windows')),
        manageTab('predictions', 'Predictions', text('No markets yet.')),
        { id: 'stream', label: 'Stream', path: `/events/${MANAGED_EVENT_SLUG}?tab=stream`, ready: steps(heading(MANAGED_EVENT_NAME), shows(page => page.getByRole('button', { name: 'Choose a streamer' }))) },
    ],
}
