import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
    SERVER_CONFIG_FIXTURES,
    auditServerConfigFixture,
    serverConfigErrorFixture,
    serverConfigFixture,
    serverConfigFixtureResponse,
    serverConfigFixtureText,
    serverConfigOperationsFixture,
    serverConfigPatchFixture,
    serverInfoFixture,
    type AuditFixtureName,
    type ServerConfigErrorFixtureName,
    type ServerConfigFixtureName,
    type ServerInfoRow,
} from './serverConfigFixtures'
import type {
    AdminActiveTitle,
    AdminHost,
    AdminHostRuntime,
    AdminHostToken,
    AdminOperationsServer,
    AdminServerConfig,
    AdminServerOperations,
    AdminServerProbe,
    AdminServerRuntime,
    AuditEntry,
    ServerAction,
    ServerConfigApply,
    ServerConfigApplyMode,
    ServerConfigAuditDetails,
    ServerConfigColor,
    ServerConfigEditor,
    ServerConfigErrorBody,
    ServerConfigErrorCode,
    ServerConfigErrorKeys,
    ServerConfigGroup,
    ServerConfigKey,
    ServerConfigKeyId,
    ServerConfigKeyState,
    ServerConfigKeysErrorCode,
    ServerConfigLayout,
    ServerConfigPatchResult,
    ServerConfigRestart,
    ServerConfigRuntime,
    ServerConfigSeedAuditDetails,
    ServerConfigState,
    ServerConfigValueMap,
    ServerControl,
    ServerControlUnavailable,
    ServerOperationsBuild,
    ServerOperationsConfig,
    ServerOperationsRuleset,
    ServerRuleset,
    ServerRulesetAuditDetails,
    ServerUnitState,
} from '@/app/utils/api'

const FIXTURE_DIR = resolve(__dirname, 'serverConfig')

const KEY_IDS = keysOf<ServerConfigKeyId>({
    server_name: true,
    region: true,
    admin_name: true,
    admin_email: true,
    motd_1: true,
    motd_2: true,
    motd_3: true,
    motd_4: true,
    max_players: true,
    max_spectators: true,
    game_password: true,
    mute_spectators: true,
    tournament: true,
    start_map: true,
    time_limit: true,
    goal_team_score: true,
    sudden_death: true,
    checkpoints: true,
    player_collisions: true,
    spectate_after_cap: true,
    allow_boosted_caps: true,
    idle_to_spec_minutes: true,
    board_label_text: true,
    board_label_color: true,
    allowed_teams: true,
    winter_scoreboard: true,
    spectator_votes: true,
    mid_game_vote_percent: true,
    vote_time_limit: true,
    scoreboard_delay: true,
    switch_on_empty: true,
    empty_minutes: true,
    random_map: true,
    default_map: true,
})
const RULESETS = keysOf<ServerRuleset>({ casual: true, certified: true })
const GROUPS = keysOf<ServerConfigGroup>({
    listing: true,
    access: true,
    match: true,
    start_map: true,
    gameplay: true,
    mapvote: true,
})
const EDITORS = keysOf<ServerConfigEditor>({ staff: true, admin: true })
const KEY_STATES = keysOf<ServerConfigKeyState>({
    editable: true,
    locked: true,
    after_cutover: true,
    not_managed: true,
})
const LAYOUTS = keysOf<ServerConfigLayout>({ cutover: true, legacy: true })
const APPLY_MODES = keysOf<ServerConfigApplyMode>({ when_empty: true, now: true, next_map: true })
const CONFIG_STATES = keysOf<ServerConfigState>({ applied: true, pending: true, drift: true, not_managed: true })
const KEYS_ERROR_CODES = keysOf<ServerConfigKeysErrorCode>({
    unknown_key: true,
    invalid_value: true,
    forbidden_key: true,
    not_managed: true,
    after_cutover: true,
    locked_key: true,
})
const ERROR_CODES = keysOf<ServerConfigErrorCode>({
    ...Object.fromEntries(KEYS_ERROR_CODES.map((code) => [code, true])),
    reason_required: true,
    no_changes: true,
} as Record<ServerConfigErrorCode, true>)
const SERVER_ACTIONS = keysOf<ServerAction>({ restart: true, start: true, stop: true })
const UNIT_STATES = keysOf<ServerUnitState>({
    active: true,
    activating: true,
    failed: true,
    held: true,
    inactive: true,
})
const UNAVAILABLE = keysOf<ServerControlUnavailable>({ not_managed: true, agent_unreachable: true })
const CERTIFIED_LOCKS: ServerConfigKeyId[] = ['max_players', 'player_collisions', 'allow_boosted_caps']
const CUTOVER_KEY_IDS = [
    'sudden_death',
    'checkpoints',
    'player_collisions',
    'spectate_after_cap',
    'allow_boosted_caps',
    'idle_to_spec_minutes',
    'board_label_text',
    'board_label_color',
    'allowed_teams',
    'winter_scoreboard',
    'spectator_votes',
    'mid_game_vote_percent',
    'vote_time_limit',
    'scoreboard_delay',
    'switch_on_empty',
    'empty_minutes',
    'random_map',
    'default_map',
] as const satisfies readonly ServerConfigKeyId[]
const APPLY_CHOICES = ['when_empty', 'now'] as const

