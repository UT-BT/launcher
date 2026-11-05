import type {
  AdminAlert,
  AdminOperationsServer,
  AdminServerProbe,
  ServerAction,
  ServerActionFailure,
  ServerControl,
  ServerUnitState,
} from '@/app/utils/api'
import { ADMIN_DASHBOARD_ROLES, ADMIN_ONLY_ROLES } from '@/app/utils/roles'
import type { Tone } from '../types'

export const SERVER_ACTION_LABELS: Record<ServerAction, string> = { restart: 'Restart', start: 'Start', stop: 'Stop' }

const ACTION_ROLES: Record<ServerAction, number[]> = {
  restart: ADMIN_DASHBOARD_ROLES,
  start: ADMIN_ONLY_ROLES,
  stop: ADMIN_ONLY_ROLES,
}

const UNIT_STATE_WORDS: Record<ServerUnitState, string> = {
  active: 'running',
  activating: 'starting',
  failed: 'crash loop',
  held: 'held',
  inactive: 'stopped',
}

export function unitStateWords(state: ServerUnitState | null): string {
  return state ? UNIT_STATE_WORDS[state] : 'the state is unknown'
}

export type ServerActionAvailability =
  | { action: ServerAction; enabled: true; reason: null }
  | { action: ServerAction; enabled: false; reason: string }

function disabledReason(action: ServerAction, control: ServerControl | undefined): string | null {
  if (!control || control.unavailable === 'not_managed') return 'Host not managed'
  if (control.unavailable === 'agent_unreachable') return 'Host agent unreachable'
  if (control.actions.includes(action)) return null
  return `Not available while ${unitStateWords(control.unit_state)}`
}

export function serverActionsFor(role: number | undefined, control: ServerControl | undefined): ServerActionAvailability[] {
  return (Object.keys(ACTION_ROLES) as ServerAction[])
    .filter((action) => ACTION_ROLES[action].includes(role ?? 0))
    .map((action) => {
      const reason = disabledReason(action, control)
      return reason === null ? { action, enabled: true, reason } : { action, enabled: false, reason }
    })
}

export type HealthKey = 'held' | 'crash_loop' | 'watchdog' | 'healthy' | 'hung' | 'down' | 'unknown' | 'unlisted'

export interface Health {
  key: HealthKey
  label: string
  tone: Tone
  hint: string
}

function hasWatchdogAlert(server: AdminOperationsServer, alerts: AdminAlert[]): boolean {
  return alerts.some((alert) =>
    alert.kind === 'server.watchdog_gave_up'
    && alert.status !== 'resolved'
    && (alert.server_ref
      ? alert.server_ref === server.id
      : !!server.host_ref && alert.host_ref === server.host_ref && alert.port === server.port),
  )
}

export function serverHealth(server: AdminOperationsServer, alerts: AdminAlert[] = []): Health {
  const unitState = server.control?.unit_state
  if (unitState === 'held') {
    return { key: 'held', label: 'Held', tone: 'accent', hint: 'Stopped by staff. It stays stopped until someone starts it.' }
  }
  if (unitState === 'failed') {
    return {
      key: 'crash_loop',
      label: 'Crash loop',
      tone: 'red',
      hint: 'It kept crashing and is no longer restarted automatically. Start it once the cause is fixed.',
    }
  }
  if (hasWatchdogAlert(server, alerts)) {
    return {
      key: 'watchdog',
      label: 'Hung (watchdog)',
      tone: 'red',
      hint: 'It stopped answering and automatic restarts did not bring it back. See the alert above.',
    }
  }

  const runtime = server.runtime
  const processKnown = runtime?.known && !runtime.stale

  if (!server.active) {
    return { key: 'unlisted', label: 'Inactive', tone: 'accent', hint: 'Not listed in the browser' }
  }
  if (server.probe.answering) {
    return { key: 'healthy', label: 'Healthy', tone: 'emerald', hint: 'Answering player queries' }
  }
  if (processKnown && runtime.process_up) {
    return {
      key: 'hung',
      label: 'Hung',
      tone: 'amber',
      hint: 'The process is running but the server is not answering queries. A restart usually clears this.',
    }
  }
  if (processKnown && runtime.process_up === false) {
    return { key: 'down', label: 'Down', tone: 'red', hint: 'The process is not running on its host' }
  }
  return { key: 'unknown', label: 'No reply', tone: 'red', hint: 'Not answering, and its host has not reported in' }
}

export function isProblemHealth(key: HealthKey): boolean {
  return key !== 'healthy' && key !== 'unlisted'
}

export function isHungHealth(key: HealthKey): boolean {
  return key === 'hung' || key === 'watchdog'
}

export function isDownHealth(key: HealthKey): boolean {
  return key === 'down' || key === 'unknown' || key === 'crash_loop'
}

export function playerCountText(probe: AdminServerProbe): string {
  if (!probe.answering || probe.num_players === null || probe.max_players === null) return 'player count unknown'
  return `${probe.num_players} of ${probe.max_players} players`
}

export interface ServerActionConfirm {
  title: string
  confirmLabel: string
  tone: 'accent' | 'red'
  server: string
  players: string
  detail: string
}

const CONFIRM_DETAIL: Record<ServerAction, string> = {
  restart: 'Everyone on it is disconnected while it restarts.',
  start: 'It starts now and joins the browser once it answers.',
  stop: 'Everyone on it is disconnected. It stays stopped across restarts until someone starts it.',
}

export function serverActionConfirm(action: ServerAction, server: AdminOperationsServer): ServerActionConfirm {
  const label = SERVER_ACTION_LABELS[action]
  return {
    title: `${label} server`,
    confirmLabel: label,
    tone: action === 'start' ? 'accent' : 'red',
    server: server.name,
    players: playerCountText(server.probe),
    detail: CONFIRM_DETAIL[action],
  }
}

export function serverActionFailureMessage(action: ServerAction, failure: ServerActionFailure): string {
  switch (failure.code) {
    case 'rate_limited':
      return `Another action just reached this server. Try again in ${failure.retry_after} s.`
    case 'action_not_offered':
      return `${SERVER_ACTION_LABELS[action]} is not available while ${unitStateWords(failure.unit_state)}.`
    case 'agent_error':
      return 'The host agent did not respond. Try again in a moment.'
    case 'not_managed':
      return 'Host not managed.'
  }
}

export function serverActionSuccessMessage(action: ServerAction, server: AdminOperationsServer, unitState: ServerUnitState): string {
  return `${SERVER_ACTION_LABELS[action]} sent. ${server.name} is ${unitStateWords(unitState)}.`
}
