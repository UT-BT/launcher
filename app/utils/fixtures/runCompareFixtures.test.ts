import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import capDetailCandidatesFile from './runCompare/cap_detail_candidates.json'
import capDetailGhostOnlyFile from './runCompare/cap_detail_ghost_only.json'
import chartRulesFile from './runCompare/chart_rules.json'
import compareAlignedFile from './runCompare/compare_aligned.json'
import compareErrorsFile from './runCompare/compare_errors.json'
import compareLongFile from './runCompare/compare_long.json'
import compareMotionFile from './runCompare/compare_motion.json'
import compareNeverRejoinsFile from './runCompare/compare_never_rejoins.json'
import compareRoutesDifferFile from './runCompare/compare_routes_differ.json'
import compareSeparatedFile from './runCompare/compare_separated.json'
import compareShortFile from './runCompare/compare_short.json'
import teamCapDetailMembersFile from './runCompare/team_cap_detail_members.json'
import {
    CHART_RULES_FILE,
    RUN_COMPARE_ERRORS_FILE,
    RUN_COMPARE_FIXTURES,
    chartRuleVectors,
    runCompareErrorResponse,
    runCompareErrors,
    runCompareFixture,
    runCompareFixtureResponse,
    type ChartRuleVectors,
    type RunCompareComparisonName,
    type RunCompareErrorEntry,
    type RunCompareFixtureName,
} from './runCompareFixtures'
import {
    CAP_COMPARISON_ERROR_CODES,
    CAP_COMPARISON_STATES,
    fetchCapComparison,
    fetchCapComparisonMotion,
    fetchCapDetail,
    fetchTeamCapDetail,
    type CapCompareCandidate,
    type CapComparison,
    type CapComparisonMotion,
    type CapComparisonRun,
    type CapComparisonSector,
    type CapComparisonSeparation,
    type CapDetail,
    type CapRecord,
    type TeamCapDetail,
} from '@/app/utils/api'

type Loose<T> = T extends string
    ? string
    : T extends number
      ? number
      : T extends boolean
        ? boolean
        : T extends readonly (infer U)[]
          ? Loose<U>[]
          : T extends object
            ? { [K in keyof T]: Loose<T[K]> }
            : T

interface Envelope<T> {
    success: boolean
    data: Loose<T>
}

const TYPED_FILES: Record<RunCompareFixtureName, unknown> = {
    aligned: compareAlignedFile satisfies Envelope<CapComparison>,
    separated: compareSeparatedFile satisfies Envelope<CapComparison>,
    neverRejoins: compareNeverRejoinsFile satisfies Envelope<CapComparison>,
    long: compareLongFile satisfies Envelope<CapComparison>,
    short: compareShortFile satisfies Envelope<CapComparison>,
    routesDiffer: compareRoutesDifferFile satisfies Envelope<CapComparison>,
    motion: compareMotionFile satisfies Envelope<CapComparisonMotion>,
    capDetailCandidates: capDetailCandidatesFile satisfies Envelope<CapDetail>,
    capDetailGhostOnly: capDetailGhostOnlyFile satisfies Envelope<CapDetail>,
    teamCapDetailMembers: teamCapDetailMembersFile satisfies Envelope<TeamCapDetail>,
}

const TYPED_ERRORS = compareErrorsFile satisfies Loose<RunCompareErrorEntry>[]
const TYPED_CHART_RULES = chartRulesFile satisfies Loose<ChartRuleVectors>

const FIXTURE_DIR = resolve(__dirname, 'runCompare')

