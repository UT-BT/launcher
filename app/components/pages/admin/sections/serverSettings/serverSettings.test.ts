import { describe, expect, it } from 'vitest'
import { ROLE } from '@/app/utils/roles'
import { serverConfigFixture, serverConfigOperationsFixture, serverConfigPatchFixture } from '@/app/utils/fixtures/serverConfigFixtures'
import type { AdminServerConfig, ServerConfigKeyId } from '@/app/utils/api'
import {
  canApplyNow,
  canOpenServerSettings,
  initialDraft,
  pushesSettings,
  reasonRequired,
  saveOutcome,
  saveRoute,
  settingMode,
  settingsChange,
  settingsErrors,
  settingsView,
  teamRunText,
  validateSetting,
  type DraftValue,
  type SettingsDraft,
} from './serverSettings'

function modeOf(config: AdminServerConfig, id: ServerConfigKeyId, role: number, draft: SettingsDraft = initialDraft(config)) {
  const key = config.keys.find((candidate) => candidate.id === id)
  if (!key) throw new Error(`no key ${id}`)
  return settingMode(key, role, config, draft.ruleset)
}

describe('settingMode', () => {
  const certified = serverConfigFixture('serverConfigResponse')
  const legacy = serverConfigFixture('serverConfigResponseLegacy')
  const unmanaged = serverConfigFixture('serverConfigResponseUnmanaged')

  it('lets an admin edit every editable key', () => {
    expect(modeOf(certified, 'server_name', ROLE.ADMIN)).toBe('editable')
    expect(modeOf(certified, 'max_spectators', ROLE.ADMIN)).toBe('editable')
    expect(modeOf(certified, 'board_label_color', ROLE.ADMIN)).toBe('editable')
  })

  it('lets a moderator edit the staff keys and shows the admin keys read-only', () => {
    expect(modeOf(certified, 'server_name', ROLE.MODERATOR)).toBe('editable')
    expect(modeOf(certified, 'game_password', ROLE.MODERATOR)).toBe('editable')
    expect(modeOf(certified, 'region', ROLE.MODERATOR)).toBe('read_only')
    expect(modeOf(certified, 'motd_1', ROLE.MODERATOR)).toBe('read_only')
  })

  it('shows the keys the certified ruleset sets as locked for every role', () => {
    for (const role of [ROLE.ADMIN, ROLE.MODERATOR]) {
      expect(modeOf(certified, 'max_players', role)).toBe('locked')
      expect(modeOf(certified, 'allow_boosted_caps', role)).toBe('locked')
      expect(modeOf(certified, 'player_collisions', role)).toBe('locked')
    }
  })

  it('shows the cutover keys of a legacy server as available after cutover', () => {
    expect(modeOf(legacy, 'sudden_death', ROLE.ADMIN)).toBe('after_cutover')
    expect(modeOf(legacy, 'default_map', ROLE.ADMIN)).toBe('after_cutover')
    expect(modeOf(legacy, 'time_limit', ROLE.ADMIN)).toBe('editable')
  })

  it('leaves only the region editable on a server that is not managed', () => {
    expect(modeOf(unmanaged, 'region', ROLE.ADMIN)).toBe('editable')
    expect(modeOf(unmanaged, 'server_name', ROLE.ADMIN)).toBe('not_managed')
    expect(modeOf(unmanaged, 'game_password', ROLE.MODERATOR)).toBe('not_managed')
    expect(modeOf(unmanaged, 'region', ROLE.MODERATOR)).toBe('read_only')
  })

  it('gives a role outside the dashboard nothing to edit', () => {
    expect(modeOf(certified, 'server_name', ROLE.CUP_ADMIN)).toBe('read_only')
    expect(modeOf(certified, 'server_name', ROLE.USER)).toBe('read_only')
  })
})

