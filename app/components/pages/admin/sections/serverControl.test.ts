import { describe, expect, it } from 'vitest'
import type { AdminAlert, AdminOperationsServer, ServerAction, ServerControl, ServerUnitState } from '@/app/utils/api'
import { serverOperationsFixture } from '@/app/utils/fixtures/serverControlFixtures'
import { ROLE } from '@/app/utils/roles'
import {
  isHungHealth,
  isProblemHealth,
  playerCountText,
  serverActionConfirm,
  serverActionFailureMessage,
  serverActionSuccessMessage,
  serverActionsFor,
  serverHealth,
} from './serverControl'

const fixture = serverOperationsFixture()
const byHost = (name: string) => {
  const server = fixture.servers.find((row) => row.host_name === name)
  if (!server) throw new Error(`no fixture server on ${name}`)
  return server
}
const unreachable = byHost('au1')
const managed = byHost('eu1')
const notManaged = byHost('us1')

const UNIT_STATES: ServerUnitState[] = ['active', 'activating', 'failed', 'held', 'inactive']
const ACTION_MATRIX: Record<ServerUnitState, ServerAction[]> = {
  active: ['restart', 'stop'],
  activating: ['stop'],
  failed: ['start', 'stop'],
  held: ['start'],
  inactive: ['start'],
}
const STATE_WORDS: Record<ServerUnitState, string> = {
  active: 'running',
  activating: 'starting',
  failed: 'crash loop',
  held: 'held',
  inactive: 'stopped',
}

function managedControl(unit_state: ServerUnitState): ServerControl {
  return {
    ...(managed.control as ServerControl),
    unit_state,
    held: unit_state === 'held',
    actions: ACTION_MATRIX[unit_state],
  }
}

function withControl(server: AdminOperationsServer, control: Partial<ServerControl>): AdminOperationsServer {
  return { ...server, control: { ...(server.control as ServerControl), ...control } }
}

function alert(overrides: Partial<AdminAlert>): AdminAlert {
  return {
    id: 'alert-1',
    kind: 'server.watchdog_gave_up',
    severity: 'critical',
    status: 'open',
    host_ref: managed.host_ref,
    host_name: managed.host_name,
    server_ref: managed.id,
    server_name: managed.name,
    raw_server: null,
    port: managed.port,
    map_name: null,
    summary: 'Gave up restarting',
    details: { auto_restarts_last_hour: 11 },
    occurrences: 1,
    first_seen_at: null,
    last_seen_at: null,
    acknowledged_by: null,
    acknowledged_at: null,
    resolved_at: null,
    resolution: null,
    ...overrides,
  }
}

