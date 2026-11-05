import type {
  AdminServerConfig,
  ServerConfigChange,
  ServerConfigColor,
  ServerConfigEditor,
  ServerConfigGroup,
  ServerConfigKey,
  ServerConfigKeyId,
  ServerConfigPatchResult,
  ServerConfigRestart,
  ServerConfigValues,
  ServerOperationsRuleset,
  ServerRuleset,
} from '@/app/utils/api'
import { ADMIN_DASHBOARD_ROLES, ADMIN_ONLY_ROLES } from '@/app/utils/roles'
import { serverActionsFor } from '../serverControl'

type TextChars = 'listing' | 'strict'

export type SettingSpec =
  | { kind: 'text'; label: string; minLength: number; maxLength: number; chars: TextChars }
  | { kind: 'password'; label: string; minLength: number; maxLength: number }
  | { kind: 'map'; label: string; minLength: number; maxLength: number }
  | { kind: 'number'; label: string; min: number; max: number; hint?: string }
  | { kind: 'bool'; label: string }
  | { kind: 'color'; label: string }

const listing = (label: string, minLength = 0): SettingSpec => ({ kind: 'text', label, minLength, maxLength: 80, chars: 'listing' })
const number = (label: string, min: number, max: number, hint?: string): SettingSpec => ({ kind: 'number', label, min, max, hint })
const bool = (label: string): SettingSpec => ({ kind: 'bool', label })

export const SETTING_SPECS: Record<ServerConfigKeyId, SettingSpec> = {
  server_name: listing('Server name', 1),
  region: { kind: 'text', label: 'Region', minLength: 1, maxLength: 64, chars: 'strict' },
  admin_name: listing('Admin name'),
  admin_email: listing('Admin email'),
  motd_1: listing('Message of the day, line 1'),
  motd_2: listing('Message of the day, line 2'),
  motd_3: listing('Message of the day, line 3'),
  motd_4: listing('Message of the day, line 4'),
  max_players: number('Max players', 1, 128),
  max_spectators: number('Max spectators', 0, 64),
  game_password: { kind: 'password', label: 'Game password', minLength: 0, maxLength: 32 },
  mute_spectators: bool('Mute spectators'),
  tournament: bool('Tournament mode'),
  start_map: { kind: 'map', label: 'Start map', minLength: 1, maxLength: 64 },
  time_limit: number('Time limit (minutes)', 0, 999, '0 means no limit'),
  goal_team_score: number('Score limit', 0, 999, '0 means no limit'),
  sudden_death: bool('Sudden death'),
  checkpoints: bool('Checkpoints'),
  player_collisions: bool('Player collisions'),
  spectate_after_cap: bool('Spectate after cap'),
  allow_boosted_caps: bool('Allow boosted caps'),
  idle_to_spec_minutes: number('Idle to spectator (minutes)', 1, 999),
  board_label_text: { kind: 'text', label: 'Board label text', minLength: 0, maxLength: 64, chars: 'strict' },
  board_label_color: { kind: 'color', label: 'Board label colour' },
  allowed_teams: number('Allowed teams', 0, 2, '0 both, 1 red only, 2 blue only'),
  winter_scoreboard: bool('Winter scoreboard'),
  spectator_votes: bool('Spectators can vote'),
  mid_game_vote_percent: number('Mid-game vote (%)', 0, 100),
  vote_time_limit: number('Vote time (seconds)', 1, 999),
  scoreboard_delay: number('Scoreboard delay (seconds)', 0, 999),
  switch_on_empty: bool('Switch map when empty'),
  empty_minutes: number('Empty for (minutes)', 1, 999),
  random_map: bool('Switch to a random map'),
  default_map: { kind: 'map', label: 'Default map', minLength: 0, maxLength: 64 },
}

export function isSettingId(key: string): key is ServerConfigKeyId {
  return Object.hasOwn(SETTING_SPECS, key)
}

export const CERTIFIED_LOCKED_KEYS: readonly ServerConfigKeyId[] = ['max_players', 'allow_boosted_caps', 'player_collisions']

export type DraftValue = string | boolean | ServerConfigColor

export interface SettingsDraft {
  ruleset: ServerRuleset
  values: Partial<Record<ServerConfigKeyId, DraftValue>>
}

const NO_COLOR: ServerConfigColor = { r: 0, g: 0, b: 0, a: 0 }

function draftValueOf(id: ServerConfigKeyId, config: AdminServerConfig): DraftValue {
  const value = config.values[id]
  const spec = SETTING_SPECS[id]
  if (spec.kind === 'bool') return value === true
  if (spec.kind === 'color') return typeof value === 'object' ? { ...value } : { ...NO_COLOR }
  if (spec.kind === 'number') return typeof value === 'number' ? String(value) : ''
  return typeof value === 'string' ? value : ''
}