const PINNED_SHA256: Record<string, string> = {
    'cap_detail_candidates.json': 'c369ce35fcf6b3ee8a7ae0f1a4aeffa730343194a0e7e1c7c3b7900adddd5b1d',
    'cap_detail_ghost_only.json': 'a79f5bed410aa27a93068b6d43d0c26575dce621d6d94a3714861850740ad545',
    'chart_rules.json': 'ce8d93db54974040a8e7110e47f42969bbf75cbc23c3881a907d8a3f828b48ae',
    'compare_aligned.json': '06c383fe69c7a5a82d3384dd23bc457ad880a4298c8167b19e87820234dc80d3',
    'compare_errors.json': '9e7921e24e5c072ea24f9f8dc7bbfc4a952fb2955cda80f0fb8a8e1300358df6',
    'compare_motion.json': '5b711bd6e5235e1598936214e822da58e3b5bf5ebcad727e00b4ab7d95605110',
    'compare_long.json': '07ee496d66eba46c4a183898f9a7d9e5293540f0ad29e7444a7fd63e0651ddb2',
    'compare_never_rejoins.json': 'd310365864feabf40fa24b7df6f4da2e2f3b253b73b590d7124dc27e413b4714',
    'compare_routes_differ.json': 'c58feeaf51c790d0b7823ed1f64ec5fe3b74d7acccfb5aabc8f36c263d11e2bd',
    'compare_separated.json': '2347d7c7b667d87fb1d8a989b34c8b101d36fe0c950522018498cbe27ba1a321',
    'compare_short.json': '56d3aaeefb13934ae84081fb03d55ac8a5eb1875ac67b94345680bb4606cbc1a',
    'team_cap_detail_members.json': '6356a08956273adfb0b32244692646f6a64bd6a05f2395c8a28641f53c9cec19',
}

const COMPARISON_KEYS = {
    algo_version: true,
    state: true,
    runner: true,
    reference: true,
    duration_ms: true,
    final_delta_ms: true,
    coverage: true,
    segments: true,
    separations: true,
    sectors: true,
    speed: true,
} satisfies Record<keyof CapComparison, true>

const RUN_KEYS = { cap_id: true, user: true, alias: true, team: true, cap_time_ms: true } satisfies Record<keyof CapComparisonRun, true>

const SEPARATION_KEYS = {
    start_ms: true,
    end_ms: true,
    start_delta_ms: true,
    end_delta_ms: true,
    rejoined: true,
} satisfies Record<keyof CapComparisonSeparation, true>

const SECTOR_KEYS = {
    index: true,
    end_ms: true,
    split_ms: true,
    delta_split_ms: true,
    delta_total_ms: true,
    separated: true,
    runner_distance_uu: true,
    reference_distance_uu: true,
    delta_speed_ms: true,
    delta_line_ms: true,
    runner_speed_uu_s: true,
    reference_speed_uu_s: true,
} satisfies Record<keyof CapComparisonSector, true>

const CANDIDATE_KEYS = { id: true, user: true, alias: true, cap_time_seconds: true, has_ghost: true } satisfies Record<
    keyof CapCompareCandidate,
    true
>

const MEMBER_CAP_KEYS = ['has_ghost', 'id', 'team', 'zone_checkpoints'] satisfies (keyof CapRecord)[]

const COMPARISON_NAMES: RunCompareComparisonName[] = ['aligned', 'separated', 'neverRejoins', 'long', 'short', 'routesDiffer']
const ALIGNED_NAMES = COMPARISON_NAMES.filter((name) => name !== 'routesDiffer')
const ALL_NAMES = Object.keys(RUN_COMPARE_FIXTURES) as RunCompareFixtureName[]
const MAX_POINTS = 300
const MINUS = String.fromCharCode(0x2212)

function keysOf(value: object): string[] {
    return Object.keys(value).sort()
}

function fileText(file: string): string {
    return readFileSync(resolve(FIXTURE_DIR, file), 'utf8')
}

function points(comparison: CapComparison) {
    return comparison.segments.flat()
}

function comparisonTimes(comparison: CapComparison): number[] {
    return [
        comparison.duration_ms,
        comparison.final_delta_ms,
        comparison.runner.cap_time_ms,
        comparison.reference.cap_time_ms,
        ...points(comparison).flat(),
        ...comparison.separations.flatMap((band) => [band.start_ms, band.end_ms, band.start_delta_ms, band.end_delta_ms]),
        ...comparison.sectors.flatMap((sector) => [
            sector.end_ms,
            sector.split_ms,
            sector.delta_split_ms,
            sector.delta_total_ms,
            sector.runner_distance_uu,
            sector.reference_distance_uu,
            sector.delta_speed_ms,
            sector.delta_line_ms,
        ]),
        ...comparison.speed.runner.flat(2),
        ...comparison.speed.reference.flat(2),
    ]
}

function stubFetch(response: () => Promise<Response>) {
    const fetchMock = vi.fn().mockImplementation(response)
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
}

afterEach(() => {
    vi.unstubAllGlobals()
})