type CutoverKeyId = (typeof CUTOVER_KEY_IDS)[number]
type Reverting<T> = T & { reverts: string }
type RegionOnly = { region: string }
type RegionOnlyAuditDetails = Omit<ServerConfigAuditDetails, 'before' | 'after' | 'version'> & {
    before: RegionOnly
    after: RegionOnly
    version: null
}
type CutoverSeedAuditDetails = Omit<ServerConfigSeedAuditDetails, 'after' | 'renamed'> & {
    after: Partial<Pick<ServerConfigValueMap, CutoverKeyId>>
    layout: 'cutover'
}

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

const positiveInt: Check<number> = (value, path) => {
    if (!Number.isInteger(value) || (value as number) < 1) {
        fail(path, `expected a positive integer, got ${JSON.stringify(value)}`)
    }
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

function record(value: unknown, path: string): Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        fail(path, `expected an object, got ${JSON.stringify(value)}`)
    }
    return value as Record<string, unknown>
}

function object<T>(schema: Schema<T>): Check<T> {
    return (value, path) => {
        const fields = record(value, path)
        const expected = Object.keys(schema).sort()
        const actual = Object.keys(fields).sort()
        if (expected.join() !== actual.join()) fail(path, `expected keys ${expected.join()}, got ${actual.join()}`)
        for (const key of expected) {
            ;(schema as Record<string, Check<unknown>>)[key](fields[key], `${path}.${key}`)
        }
    }
}

function partialObject<T>(schema: Schema<T>): Check<Partial<T>> {
    return (value, path) => {
        const fields = record(value, path)
        for (const key of Object.keys(fields)) {
            const check = (schema as Record<string, Check<unknown> | undefined>)[key]
            if (!check) fail(path, `has key ${key}, which the contract does not`)
            check(fields[key], `${path}.${key}`)
        }
    }
}

function envelope<T>(data: Check<T>): Check<{ success: true; data: T }> {
    return object<{ success: true; data: T }>({ success: literal(true), data })
}

function anyOf<T>(...checks: Check<T>[]): Check<T> {
    return (value, path) => {
        const failures: string[] = []
        for (const check of checks) {
            try {
                check(value, path)
                return
            } catch (error) {
                failures.push((error as Error).message)
            }
        }
        fail(path, `matches no allowed shape: ${failures.join('; ')}`)
    }
}

const keyIds = arrayOf(oneOf(KEY_IDS))

const color = object<ServerConfigColor>({ r: int, g: int, b: int, a: int })

const valueSchema: Schema<ServerConfigValueMap> = {
    server_name: str,
    region: str,
    admin_name: str,
    admin_email: str,
    motd_1: str,
    motd_2: str,
    motd_3: str,
    motd_4: str,
    max_players: int,
    max_spectators: int,
    game_password: str,
    mute_spectators: bool,
    tournament: bool,
    start_map: str,
    time_limit: int,
    goal_team_score: int,
    sudden_death: bool,
    checkpoints: bool,
    player_collisions: bool,
    spectate_after_cap: bool,
    allow_boosted_caps: bool,
    idle_to_spec_minutes: int,
    board_label_text: str,
    board_label_color: color,
    allowed_teams: int,
    winter_scoreboard: bool,
    spectator_votes: bool,
    mid_game_vote_percent: int,
    vote_time_limit: int,
    scoreboard_delay: int,
    switch_on_empty: bool,
    empty_minutes: int,
    random_map: bool,
    default_map: str,
}

