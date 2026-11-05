import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
    SERVER_CONTROL_FIXTURES,
    serverActionErrorFixture,
    serverActionResultFixture,
    serverControlFixtureResponse,
    serverControlFixtureText,
    serverOperationsFixture,
    type ServerControlErrorFixtureName,
    type ServerControlFixtureName,
} from './serverControlFixtures'
import type {
    AdminHost,
    AdminHostRuntime,
    AdminHostToken,
    AdminOperationsServer,
    AdminServerOperations,
    AdminServerProbe,
    AdminServerRuntime,
    ServerAction,
    ServerActionErrorBody,
    ServerActionErrorCode,
    ServerActionNotOffered,
    ServerActionRateLimited,
    ServerActionResult,
    ServerControl,
    ServerControlUnavailable,
    ServerUnitState,
} from '@/app/utils/api'

const FIXTURE_DIR = resolve(__dirname, 'serverControl')

const SERVER_ACTIONS = keysOf<ServerAction>({ restart: true, start: true, stop: true })
const UNIT_STATES = keysOf<ServerUnitState>({ active: true, activating: true, failed: true, held: true, inactive: true })
const UNAVAILABLE = keysOf<ServerControlUnavailable>({ not_managed: true, agent_unreachable: true })
const ERROR_CODES = keysOf<ServerActionErrorCode>({
    not_managed: true,
    action_not_offered: true,
    rate_limited: true,
    agent_error: true,
})

function keysOf<K extends string>(record: Record<K, true>): K[] {
    return Object.keys(record) as K[]
}

type Check<T> = ((value: unknown, path: string) => void) & { readonly checks?: T }
type Schema<T> = { [K in keyof T]-?: Check<T[K]> }

function fail(path: string, message: string): never {
    throw new Error(`${path}: ${message}`)
}

const str: Check<string> = (value, path) => {
    if (typeof value !== 'string') fail(path, `expected a string, got ${JSON.stringify(value)}`)
}

const int: Check<number> = (value, path) => {
    if (!Number.isInteger(value)) fail(path, `expected an integer, got ${JSON.stringify(value)}`)
}

const num: Check<number> = (value, path) => {
    if (typeof value !== 'number') fail(path, `expected a number, got ${JSON.stringify(value)}`)
}

const bool: Check<boolean> = (value, path) => {
    if (typeof value !== 'boolean') fail(path, `expected a boolean, got ${JSON.stringify(value)}`)
}

const timestamp: Check<string> = (value, path) => {
    str(value, path)
    if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?\+00:00$/.test(value as string)) {
        fail(path, `expected a UTC ISO timestamp, got ${JSON.stringify(value)}`)
    }
}

const uuid: Check<string> = (value, path) => {
    str(value, path)
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value as string)) {
        fail(path, `expected a lowercase UUID, got ${JSON.stringify(value)}`)
    }
}

