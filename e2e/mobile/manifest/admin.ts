import type { Page } from '@playwright/test'
import { signedInStorage } from '../fixtures/synthetic/session'
import { fakeHwid, person, syntheticMap } from '../fixtures/synthetic/people'
import { heading, steps, tap } from './steps'
import type { MobileRouteEntry, MobileSubView, PageStep } from './types'

function shown(text: string | RegExp): PageStep {
    return async page => {
        await page.getByText(text).filter({ visible: true }).first().waitFor()
    }
}

function picksSection(id: string, label: string): PageStep {
    return async (page: Page) => {
        const picker = page.locator(`select:has(option[value="${id}"])`)
        if (await picker.isVisible()) await picker.selectOption(id)
        else await page.getByRole('button', { name: label, exact: true }).click()
    }
}

function section(id: string, label: string, title: string, data: string | RegExp): MobileSubView {
    return { id, label, open: picksSection(id, label), ready: steps(heading(title), shown(data)) }
}

function antiCheatTab(id: string, label: string, data: string | RegExp): MobileSubView {
    return {
        id: `anti-cheat-${id}`,
        label: `Anti-Cheat › ${label}`,
        open: steps(picksSection('anti-cheat', 'Anti-Cheat'), heading('Anti-Cheat'), tap(page => page.getByRole('button', { name: new RegExp(`^${label}`) }))),
        ready: steps(heading('Anti-Cheat'), shown(data)),
    }
}

export const admin: MobileRouteEntry = {
    view: 'admin',
    tier: 'role-gated',
    path: '/admin',
    fixtures: 'admin',
    storage: signedInStorage(),
    ready: steps(heading('Overview'), shown('Active bans')),
    subViews: [
        section('usage-health', 'Usage & Health', 'Usage & Health', 'Signed-in users'),
        section('user-management', 'User Management', 'User Management', person(1).alias),
        section('title-management', 'Title Management', 'Title Management', 'Test Title 2'),
        section('news-management', 'News', 'News', /^Test announcement 1:/),
        section('events-management', 'Events', 'Events', /^Test Cup 2026 Autumn Edition$/),
        section('formats-management', 'Tournament Formats', 'Templates', 'Groups then double elimination'),
        section('streamers', 'Streamers', 'Streamers', person(40).alias),
        section('caps-management', 'Caps Management', 'Caps Management', person(1).alias),
        section('maps-management', 'Maps Management', 'Maps Management', syntheticMap(1).replace(/^CTF-BT-/, '')),
        section('map-uploads', 'Map Uploads', 'Map Uploads', /Baz/),
        section('patches-management', 'Patch Releases', 'Patch Releases', 'v4.8.0'),
        section('anti-cheat', 'Anti-Cheat', 'Anti-Cheat', fakeHwid(0)),
        antiCheatTab('cap-delta', 'High Cap Delta', person(6).alias),
        antiCheatTab('low-fps', 'Low FPS WRs', person(10).alias),
        section('audit-logs', 'Audit Logs', 'Audit Logs', person(12).alias),
        section('role-management', 'Staff Roles', 'Staff Roles', person(31).alias),
        section('hosts-management', 'Game Hosts', 'Game Hosts', 'test-host-eu'),
    ],
}