describe('serverActionsFor', () => {
  it('fixtures cover a managed, an unreachable and a not managed server', () => {
    expect(managed.control?.unavailable).toBeNull()
    expect(unreachable.control?.unavailable).toBe('agent_unreachable')
    expect(notManaged.control?.unavailable).toBe('not_managed')
  })

  it('offers moderators Restart only, and admins Restart, Start and Stop', () => {
    expect(serverActionsFor(ROLE.MODERATOR, managed.control).map((item) => item.action)).toEqual(['restart'])
    expect(serverActionsFor(ROLE.ADMIN, managed.control).map((item) => item.action)).toEqual(['restart', 'start', 'stop'])
  })

  it('offers nothing to roles outside the staff dashboard', () => {
    expect(serverActionsFor(ROLE.USER, managed.control)).toEqual([])
    expect(serverActionsFor(ROLE.CUP_ADMIN, managed.control)).toEqual([])
    expect(serverActionsFor(undefined, managed.control)).toEqual([])
  })

  it('enables exactly the actions the managed fixture row offers', () => {
    expect(serverActionsFor(ROLE.ADMIN, managed.control)).toEqual([
      { action: 'restart', enabled: true, reason: null },
      { action: 'start', enabled: false, reason: 'Not available while running' },
      { action: 'stop', enabled: true, reason: null },
    ])
  })

  it('disables every action on a not managed host', () => {
    for (const role of [ROLE.MODERATOR, ROLE.ADMIN]) {
      for (const item of serverActionsFor(role, notManaged.control)) {
        expect(item).toEqual({ action: item.action, enabled: false, reason: 'Host not managed' })
      }
    }
  })

  it('disables every action while the host agent is unreachable, whatever the last state', () => {
    for (const role of [ROLE.MODERATOR, ROLE.ADMIN]) {
      for (const unit_state of UNIT_STATES) {
        const control = { ...(unreachable.control as ServerControl), unit_state, actions: ACTION_MATRIX[unit_state] }
        for (const item of serverActionsFor(role, control)) {
          expect(item).toEqual({ action: item.action, enabled: false, reason: 'Host agent unreachable' })
        }
      }
    }
  })

  it('treats a row without a control block as not managed', () => {
    expect(serverActionsFor(ROLE.ADMIN, undefined).map((item) => item.reason)).toEqual([
      'Host not managed',
      'Host not managed',
      'Host not managed',
    ])
  })

  for (const role of [ROLE.MODERATOR, ROLE.ADMIN]) {
    for (const unit_state of UNIT_STATES) {
      it(`follows what the server offered while ${unit_state} (role ${role})`, () => {
        const control = managedControl(unit_state)
        for (const item of serverActionsFor(role, control)) {
          const offered = control.actions.includes(item.action)
          expect(item.enabled).toBe(offered)
          expect(item.reason).toBe(offered ? null : `Not available while ${STATE_WORDS[unit_state]}`)
        }
      })
    }
  }

  it('only reads the offered actions, never the unit state, to enable an item', () => {
    const control = { ...managedControl('held'), actions: ['restart'] as ServerAction[] }
    expect(serverActionsFor(ROLE.ADMIN, control).map((item) => item.enabled)).toEqual([true, false, false])
  })

  it('says the state is unknown when a managed server has not reported one', () => {
    const control = { ...managedControl('active'), unit_state: null, actions: [] }
    expect(serverActionsFor(ROLE.MODERATOR, control)[0].reason).toBe('Not available while the state is unknown')
  })
})

describe('serverHealth', () => {
  it('keeps the existing states for the fixture rows', () => {
    expect(serverHealth(managed).key).toBe('healthy')
    expect(serverHealth(notManaged).key).toBe('healthy')
    expect(serverHealth(unreachable).key).toBe('unknown')
  })

  it('shows Held when the unit is held', () => {
    const health = serverHealth(withControl(managed, { unit_state: 'held', held: true, actions: ['start'] }))
    expect(health).toMatchObject({ key: 'held', label: 'Held' })
  })

  it('shows Crash loop when the unit has failed', () => {
    const health = serverHealth(withControl(managed, { unit_state: 'failed', actions: ['start', 'stop'] }))
    expect(health).toMatchObject({ key: 'crash_loop', label: 'Crash loop' })
  })

  it('shows Hung (watchdog) for an open or acknowledged watchdog alert on this server', () => {
    expect(serverHealth(managed, [alert({})])).toMatchObject({ key: 'watchdog', label: 'Hung (watchdog)' })
    expect(serverHealth(managed, [alert({ status: 'acknowledged' })]).key).toBe('watchdog')
  })

  it('ignores resolved watchdog alerts, other kinds and other servers', () => {
    expect(serverHealth(managed, [alert({ status: 'resolved' })]).key).toBe('healthy')
    expect(serverHealth(managed, [alert({ kind: 'server.crash_loop' })]).key).toBe('healthy')
    expect(serverHealth(managed, [alert({ server_ref: notManaged.id, port: 7790 })]).key).toBe('healthy')
  })

  it('matches an alert without a server link by host and port', () => {
    expect(serverHealth(managed, [alert({ server_ref: null })]).key).toBe('watchdog')
    expect(serverHealth(managed, [alert({ server_ref: null, port: managed.port + 1 })]).key).toBe('healthy')
  })

  it('ranks Held, then Crash loop, then Hung (watchdog), ahead of every existing state', () => {
    const hung = { ...managed, probe: { ...managed.probe, answering: false } }
    const inactive = { ...hung, active: false }
    const open = [alert({})]

    expect(serverHealth(hung).key).toBe('hung')
    expect(serverHealth(hung, open).key).toBe('watchdog')
    expect(serverHealth(inactive, open).key).toBe('watchdog')
    expect(serverHealth(withControl(inactive, { unit_state: 'failed' }), open).key).toBe('crash_loop')
    expect(serverHealth(withControl(inactive, { unit_state: 'held', held: true }), open).key).toBe('held')
  })

  it('keeps the last known state while the host agent is unreachable', () => {
    expect(serverHealth(withControl(unreachable, { unit_state: 'held', held: true })).key).toBe('held')
  })

  it('counts the new states as problems, and Hung (watchdog) as hung', () => {
    expect(['held', 'crash_loop', 'watchdog', 'hung', 'down', 'unknown'].every((key) => isProblemHealth(key as never))).toBe(true)
    expect(isProblemHealth('healthy')).toBe(false)
    expect(isProblemHealth('unlisted')).toBe(false)
    expect(isHungHealth('watchdog')).toBe(true)
    expect(isHungHealth('hung')).toBe(true)
    expect(isHungHealth('crash_loop')).toBe(false)
  })
})

