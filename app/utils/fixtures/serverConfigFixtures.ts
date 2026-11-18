import auditServerConfig from './serverConfig/audit_server_config.json'
import auditServerConfigCutoverSeed from './serverConfig/audit_server_config_cutover_seed.json'
import auditServerConfigRollback from './serverConfig/audit_server_config_rollback.json'
import auditServerConfigUnmanagedRegion from './serverConfig/audit_server_config_unmanaged_region.json'
import operationsResponse from './serverConfig/operations_response.json'
import serverConfigPatchAfterCutover from './serverConfig/server_config_patch_after_cutover.json'
import serverConfigPatchForbiddenKey from './serverConfig/server_config_patch_forbidden_key.json'
import serverConfigPatchInvalidValue from './serverConfig/server_config_patch_invalid_value.json'
import serverConfigPatchLockedKey from './serverConfig/server_config_patch_locked_key.json'
import serverConfigPatchNextMap from './serverConfig/server_config_patch_next_map.json'
import serverConfigPatchNoChanges from './serverConfig/server_config_patch_no_changes.json'
import serverConfigPatchNotManaged from './serverConfig/server_config_patch_not_managed.json'
import serverConfigPatchOk from './serverConfig/server_config_patch_ok.json'
import serverConfigPatchReasonRequired from './serverConfig/server_config_patch_reason_required.json'
import serverConfigPatchUnknownKey from './serverConfig/server_config_patch_unknown_key.json'
import serverConfigResponse from './serverConfig/server_config_response.json'
import serverConfigResponseLegacy from './serverConfig/server_config_response_legacy.json'
import serverConfigResponseUnmanaged from './serverConfig/server_config_response_unmanaged.json'
import serverInfoResponse from './serverConfig/server_info_response.json'
import type {
    AdminServerConfig,
    AdminServerOperations,
    AuditEntry,
    ServerConfigErrorBody,
    ServerConfigPatchResult,
    ServerListingFields,
} from '@/app/utils/api'
import type { Server } from '@/app/utils/server-utils'

export type ServerConfigErrorFixtureName =
    | 'serverConfigPatchAfterCutover'
    | 'serverConfigPatchForbiddenKey'
    | 'serverConfigPatchInvalidValue'
    | 'serverConfigPatchLockedKey'
    | 'serverConfigPatchNoChanges'
    | 'serverConfigPatchNotManaged'
    | 'serverConfigPatchReasonRequired'
    | 'serverConfigPatchUnknownKey'

export type ServerConfigReadFixtureName =
    | 'serverConfigResponse'
    | 'serverConfigResponseLegacy'
    | 'serverConfigResponseUnmanaged'

export type ServerConfigPatchFixtureName = 'serverConfigPatchOk' | 'serverConfigPatchNextMap'

export type AuditFixtureName =
    | 'auditServerConfig'
    | 'auditServerConfigRollback'
    | 'auditServerConfigUnmanagedRegion'
    | 'auditServerConfigCutoverSeed'

export type ServerConfigFixtureName =
    | ServerConfigReadFixtureName
    | ServerConfigPatchFixtureName
    | ServerConfigErrorFixtureName
    | AuditFixtureName
    | 'operationsResponse'
    | 'serverInfoResponse'

export type ServerInfoRow = Omit<Server, 'ping' | 'players'> &
    ServerListingFields & { players: Array<Server['players'][number] & { slot: number }> }

interface FixtureEntry {
    file: string
    route: string
    status: number
    body: unknown
}

const CONFIG_ROUTE = 'GET /admin/servers/:id/config'
const AUDIT_ROUTE = 'GET /admin/audit'
const PATCH_ROUTE = 'PATCH /admin/servers/:id/config'