const values = partialObject(valueSchema)

const configKey = object<ServerConfigKey>({
    id: oneOf(KEY_IDS),
    group: oneOf(GROUPS),
    editable_by: oneOf(EDITORS),
    state: oneOf(KEY_STATES),
})

const configRuntime = object<ServerConfigRuntime>({
    cached_version: nullable(int),
    applied_version: nullable(int),
    drift: keyIds,
})

const configFields: Schema<AdminServerConfig> = {
    server_id: uuid,
    managed: bool,
    layout: nullable(oneOf(LAYOUTS)),
    version: nullable(int),
    ruleset: oneOf(RULESETS),
    values,
    keys: arrayOf(configKey),
    config: nullable(configRuntime),
}

const restart: Check<ServerConfigRestart> = anyOf<ServerConfigRestart>(
    object<{ unit_state: ServerUnitState; held: boolean }>({ unit_state: oneOf(UNIT_STATES), held: bool }),
    object<{ error: 'rate_limited'; retry_after: number }>({ error: literal('rate_limited'), retry_after: int }),
    object<{ error: 'agent_error' }>({ error: literal('agent_error') })
)

const patchResult = object<ServerConfigPatchResult>({
    ...configFields,
    apply: object<ServerConfigApply>({ mode: oneOf(APPLY_MODES), restart: nullable(restart) }),
})

function errorBody(code: ServerConfigErrorCode): Check<ServerConfigErrorBody> {
    const base = { success: literal(false), error: str, code: literal(code) }
    if ((KEYS_ERROR_CODES as string[]).includes(code)) {
        return object({
            ...base,
            data: object<ServerConfigErrorKeys>({ keys: arrayOf(str) }),
        }) as Check<ServerConfigErrorBody>
    }
    return object(base) as Check<ServerConfigErrorBody>
}

