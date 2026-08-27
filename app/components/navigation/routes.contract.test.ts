import { readdirSync, readFileSync } from 'fs'
import { join, relative, resolve, sep } from 'path'
import { describe, expect, it } from 'vitest'
import { pathToNav, viewToPath } from './routes'
import { titleForRoute } from './titles'
import { capTimeTarget } from '@/app/components/shared/capTimeTarget'
import { isTeamRunRow, teamRunCapId } from '@/app/components/shared/runDemo'
import type { NavParams } from './NavigationContext'

interface ContractRoute {
    path: string
    view: string
    kind: string
    param?: keyof NavParams
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
}

function paramsFor(route: ContractRoute): NavParams {
    if (!route.param) return {}
    const raw = SAMPLES[route.param]
    return { [route.param]: route.param === 'newsId' ? Number(raw) : raw } as NavParams
}

function concretePath(route: ContractRoute): string {
    if (!route.param) return route.path
    return route.path.replace(`:${route.param}`, encodeURIComponent(SAMPLES[route.param]))
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
        if (route.param) expect(parsed.params[route.param]).toBe(params[route.param])
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


describe('team cap deep links', () => {
    const CAP_ID = SAMPLES.capId
    const TEAM_CAP_ID = SAMPLES.teamCapId

    it('keeps solo and team cap detail on separate paths', () => {
        expect(viewToPath('cap-detail', { capId: CAP_ID })).toBe(`/caps/${CAP_ID}`)
        expect(viewToPath('team-cap-detail', { teamCapId: TEAM_CAP_ID })).toBe(`/team-caps/${TEAM_CAP_ID}`)
        expect(viewToPath('cap-detail', { capId: CAP_ID }))
            .not.toBe(viewToPath('team-cap-detail', { teamCapId: TEAM_CAP_ID }))
    })

    it('never resolves a team cap url onto the solo cap page', () => {
        const parsed = pathToNav(`/team-caps/${TEAM_CAP_ID}`, '')
        expect(parsed.view).toBe('team-cap-detail')
        expect(parsed.params.teamCapId).toBe(TEAM_CAP_ID)
        expect(parsed.params.capId).toBeUndefined()
    })

    it('never resolves a solo cap url onto the team cap page', () => {
        const parsed = pathToNav(`/caps/${CAP_ID}`, '')
        expect(parsed.view).toBe('cap-detail')
        expect(parsed.params.capId).toBe(CAP_ID)
        expect(parsed.params.teamCapId).toBeUndefined()
    })

    it('falls back to home for a bare team cap path, as pathToNav does for caps', () => {
        expect(pathToNav('/team-caps', '').view).toBe('home')
        expect(pathToNav('/caps', '').view).toBe('home')
    })

    it('routes a team row through the team cap contract end to end', () => {
        const target = capTimeTarget(undefined, TEAM_CAP_ID)!
        const path = viewToPath(target.view, target.params)
        const parsed = pathToNav(path, '')

        expect(contract.routes.find(r => r.view === target.view)?.kind).toBe('team-cap')
        expect(parsed.view).toBe('team-cap-detail')
        expect(parsed.params.teamCapId).toBe(TEAM_CAP_ID)
    })

    it('routes a solo row through the cap contract end to end', () => {
        const target = capTimeTarget(CAP_ID, null)!
        const path = viewToPath(target.view, target.params)
        const parsed = pathToNav(path, '')

        expect(contract.routes.find(r => r.view === target.view)?.kind).toBe('cap')
        expect(parsed.view).toBe('cap-detail')
        expect(parsed.params.capId).toBe(CAP_ID)
    })

    it('gives the team cap route its own tab title', () => {
        const soloTitle = titleForRoute('cap-detail', { capId: CAP_ID })
        const teamTitle = titleForRoute('team-cap-detail', { teamCapId: TEAM_CAP_ID })

        expect(teamTitle).not.toBe('UTBT.net')
        expect(teamTitle).not.toBe(soloTitle)
    })
})


describe('team rows on an api that sends no team cap id', () => {
    const TEAM_CAP_ID = SAMPLES.teamCapId
    const CAP_ID = SAMPLES.capId

    const legacyTeamRow = {
        cap_id: TEAM_CAP_ID,
        cap_time_seconds: 83.88,
        user_id: null,
        members: [
            { cap_id: '934e9a03-4c72-4d1b-9f88-2a6b5c3d1e40', cap_time_seconds: 83.813, alias: 'dsn' },
            { cap_id: '46a4177f-8d34-4e29-b7a1-5c9f0e2d3b17', cap_time_seconds: 83.88, alias: 'TriGGeR' },
        ],
    }

    const legacySoloRow = {
        cap_id: CAP_ID,
        cap_time_seconds: 41.2,
        user_id: '228152236587483136',
        members: null,
    }

    it('still routes a team row to the team cap page', () => {
        expect(isTeamRunRow(legacyTeamRow)).toBe(true)

        const target = capTimeTarget(undefined, teamRunCapId(legacyTeamRow))!
        const parsed = pathToNav(viewToPath(target.view, target.params), '')

        expect(parsed.view).toBe('team-cap-detail')
        expect(parsed.params.teamCapId).toBe(TEAM_CAP_ID)
        expect(parsed.params.capId).toBeUndefined()
    })

    it('still routes a solo row to the solo cap page', () => {
        expect(isTeamRunRow(legacySoloRow)).toBe(false)

        const target = capTimeTarget(legacySoloRow.cap_id, teamRunCapId(legacySoloRow))!
        const parsed = pathToNav(viewToPath(target.view, target.params), '')

        expect(parsed.view).toBe('cap-detail')
        expect(parsed.params.capId).toBe(CAP_ID)
    })

    it('prefers the explicit team cap id once the api sends one', () => {
        const upgraded = { ...legacyTeamRow, team_cap_id: SAMPLES.teamCapId, cap_id: CAP_ID }

        expect(teamRunCapId(upgraded)).toBe(SAMPLES.teamCapId)
    })
})

const RENDERER_ROOT = resolve(__dirname, '../..')
const SHARED_REPLAY_HOOK = 'hooks/useReplayWatch.ts'

const KNOWN_INDIVIDUAL_CAP_IDS: Record<string, string[]> = {
    'components/pages/CapDetailPage.tsx': ['cap.id'],
    'components/pages/TeamCapDetailPage.tsx': ['member.cap_id'],
    'components/pages/mapDetail/LeaderboardCard.tsx': ['entry.id'],
}

interface RendererSource {
    path: string
    text: string
}

function collectRendererSources(dir: string, acc: RendererSource[] = []): RendererSource[] {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name)
        if (entry.isDirectory()) {
            collectRendererSources(full, acc)
            continue
        }
        if (!/\.tsx?$/.test(entry.name) || /\.test\.tsx?$/.test(entry.name)) continue
        acc.push({ path: relative(RENDERER_ROOT, full).split(sep).join('/'), text: readFileSync(full, 'utf8') })
    }
    return acc
}

