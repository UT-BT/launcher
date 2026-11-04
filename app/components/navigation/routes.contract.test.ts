import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'
import { canonicalPath, pathToNav, viewToPath } from './routes'
import { titleForRoute } from './titles'
import type { NavParams } from './NavigationContext'
import { STREAM_SCENES, parseStreamScenePath } from '../stream/streamScenes'
import { ADMIN_SECTIONS } from '../pages/admin/registry'

interface ContractRoute {
    path: string
    view: string
    kind: string
    params?: (keyof NavParams)[]
}

const contract: { version: number; routes: ContractRoute[] } = JSON.parse(
    readFileSync(resolve(__dirname, '../../public/route-contract.json'), 'utf8')
)

// route-contract.json must stay in sync with routes.ts: it drives per-URL link
// previews in the deployed build. If routes.ts gains a view and the contract
// doesn't, links to it unfurl as the generic site card — so drift fails here.

const SAMPLES: Record<string, string> = {
    mapName: 'CTF-BT-Aztec',
    playerId: '228152236587483136',
    teamId: '9ca5c141-f968-4bf1-b05f-2bd2af0611b3',
    capId: '762aae22-12a2-4be2-9045-db197d676953',
    teamCapId: '3059e580-ef39-4cd4-9759-48dd6bda72c4',
    newsId: '42',
    eventSlug: '2v2-cup-2026',
    matchId: '77',
    eventTeamId: '0afeb020-f471-4988-9201-2676902cc2b3',
}

const QUERIES: Record<string, string> = {
    'run-compare': 'runs=762aae22-12a2-4be2-9045-db197d676953,258021df-51b1-4ed3-99cc-62d4e75892a7&t=12.500',
}

function paramsFor(route: ContractRoute): NavParams {
    const result: NavParams = {}
    for (const key of route.params ?? []) {
        const raw = SAMPLES[key]
        ;(result as Record<string, unknown>)[key] = key === 'newsId' ? Number(raw) : raw
    }
    if (QUERIES[route.view]) result.compare = QUERIES[route.view]
    return result
}

function searchFor(route: ContractRoute): string {
    return QUERIES[route.view] ? `?${QUERIES[route.view]}` : ''
}

function concretePath(route: ContractRoute): string {
    return (route.params ?? []).reduce(
        (path, key) => path.replace(`:${key}`, encodeURIComponent(SAMPLES[key])),
        route.path,
    )
}

describe('route contract', () => {
    it('covers every view viewToPath knows about', () => {
        const source = readFileSync(resolve(__dirname, 'routes.ts'), 'utf8')
        const body = source.slice(source.indexOf('export function viewToPath'), source.indexOf('export function pathToNav'))
        const views = [...body.matchAll(/case '([^']+)':/g)].map(m => m[1])

        expect(views.length).toBeGreaterThan(0)
        expect([...contract.routes.map(r => r.view)].sort()).toEqual([...views].sort())
    })

    it('has a unique kind per route', () => {
        const kinds = contract.routes.map(r => r.kind)
        expect(new Set(kinds).size).toBe(kinds.length)
    })

    it.each(contract.routes)('$kind round-trips through viewToPath and pathToNav', route => {
        const params = paramsFor(route)
        expect(viewToPath(route.view, params)).toBe(concretePath(route) + searchFor(route))

        const parsed = pathToNav(concretePath(route), searchFor(route))
        expect(parsed.view).toBe(route.view)
        expect(parsed.params).toEqual(params)
    })

    it.each(contract.routes)('$kind has a non-default tab title', route => {
        const title = titleForRoute(route.view, paramsFor(route))
        expect(title).not.toBe('UTBT.net')
        expect(title.length).toBeGreaterThan(0)
    })
})

interface ManifestEntry {
    view: string
    id?: string
    tier: 'public' | 'role-gated'
    subViews?: { id: string }[]
}

const MOBILE_MANIFEST_MODULE = '../../../e2e/mobile/manifest'

