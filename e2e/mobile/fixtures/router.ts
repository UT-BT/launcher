import type { Page, Route } from '@playwright/test'
import { mockApi } from '../../sidebarRail'
import { FIXTURE_SETS } from './index'
import type { ApiHost, FixtureReply, FixtureRoute, FixtureSet } from './types'

const API_HOSTS = /https:\/\/(api|gateway)\.utbt\.net\/.*/
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost'])
const BLANK_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')

function hostOf(url: URL): ApiHost {
    return url.hostname.startsWith('gateway.') ? 'gateway' : 'api'
}

function normalisedPath(url: URL): string {
    return url.pathname.replace(/\/$/, '') || '/'
}

function matches(route: FixtureRoute, url: URL): boolean {
    if (route.host !== hostOf(url)) return false
    const path = normalisedPath(url)
    return typeof route.path === 'string' ? route.path === path : route.path.test(path)
}

function fixtureSet(name: string): FixtureSet {
    const set = FIXTURE_SETS[name]
    if (!set) throw new Error(`no mobile fixture set named "${name}" (known: ${Object.keys(FIXTURE_SETS).join(', ')})`)
    return set
}

function findReply(set: FixtureSet, url: URL): FixtureReply | null {
    const route = set.routes.find(candidate => matches(candidate, url))
    if (!route) return null
    return typeof route.reply === 'function' ? route.reply(url) : route.reply
}

async function fulfil(route: Route, reply: FixtureReply) {
    await route.fulfill({ status: reply.status ?? 200, json: reply.json }).catch(() => undefined)
}

async function keepOffline(route: Route) {
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
        const reply = findReply(set, new URL(route.request().url()))
        if (!reply) return route.fallback()
        await fulfil(route, reply)
    })
}