describe('locks follow the ruleset being edited', () => {
  const certified = serverConfigFixture('serverConfigResponse')
  const legacy = serverConfigFixture('serverConfigResponseLegacy')

  it('unlocks the three keys when a certified server is switched to Casual, and locks them again on the way back', () => {
    const casual = { ...initialDraft(certified), ruleset: 'casual' as const }
    expect(modeOf(certified, 'max_players', ROLE.ADMIN, casual)).toBe('editable')
    expect(modeOf(certified, 'allow_boosted_caps', ROLE.ADMIN, casual)).toBe('editable')
    expect(modeOf(certified, 'player_collisions', ROLE.ADMIN, casual)).toBe('editable')
    expect(modeOf(certified, 'max_players', ROLE.MODERATOR, casual)).toBe('read_only')

    const back = { ...casual, ruleset: 'certified' as const }
    expect(modeOf(certified, 'max_players', ROLE.ADMIN, back)).toBe('locked')
  })

  it('keeps the server state for every other key whatever the ruleset', () => {
    const casual = { ...initialDraft(certified), ruleset: 'casual' as const }
    expect(modeOf(certified, 'tournament', ROLE.ADMIN, casual)).toBe('editable')
    expect(modeOf(certified, 'region', ROLE.MODERATOR, casual)).toBe('read_only')
  })

  it('locks max players when a casual server is switched to Certified, and leaves after-cutover keys as they are', () => {
    const toCertified = { ...initialDraft(legacy), ruleset: 'certified' as const }
    expect(modeOf(legacy, 'max_players', ROLE.ADMIN, toCertified)).toBe('locked')
    expect(modeOf(legacy, 'allow_boosted_caps', ROLE.ADMIN, toCertified)).toBe('after_cutover')
    expect(modeOf(legacy, 'tournament', ROLE.ADMIN, toCertified)).toBe('editable')
  })
})

describe('validateSetting', () => {
  it('accepts the values the fixtures hold', () => {
    const values = serverConfigFixture('serverConfigResponse').values
    const draft = initialDraft(serverConfigFixture('serverConfigResponse'))
    for (const id of Object.keys(values) as ServerConfigKeyId[]) {
      expect(validateSetting(id, draft.values[id] ?? ''), id).toBeNull()
    }
  })

  it('checks text length against the key limits', () => {
    expect(validateSetting('server_name', '')).toBe('Required')
    expect(validateSetting('server_name', 'x'.repeat(80))).toBeNull()
    expect(validateSetting('server_name', 'x'.repeat(81))).toBe('At most 80 characters')
    expect(validateSetting('motd_2', '')).toBeNull()
    expect(validateSetting('game_password', 'x'.repeat(33))).toBe('At most 32 characters')
    expect(validateSetting('board_label_text', 'x'.repeat(65))).toBe('At most 64 characters')
    expect(validateSetting('start_map', '')).toBe('Required')
    expect(validateSetting('default_map', '')).toBeNull()
  })

  it('refuses characters outside printable ASCII', () => {
    expect(validateSetting('motd_1', 'café')).toBe('Use plain ASCII letters, digits and punctuation')
    expect(validateSetting('motd_1', 'tab\there')).toBe('Use plain ASCII letters, digits and punctuation')
    expect(validateSetting('motd_1', '~ !')).toBeNull()
  })

  it('allows square brackets in listing text and the game password, but never = or "', () => {
    expect(validateSetting('server_name', '[UTBT.NET] - Test')).toBeNull()
    expect(validateSetting('game_password', '[pw]')).toBeNull()
    expect(validateSetting('server_name', 'a=b')).toBe('Cannot contain = or "')
    expect(validateSetting('game_password', 'say "hi"')).toBe('Cannot contain = or "')
  })

  it('refuses square brackets in the region and the board label', () => {
    expect(validateSetting('region', '[EU]')).toBe('Cannot contain [ ] = or "')
    expect(validateSetting('board_label_text', 'a=b')).toBe('Cannot contain [ ] = or "')
    expect(validateSetting('region', 'United States')).toBeNull()
  })

  it('refuses spaces, quotes and shell characters in map names', () => {
    expect(validateSetting('start_map', 'CTF-BT-Maverick')).toBeNull()
    for (const bad of ['CTF BT', "CTF-'x", 'CTF-$x', 'CTF-`x', 'CTF-\\x', 'CTF-[x]', 'CTF-"x', 'CTF=x']) {
      expect(validateSetting('start_map', bad), bad).toBe('Cannot contain spaces or any of [ ] = " \' \\ $ `')
    }
  })

  it('checks numbers are whole and within the key range', () => {
    expect(validateSetting('max_players', '1')).toBeNull()
    expect(validateSetting('max_players', '128')).toBeNull()
    expect(validateSetting('max_players', '0')).toBe('From 1 to 128')
    expect(validateSetting('max_players', '129')).toBe('From 1 to 128')
    expect(validateSetting('max_players', '')).toBe('Enter a whole number')
    expect(validateSetting('max_players', '2.5')).toBe('Enter a whole number')
    expect(validateSetting('allowed_teams', '3')).toBe('From 0 to 2')
    expect(validateSetting('mid_game_vote_percent', '100')).toBeNull()
    expect(validateSetting('idle_to_spec_minutes', '0')).toBe('From 1 to 999')
  })

  it('checks each colour component is 0 to 255', () => {
    expect(validateSetting('board_label_color', { r: 255, g: 0, b: 10, a: 0 })).toBeNull()
    expect(validateSetting('board_label_color', { r: 256, g: 0, b: 10, a: 0 })).toBe('Each component is 0 to 255')
  })
})