const hostToken = object<AdminHostToken>({
    id: uuid,
    name: str,
    scopes: arrayOf(str),
    active: bool,
    created_at: nullable(timestamp),
    last_seen_at: nullable(timestamp),
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

const unknownHostRuntime = object<Pick<AdminHostRuntime, 'known' | 'reachable' | 'polled_at'>>({
    known: literal(false) as Check<boolean>,
    reachable: literal(null),
    polled_at: literal(null),
})

const hostRuntime: Check<AdminHostRuntime> = (value, path) => {
    if ((value as { known?: unknown } | null)?.known === true) knownHostRuntime(value, path)
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
    probe: object<AdminServerProbe>({
        answering: bool,
        map_name: nullable(str),
        num_players: nullable(int),
        max_players: nullable(int),
        updated_at: nullable(timestamp),
        seconds_stale: nullable(int),
    }),
    runtime: object<AdminServerRuntime>({
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
    }),
    control: object<ServerControl>({
        managed: bool,
        unit_state: nullable(oneOf(UNIT_STATES)),
        held: bool,
        restarts: nullable(int),
        started_at: nullable(timestamp),
        actions: arrayOf(oneOf(SERVER_ACTIONS)),
        unavailable: nullable(oneOf(UNAVAILABLE)),
    }),
    ruleset: object<ServerOperationsRuleset>({
        desired: oneOf(RULESETS),
        in_force: nullable(oneOf(RULESETS)),
        pending: bool,
        team_run_active: nullable(bool),
    }),
    config: object<ServerOperationsConfig>({
        state: oneOf(CONFIG_STATES),
        version: nullable(int),
        cached_version: nullable(int),
        applied_version: nullable(int),
        drift: keyIds,
    }),
    build: object<ServerOperationsBuild>({ utbt_build: nullable(str), server_packages: arrayOf(str) }),
    players: nullable(arrayOf(str)),
})

const operations = object<AdminServerOperations>({
    hosts: arrayOf(host),
    servers: arrayOf(operationsServer),
    generated_at: nullable(timestamp),
})

const activeTitle = object<AdminActiveTitle>({
    id: str,
    name: str,
    color: str,
    color_r: int,
    color_g: int,
    color_b: int,
    rarity: int,
})

const serverInfoRow = object<ServerInfoRow>({
    id: uuid,
    ip: str,
    hostname: str,
    hostport: int,
    map_name: str,
    player_count: int,
    max_players: int,
    spectators: int,
    time_limit_minutes: int,
    remaining_time_seconds: int,
    goal_team_score: int,
    red_team_score: int,
    blue_team_score: int,
    certified_records: bool,
    players: arrayOf(
        object<ServerInfoRow['players'][number]>({
            id: str,
            slot: int,
            name: str,
            ping: int,
            time: int,
            team: int,
            deaths: int,
            is_spectator: bool,
            alias: nullable(str),
            active_title: nullable(activeTitle) as Check<ServerInfoRow['players'][number]['active_title']>,
        })
    ),
    ruleset: oneOf(RULESETS),
    region: nullable(str),
    tournament: nullable(bool),
    password_protected: nullable(bool),
})

function maybeReverting<T>(schema: Schema<T>): Check<T | Reverting<T>> {
    return anyOf<T | Reverting<T>>(object<T>(schema), object<Reverting<T>>({ ...schema, reverts: uuid } as Schema<Reverting<T>>))
}

const regionOnly = object<RegionOnly>({ region: str })

const cutoverSchema = Object.fromEntries(CUTOVER_KEY_IDS.map((id) => [id, valueSchema[id]])) as Schema<
    Pick<ServerConfigValueMap, CutoverKeyId>
>

const cutoverValues: Check<Partial<Pick<ServerConfigValueMap, CutoverKeyId>>> = (value, path) => {
    partialObject(cutoverSchema)(value, path)
    if (Object.keys(record(value, path)).length === 0) fail(path, 'a cutover seed seeds at least one cutover key')
}

const AUDIT_DETAILS: Record<string, Check<unknown>> = {
    'server.ruleset': maybeReverting<ServerRulesetAuditDetails>({
        before: object<{ ruleset: ServerRuleset }>({ ruleset: oneOf(RULESETS) }),
        after: object<{ ruleset: ServerRuleset }>({ ruleset: oneOf(RULESETS) }),
    }),
    'server.config': anyOf<unknown>(
        maybeReverting<ServerConfigAuditDetails>({
            before: values,
            after: values,
            version: positiveInt,
            apply: oneOf(APPLY_CHOICES),
        }),
        maybeReverting<RegionOnlyAuditDetails>({
            before: regionOnly,
            after: regionOnly,
            version: literal(null),
            apply: oneOf(APPLY_CHOICES),
        })
    ),
    'server.config.seed': (value, path) => {
        const fields = record(value, path)
        const base = { after: values, version: positiveInt }
        if ('layout' in fields) {
            object<CutoverSeedAuditDetails>({
                after: cutoverValues,
                version: positiveInt,
                layout: literal('cutover'),
            })(value, path)
        } else if ('renamed' in fields) {
            object<ServerConfigSeedAuditDetails>({
                ...base,
                renamed: object<{ before: string; after: string }>({ before: str, after: str }),
            })(value, path)
        } else {
            object<Omit<ServerConfigSeedAuditDetails, 'renamed'>>(base)(value, path)
        }
    },
}

const auditEntry: Check<AuditEntry> = (value, path) => {
    object<AuditEntry>({
        id: uuid,
        action: oneOf(Object.keys(AUDIT_DETAILS)),
        actor_id: nullable(str),
        actor_alias: nullable(str),
        actor_role: int,
        actor_title: nullable(activeTitle),
        target_type: literal('public_server') as Check<string>,
        target_id: nullable(uuid),
        target_alias: nullable(str),
        summary: str,
        details: () => undefined,
        reason: nullable(str),
        ip: nullable(str),
        created_at: nullable(timestamp),
        reverts: nullable(uuid),
        reverted: bool,
        can_rollback: bool,
    })(value, path)
    const entry = value as AuditEntry
    AUDIT_DETAILS[entry.action](entry.details, `${path}.details`)
    const reverts = (entry.details as { reverts?: string }).reverts ?? null
    if (entry.reverts !== reverts) fail(`${path}.reverts`, 'must be the details.reverts of a rollback row, else null')
    if (entry.reverts !== null && entry.can_rollback) fail(`${path}.can_rollback`, 'a rollback row cannot be rolled back')
}

const ERROR_FIXTURE_CODES: Record<ServerConfigErrorFixtureName, ServerConfigErrorCode> = {
    serverConfigPatchUnknownKey: 'unknown_key',
    serverConfigPatchInvalidValue: 'invalid_value',
    serverConfigPatchReasonRequired: 'reason_required',
    serverConfigPatchNoChanges: 'no_changes',
    serverConfigPatchForbiddenKey: 'forbidden_key',
    serverConfigPatchNotManaged: 'not_managed',
    serverConfigPatchAfterCutover: 'after_cutover',
    serverConfigPatchLockedKey: 'locked_key',
}

const auditList = envelope(object<{ items: AuditEntry[] }>({ items: arrayOf(auditEntry) }))

const SCHEMAS: Record<ServerConfigFixtureName, Check<unknown>> = {
    serverConfigResponse: envelope(object(configFields)),
    serverConfigResponseLegacy: envelope(object(configFields)),
    serverConfigResponseUnmanaged: envelope(object(configFields)),
    serverConfigPatchOk: envelope(patchResult),
    serverConfigPatchNextMap: envelope(patchResult),
    ...(Object.fromEntries(
        Object.entries(ERROR_FIXTURE_CODES).map(([name, code]) => [name, errorBody(code)])
    ) as Record<ServerConfigErrorFixtureName, Check<unknown>>),
    operationsResponse: envelope(operations),
    serverInfoResponse: arrayOf(serverInfoRow),
    auditServerConfig: auditList,
    auditServerConfigRollback: auditList,
    auditServerConfigUnmanagedRegion: auditList,
    auditServerConfigCutoverSeed: auditList,
}

const NAMES = Object.keys(SERVER_CONFIG_FIXTURES) as ServerConfigFixtureName[]
const ERROR_NAMES = Object.keys(ERROR_FIXTURE_CODES) as ServerConfigErrorFixtureName[]

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
                .map((key) => [key, canonical((value as Record<string, unknown>)[key])])
        )
    }
    return value
}

