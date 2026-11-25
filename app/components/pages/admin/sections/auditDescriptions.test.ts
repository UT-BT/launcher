import { describe, expect, it } from 'vitest'
import { ApiError, type AuditEntry } from '@/app/utils/api'
import { auditServerConfigFixture } from '@/app/utils/fixtures/serverConfigFixtures'
import {
  PASSWORD_SKIPPED_NOTICE, auditActorName, auditDiffRow, isNotReversible, isSystemActor, rollbackNeedsReason,
  rollbackNotice, serverAuditDescription,
} from './auditDescriptions'

const rows = auditServerConfigFixture()

function row(action: string): AuditEntry {
  const found = rows.find((e) => e.action === action)
  if (!found) throw new Error(`no ${action} row in the fixture`)
  return found
}

function diffRows(e: AuditEntry) {
  const details = e.details as { before?: Record<string, unknown>; after?: Record<string, unknown> }
  const keys = Array.from(new Set([...Object.keys(details.before ?? {}), ...Object.keys(details.after ?? {})]))
  return keys.map((k) => auditDiffRow(k, details.before?.[k], details.after?.[k]))
}

describe('serverAuditDescription', () => {
  it('describes a ruleset change with both rulesets', () => {
    expect(serverAuditDescription(row('server.ruleset'))).toBe(
      'Changed ruleset of server 7c3e9d14 from casual to certified',
    )
  })

  it('names the server from the target alias when the row has one', () => {
    const e = { ...row('server.ruleset'), target_alias: '[BT] Test Server #1 (EU)' }
    expect(serverAuditDescription(e)).toBe('Changed ruleset of [BT] Test Server #1 (EU) from casual to certified')
  })

  it('counts the changed settings of a config change', () => {
    expect(serverAuditDescription(row('server.config'))).toBe('Changed 2 settings on server 7c3e9d14')
  })

  it('uses the singular for one changed setting', () => {
    const e = { ...row('server.config'), details: { before: { motd_1: 'a' }, after: { motd_1: 'b' }, version: 6, apply: 'now' } }
    expect(serverAuditDescription(e)).toBe('Changed 1 setting on server 7c3e9d14')
  })

  it('names a renamed server by its new name in a config change', () => {
    const e = { ...row('server.config'), details: { before: { server_name: 'Old' }, after: { server_name: 'New' }, version: 6, apply: 'now' } }
    expect(serverAuditDescription(e)).toBe('Changed 1 setting on New')
  })

  it('describes a seed with the name it set and the name it replaced', () => {
    expect(serverAuditDescription(row('server.config.seed'))).toBe(
      'Seeded settings for [BT] Test Server #1 (EU), renamed from BT Test Server | EU',
    )
  })

  it('describes a seed that kept the name without a rename', () => {
    const seed = row('server.config.seed')
    const details = { ...(seed.details as Record<string, unknown>), renamed: undefined }
    expect(serverAuditDescription({ ...seed, details })).toBe('Seeded settings for [BT] Test Server #1 (EU)')
  })

  it('leaves other actions to the generic description', () => {
    expect(serverAuditDescription({ ...row('server.config'), action: 'server.update' })).toBeNull()
  })
})

describe('auditDiffRow', () => {
  it('shows the game password of a config change as changed, never as a value', () => {
    const password = diffRows(row('server.config')).find((r) => r.key === 'game_password')
    expect(password).toEqual({ key: 'game_password', before: 'Changed', after: 'Changed', changed: true, masked: true })
  })

  it('shows the seeded game password as hidden', () => {
    const password = diffRows(row('server.config.seed')).find((r) => r.key === 'game_password')
    expect(password).toEqual({ key: 'game_password', before: '—', after: 'Hidden', changed: true, masked: true })
  })

  it('never shows a game password value, even an unexpected one', () => {
    const r = auditDiffRow('game_password', 'example-pass', 'other-pass')
    expect([r.before, r.after]).toEqual(['Changed', 'Changed'])
  })

  it('shows other settings as before and after values', () => {
    const motd = diffRows(row('server.config')).find((r) => r.key === 'motd_1')
    expect(motd).toEqual({
      key: 'motd_1', before: 'Welcome to the test server', after: 'Cup qualifiers tonight at 20:00 UTC', changed: true, masked: false,
    })
  })

  it('shows the ruleset change', () => {
    expect(diffRows(row('server.ruleset'))).toEqual([
      { key: 'ruleset', before: 'casual', after: 'certified', changed: true, masked: false },
    ])
  })

  it('renders structured seed values as JSON', () => {
    const color = diffRows(row('server.config.seed')).find((r) => r.key === 'board_label_color')
    expect(color?.after).toBe('{"a":0,"b":55,"g":175,"r":212}')
  })

  it('never puts a password value in any row of the fixture', () => {
    for (const e of rows) {
      for (const r of diffRows(e).filter((d) => d.key === 'game_password')) {
        expect(['Changed', 'Hidden', '—']).toContain(r.before)
        expect(['Changed', 'Hidden', '—']).toContain(r.after)
      }
    }
  })
})

