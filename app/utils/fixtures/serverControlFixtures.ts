import operationsResponse from './serverControl/operations_response.json'
import serverActionAgentError from './serverControl/server_action_agent_error.json'
import serverActionNotManaged from './serverControl/server_action_not_managed.json'
import serverActionNotOffered from './serverControl/server_action_not_offered.json'
import serverActionOk from './serverControl/server_action_ok.json'
import serverActionRateLimited from './serverControl/server_action_rate_limited.json'
import type { AdminServerOperations, ServerActionErrorBody, ServerActionResult } from '@/app/utils/api'

export type ServerControlErrorFixtureName =
    | 'serverActionNotManaged'
    | 'serverActionNotOffered'
    | 'serverActionRateLimited'
    | 'serverActionAgentError'

export type ServerControlFixtureName = 'operationsResponse' | 'serverActionOk' | ServerControlErrorFixtureName

interface FixtureEntry {
    file: string
    route: string
    status: number
    body: unknown
}

const ACTION_ROUTE = 'POST /admin/servers/:id/:action'

export const SERVER_CONTROL_FIXTURES: Record<ServerControlFixtureName, FixtureEntry> = {
    operationsResponse: {
        file: 'operations_response.json',
        route: 'GET /admin/servers/operations',
        status: 200,
        body: operationsResponse,
    },
    serverActionOk: { file: 'server_action_ok.json', route: ACTION_ROUTE, status: 200, body: serverActionOk },
    serverActionNotManaged: {
        file: 'server_action_not_managed.json',
        route: ACTION_ROUTE,
        status: 409,
        body: serverActionNotManaged,
    },
    serverActionNotOffered: {
        file: 'server_action_not_offered.json',
        route: ACTION_ROUTE,
        status: 409,
        body: serverActionNotOffered,
    },
    serverActionRateLimited: {
        file: 'server_action_rate_limited.json',
        route: ACTION_ROUTE,
        status: 429,
        body: serverActionRateLimited,
    },
    serverActionAgentError: {
        file: 'server_action_agent_error.json',
        route: ACTION_ROUTE,
        status: 502,
        body: serverActionAgentError,
    },
}

export function serverOperationsFixture(): AdminServerOperations {
    return structuredClone((SERVER_CONTROL_FIXTURES.operationsResponse.body as { data: AdminServerOperations }).data)
}

export function serverActionResultFixture(): ServerActionResult {
    return structuredClone((SERVER_CONTROL_FIXTURES.serverActionOk.body as { data: ServerActionResult }).data)
}

export function serverActionErrorFixture(name: ServerControlErrorFixtureName): ServerActionErrorBody {
    return structuredClone(SERVER_CONTROL_FIXTURES[name].body as ServerActionErrorBody)
}

export function serverControlFixtureText(name: ServerControlFixtureName): string {
    return `${JSON.stringify(SERVER_CONTROL_FIXTURES[name].body)}\n`
}

export function serverControlFixtureResponse(name: ServerControlFixtureName): Response {
    return new Response(serverControlFixtureText(name), {
        status: SERVER_CONTROL_FIXTURES[name].status,
        headers: { 'Content-Type': 'application/json' },
    })
}
