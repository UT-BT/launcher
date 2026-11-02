import { describe, expect, it } from 'vitest'
import { RECORDED_SETS } from '../index'
import { recordedFixtureSet } from '../recording'
import type { FixtureRoute } from '../types'
import { SYNTHETIC_ID_PREFIX } from './people'
import { SYNTHETIC_SETS } from './index'

const DOCUMENTATION_RANGES = ['192.0.2.', '198.51.100.', '203.0.113.']
const RECORDED_PATHS = new Set(RECORDED_SETS.flatMap(set => recordedFixtureSet(set).routes.map(route => `${route.host} ${String(route.path)}`)))

function samplePath(pattern: RegExp): string {
    return pattern.source
        .replace(/^\^|\$$/g, '')
        .replace(/\\d\+/g, '1')
        .replace(/\[\^\/\]\+/g, 'sample')
        .replace(/\\\//g, '/')
}

function bodyOf(route: FixtureRoute): unknown {
    const path = typeof route.path === 'string' ? route.path : samplePath(route.path)
    const url = new URL(`https://${route.host}.utbt.net${path}?limit=50&offset=0`)
    if (typeof route.path !== 'string') expect(route.path.test(path), `no sample path for ${route.path}`).toBe(true)
    return typeof route.reply === 'function' ? route.reply(url).json : route.reply.json
}

function syntheticRoutes(): { where: string; body: unknown }[] {
    return SYNTHETIC_SETS.flatMap(set => set.routes
        .filter(route => !RECORDED_PATHS.has(`${route.host} ${String(route.path)}`))
        .map(route => ({ where: `${set.name} ${String(route.path)}`, body: bodyOf(route) })))
}

function strings(value: unknown, keys: string[] = []): { keys: string[]; value: string }[] {
    if (typeof value === 'string') return [{ keys, value }]
    if (typeof value === 'number' && Number.isInteger(value)) return [{ keys, value: String(value) }]
    if (Array.isArray(value)) return value.flatMap(item => strings(item, keys))
    if (value && typeof value === 'object') return Object.entries(value).flatMap(([key, item]) => strings(item, [...keys, key]))
    return []
}

const ROUTES = syntheticRoutes()
const VALUES = ROUTES.flatMap(({ where, body }) => strings(body).map(entry => ({ where, ...entry })))

describe('synthetic fixture sets', () => {
    it('serve data for every route', () => {
        expect(ROUTES.length).toBeGreaterThan(40)
        for (const { where, body } of ROUTES) expect(body, where).toBeDefined()
    })

    it('use only documentation IP ranges', () => {
        const ips = VALUES.flatMap(({ where, value }) => (value.match(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g) ?? []).map(ip => ({ where, ip })))
        expect(ips.length).toBeGreaterThan(0)
        for (const { where, ip } of ips) expect(DOCUMENTATION_RANGES.some(range => ip.startsWith(range)), `${where}: ${ip}`).toBe(true)
    })

    it('use only obviously fake hardware ids', () => {
        const hwids = VALUES.filter(({ keys, value }) => {
            const key = keys[keys.length - 1] ?? ''
            return /hwid/i.test(key) || (key === 'value' && keys.some(parent => /hwid/i.test(parent))) || (/hwid/i.test(value) && key !== 'type')
        })
        expect(hwids.length).toBeGreaterThan(0)
        for (const { where, value } of hwids) expect(value, where).toMatch(/^FAKE-HWID-\d{4}-0000-0000-TEST$/)
    })

    it('use only synthetic player ids', () => {
        const ids = VALUES.filter(({ value }) => /^\d{15,20}$/.test(value))
        expect(ids.length).toBeGreaterThan(0)
        for (const { where, value } of ids) expect(value.startsWith(SYNTHETIC_ID_PREFIX), `${where}: ${value}`).toBe(true)
    })

    it('hold no email addresses or tokens', () => {
        for (const { where, value } of VALUES) {
            expect(value, where).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/)
            expect(value, where).not.toMatch(/^eyJ|^bearer /i)
        }
    })
})