function statesOf(config: AdminServerConfig, state: ServerConfigKeyState): ServerConfigKeyId[] {
    return config.keys.filter((key) => key.state === state).map((key) => key.id)
}

describe('server config fixtures', () => {
    it('lists every fixture file once, and SHA256SUMS pins each of them', () => {
        const onDisk = readdirSync(FIXTURE_DIR)
            .filter((file) => file.endsWith('.json'))
            .sort()
        const listed = NAMES.map((name) => SERVER_CONFIG_FIXTURES[name].file).sort()
        const sums = pinnedSums()

        expect(onDisk).toEqual(listed)
        expect([...sums.keys()]).toEqual(listed)
        for (const file of listed) {
            expect(createHash('sha256').update(fileBytes(file)).digest('hex'), file).toBe(sums.get(file))
        }
    })

    it('keeps every file in the canonical serialization', () => {
        for (const name of NAMES) {
            const { file, body } = SERVER_CONFIG_FIXTURES[name]
            expect(fileBytes(file).toString('ascii'), file).toBe(`${JSON.stringify(canonical(body), null, 2)}\n`)
        }
    })

    it('matches the client types field for field', () => {
        for (const name of NAMES) {
            expect(() => SCHEMAS[name](SERVER_CONFIG_FIXTURES[name].body, name), name).not.toThrow()
        }
    })

    it('rejects a fixture that drifts from its type', () => {
        const drifted = structuredClone(SERVER_CONFIG_FIXTURES.serverConfigResponse.body) as {
            data: { keys: Array<Record<string, unknown>>; values: Record<string, unknown> }
        }
        drifted.data.keys[0].state = 'hidden'
        expect(() => SCHEMAS.serverConfigResponse(drifted, 'drifted')).toThrow(/hidden/)

        drifted.data.keys[0].state = 'editable'
        drifted.data.values.admin_password = 'x'
        expect(() => SCHEMAS.serverConfigResponse(drifted, 'drifted')).toThrow(/admin_password/)

        const row = structuredClone(SERVER_CONFIG_FIXTURES.operationsResponse.body) as {
            data: { servers: Array<Record<string, unknown>> }
        }
        delete row.data.servers[0].build
        expect(() => SCHEMAS.operationsResponse(row, 'drifted')).toThrow(/keys/)
    })

    it('lists every key in table order on every config read', () => {
        for (const name of [
            'serverConfigResponse',
            'serverConfigResponseLegacy',
            'serverConfigResponseUnmanaged',
        ] as const) {
            expect(
                serverConfigFixture(name).keys.map((key) => key.id),
                name
            ).toEqual(KEY_IDS)
        }
        expect(Object.keys(serverConfigFixture('serverConfigResponse').values).sort()).toEqual([...KEY_IDS].sort())
    })

    it('shows the certified locks, the cutover keys and the not managed keys', () => {
        const certified = serverConfigFixture('serverConfigResponse')
        const legacy = serverConfigFixture('serverConfigResponseLegacy')
        const unmanaged = serverConfigFixture('serverConfigResponseUnmanaged')

        expect(certified.ruleset).toBe('certified')
        expect(statesOf(certified, 'locked')).toEqual(CERTIFIED_LOCKS)
        expect(statesOf(legacy, 'after_cutover').length).toBeGreaterThan(0)
        expect(statesOf(legacy, 'after_cutover').some((id) => id in legacy.values)).toBe(false)
        expect(statesOf(unmanaged, 'not_managed')).toEqual(KEY_IDS.filter((id) => id !== 'region'))
        expect(unmanaged).toMatchObject({ managed: false, version: null, layout: null, config: null })
    })

    it('lets staff edit only the name and the password', () => {
        const staff = serverConfigFixture('serverConfigResponse')
            .keys.filter((key) => key.editable_by === 'staff')
            .map((key) => key.id)

        expect(staff).toEqual(['server_name', 'game_password'])
    })

    it('answers a save with how it applies', () => {
        expect(serverConfigPatchFixture('serverConfigPatchOk').apply).toEqual({
            mode: 'now',
            restart: { unit_state: 'activating', held: false },
        })
        expect(serverConfigPatchFixture('serverConfigPatchNextMap').apply).toEqual({ mode: 'next_map', restart: null })
        expect(statesOf(serverConfigPatchFixture('serverConfigPatchNextMap'), 'locked')).toEqual([])
    })

    it('has one error fixture per error code, with its status', () => {
        const codes = Object.fromEntries(
            ERROR_NAMES.map((name) => [serverConfigErrorFixture(name).code, SERVER_CONFIG_FIXTURES[name].status])
        )

        expect(Object.keys(codes).sort()).toEqual([...ERROR_CODES].sort())
        expect(codes).toEqual({
            unknown_key: 400,
            invalid_value: 400,
            reason_required: 400,
            no_changes: 400,
            forbidden_key: 403,
            not_managed: 409,
            after_cutover: 409,
            locked_key: 409,
        })
        for (const name of ERROR_NAMES) {
            const body = serverConfigErrorFixture(name)
            expect('data' in body, name).toBe((KEYS_ERROR_CODES as string[]).includes(body.code))
        }
    })

    it('has one operations row per config state, with the ruleset pending where the game runs another', () => {
        const rows = serverConfigOperationsFixture().servers

        expect(rows.map((row) => row.config?.state).sort()).toEqual([...CONFIG_STATES].sort())
        for (const row of rows) {
            const ruleset = row.ruleset as ServerOperationsRuleset
            expect(ruleset.pending).toBe(ruleset.in_force !== null && ruleset.in_force !== ruleset.desired)
            if (row.config?.state === 'not_managed') expect(row.players).toBeNull()
        }
        expect(rows.find((row) => row.config?.state === 'drift')?.config?.drift).toEqual(['motd_1'])
    })

    it('shows a duel, a password and a stale status on the public rows', () => {
        const rows = serverInfoFixture()

        expect(rows.filter((row) => row.tournament).map((row) => row.ruleset)).toEqual(['certified'])
        expect(rows.filter((row) => row.password_protected).map((row) => row.ruleset)).toEqual(['casual'])
        expect(rows.filter((row) => row.tournament === null).map((row) => row.password_protected)).toEqual([null])
    })

    it('shows a system seed row and never a password value in the audit rows', () => {
        const rows = auditServerConfigFixture()
        const byAction = Object.fromEntries(rows.map((row) => [row.action, row]))

        expect(byAction['server.config.seed'].actor_id).toBeNull()
        expect((byAction['server.config'].details as ServerConfigAuditDetails).after.game_password).toBe('changed')
        expect((byAction['server.config.seed'].details as ServerConfigSeedAuditDetails).after.game_password).toBe(
            'hidden'
        )
        expect(byAction['server.ruleset'].reason).toBeTruthy()
        expect(fileBytes('audit_server_config.json').toString('ascii')).not.toContain('example-pass')
    })

    it('pairs each rollback row with the row it reverts', () => {
        const rows = auditServerConfigFixture('auditServerConfigRollback')
        const rollbacks = rows.filter((row) => row.reverts !== null)

        expect(rollbacks.map((row) => row.action).sort()).toEqual(['server.config', 'server.ruleset'])
        for (const rollback of rollbacks) {
            const original = rows.find((row) => row.id === rollback.reverts)
            expect(original?.action).toBe(rollback.action)
            expect(original?.reverted).toBe(true)
            expect((rollback.details as { reverts: string }).reverts).toBe(rollback.reverts)
        }
        expect(rows.every((row) => !row.can_rollback)).toBe(true)
    })

    it('has a null version only on region changes of a server whose settings are not managed', () => {
        for (const row of auditServerConfigFixture('auditServerConfigUnmanagedRegion')) {
            const details = row.details as RegionOnlyAuditDetails
            expect(details.version).toBeNull()
            expect(Object.keys(details.before)).toEqual(['region'])
            expect(Object.keys(details.after)).toEqual(['region'])
        }
    })

    it('seeds only the cutover settings, with the System actor and no password, on the cutover seed row', () => {
        const [row] = auditServerConfigFixture('auditServerConfigCutoverSeed')
        const details = row.details as CutoverSeedAuditDetails

        expect([row.action, row.actor_id, row.actor_alias, details.layout]).toEqual([
            'server.config.seed',
            null,
            null,
            'cutover',
        ])
        expect(Object.keys(details.after).sort()).toEqual([...CUTOVER_KEY_IDS].sort())
        expect('game_password' in details.after).toBe(false)
    })

    it('accepts the three audit shapes and nothing wider', () => {
        const widened = (name: AuditFixtureName, index: number, change: (row: Record<string, any>) => void) => {
            const body = structuredClone(SERVER_CONFIG_FIXTURES[name].body) as {
                data: { items: Array<Record<string, any>> }
            }
            change(body.data.items[index])
            return () => SCHEMAS[name](body, name)
        }

        expect(widened('auditServerConfig', 0, (row) => (row.details.version = null))).toThrow(/no allowed shape/)
        expect(
            widened('auditServerConfigUnmanagedRegion', 1, (row) => {
                row.details.before = { motd_1: 'a' }
                row.details.after = { motd_1: 'b' }
            })
        ).toThrow(/no allowed shape/)
        expect(
            widened('auditServerConfigCutoverSeed', 0, (row) => (row.details.after.game_password = 'hidden'))
        ).toThrow(/game_password/)
        expect(widened('auditServerConfigCutoverSeed', 0, (row) => (row.details.layout = 'legacy'))).toThrow(/legacy/)
        expect(widened('auditServerConfigCutoverSeed', 0, (row) => (row.details.version = 0))).toThrow(/positive integer/)
        expect(widened('auditServerConfig', 2, (row) => (row.details.reverts = row.id))).toThrow(/reverts/)
        expect(widened('auditServerConfigRollback', 0, (row) => delete row.details.reverts)).toThrow(/details.reverts/)
        expect(widened('auditServerConfigRollback', 0, (row) => (row.can_rollback = true))).toThrow(/rolled back/)
    })

    it('hands out copies, so a test cannot change the fixture for the next one', () => {
        serverConfigFixture('serverConfigResponse').values.server_name = 'changed'
        serverInfoFixture()[0].hostname = 'changed'

        expect(serverConfigFixture('serverConfigResponse').values.server_name).not.toBe('changed')
        expect(serverInfoFixture()[0].hostname).not.toBe('changed')
    })

    it('serves each fixture as a response with its status', async () => {
        const response = serverConfigFixtureResponse('serverConfigPatchLockedKey')

        expect(response.status).toBe(409)
        expect(await response.json()).toEqual(SERVER_CONFIG_FIXTURES.serverConfigPatchLockedKey.body)
        expect(serverConfigFixtureText('serverInfoResponse').endsWith('\n')).toBe(true)
    })
})