const { MOBILE_MANIFEST }: { MOBILE_MANIFEST: readonly ManifestEntry[] } = await import(MOBILE_MANIFEST_MODULE)

function entryId(entry: ManifestEntry): string {
    return entry.id ?? entry.view
}

const ROLE_GATED_ENTRIES = ['admin', 'home:signed-in', 'maps:signed-in', 'event-detail:manager', 'match-pickban:captain', 'match-pickban:manager']

describe('mobile route manifest', () => {
    const entries = new Map(MOBILE_MANIFEST.map(entry => [entryId(entry), entry]))
    const contractViews = new Set(contract.routes.map(route => route.view))

    it.each(contract.routes)('$kind has a mobile manifest entry for its view', route => {
        expect(entries.get(route.view), `e2e/mobile/manifest has no entry for the ${route.view} view; add one (agents/testing.md, Mobile route manifest)`).toBeDefined()
    })

    it.each(MOBILE_MANIFEST.map(entry => ({ id: entryId(entry), view: entry.view })))('the $id manifest entry names a contract view', ({ id, view }) => {
        expect(contractViews.has(view), `${id} names the ${view} view, which route-contract.json does not have`).toBe(true)
    })

    it.each(ROLE_GATED_ENTRIES)('crawls %s as a role-gated entry', id => {
        expect(entries.get(id)?.tier, `e2e/mobile/manifest has no role-gated ${id} entry`).toBe('role-gated')
    })

    it('names each role-gated entry on a public view <view>:<who>', () => {
        for (const [id, entry] of entries) {
            if (id === entry.view) continue
            expect(id, `${id} is a second entry for ${entry.view}`).toMatch(new RegExp(`^${entry.view}:[a-z-]+$`))
            expect(entry.tier, `${id} is a second entry for ${entry.view}`).toBe('role-gated')
        }
    })

    it.each(ADMIN_SECTIONS.map(section => section.id))('crawls the %s admin section', id => {
        const admin = entries.get('admin')
        const crawled = [ADMIN_SECTIONS[0].id, ...(admin?.subViews ?? []).map(subView => subView.id)]
        expect(crawled, `the admin manifest entry has no sub-view for the ${id} section`).toContain(id)
    })
})

describe('malformed urls', () => {
    it('does not throw on a malformed percent escape', () => {
        for (const path of ['/maps/50%', '/maps/%', '/players/%zz', '/maps/%E0%A4%A', '/%']) {
            expect(() => pathToNav(path, '')).not.toThrow()
        }
    })

    it('still resolves a view for an undecodable path instead of failing', () => {
        expect(pathToNav('/maps/50%', '').view).toBeTruthy()
        expect(pathToNav('/%', '').view).toBe('home')
    })

    it('decodes ordinary escaped map names as before', () => {
        expect(pathToNav('/maps/CTF-BT-CM24%20Winter', '').params.mapName).toBe('CTF-BT-CM24 Winter')
    })
})

describe('the compare route', () => {
    const A = '0a0a0a0a-0000-4000-8000-00000000000a'
    const B = '0b0b0b0b-0000-4000-8000-00000000000b'

    it('carries the query string as it arrived, without the question mark', () => {
        expect(pathToNav('/compare', `?runs=${B},${A}&t=3.5&utm_source=x`)).toEqual({
            view: 'run-compare',
            params: { compare: `runs=${B},${A}&t=3.5&utm_source=x` },
        })
    })

    it('opens an empty comparison without a query string', () => {
        expect(pathToNav('/compare', '')).toEqual({ view: 'run-compare', params: {} })
        expect(viewToPath('run-compare', {})).toBe('/compare')
    })

    it('leaves a longer path off the compare page', () => {
        expect(pathToNav('/compare/extra', `?runs=${A}`).view).not.toBe('run-compare')
    })

    it('keeps only the sorted run list in the canonical link', () => {
        expect(canonicalPath('run-compare', { compare: `runs=${B},${A}&ref=${A}&sync=position&t=3.000` })).toBe(`/compare?runs=${A},${B}`)
    })

    it('has a bare canonical link when no run is listed', () => {
        expect(canonicalPath('run-compare', { compare: 't=3.000' })).toBe('/compare')
    })

    it('leaves every other route canonical at its own path', () => {
        expect(canonicalPath('event-detail', { eventSlug: 'cup', eventTab: 'schedule' })).toBe('/events/cup?tab=schedule')
        expect(canonicalPath('maps', { mapsNewOnly: true })).toBe('/maps?new=1')
    })
})