function balancedBlocks(text: string, marker: string): string[] {
    const blocks: string[] = []
    let at = text.indexOf(marker)
    while (at !== -1) {
        const open = at + marker.length - 1
        let depth = 0
        let i = open
        for (; i < text.length; i++) {
            const ch = text[i]
            if (ch === '(' || ch === '{' || ch === '[') depth++
            else if (ch === ')' || ch === '}' || ch === ']') {
                depth--
                if (depth === 0) break
            }
        }
        blocks.push(text.slice(open + 1, i))
        at = text.indexOf(marker, at + marker.length)
    }
    return blocks
}

function topLevelArgs(block: string): string[] {
    const args: string[] = []
    let depth = 0
    let start = 0
    for (let i = 0; i < block.length; i++) {
        const ch = block[i]
        if (ch === '(' || ch === '{' || ch === '[') depth++
        else if (ch === ')' || ch === '}' || ch === ']') depth--
        else if (ch === ',' && depth === 0) {
            args.push(block.slice(start, i))
            start = i + 1
        }
    }
    args.push(block.slice(start))
    return args.map(arg => arg.trim()).filter(arg => arg.length > 0)
}

function capIdArgument(block: string): string | null {
    const match = block.match(/(?:^|[\s,{])capId\s*:\s*([^,\n]+)/)
    return match ? match[1].trim() : null
}

function namesARunDemo(expression: string, path: string): boolean {
    if (/demo/i.test(expression)) return true
    return (KNOWN_INDIVIDUAL_CAP_IDS[path] ?? []).includes(expression)
}

describe('ids handed to the demo converter', () => {
    const sources = collectRendererSources(RENDERER_ROOT)

    it('scans the call sites it is meant to police', () => {
        const watchers = sources.filter(source => source.text.includes('openReplay({'))
        const downloaders = sources.filter(source => source.text.includes('demoDownload.start('))

        expect(watchers.length).toBeGreaterThan(5)
        expect(downloaders.length).toBeGreaterThan(5)
    })

    it('never watches a replay from a team cap id', () => {
        for (const { path, text } of sources) {
            for (const block of balancedBlocks(text, 'openReplay(')) {
                const expression = capIdArgument(block)
                if (expression == null) continue
                expect(expression, `${path} openReplay capId`).not.toMatch(/team/i)
                expect(namesARunDemo(expression, path), `${path} openReplay capId ${expression}`).toBe(true)
            }
        }
    })

    it('never downloads a demo from a team cap id', () => {
        for (const { path, text } of sources) {
            for (const block of balancedBlocks(text, 'demoDownload.start(')) {
                const args = topLevelArgs(block)
                expect(args.length, `${path} demoDownload.start`).toBeGreaterThanOrEqual(2)
                expect(args[0], `${path} demoDownload.start row`).not.toMatch(/team/i)
                if (args.length < 3) continue
                expect(args[2], `${path} demoDownload.start demo id`).not.toMatch(/team/i)
                expect(namesARunDemo(args[2], path), `${path} demoDownload.start demo id ${args[2]}`).toBe(true)
            }
        }
    })

    it('never resolves a replay from a team cap id outside the shared watcher', () => {
        for (const { path, text } of sources) {
            if (path === SHARED_REPLAY_HOOK) continue
            for (const block of balancedBlocks(text, 'resolveReplayForCap(')) {
                expect(block.trim(), `${path} resolveReplayForCap`).not.toMatch(/team/i)
            }
        }
    })
})
