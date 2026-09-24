import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'
import { pathToNav, viewToPath } from './routes'
import { titleForRoute } from './titles'
import type { NavParams } from './NavigationContext'

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
}

function paramsFor(route: ContractRoute): NavParams {
    const result: NavParams = {}
    for (const key of route.params ?? []) {
        const raw = SAMPLES[key]
        ;(result as Record<string, unknown>)[key] = key === 'newsId' ? Number(raw) : raw
    }
    return result
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
        expect(viewToPath(route.view, params)).toBe(concretePath(route))

        const parsed = pathToNav(concretePath(route), '')
        expect(parsed.view).toBe(route.view)
        for (const key of route.params ?? []) {
            expect(parsed.params[key]).toBe(params[key])
        }
    })

    it.each(contract.routes)('$kind has a non-default tab title', route => {
        const title = titleForRoute(route.view, paramsFor(route))
        expect(title).not.toBe('UTBT.net')
        expect(title.length).toBeGreaterThan(0)
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

describe('the stream sub-route', () => {
    it('is never resolved as match-pickban by pathToNav, since it is handled before the app shell mounts', () => {
        expect(pathToNav('/events/cup/matches/77/stream', '').view).not.toBe('match-pickban')
    })
})