export const SERVER_CONFIG_FIXTURES: Record<ServerConfigFixtureName, FixtureEntry> = {
    auditServerConfig: {
        file: 'audit_server_config.json',
        route: AUDIT_ROUTE,
        status: 200,
        body: auditServerConfig,
    },
    auditServerConfigCutoverSeed: {
        file: 'audit_server_config_cutover_seed.json',
        route: AUDIT_ROUTE,
        status: 200,
        body: auditServerConfigCutoverSeed,
    },
    auditServerConfigRollback: {
        file: 'audit_server_config_rollback.json',
        route: AUDIT_ROUTE,
        status: 200,
        body: auditServerConfigRollback,
    },
    auditServerConfigUnmanagedRegion: {
        file: 'audit_server_config_unmanaged_region.json',
        route: AUDIT_ROUTE,
        status: 200,
        body: auditServerConfigUnmanagedRegion,
    },
    operationsResponse: {
        file: 'operations_response.json',
        route: 'GET /admin/servers/operations',
        status: 200,
        body: operationsResponse,
    },
    serverConfigPatchAfterCutover: {
        file: 'server_config_patch_after_cutover.json',
        route: PATCH_ROUTE,
        status: 409,
        body: serverConfigPatchAfterCutover,
    },
    serverConfigPatchForbiddenKey: {
        file: 'server_config_patch_forbidden_key.json',
        route: PATCH_ROUTE,
        status: 403,
        body: serverConfigPatchForbiddenKey,
    },
    serverConfigPatchInvalidValue: {
        file: 'server_config_patch_invalid_value.json',
        route: PATCH_ROUTE,
        status: 400,
        body: serverConfigPatchInvalidValue,
    },
    serverConfigPatchLockedKey: {
        file: 'server_config_patch_locked_key.json',
        route: PATCH_ROUTE,
        status: 409,
        body: serverConfigPatchLockedKey,
    },
    serverConfigPatchNextMap: {
        file: 'server_config_patch_next_map.json',
        route: PATCH_ROUTE,
        status: 200,
        body: serverConfigPatchNextMap,
    },
    serverConfigPatchNoChanges: {
        file: 'server_config_patch_no_changes.json',
        route: PATCH_ROUTE,
        status: 400,
        body: serverConfigPatchNoChanges,
    },
    serverConfigPatchNotManaged: {
        file: 'server_config_patch_not_managed.json',
        route: PATCH_ROUTE,
        status: 409,
        body: serverConfigPatchNotManaged,
    },
    serverConfigPatchOk: {
        file: 'server_config_patch_ok.json',
        route: PATCH_ROUTE,
        status: 200,
        body: serverConfigPatchOk,
    },
    serverConfigPatchReasonRequired: {
        file: 'server_config_patch_reason_required.json',
        route: PATCH_ROUTE,
        status: 400,
        body: serverConfigPatchReasonRequired,
    },
    serverConfigPatchUnknownKey: {
        file: 'server_config_patch_unknown_key.json',
        route: PATCH_ROUTE,
        status: 400,
        body: serverConfigPatchUnknownKey,
    },
    serverConfigResponse: {
        file: 'server_config_response.json',
        route: CONFIG_ROUTE,
        status: 200,
        body: serverConfigResponse,
    },
    serverConfigResponseLegacy: {
        file: 'server_config_response_legacy.json',
        route: CONFIG_ROUTE,
        status: 200,
        body: serverConfigResponseLegacy,
    },
    serverConfigResponseUnmanaged: {
        file: 'server_config_response_unmanaged.json',
        route: CONFIG_ROUTE,
        status: 200,
        body: serverConfigResponseUnmanaged,
    },
    serverInfoResponse: {
        file: 'server_info_response.json',
        route: 'GET /server-info',
        status: 200,
        body: serverInfoResponse,
    },
}

function data<T>(name: ServerConfigFixtureName): T {
    return structuredClone((SERVER_CONFIG_FIXTURES[name].body as { data: T }).data)
}

export function serverConfigFixture(name: ServerConfigReadFixtureName): AdminServerConfig {
    return data<AdminServerConfig>(name)
}

export function serverConfigPatchFixture(name: ServerConfigPatchFixtureName): ServerConfigPatchResult {
    return data<ServerConfigPatchResult>(name)
}

export function serverConfigErrorFixture(name: ServerConfigErrorFixtureName): ServerConfigErrorBody {
    return structuredClone(SERVER_CONFIG_FIXTURES[name].body as ServerConfigErrorBody)
}

export function serverConfigOperationsFixture(): AdminServerOperations {
    return data<AdminServerOperations>('operationsResponse')
}

export function serverInfoFixture(): ServerInfoRow[] {
    return structuredClone(SERVER_CONFIG_FIXTURES.serverInfoResponse.body as ServerInfoRow[])
}

export function auditServerConfigFixture(name: AuditFixtureName = 'auditServerConfig'): AuditEntry[] {
    return data<{ items: AuditEntry[] }>(name).items
}

export function serverConfigFixtureText(name: ServerConfigFixtureName): string {
    return `${JSON.stringify(SERVER_CONFIG_FIXTURES[name].body)}
`
}

export function serverConfigFixtureResponse(name: ServerConfigFixtureName): Response {
    return new Response(serverConfigFixtureText(name), {
        status: SERVER_CONFIG_FIXTURES[name].status,
        headers: { 'Content-Type': 'application/json' },
    })
}