describe('run compare fixtures', () => {
    it('lists every fixture file once, and every file is pinned', () => {
        const onDisk = readdirSync(FIXTURE_DIR).filter((file) => file.endsWith('.json')).sort()
        const listed = [...ALL_NAMES.map((name) => RUN_COMPARE_FIXTURES[name].file), RUN_COMPARE_ERRORS_FILE, CHART_RULES_FILE]

        expect(listed.sort()).toEqual(onDisk)
        expect(Object.keys(PINNED_SHA256).sort()).toEqual(onDisk)
    })

    it.each(Object.keys(PINNED_SHA256))('pins %s byte for byte in the canonical form', (file) => {
        const bytes = readFileSync(resolve(FIXTURE_DIR, file))

        expect(createHash('sha256').update(bytes).digest('hex')).toBe(PINNED_SHA256[file])
        expect(bytes.every((byte) => byte < 0x80)).toBe(true)
        expect(bytes.toString('utf8').endsWith('}\n') || bytes.toString('utf8').endsWith(']\n')).toBe(true)
        expect(bytes.toString('utf8').trimEnd()).not.toContain('\n')
    })

    it.each(ALL_NAMES)('%s sits inside the success envelope and type-checks', (name) => {
        const body = JSON.parse(fileText(RUN_COMPARE_FIXTURES[name].file))

        expect(keysOf(body)).toEqual(['data', 'success'])
        expect(body.success).toBe(true)
        expect(TYPED_FILES[name]).toEqual(body)
    })

    it.each(COMPARISON_NAMES)('%s has the comparison shape with every time in integer milliseconds', (name) => {
        const comparison = runCompareFixture(name)

        expect(keysOf(comparison)).toEqual(keysOf(COMPARISON_KEYS))
        expect(keysOf(comparison.runner)).toEqual(keysOf(RUN_KEYS))
        expect(keysOf(comparison.reference)).toEqual(keysOf(RUN_KEYS))
        expect(CAP_COMPARISON_STATES).toContain(comparison.state)
        expect(comparison.algo_version).toBe(1)
        expect(comparisonTimes(comparison).every(Number.isInteger)).toBe(true)
        expect(typeof comparison.runner.user).toBe('string')
        expect(comparison.runner.team).toBe(comparison.reference.team)
        expect(comparison.duration_ms).toBe(comparison.reference.cap_time_ms)
        expect(comparison.final_delta_ms).toBe(comparison.runner.cap_time_ms - comparison.reference.cap_time_ms)
        for (const band of comparison.separations) expect(keysOf(band)).toEqual(keysOf(SEPARATION_KEYS))
        for (const sector of comparison.sectors) expect(keysOf(sector)).toEqual(keysOf(SECTOR_KEYS))
    })

    it.each(ALIGNED_NAMES)('%s draws a curve that ends on the final gap, with ten sectors', (name) => {
        const comparison = runCompareFixture(name)
        const { segments, separations, sectors, duration_ms: duration, final_delta_ms: final } = comparison

        expect(comparison.state).toBe('aligned')
        expect(comparison.coverage).toBeGreaterThanOrEqual(0.5)
        expect(points(comparison).length).toBeLessThanOrEqual(MAX_POINTS)
        expect(segments.at(-1)?.at(-1)).toEqual([duration, final])
        for (const segment of segments) {
            const times = segment.map(([t]) => t)
            expect(times.every((t, i) => i === 0 || t > times[i - 1])).toBe(true)
            expect(times[0]).toBeGreaterThanOrEqual(0)
            expect(times.at(-1)).toBeLessThanOrEqual(duration)
        }
        expect(separations).toHaveLength(segments.length - 1)
        separations.forEach((band, i) => {
            expect(segments[i].at(-1)).toEqual([band.start_ms, band.start_delta_ms])
            expect(segments[i + 1][0]).toEqual([band.end_ms, band.end_delta_ms])
        })
        expect(sectors.map((sector) => sector.index)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
        expect(sectors.at(-1)?.end_ms).toBe(duration)
        expect(sectors.at(-1)?.delta_total_ms).toBe(final)
        expect(sectors.reduce((sum, sector) => sum + sector.split_ms, 0)).toBe(comparison.runner.cap_time_ms)
    })

    it.each(ALIGNED_NAMES)('%s splits every sector into speed and line, and carries both speed traces', (name) => {
        const { sectors, speed, duration_ms: duration } = runCompareFixture(name)

        for (const sector of sectors) {
            expect(sector.delta_speed_ms + sector.delta_line_ms).toBe(sector.delta_split_ms)
            expect(sector.runner_distance_uu).toBeGreaterThanOrEqual(0)
            expect(sector.reference_distance_uu).toBeGreaterThanOrEqual(0)
        }
        expect(speed.reference).toHaveLength(1)
        for (const segments of [speed.runner, speed.reference]) {
            expect(segments.flat().length).toBeGreaterThan(0)
            expect(segments.flat().length).toBeLessThanOrEqual(MAX_POINTS)
            for (const segment of segments) {
                const times = segment.map(([t]) => t)
                expect(times.every((t, i) => i === 0 || t > times[i - 1])).toBe(true)
                expect(times[0]).toBeGreaterThanOrEqual(0)
                expect(times.at(-1)).toBeLessThanOrEqual(duration)
                expect(segment.every(([, uuPerS]) => uuPerS >= 0)).toBe(true)
            }
        }
    })

    it('has a clean pair, a pair with rejoined bands and a run that never rejoins', () => {
        const aligned = runCompareFixture('aligned')
        const separated = runCompareFixture('separated')
        const neverRejoins = runCompareFixture('neverRejoins')

        expect(aligned.separations).toEqual([])
        expect(aligned.sectors.some((sector) => sector.separated)).toBe(false)
        expect(separated.separations.length).toBeGreaterThan(1)
        expect(separated.separations.every((band) => band.rejoined)).toBe(true)
        expect(separated.sectors.some((sector) => sector.separated)).toBe(true)
        expect(neverRejoins.separations.map((band) => band.rejoined)).toEqual([true, false])
        expect(neverRejoins.separations.at(-1)?.end_ms).toBe(neverRejoins.duration_ms)
        expect(neverRejoins.segments.at(-1)).toEqual([[neverRejoins.duration_ms, neverRejoins.final_delta_ms]])
    })

    it('has a run over nine minutes on the point limit and a run under a minute', () => {
        const long = runCompareFixture('long')

        expect(long.duration_ms).toBeGreaterThan(9 * 60_000)
        expect(points(long).length).toBeGreaterThan(MAX_POINTS - 5)
        expect(points(long).length).toBeLessThanOrEqual(MAX_POINTS)
        expect(runCompareFixture('short').duration_ms).toBeLessThan(60_000)
    })

    it('keeps only the final gap when the routes differ', () => {
        const comparison = runCompareFixture('routesDiffer')

        expect(comparison.state).toBe('routes_differ')
        expect([comparison.segments, comparison.separations, comparison.sectors]).toEqual([[], [], []])
        expect(comparison.speed).toEqual({ runner: [], reference: [] })
        expect(comparison.coverage).toBeLessThan(0.5)
    })

    it('gives every candidate a ghost flag, mixing replay and zones on both sides of the cap', () => {
        const detail = runCompareFixture('capDetailCandidates')
        const replay = detail.compare_candidates.filter((candidate) => detail.cap.has_ghost && candidate.has_ghost)

        expect(detail.cap.has_ghost).toBe(true)
        for (const candidate of detail.compare_candidates) expect(keysOf(candidate)).toEqual(keysOf(CANDIDATE_KEYS))
        expect(replay.length).toBeGreaterThan(0)
        expect(replay.length).toBeLessThan(detail.compare_candidates.length)
        expect(detail.compare_candidates.some((candidate) => candidate.cap_time_seconds < detail.cap.cap_time_seconds)).toBe(true)
        expect(detail.compare_candidates.some((candidate) => candidate.cap_time_seconds > detail.cap.cap_time_seconds)).toBe(true)
    })

    it('gives a cap with a ghost but no zonetimes replay candidates only', () => {
        const detail = runCompareFixture('capDetailGhostOnly')

        expect([detail.has_checkpoints, detail.checkpoints]).toEqual([false, []])
        expect(detail.compare_candidates.length).toBeGreaterThan(0)
        expect(detail.compare_candidates.every((candidate) => candidate.has_ghost)).toBe(true)
    })

    it('gives every team member its full cap record with side, ghost flag and raw zonetimes', () => {
        const { members } = runCompareFixture('teamCapDetailMembers')

        expect(members.length).toBeGreaterThan(1)
        for (const member of members) {
            expect(member.cap).toBeDefined()
            expect(keysOf(member.cap ?? {})).toEqual(expect.arrayContaining(MEMBER_CAP_KEYS))
            expect(keysOf(member.cap ?? {})).toEqual([...keysOf(runCompareFixture('capDetailCandidates').cap), 'zone_checkpoints'].sort())
            expect(member.cap?.id).toBe(member.cap_id)
            expect([0, 1, null]).toContain(member.cap?.team)
        }
        expect(new Set(members.map((member) => member.cap?.has_ghost))).toEqual(new Set([true, false]))
        expect(members.some((member) => member.cap?.zone_checkpoints === null)).toBe(true)
    })

    it('lists one error body per error code, each without data', () => {
        const entries = runCompareErrors()

        expect(TYPED_ERRORS).toEqual(entries)
        expect(entries.map((entry) => entry.body.code)).toEqual([...CAP_COMPARISON_ERROR_CODES])
        for (const entry of entries) {
            expect(keysOf(entry.body)).toEqual(['code', 'error', 'success'])
            expect(entry.body.success).toBe(false)
            expect([400, 404, 409]).toContain(entry.status)
        }
    })

    it('pins chart rule vectors for the 11.8 s, 1:22 and 9:37 runs and both sides of the end tick', () => {
        const rules = chartRuleVectors()
        const endLabel = (name: string) => rules.x.find((vector) => vector.name === name)?.ticks.at(-1)?.label

        expect(TYPED_CHART_RULES).toEqual(rules)
        expect([endLabel('11.8 s run'), endLabel('1:22 run'), endLabel('9:37 run')]).toEqual(['11.8s', '1:22', '9:37'])
        expect(new Set(rules.x.map((vector) => vector.end_tick))).toEqual(new Set([true, false]))
        for (const vector of rules.x) expect(vector.ticks.length).toBeLessThanOrEqual(7)
        for (const vector of rules.y) {
            expect(vector.ticks.map((tick) => tick.value_ms)).toContain(0)
            for (const tick of vector.ticks) {
                expect(tick.label.endsWith('s')).toBe(true)
                expect(tick.label.startsWith('+')).toBe(tick.value_ms > 0)
                expect(tick.label.startsWith(MINUS)).toBe(tick.value_ms < 0)
            }
        }
    })

    it('hands out copies, so a test cannot change the fixture for the next one', () => {
        const comparison = runCompareFixture('short')
        comparison.segments[0][0][1] = 99_999

        expect(runCompareFixture('short').segments[0][0][1]).not.toBe(99_999)
    })
})

describe('comparison fetcher', () => {
    it('reads the comparison for a runner and a reference cap', async () => {
        const fetchMock = stubFetch(() => Promise.resolve(runCompareFixtureResponse('separated')))

        expect(await fetchCapComparison('runner/1', 'reference 2')).toEqual(runCompareFixture('separated'))
        const [url] = fetchMock.mock.calls[0] as [string]
        expect(url).toMatch(/\/ghosts\/compare\?runner=runner%2F1&reference=reference\+2&v=\d+$/)
    })

    it('reads a routes-differ comparison as it is', async () => {
        stubFetch(() => Promise.resolve(runCompareFixtureResponse('routesDiffer')))

        expect(await fetchCapComparison('a', 'b')).toEqual(runCompareFixture('routesDiffer'))
    })

    it.each([...CAP_COMPARISON_ERROR_CODES])('returns null on the %s error', async (code) => {
        stubFetch(() => Promise.resolve(runCompareErrorResponse(code)))

        expect(await fetchCapComparison('a', 'b')).toBeNull()
    })

    it('returns null on any other non-200 status', async () => {
        stubFetch(() => Promise.resolve(new Response('upstream down', { status: 502 })))
        expect(await fetchCapComparison('a', 'b')).toBeNull()

        stubFetch(() => Promise.resolve(new Response(JSON.stringify(compareShortFile), { status: 203 })))
        expect(await fetchCapComparison('a', 'b')).toBeNull()
    })

    it('returns null on a network error', async () => {
        stubFetch(() => Promise.reject(new TypeError('Failed to fetch')))

        expect(await fetchCapComparison('a', 'b')).toBeNull()
    })

    it('returns null on a body that is not a comparison', async () => {
        stubFetch(() => Promise.resolve(new Response('not json', { status: 200 })))
        expect(await fetchCapComparison('a', 'b')).toBeNull()

        stubFetch(() => Promise.resolve(new Response(JSON.stringify({ success: true, data: { state: 'unknown' } }), { status: 200 })))
        expect(await fetchCapComparison('a', 'b')).toBeNull()
    })

    it('returns null on sectors without their speed and line split, as an older cached body has', async () => {
        const comparison = runCompareFixture('aligned')
        const stale = {
            ...comparison,
            sectors: comparison.sectors.map(({ runner_speed_uu_s: _r, reference_speed_uu_s: _f, ...sector }) => sector),
        }
        stubFetch(() => Promise.resolve(new Response(JSON.stringify({ success: true, data: stale }), { status: 200 })))

        expect(await fetchCapComparison('a', 'b')).toBeNull()
    })

    it('returns null on a comparison without speed traces, so the card falls back to zone checkpoints', async () => {
        const { speed: _speed, ...withoutSpeed } = runCompareFixture('aligned')
        stubFetch(() => Promise.resolve(new Response(JSON.stringify({ success: true, data: withoutSpeed }), { status: 200 })))

        expect(await fetchCapComparison('a', 'b')).toBeNull()
    })
})

describe('motion fetcher', () => {
    it('reads every sample and movement of both runs', async () => {
        const fetchMock = stubFetch(() => Promise.resolve(runCompareFixtureResponse('motion')))

        expect(await fetchCapComparisonMotion('runner/1', 'reference 2')).toEqual(runCompareFixture('motion'))
        const [url] = fetchMock.mock.calls[0] as [string]
        expect(url).toMatch(/\/ghosts\/compare\/motion\?runner=runner%2F1&reference=reference\+2&v=\d+$/)
    })

    it.each([...CAP_COMPARISON_ERROR_CODES])('returns null on the %s error', async (code) => {
        stubFetch(() => Promise.resolve(runCompareErrorResponse(code)))

        expect(await fetchCapComparisonMotion('a', 'b')).toBeNull()
    })

    it('returns null on a network error or a body that is not a motion', async () => {
        stubFetch(() => Promise.reject(new TypeError('Failed to fetch')))
        expect(await fetchCapComparisonMotion('a', 'b')).toBeNull()

        stubFetch(() => Promise.resolve(runCompareFixtureResponse('aligned')))
        expect(await fetchCapComparisonMotion('a', 'b')).toBeNull()
    })
})

describe('the motion fixture', () => {
    it('carries every sample of both runs on the reference clock, with their dodges, jumps and kicks', () => {
        const motion = runCompareFixture('motion')
        const separated = runCompareFixture('separated')

        expect(motion.duration_ms).toBe(separated.duration_ms)
        expect(motion.reference.segments).toHaveLength(1)
        for (const run of [motion.runner, motion.reference]) {
            for (const segment of run.segments) {
                expect(segment.every(([t, speed, state], i) => (
                    Number.isInteger(t) && t <= motion.duration_ms && speed >= 0 && [0, 1, 2].includes(state)
                    && (i === 0 || t >= segment[i - 1][0])
                ))).toBe(true)
            }
            expect(new Set(run.events.map(e => e.kind))).toEqual(new Set(['dodge', 'jump', 'kick']))
            expect(run.events.every(e => e.kind === 'dodge' || e.direction === null)).toBe(true)
        }
    })
})

describe('cap detail payload fixtures through their fetchers', () => {
    it.each(['capDetailCandidates', 'capDetailGhostOnly'] as const)('reads %s with the ghost flags intact', async (name) => {
        stubFetch(() => Promise.resolve(runCompareFixtureResponse(name)))
        const detail = await fetchCapDetail('', 'cap')
        const fixture = runCompareFixture(name)

        expect(detail?.cap.has_ghost).toBe(fixture.cap.has_ghost)
        expect(detail?.compare_candidates).toEqual(fixture.compare_candidates)
    })

    it('reads the team members with their cap', async () => {
        stubFetch(() => Promise.resolve(runCompareFixtureResponse('teamCapDetailMembers')))
        const detail = await fetchTeamCapDetail('', 'team-cap')

        expect(detail?.members).toEqual(runCompareFixture('teamCapDetailMembers').members)
    })
})