export function initialDraft(config: AdminServerConfig): SettingsDraft {
  return {
    ruleset: config.ruleset,
    values: Object.fromEntries(config.keys.map((key) => [key.id, draftValueOf(key.id, config)])),
  }
}

const FORBIDDEN: Record<TextChars | 'map', { chars: string; message: string }> = {
  listing: { chars: '="', message: 'Cannot contain = or "' },
  strict: { chars: '[]="', message: 'Cannot contain [ ] = or "' },
  map: { chars: '[]="\' \\$`', message: 'Cannot contain spaces or any of [ ] = " \' \\ $ `' },
}

const PRINTABLE_FIRST = 32
const PRINTABLE_LAST = 126
const COLOR_MAX = 255

function textError(value: string, minLength: number, maxLength: number, forbidden: { chars: string; message: string }): string | null {
  if (value.length < minLength) return 'Required'
  if (value.length > maxLength) return `At most ${maxLength} characters`
  const chars = [...value]
  if (chars.some((char) => char.charCodeAt(0) < PRINTABLE_FIRST || char.charCodeAt(0) > PRINTABLE_LAST)) {
    return 'Use plain ASCII letters, digits and punctuation'
  }
  return chars.some((char) => forbidden.chars.includes(char)) ? forbidden.message : null
}

function isWholeNumber(text: string): boolean {
  return /^-?\d+$/.test(text.trim())
}

export function validateSetting(id: ServerConfigKeyId, value: DraftValue): string | null {
  const spec = SETTING_SPECS[id]
  switch (spec.kind) {
    case 'text':
      return textError(String(value), spec.minLength, spec.maxLength, FORBIDDEN[spec.chars])
    case 'password':
      return textError(String(value), spec.minLength, spec.maxLength, FORBIDDEN.listing)
    case 'map':
      return textError(String(value), spec.minLength, spec.maxLength, FORBIDDEN.map)
    case 'number': {
      const text = String(value)
      if (!isWholeNumber(text)) return 'Enter a whole number'
      const parsed = Number(text)
      return parsed < spec.min || parsed > spec.max ? `From ${spec.min} to ${spec.max}` : null
    }
    case 'color': {
      const parts = typeof value === 'object' ? [value.r, value.g, value.b, value.a] : []
      const valid = parts.length > 0 && parts.every((part) => Number.isInteger(part) && part >= 0 && part <= COLOR_MAX)
      return valid ? null : 'Each component is 0 to 255'
    }
    case 'bool':
      return null
  }
}

const EDITOR_ROLES: Record<ServerConfigEditor, number[]> = {
  staff: ADMIN_DASHBOARD_ROLES,
  admin: ADMIN_ONLY_ROLES,
}

export type SettingMode = 'editable' | 'read_only' | 'locked' | 'after_cutover' | 'not_managed'

function stateFor(key: ServerConfigKey, config: AdminServerConfig, ruleset: ServerRuleset): ServerConfigKey['state'] {
  if (ruleset === config.ruleset || key.state === 'not_managed' || key.state === 'after_cutover') return key.state
  if (!CERTIFIED_LOCKED_KEYS.includes(key.id)) return key.state
  return ruleset === 'certified' ? 'locked' : 'editable'
}

export function settingMode(key: ServerConfigKey, role: number | undefined, config: AdminServerConfig, ruleset: ServerRuleset): SettingMode {
  const state = stateFor(key, config, ruleset)
  if (state !== 'editable') return state
  return EDITOR_ROLES[key.editable_by].includes(role ?? 0) ? 'editable' : 'read_only'
}

type WireValue = ServerConfigValues[ServerConfigKeyId]

function wireValue(id: ServerConfigKeyId, value: DraftValue): WireValue {
  if (SETTING_SPECS[id].kind === 'number') return isWholeNumber(String(value)) ? Number(value) : String(value)
  return typeof value === 'object' ? { ...value } : value
}

function sameValue(a: WireValue, b: WireValue): boolean {
  if (typeof a === 'object' && typeof b === 'object') return a.r === b.r && a.g === b.g && a.b === b.b && a.a === b.a
  return a === b
}

export function changedSettings(config: AdminServerConfig, draft: SettingsDraft, role: number | undefined): ServerConfigKeyId[] {
  return config.keys
    .filter((key) => settingMode(key, role, config, draft.ruleset) === 'editable')
    .map((key) => key.id)
    .filter((id) => {
      const value = draft.values[id]
      return value !== undefined && !sameValue(wireValue(id, value), config.values[id])
    })
}