describe('playerCountText', () => {
  it('shows the probe count while the server answers', () => {
    expect(playerCountText(managed.probe)).toBe('3 of 16 players')
  })

  it('is unknown when the probe is stale or missing', () => {
    expect(playerCountText(unreachable.probe)).toBe('player count unknown')
    expect(playerCountText({ ...managed.probe, num_players: null })).toBe('player count unknown')
    expect(playerCountText({ ...managed.probe, max_players: null })).toBe('player count unknown')
  })
})

describe('serverActionConfirm', () => {
  it('names the server and the players on it', () => {
    const confirm = serverActionConfirm('restart', managed)
    expect(confirm.title).toBe('Restart server')
    expect(confirm.confirmLabel).toBe('Restart')
    expect(confirm.server).toBe('BT Test Server | EU')
    expect(confirm.players).toBe('3 of 16 players')
  })

  it('says the player count is unknown without a fresh probe', () => {
    expect(serverActionConfirm('restart', unreachable).players).toBe('player count unknown')
  })

  it('warns that a stopped server stays stopped until someone starts it', () => {
    const confirm = serverActionConfirm('stop', managed)
    expect(confirm.detail).toContain('stays stopped across restarts until someone starts it')
    expect(confirm.tone).toBe('red')
  })

  it('has a confirm for start', () => {
    expect(serverActionConfirm('start', managed)).toMatchObject({ title: 'Start server', confirmLabel: 'Start', tone: 'accent' })
  })
})

describe('serverActionFailureMessage', () => {
  it('asks to try again after the rate limit', () => {
    expect(serverActionFailureMessage('restart', { code: 'rate_limited', message: 'x', retry_after: 9 }))
      .toBe('Another action just reached this server. Try again in 9 s.')
  })

  it('names the state when the action is no longer offered', () => {
    expect(serverActionFailureMessage('restart', { code: 'action_not_offered', message: 'x', unit_state: 'held', actions: ['start'] }))
      .toBe('Restart is not available while held.')
  })

  it('shows a generic host agent error', () => {
    expect(serverActionFailureMessage('stop', { code: 'agent_error', message: 'x' }))
      .toBe('The host agent did not respond. Try again in a moment.')
  })

  it('says the host is not managed', () => {
    expect(serverActionFailureMessage('start', { code: 'not_managed', message: 'x' })).toBe('Host not managed.')
  })
})

describe('serverActionSuccessMessage', () => {
  it('names the server and the state the host answered with', () => {
    expect(serverActionSuccessMessage('restart', managed, 'activating')).toBe('Restart sent. BT Test Server | EU is starting.')
  })
})
