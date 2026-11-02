import type { Locator, Page } from '@playwright/test'
import type { FixtureData } from '../fixtures/data'
import { MODAL_ROOT, type MobileModal, type PageStep } from './types'

export type Row = Record<string, unknown>

export function heading(name: string | RegExp): PageStep {
    return async (page: Page) => {
        await page.getByRole('heading', { name, exact: typeof name === 'string' }).first().waitFor()
    }
}

export function seen(...keys: string[]): Record<string, string> {
    return Object.fromEntries(keys.map(key => [key, JSON.stringify({ seen: true, version: 1 })]))
}

export function rowsOf(value: unknown, key?: string): Row[] | undefined {
    const list = key && value && typeof value === 'object' && !Array.isArray(value) ? (value as Row)[key] : value
    return Array.isArray(list) ? list as Row[] : undefined
}

export function text(page: Page, value: string): Locator {
    return page.getByText(value, { exact: true }).first()
}

export function recordShown(row: Row, page: Page): Locator | null {
    const map = row.mapName ?? row.map
    const members = (rowsOf(row.members) ?? []).map(member => member.alias)
    const names = [row.alias, ...members, typeof map === 'string' ? map.replace(/^CTF-BT[-+]/, '') : null]
        .filter((name): name is string => typeof name === 'string' && name !== '')
    if (!names.length) return null
    return names
        .map(name => page.getByText(name, { exact: true }))
        .reduce((all, one) => all.or(one))
        .filter({ visible: true })
        .first()
}

export interface ListReady {
    heading?: string | RegExp
    rows: (data: FixtureData) => Row[] | undefined
    label: (row: Row, page: Page) => unknown
    empty: string | RegExp
}

export function listed({ heading: title, rows, label, empty }: ListReady): PageStep {
    return async (page, data) => {
        if (title) await heading(title)(page, data)
        const list = data && rows(data)
        if (!list) return
        const first = list.length ? label(list[0], page) : null
        if (typeof first === 'string' && first) await text(page, first).waitFor()
        else if (first && typeof first === 'object' && 'waitFor' in first) await (first as Locator).waitFor()
        else await page.getByText(empty).first().waitFor()
    }
}

export function steps(...all: PageStep[]): PageStep {
    return async (page, data) => {
        for (const step of all) await step(page, data)
    }
}

export function tap(locate: (page: Page) => Locator): PageStep {
    return async page => {
        await locate(page).click()
    }
}

export function shows(locate: (page: Page) => Locator): PageStep {
    return async page => {
        await locate(page).waitFor()
    }
}

const REPLAY_VIDEO = /^Replay —/
const REPLAY_UNAVAILABLE = 'Replay not available'

export function modalHeading(page: Page, name: string | RegExp): Locator {
    return page.locator(MODAL_ROOT).getByRole('heading', { name }).first()
}

export function watchesReplay(within: (page: Page) => Page | Locator = page => page): PageStep {
    return async page => {
        const buttons = within(page).locator('button:has(.lucide-play):enabled').filter({ visible: true })
        const count = await buttons.count()
        for (let index = 0; index < count; index += 1) {
            await buttons.nth(index).click()
            await modalHeading(page, REPLAY_VIDEO).or(modalHeading(page, REPLAY_UNAVAILABLE)).waitFor()
            if (await modalHeading(page, REPLAY_VIDEO).isVisible()) return
            await page.keyboard.press('Escape')
            await modalHeading(page, REPLAY_UNAVAILABLE).waitFor({ state: 'hidden' })
        }
        if (count) throw new Error('none of the replays on screen has a video')
    }
}

export function opens(trigger: (page: Page) => Locator, title: string | RegExp): PageStep {
    return async page => {
        await trigger(page).first().click()
        await modalHeading(page, title).waitFor()
    }
}

export function opensWhenShown(trigger: (page: Page) => Locator, title: string | RegExp): PageStep {
    return async page => {
        const button = trigger(page).filter({ visible: true }).first()
        if (await button.count() === 0) return
        await button.click()
        await modalHeading(page, title).waitFor()
    }
}

export const watchRun: MobileModal = {
    id: 'watch-run',
    label: 'Replay video',
    open: watchesReplay(),
}

export const wrHistory: MobileModal = {
    id: 'wr-progression',
    label: 'World record progression',
    open: opensWhenShown(page => page.getByRole('button', { name: 'View world record history' }), /^World Record Progression/),
}