export function settingsChange(config: AdminServerConfig, draft: SettingsDraft, role: number | undefined): ServerConfigChange['changes'] {
  const changes: ServerConfigChange['changes'] = Object.fromEntries(
    changedSettings(config, draft, role).map((id) => [id, wireValue(id, draft.values[id] ?? '')]),
  )
  return draft.ruleset === config.ruleset ? changes : { ...changes, ruleset: draft.ruleset }
}

export function settingsErrors(
  config: AdminServerConfig,
  draft: SettingsDraft,
  role: number | undefined,
): Partial<Record<ServerConfigKeyId, string>> {
  const errors = changedSettings(config, draft, role).map((id) => [id, validateSetting(id, draft.values[id] ?? '')] as const)
  return Object.fromEntries(errors.filter(([, error]) => error !== null))
}

export function reasonRequired(config: AdminServerConfig, draft: SettingsDraft): boolean {
  return draft.ruleset !== config.ruleset
}

const UNPUSHED_CHANGES: readonly string[] = ['ruleset', 'region']

export function pushesSettings(changes: ServerConfigChange['changes']): boolean {
  return Object.keys(changes).some((id) => !UNPUSHED_CHANGES.includes(id))
}

export function canApplyNow(role: number | undefined): boolean {
  return serverActionsFor(role, undefined).some((item) => item.action === 'restart')
}

export function saveRoute(role: number | undefined): 'config' | 'config/basic' {
  return ADMIN_ONLY_ROLES.includes(role ?? 0) ? 'config' : 'config/basic'
}

function restartFailure(restart: ServerConfigRestart | null): string | null {
  if (!restart || !('error' in restart)) return null
  return restart.error === 'rate_limited'
    ? `another action just reached this server. Try again in ${restart.retry_after} s.`
    : 'the host agent did not respond. It applies at the next restart.'
}

export function saveOutcome(result: ServerConfigPatchResult, changes: ServerConfigChange['changes']): { message: string; failed: boolean } {
  const { mode, restart } = result.apply
  if (mode === 'next_map') return { message: 'ruleset' in changes ? 'Saved. Applies at the next map' : 'Saved', failed: false }
  if (mode === 'when_empty') return { message: 'Saved. Applies when the server is empty', failed: false }
  const failure = restartFailure(restart)
  return failure ? { message: `Saved, but the restart failed: ${failure}`, failed: true } : { message: 'Saved. Restarting', failed: false }
}

export function teamRunText(ruleset: ServerOperationsRuleset | undefined): string {
  if (ruleset?.team_run_active === true) return 'A team run is in progress'
  if (ruleset?.team_run_active === false) return 'No team run in progress'
  return 'Team run state unknown'
}

export const SETTING_GROUPS: readonly { id: ServerConfigGroup; label: string }[] = [
  { id: 'listing', label: 'Listing' },
  { id: 'access', label: 'Access' },
  { id: 'match', label: 'Match' },
  { id: 'start_map', label: 'Start map' },
  { id: 'gameplay', label: 'Gameplay' },
  { id: 'mapvote', label: 'MapVote' },
]

export function canOpenServerSettings(role: number | undefined): boolean {
  return ADMIN_DASHBOARD_ROLES.includes(role ?? 0)
}

export interface SettingField {
  id: ServerConfigKeyId
  mode: SettingMode
}

export interface SettingsGroupView {
  id: ServerConfigGroup
  label: string
  fields: SettingField[]
  later: SettingField[]
}

export interface SettingsView {
  groups: SettingsGroupView[]
  rulesetEditable: boolean
  notManaged: boolean
  roleNotice: string | null
}

function joinWords(words: string[]): string {
  if (words.length < 2) return words.join('')
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1)
}

export function settingsView(config: AdminServerConfig, draft: SettingsDraft, role: number | undefined): SettingsView {
  const fields = config.keys.map((key) => ({ id: key.id, group: key.group, mode: settingMode(key, role, config, draft.ruleset) }))
  const rulesetEditable = canOpenServerSettings(role)
  const editable = fields.filter((field) => field.mode === 'editable').map((field) => `the ${lowerFirst(SETTING_SPECS[field.id].label)}`)
  const yours = rulesetEditable ? ['the ruleset', ...editable] : editable
  const readOnly = fields.some((field) => field.mode === 'read_only')
  const youCan = yours.length ? ` You can change ${joinWords(yours)}.` : ''
  return {
    groups: SETTING_GROUPS.map(({ id, label }) => {
      const inGroup = fields.filter((field) => field.group === id).map(({ id: fieldId, mode }) => ({ id: fieldId, mode }))
      return {
        id,
        label,
        fields: inGroup.filter((field) => field.mode !== 'after_cutover'),
        later: inGroup.filter((field) => field.mode === 'after_cutover'),
      }
    }),
    rulesetEditable,
    notManaged: !config.managed,
    roleNotice: readOnly ? `Only admins can change these.${youCan}` : null,
  }
}
