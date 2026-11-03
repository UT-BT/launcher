import type { Page, Route } from '@playwright/test'
import { mockApi } from '../../sidebarRail'
import { replyFor } from './data'
import { FIXTURE_SETS, fixtureSetNamed } from './index'
import type { FixtureReply, FixtureSet } from './types'

const API_HOSTS = /https:\/\/(api|gateway)\.utbt\.net\/.*/
export const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost'])
const BLANK_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')

function fixtureSet(name: string): FixtureSet {
    const set = fixtureSetNamed(name)
    if (!set) throw new Error(`no mobile fixture set named "${name}" (known: ${Object.keys(FIXTURE_SETS).join(', ')})`)
    return set
}

async function fulfil(route: Route, reply: FixtureReply) {
    await route.fulfill({ status: reply.status ?? 200, json: reply.json }).catch(() => undefined)
}

export async function keepOffline(route: Route) {
    if (route.request().resourceType() === 'image') {
        await route.fulfill({ contentType: 'image/png', body: BLANK_PNG }).catch(() => undefined)
        return
    }
    await route.fulfill({ status: 404, body: '' }).catch(() => undefined)
}

export async function serveFixtureSet(page: Page, name: string) {
    const set = fixtureSet(name)
    await page.route(url => !LOCAL_HOSTS.has(url.hostname), keepOffline)
    await mockApi(page)
    await page.route(API_HOSTS, async route => {
        const reply = replyFor(set, new URL(route.request().url()))
        if (!reply) return route.fallback()
        await fulfil(route, reply)
    })
}