function edited(config: AdminServerConfig, values: Partial<Record<ServerConfigKeyId, DraftValue>>, ruleset = config.ruleset): SettingsDraft {
  const draft = initialDraft(config)
  return { ruleset, values: { ...draft.values, ...values } }
}

describe('settingsChange', () => {
  const certified = serverConfigFixture('serverConfigResponse')
  const legacy = serverConfigFixture('serverConfigResponseLegacy')

  it('is empty until something changed', () => {
    expect(settingsChange(certified, initialDraft(certified), ROLE.ADMIN)).toEqual({})
  })

  it('holds the changed keys only, typed for the wire', () => {
    const draft = edited(certified, {
      max_spectators: '12',
      motd_1: 'Cup qualifiers tonight',
      mute_spectators: true,
      board_label_color: { r: 10, g: 175, b: 55, a: 0 },
    })
    expect(settingsChange(certified, draft, ROLE.ADMIN)).toEqual({
      max_spectators: 12,
      motd_1: 'Cup qualifiers tonight',
      mute_spectators: true,
      board_label_color: { r: 10, g: 175, b: 55, a: 0 },
    })
  })

  it('drops an edit that is back at the saved value', () => {
    const draft = edited(certified, { max_spectators: '010', motd_1: 'Welcome to the test server' })
    expect(settingsChange(certified, draft, ROLE.ADMIN)).toEqual({})
  })

  it('carries the ruleset when it changed', () => {
    expect(settingsChange(certified, edited(certified, {}, 'casual'), ROLE.MODERATOR)).toEqual({ ruleset: 'casual' })
  })

  it('leaves out a key the role may not change', () => {
    const draft = edited(certified, { server_name: 'Renamed', motd_1: 'Hello' })
    expect(settingsChange(certified, draft, ROLE.MODERATOR)).toEqual({ server_name: 'Renamed' })
  })

  it('leaves out a key the ruleset in the dialog locks', () => {
    const unlocked = edited(legacy, { max_players: '16' })
    expect(settingsChange(legacy, unlocked, ROLE.ADMIN)).toEqual({ max_players: 16 })
    const locked = edited(legacy, { max_players: '16' }, 'certified')
    expect(settingsChange(legacy, locked, ROLE.ADMIN)).toEqual({ ruleset: 'certified' })
  })
})