function literal<V extends string | boolean | null>(expected: V): Check<V> {
    return (value, path) => {
        if (value !== expected) fail(path, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(value)}`)
    }
}

function nullable<T>(check: Check<T>): Check<T | null> {
    return (value, path) => {
        if (value !== null) check(value, path)
    }
}

function oneOf<V extends string>(values: readonly V[]): Check<V> {
    return (value, path) => {
        if (typeof value !== 'string' || !(values as readonly string[]).includes(value)) {
            fail(path, `expected one of ${values.join(', ')}, got ${JSON.stringify(value)}`)
        }
    }
}

function arrayOf<T>(check: Check<T>): Check<T[]> {
    return (value, path) => {
        if (!Array.isArray(value)) fail(path, `expected an array, got ${JSON.stringify(value)}`)
        value.forEach((item, index) => check(item, `${path}[${index}]`))
    }
}

function object<T>(schema: Schema<T>): Check<T> {
    return (value, path) => {
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
            fail(path, `expected an object, got ${JSON.stringify(value)}`)
        }
        const record = value as Record<string, unknown>
        const expected = Object.keys(schema).sort()
        const actual = Object.keys(record).sort()
        if (expected.join() !== actual.join()) fail(path, `expected keys ${expected.join()}, got ${actual.join()}`)
        for (const key of expected) {
            ;(schema as Record<string, Check<unknown>>)[key](record[key], `${path}.${key}`)
        }
    }
}

function envelope<T>(data: Check<T>): Check<{ success: true; data: T }> {
    return object<{ success: true; data: T }>({ success: literal(true), data })
}

const actionList = arrayOf(oneOf(SERVER_ACTIONS))

const hostToken = object<AdminHostToken>({
    id: uuid,
    name: str,
    scopes: arrayOf(str),
    active: bool,
    created_at: nullable(timestamp),
    last_seen_at: nullable(timestamp),
})

type UnknownHostRuntime = Pick<AdminHostRuntime, 'known' | 'reachable' | 'polled_at'>

const unknownHostRuntime = object<UnknownHostRuntime>({
    known: literal(false) as Check<boolean>,
    reachable: literal(null),
    polled_at: literal(null),
})

const knownHostRuntime = object<AdminHostRuntime>({
    known: literal(true) as Check<boolean>,
    reachable: nullable(bool),
    agent_version: nullable(str),
    polled_at: nullable(timestamp),
    last_success_at: nullable(timestamp),
    last_error: nullable(str),
    seconds_since_poll: nullable(int),
    uptime_seconds: nullable(int),
    cpu_percent: nullable(num),
    load: arrayOf(nullable(num)),
    memory_percent: nullable(num),
    memory_total_mb: nullable(int),
    disk_percent: nullable(num),
    disk_total_mb: nullable(int),
    net_rx_bytes_sec: nullable(int),
    net_tx_bytes_sec: nullable(int),
    server_count: nullable(int),
    servers_up: nullable(int),
})

const hostRuntime: Check<AdminHostRuntime> = (value, path) => {
    const known = (value as { known?: unknown } | null)?.known
    if (known === true) knownHostRuntime(value, path)
    else unknownHostRuntime(value, path)
}

const host = object<AdminHost>({
    id: uuid,
    name: str,
    region: nullable(str),
    ip: nullable(str),
    agent_port: int,
    control_port: nullable(int),
    active: bool,
    created_at: nullable(timestamp),
    token: nullable(hostToken),
    runtime: hostRuntime,
})

const probe = object<AdminServerProbe>({
    answering: bool,
    map_name: nullable(str),
    num_players: nullable(int),
    max_players: nullable(int),
    updated_at: nullable(timestamp),
    seconds_stale: nullable(int),
})

const runtime = object<AdminServerRuntime>({
    known: bool,
    process_up: nullable(bool),
    stale: bool,
    matched_by: nullable(oneOf(['process', 'log'])),
    pid: nullable(int),
    cpu_percent: nullable(num),
    memory_mb: nullable(int),
    uptime_seconds: nullable(int),
    observed_at: nullable(timestamp),
    changed_at: nullable(timestamp),
})

const control = object<ServerControl>({
    managed: bool,
    unit_state: nullable(oneOf(UNIT_STATES)),
    held: bool,
    restarts: nullable(int),
    started_at: nullable(timestamp),
    actions: actionList,
    unavailable: nullable(oneOf(UNAVAILABLE)),
})

const operationsServer = object<AdminOperationsServer>({
    id: uuid,
    name: str,
    region: nullable(str),
    ip: nullable(str),
    port: int,
    active: bool,
    certified_records: bool,
    state: nullable(str),
    host_ref: nullable(uuid),
    host_name: nullable(str),
    probe,
    runtime,
    control,
})

const operations = object<AdminServerOperations>({
    hosts: arrayOf(host),
    servers: arrayOf(operationsServer),
    generated_at: nullable(timestamp),
})

const actionResult = object<ServerActionResult>({
    server_id: uuid,
    action: oneOf(SERVER_ACTIONS),
    unit_state: oneOf(UNIT_STATES),
    held: bool,
})

function errorBody<C extends ServerActionErrorCode, D>(code: C, data?: Check<D>): Check<ServerActionErrorBody> {
    const base = { success: literal(false), error: str, code: literal(code) }
    return (data ? object({ ...base, data }) : object(base)) as Check<ServerActionErrorBody>
}

const SCHEMAS: Record<ServerControlFixtureName, Check<unknown>> = {
    operationsResponse: envelope(operations),
    serverActionOk: envelope(actionResult),
    serverActionNotManaged: errorBody('not_managed'),
    serverActionNotOffered: errorBody(
        'action_not_offered',
        object<ServerActionNotOffered>({ unit_state: oneOf(UNIT_STATES), actions: actionList })
    ),
    serverActionRateLimited: errorBody('rate_limited', object<ServerActionRateLimited>({ retry_after: int })),
    serverActionAgentError: errorBody('agent_error'),
}

const NAMES = Object.keys(SERVER_CONTROL_FIXTURES) as ServerControlFixtureName[]
const ERROR_NAMES = NAMES.filter((name): name is ServerControlErrorFixtureName => SERVER_CONTROL_FIXTURES[name].status >= 400)

function fileBytes(file: string): Buffer {
    return readFileSync(resolve(FIXTURE_DIR, file))
}

function pinnedSums(): Map<string, string> {
    const sums = new Map<string, string>()
    for (const line of readFileSync(resolve(FIXTURE_DIR, 'SHA256SUMS'), 'ascii').split('\n')) {
        if (!line) continue
        const match = /^([0-9a-f]{64}) {2}(\S+)$/.exec(line)
        if (!match) throw new Error(`SHA256SUMS line ${JSON.stringify(line)} is not '<sha256>  <file>'`)
        sums.set(match[2], match[1])
    }
    return sums
}

function canonical(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(canonical)
    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.keys(value)
                .sort()
                .map(key => [key, canonical((value as Record<string, unknown>)[key])])
        )
    }
    return value
}

describe('server control fixtures', () => {
    it('lists every fixture file once, and SHA256SUMS pins each of them', () => {
        const onDisk = readdirSync(FIXTURE_DIR).filter(file => file.endsWith('.json')).sort()
        const listed = NAMES.map(name => SERVER_CONTROL_FIXTURES[name].file).sort()
        const sums = pinnedSums()

        expect(onDisk).toEqual(listed)
        expect([...sums.keys()]).toEqual(listed)
        for (const file of listed) {
            expect(createHash('sha256').update(fileBytes(file)).digest('hex'), file).toBe(sums.get(file))
        }
    })

    it('keeps every file in the canonical serialization', () => {
        for (const name of NAMES) {
            const { file, body } = SERVER_CONTROL_FIXTURES[name]
            expect(fileBytes(file).toString('ascii'), file).toBe(`${JSON.stringify(canonical(body), null, 2)}\n`)
        }
    })

    it('matches the client types field for field', () => {
        for (const name of NAMES) {
            expect(() => SCHEMAS[name](SERVER_CONTROL_FIXTURES[name].body, name), name).not.toThrow()
        }
    })

    it('rejects a fixture that drifts from its type', () => {
        const drifted = structuredClone(SERVER_CONTROL_FIXTURES.operationsResponse.body) as {
            data: { servers: Array<{ control: Record<string, unknown> }> }
        }
        drifted.data.servers[0].control.unit_state = 'running'
        expect(() => SCHEMAS.operationsResponse(drifted, 'drifted')).toThrow(/running/)

        delete drifted.data.servers[0].control.unit_state
        expect(() => SCHEMAS.operationsResponse(drifted, 'drifted')).toThrow(/keys/)

        const extra = { ...serverActionErrorFixture('serverActionAgentError'), detail: 'upstream text' }
        expect(() => SCHEMAS.serverActionAgentError(extra, 'extra')).toThrow(/keys/)
    })

    it('has one operations row per availability, and no actions while unavailable', () => {
        const rows = serverOperationsFixture().servers.map(row => row.control as ServerControl)

        expect(rows.map(row => row.unavailable).sort()).toEqual([...UNAVAILABLE, null].sort())
        for (const row of rows) {
            if (row.unavailable !== null) expect(row.actions).toEqual([])
            expect(row.managed).toBe(row.unavailable !== 'not_managed')
        }
        expect(rows.find(row => row.unavailable === null)).toMatchObject({ unit_state: 'active', actions: ['restart', 'stop'] })
    })

    it('has one error fixture per error code, with its status', () => {
        const codes = Object.fromEntries(
            ERROR_NAMES.map(name => [serverActionErrorFixture(name).code, SERVER_CONTROL_FIXTURES[name].status])
        )

        expect(Object.keys(codes).sort()).toEqual([...ERROR_CODES].sort())
        expect(codes).toEqual({ not_managed: 409, action_not_offered: 409, rate_limited: 429, agent_error: 502 })
    })

    it('carries what each error needs to explain itself', () => {
        const offered = serverActionErrorFixture('serverActionNotOffered')
        const limited = serverActionErrorFixture('serverActionRateLimited')

        expect(offered.code === 'action_not_offered' && offered.data).toEqual({ unit_state: 'held', actions: ['start'] })
        expect(limited.code === 'rate_limited' && limited.data.retry_after).toBeGreaterThan(0)
        expect(serverActionResultFixture()).toMatchObject({ action: 'restart', unit_state: 'activating' })
    })

    it('hands out copies, so a test cannot change the fixture for the next one', () => {
        serverOperationsFixture().servers[0].name = 'changed'
        serverActionResultFixture().held = true

        expect(serverOperationsFixture().servers[0].name).not.toBe('changed')
        expect(serverActionResultFixture().held).toBe(false)
    })

    it('serves each fixture as a response with its status', async () => {
        const response = serverControlFixtureResponse('serverActionRateLimited')

        expect(response.status).toBe(429)
        expect(await response.json()).toEqual(SERVER_CONTROL_FIXTURES.serverActionRateLimited.body)
        expect(serverControlFixtureText('serverActionOk').endsWith('\n')).toBe(true)
    })
})