describe('the System actor', () => {
  it('labels a row with no actor as System', () => {
    const seed = row('server.config.seed')
    expect(isSystemActor(seed)).toBe(true)
    expect(auditActorName(seed)).toBe('System')
  })

  it('keeps the actor alias of a staff row', () => {
    const e = row('server.config')
    expect(isSystemActor(e)).toBe(false)
    expect(auditActorName(e)).toBe('AdminUser')
  })
})

describe('rollback', () => {
  it('needs a reason only for a ruleset rollback', () => {
    expect(rollbackNeedsReason(row('server.ruleset'))).toBe(true)
    expect(rollbackNeedsReason(row('server.config'))).toBe(false)
    expect(rollbackNeedsReason({ action: 'user.ban' })).toBe(false)
  })

  it('explains a skipped game password', () => {
    expect(rollbackNotice({ skipped: ['game_password'] })).toBe(PASSWORD_SKIPPED_NOTICE)
    expect(PASSWORD_SKIPPED_NOTICE).toBe('Rolled back. The game password was not changed')
  })

  it('has nothing to explain when nothing was skipped', () => {
    expect(rollbackNotice({ skipped: [] })).toBeNull()
    expect(rollbackNotice({})).toBeNull()
    expect(rollbackNotice(undefined)).toBeNull()
  })

  it('recognises a not_reversible answer', () => {
    expect(isNotReversible(new ApiError(409, 'Only the game password changed.', 'x', 'not_reversible'))).toBe(true)
    expect(isNotReversible(new ApiError(409, 'Already rolled back.', 'x'))).toBe(false)
    expect(isNotReversible(new Error('boom'))).toBe(false)
  })
})

describe('the rollback, unmanaged region and cutover seed rows', () => {
  const rollbacks = auditServerConfigFixture('auditServerConfigRollback')
  const regions = auditServerConfigFixture('auditServerConfigUnmanagedRegion')
  const [cutoverSeed] = auditServerConfigFixture('auditServerConfigCutoverSeed')

  function rollbackOf(action: string): AuditEntry {
    const found = rollbacks.find((e) => e.action === action && e.reverts)
    if (!found) throw new Error(`no ${action} rollback in the fixture`)
    return found
  }

  it('describes a rollback by the change it made, and shows only the changed settings', () => {
    expect(serverAuditDescription(rollbackOf('server.ruleset'))).toBe(
      'Changed ruleset of server 7c3e9d14 from certified to casual',
    )
    expect(serverAuditDescription(rollbackOf('server.config'))).toBe('Changed 1 setting on server 7c3e9d14')
    expect(diffRows(rollbackOf('server.config'))).toEqual([
      { key: 'motd_1', before: 'Cup qualifiers tonight at 20:00 UTC', after: 'Welcome to the test server', changed: true, masked: false },
    ])
    expect(diffRows(rollbackOf('server.ruleset')).map((r) => r.key)).toEqual(['ruleset'])
  })

  it('offers no rollback of a rollback or of a reverted row', () => {
    expect(rollbacks.map((e) => [e.reverts !== null, e.reverted, e.can_rollback])).toEqual([
      [true, false, false], [false, true, false], [true, false, false], [false, true, false],
    ])
    expect(rollbacks.filter((e) => e.reverts).map(auditActorName)).toEqual(['AdminUser', 'AdminUser'])
  })

  it('shows a region change with a null version as one setting, without the version', () => {
    for (const e of regions) {
      expect(serverAuditDescription(e)).toBe('Changed 1 setting on server 7c3e9d14')
      expect(diffRows(e).map((r) => r.key)).toEqual(['region'])
    }
    expect(diffRows(regions[1])[0]).toEqual({ key: 'region', before: 'United States', after: 'Canada', changed: true, masked: false })
  })

  it('shows the cutover seed as a System seed of its cutover settings, with no password row', () => {
    expect(isSystemActor(cutoverSeed)).toBe(true)
    expect(auditActorName(cutoverSeed)).toBe('System')
    expect(serverAuditDescription(cutoverSeed)).toBe('Seeded settings for server 7c3e9d14')
    const shown = diffRows(cutoverSeed)
    expect(shown.some((r) => r.key === 'game_password' || r.masked)).toBe(false)
    expect(shown.every((r) => r.before === '—' && r.changed)).toBe(true)
    expect(shown.find((r) => r.key === 'board_label_color')?.after).toBe('{"a":0,"b":55,"g":175,"r":212}')
  })
})