describe('settingsErrors', () => {
  const legacy = serverConfigFixture('serverConfigResponseLegacy')

  it('checks the changed keys only, so a value already on the box never blocks a save', () => {
    const odd = { ...legacy, values: { ...legacy.values, motd_1: 'say "hi"' } }
    expect(settingsErrors(odd, edited(odd, { max_players: '200' }), ROLE.ADMIN)).toEqual({ max_players: 'From 1 to 128' })
  })

  it('reports nothing when the edits are valid', () => {
    expect(settingsErrors(legacy, edited(legacy, { max_players: '14', server_name: '[BT] Renamed' }), ROLE.ADMIN)).toEqual({})
  })
})

describe('the reason rule', () => {
  const certified = serverConfigFixture('serverConfigResponse')

  it('asks for a reason only when the ruleset changes', () => {
    expect(reasonRequired(certified, edited(certified, {}, 'casual'))).toBe(true)
    expect(reasonRequired(certified, edited(certified, { server_name: 'Renamed', game_password: '' }))).toBe(false)
    expect(reasonRequired(certified, edited(certified, {}, 'certified'))).toBe(false)
  })
})

describe('the apply choice', () => {
  it('matters only when a setting the server reads changes', () => {
    expect(pushesSettings({ max_players: 14 })).toBe(true)
    expect(pushesSettings({ ruleset: 'casual', server_name: 'Renamed' })).toBe(true)
    expect(pushesSettings({ ruleset: 'casual' })).toBe(false)
    expect(pushesSettings({ region: 'Germany' })).toBe(false)
    expect(pushesSettings({ ruleset: 'casual', region: 'Germany' })).toBe(false)
  })

  it('offers apply now to every role that may restart a server', () => {
    expect(canApplyNow(ROLE.ADMIN)).toBe(true)
    expect(canApplyNow(ROLE.MODERATOR)).toBe(true)
    expect(canApplyNow(ROLE.CUP_ADMIN)).toBe(false)
  })
})

describe('saveRoute', () => {
  it('sends admins to the full route and moderators to the basic one', () => {
    expect(saveRoute(ROLE.ADMIN)).toBe('config')
    expect(saveRoute(ROLE.MODERATOR)).toBe('config/basic')
    expect(saveRoute(undefined)).toBe('config/basic')
  })
})

describe('saveOutcome', () => {
  const saved = serverConfigPatchFixture('serverConfigPatchOk')

  const maxPlayers = { max_players: 12 }

  it('says a restart is under way after apply now', () => {
    expect(saveOutcome(saved, maxPlayers)).toEqual({ message: 'Saved. Restarting', failed: false })
  })

  it('says the change waits for an empty server', () => {
    expect(saveOutcome({ ...saved, apply: { mode: 'when_empty', restart: null } }, maxPlayers)).toEqual({
      message: 'Saved. Applies when the server is empty',
      failed: false,
    })
  })

  it('says a ruleset-only change applies at the next map', () => {
    expect(saveOutcome(serverConfigPatchFixture('serverConfigPatchNextMap'), { ruleset: 'casual' })).toEqual({
      message: 'Saved. Applies at the next map',
      failed: false,
    })
    expect(saveOutcome(serverConfigPatchFixture('serverConfigPatchNextMap'), { ruleset: 'casual', region: 'EU' })).toEqual({
      message: 'Saved. Applies at the next map',
      failed: false,
    })
  })

  it('says only saved when a region-only change pushes nothing', () => {
    expect(saveOutcome(serverConfigPatchFixture('serverConfigPatchNextMap'), { region: 'EU' })).toEqual({
      message: 'Saved',
      failed: false,
    })
  })

  it('says the save stands when the restart failed', () => {
    expect(saveOutcome({ ...saved, apply: { mode: 'now', restart: { error: 'rate_limited', retry_after: 9 } } }, maxPlayers)).toEqual({
      message: 'Saved, but the restart failed: another action just reached this server. Try again in 9 s.',
      failed: true,
    })
    expect(saveOutcome({ ...saved, apply: { mode: 'now', restart: { error: 'agent_error' } } }, maxPlayers)).toEqual({
      message: 'Saved, but the restart failed: the host agent did not respond. It applies at the next restart.',
      failed: true,
    })
  })
})

