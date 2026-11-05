import { apiErrorFromBody, apiRequest } from '@/app/utils/api'
import type {
  ServerAction,
  ServerActionNotOffered,
  ServerActionRateLimited,
  ServerActionResult,
  ServerUnitState,
} from '@/app/utils/api'

export type ServerActionFailure =
  | { code: 'not_managed' | 'agent_error'; message: string }
  | ({ code: 'action_not_offered'; message: string } & ServerActionNotOffered)
  | ({ code: 'rate_limited'; message: string } & ServerActionRateLimited)

export type ServerActionOutcome = { ok: true; result: ServerActionResult } | { ok: false; failure: ServerActionFailure }

function serverActionFailure(body: unknown): ServerActionFailure | null {
  if (!body || typeof body !== 'object') return null
  const { code, error, data } = body as { code?: unknown; error?: unknown; data?: { [key: string]: unknown } | null }
  const message = typeof error === 'string' ? error : ''
  switch (code) {
    case 'not_managed':
    case 'agent_error':
      return { code, message }
    case 'action_not_offered':
      return typeof data?.unit_state === 'string' && Array.isArray(data.actions)
        ? { code, message, unit_state: data.unit_state as ServerUnitState, actions: data.actions as ServerAction[] }
        : null
    case 'rate_limited':
      return typeof data?.retry_after === 'number' ? { code, message, retry_after: data.retry_after } : null
    default:
      return null
  }
}

async function postServerAction(
  accessToken: string,
  serverId: string,
  action: ServerAction
): Promise<ServerActionOutcome> {
  const res = await apiRequest(`/admin/servers/${encodeURIComponent(serverId)}/${action}`, {
    token: accessToken,
    method: 'POST',
  })
  let body: unknown
  try {
    body = await res.json()
  } catch {
    body = undefined
  }
  if (res.ok) {
    const envelope = body as { success?: boolean; data?: ServerActionResult } | undefined
    if (envelope?.success && envelope.data) return { ok: true, result: envelope.data }
    throw new Error('Invalid response format from server')
  }
  const failure = serverActionFailure(body)
  if (failure) return { ok: false, failure }
  throw apiErrorFromBody(res.status, body)
}

export function restartServer(accessToken: string, serverId: string): Promise<ServerActionOutcome> {
  return postServerAction(accessToken, serverId, 'restart')
}

export function startServer(accessToken: string, serverId: string): Promise<ServerActionOutcome> {
  return postServerAction(accessToken, serverId, 'start')
}

export function stopServer(accessToken: string, serverId: string): Promise<ServerActionOutcome> {
  return postServerAction(accessToken, serverId, 'stop')
}
