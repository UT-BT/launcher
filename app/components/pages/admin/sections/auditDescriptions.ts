import { ApiError, type AuditEntry } from '@/app/utils/api'

export const SERVER_AUDIT_ACTIONS = ['server.ruleset', 'server.config', 'server.config.seed']

export const SYSTEM_ACTOR = 'System'

export const PASSWORD_SKIPPED_NOTICE = 'Rolled back. The game password was not changed'

const GAME_PASSWORD = 'game_password'

export interface AuditDiffRow {
  key: string
  before: string
  after: string
  changed: boolean
  masked: boolean
}

export interface AuditRollbackResult {
  skipped?: string[]
}

function record(v: unknown): Record<string, unknown> | null {
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? v as Record<string, unknown> : null
}

function text(v: unknown): string | null {
  return typeof v === 'string' && v ? v : null
}

export function formatAuditValue(v: unknown): string {
  if (v === undefined) return '—'
  if (v === null) return 'null'
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return JSON.stringify(v)
}

function passwordLabel(v: unknown): string {
  if (v === undefined) return '—'
  return v === 'hidden' ? 'Hidden' : 'Changed'
}

export function auditDiffRow(key: string, before: unknown, after: unknown): AuditDiffRow {
  if (key === GAME_PASSWORD) {
    return { key, before: passwordLabel(before), after: passwordLabel(after), changed: true, masked: true }
  }
  const b = formatAuditValue(before)
  const a = formatAuditValue(after)
  return { key, before: b, after: a, changed: b !== a, masked: false }
}

export function isSystemActor(e: Pick<AuditEntry, 'actor_id' | 'actor_alias'>): boolean {
  return !e.actor_id && !e.actor_alias
}

export function auditActorName(e: Pick<AuditEntry, 'actor_id' | 'actor_alias'>): string {
  return e.actor_alias || e.actor_id || SYSTEM_ACTOR
}

function serverName(e: AuditEntry): string {
  const details = record(e.details)
  const after = record(details?.after)
  const before = record(details?.before)
  const renamed = record(details?.renamed)
  const name = text(e.target_alias) ?? text(renamed?.after) ?? text(after?.server_name) ?? text(before?.server_name)
  if (name) return name
  return e.target_id ? `server ${e.target_id.slice(0, 8)}` : 'a server'
}

function changedKeyCount(details: Record<string, unknown> | null): number {
  const keys = new Set([
    ...Object.keys(record(details?.before) ?? {}),
    ...Object.keys(record(details?.after) ?? {}),
  ])
  return keys.size
}

export function serverAuditDescription(e: AuditEntry): string | null {
  const details = record(e.details)
  const name = serverName(e)
  switch (e.action) {
    case 'server.ruleset': {
      const from = text(record(details?.before)?.ruleset) ?? '?'
      const to = text(record(details?.after)?.ruleset) ?? '?'
      return `Changed ruleset of ${name} from ${from} to ${to}`
    }
    case 'server.config': {
      const n = changedKeyCount(details)
      return `Changed ${n} ${n === 1 ? 'setting' : 'settings'} on ${name}`
    }
    case 'server.config.seed': {
      const previous = text(record(details?.renamed)?.before)
      return previous ? `Seeded settings for ${name}, renamed from ${previous}` : `Seeded settings for ${name}`
    }
    default:
      return null
  }
}

export function rollbackNeedsReason(e: Pick<AuditEntry, 'action'>): boolean {
  return e.action === 'server.ruleset'
}

export function rollbackNotice(result: AuditRollbackResult | null | undefined): string | null {
  return result?.skipped?.includes(GAME_PASSWORD) ? PASSWORD_SKIPPED_NOTICE : null
}

export function isNotReversible(e: unknown): e is ApiError {
  return e instanceof ApiError && e.reason === 'not_reversible'
}