describe('the stream sub-route', () => {
    it('is never resolved as match-pickban by pathToNav, since it is handled before the app shell mounts', () => {
        expect(pathToNav('/events/cup/matches/77/stream', '').view).not.toBe('match-pickban')
    })
})

describe('the event team route', () => {
    it('resolves a team id under an event to the team page', () => {
        expect(pathToNav('/events/2v2-cup-2026/teams/0afeb020-f471-4988-9201-2676902cc2b3', '')).toEqual({
            view: 'event-team',
            params: { eventSlug: '2v2-cup-2026', eventTeamId: '0afeb020-f471-4988-9201-2676902cc2b3' },
        })
    })

    it('leaves a teams path without an id, or with extra segments, on the event page', () => {
        expect(pathToNav('/events/2v2-cup-2026/teams', '').view).toBe('event-detail')
        expect(pathToNav('/events/2v2-cup-2026/teams/abc/extra', '').view).toBe('event-detail')
    })

    it('builds the team path from its params', () => {
        expect(viewToPath('event-team', { eventSlug: 'cup 2026', eventTeamId: 'a/b' })).toBe('/events/cup%202026/teams/a%2Fb')
    })
})

describe('the stream scene routes', () => {
    const scenePaths = [...STREAM_SCENES.map(scene => scene.id), 'scoreboard'].map(
        scene => `/stream/${SAMPLES.eventSlug}/${SAMPLES.playerId}/${scene}`
    )
    const fallbackView = pathToNav('/no-such-page', '').view

    it('have no entry in the route contract', () => {
        for (const route of contract.routes) {
            expect(route.path.split('/')[1]).not.toBe('stream')
        }
    })

    it.each(scenePaths)('%s is claimed by the stream root before the app shell mounts', path => {
        expect(parseStreamScenePath(path)).not.toBeNull()
    })

    it.each(scenePaths)('%s never resolves to an app view', path => {
        expect(pathToNav(path, '').view).toBe(fallbackView)
        expect(pathToNav(path, '?preview=1&sound=0').view).toBe(fallbackView)
    })

    it.each(contract.routes)('the stream root never claims the $kind route', route => {
        expect(parseStreamScenePath(concretePath(route))).toBeNull()
    })
})

describe('robots.txt', () => {
    const disallowed = readFileSync(resolve(__dirname, '../../public/robots.txt'), 'utf8')
        .split(/\r?\n/)
        .filter(line => line.startsWith('Disallow:'))
        .map(line => line.slice('Disallow:'.length).trim())
        .map(pattern => new RegExp(`^${pattern.split('*').map(part => part.replace(/[.?+^$()[\]{}|\\]/g, '\\$&')).join('.*')}`))

    function crawlable(path: string): boolean {
        return !disallowed.some(pattern => pattern.test(path))
    }

    it.each([
        '/stream/2v2-cup-2026/228152236587483136/overlay',
        '/stream/2v2-cup-2026/228152236587483136/starting-soon?preview=1',
        '/stream/cup/42/scoreboard',
        '/events/2v2-cup-2026/matches/77/stream',
        '/events/2v2-cup-2026/matches/77/stream?sound=0&volume=70',
    ])('keeps crawlers off %s', path => {
        expect(crawlable(path)).toBe(false)
    })

    it.each(contract.routes.filter(route => route.view !== 'admin'))('leaves the $kind route crawlable', route => {
        expect(crawlable(concretePath(route))).toBe(true)
    })
})