describe('teamRunText', () => {
  const rows = serverConfigOperationsFixture().servers

  it('reads the team run state from the operations row', () => {
    expect(teamRunText(rows.find((row) => row.name === 'BT Test Server | EU')?.ruleset)).toBe('A team run is in progress')
    expect(teamRunText(rows.find((row) => row.name === 'BT Test Server | AU')?.ruleset)).toBe('No team run in progress')
    expect(teamRunText(rows.find((row) => row.name === 'BT Test Server | US')?.ruleset)).toBe('Team run state unknown')
    expect(teamRunText(undefined)).toBe('Team run state unknown')
  })
})

describe('settingsView', () => {
  const certified = serverConfigFixture('serverConfigResponse')
  const legacy = serverConfigFixture('serverConfigResponseLegacy')
  const unmanaged = serverConfigFixture('serverConfigResponseUnmanaged')

  it('groups the keys in table order', () => {
    const view = settingsView(certified, initialDraft(certified), ROLE.ADMIN)
    expect(view.groups.map((group) => group.label)).toEqual(['Listing', 'Access', 'Match', 'Start map', 'Gameplay', 'MapVote'])
    expect(view.groups[1].fields.map((field) => field.id)).toEqual(['max_players', 'max_spectators', 'game_password', 'mute_spectators'])
  })

  it('sets the keys available after cutover apart in their group', () => {
    const view = settingsView(legacy, initialDraft(legacy), ROLE.ADMIN)
    const gameplay = view.groups.find((group) => group.id === 'gameplay')
    expect(gameplay?.fields.map((field) => field.id)).toEqual(['time_limit', 'goal_team_score'])
    expect(gameplay?.later.map((field) => field.id)).toContain('sudden_death')
    const mapvote = view.groups.find((group) => group.id === 'mapvote')
    expect(mapvote?.fields).toEqual([])
    expect(mapvote?.later).toHaveLength(8)
  })

  it('gives a moderator one notice naming what they can change', () => {
    expect(settingsView(certified, initialDraft(certified), ROLE.MODERATOR).roleNotice).toBe(
      'Only admins can change these. You can change the ruleset, the server name and the game password.',
    )
    expect(settingsView(certified, initialDraft(certified), ROLE.ADMIN).roleNotice).toBeNull()
  })

  it('flags a server that is not managed', () => {
    expect(settingsView(unmanaged, initialDraft(unmanaged), ROLE.ADMIN).notManaged).toBe(true)
    expect(settingsView(legacy, initialDraft(legacy), ROLE.ADMIN).notManaged).toBe(false)
    expect(settingsView(unmanaged, initialDraft(unmanaged), ROLE.MODERATOR).roleNotice).toBe(
      'Only admins can change these. You can change the ruleset.',
    )
  })

  it('lets staff open the dialog and change the ruleset', () => {
    expect(canOpenServerSettings(ROLE.MODERATOR)).toBe(true)
    expect(canOpenServerSettings(ROLE.ADMIN)).toBe(true)
    expect(canOpenServerSettings(ROLE.CUP_ADMIN)).toBe(false)
    expect(settingsView(unmanaged, initialDraft(unmanaged), ROLE.MODERATOR).rulesetEditable).toBe(true)
    expect(settingsView(certified, initialDraft(certified), ROLE.CUP_ADMIN).rulesetEditable).toBe(false)
  })
})
