import { apiErrorFromBody, apiGet, apiRequest } from '@/app/utils/api'
import type {
  AdminServerConfig,
  ServerConfigChange,
  ServerConfigKeyId,
  ServerConfigKeysErrorCode,
  ServerConfigPatchResult,
} from '@/app/utils/api'
import { isSettingId, saveRoute } from './serverSettings'

export type ServerConfigFailure =
  | { code: ServerConfigKeysErrorCode; message: string; keys: string[] }
  | { code: 'reason_required' | 'no_changes'; message: string }

export type ServerConfigSaveOutcome = { ok: true; result: ServerConfigPatchResult } | { ok: false; failure: ServerConfigFailure }

const KEYS_ERROR_CODES: readonly string[] = [
  'unknown_key',
  'invalid_value',
  'forbidden_key',
  'not_managed',
  'after_cutover',
  'locked_key',
] satisfies ServerConfigKeysErrorCode[]

function isKeysErrorCode(code: unknown): code is ServerConfigKeysErrorCode {
  return typeof code === 'string' && KEYS_ERROR_CODES.includes(code)
}

function serverConfigFailure(body: unknown): ServerConfigFailure | null {
  if (!body || typeof body !== 'object') return null
  const { code, error, data } = body as { code?: unknown; error?: unknown; data?: { keys?: unknown } | null }
  const message = typeof error === 'string' ? error : ''
  if (code === 'reason_required' || code === 'no_changes') return { code, message }
  if (!isKeysErrorCode(code)) return null
  const keys = data?.keys
  if (!Array.isArray(keys) || !keys.every((key) => typeof key === 'string')) return null
  return { code, message, keys }
}

function serverPath(serverId: string): string {
  return `/admin/servers/${encodeURIComponent(serverId)}`
}

export function fetchServerConfig(accessToken: string, serverId: string, signal?: AbortSignal): Promise<AdminServerConfig> {
  return apiGet(`${serverPath(serverId)}/config`, { token: accessToken, signal })
}

export async function saveServerConfig(
  accessToken: string,
  serverId: string,
  body: ServerConfigChange,
  role: number | undefined,
): Promise<ServerConfigSaveOutcome> {
  const res = await apiRequest(`${serverPath(serverId)}/${saveRoute(role)}`, {
    token: accessToken,
    method: 'PATCH',
    body,
  })
  let json: unknown
  try {
    json = await res.json()
  } catch {
    json = undefined
  }
  if (res.ok) {
    const envelope = json as { success?: boolean; data?: ServerConfigPatchResult } | undefined
    if (envelope?.success && envelope.data) return { ok: true, result: envelope.data }
    throw new Error('Invalid response format from server')
  }
  const failure = serverConfigFailure(json)
  if (failure) return { ok: false, failure }
  throw apiErrorFromBody(res.status, json)
}

const FIELD_MESSAGES: Record<ServerConfigKeysErrorCode, string | null> = {
  unknown_key: null,
  invalid_value: 'The server does not accept this value',
  forbidden_key: 'Only admins can change this',
  not_managed: 'Not managed yet',
  after_cutover: 'Available after cutover',
  locked_key: 'Set by certified',
}

export function serverConfigFieldErrors(failure: ServerConfigFailure): Partial<Record<ServerConfigKeyId, string>> {
  if (!('keys' in failure)) return {}
  const message = FIELD_MESSAGES[failure.code]
  if (!message) return {}
  return Object.fromEntries(failure.keys.filter(isSettingId).map((key) => [key, message]))
}
