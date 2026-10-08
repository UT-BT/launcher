import type { BlockCode, Draft, DraftFile, FileDisposition, WarningCode } from '@/app/utils/mapUploadTypes'
import { hasCodePackage, type DraftFormValues } from './draftFormState'

export interface ObjectGroup {
  group: string | null
  names: string[]
}

export function groupObjects(objects: string[]): ObjectGroup[] {
  const groups = new Map<string | null, string[]>()
  for (const path of objects) {
    const parts = path.split('.')
    const name = parts.length > 1 ? parts[parts.length - 1] : path
    const group = parts.length > 2 ? parts.slice(1, -1).join('.') : null
    const names = groups.get(group) ?? []
    names.push(name)
    groups.set(group, names)
  }
  return [...groups.entries()]
    .map(([group, names]) => ({ group, names: [...names].sort((a, b) => a.localeCompare(b)) }))
    .sort((a, b) => (a.group === null ? -1 : b.group === null ? 1 : a.group.localeCompare(b.group)))
}

const DISPOSITION_ORDER: FileDisposition[] = ['install', 'skip-identical', 'keep-existing', 'dropped']

export function sortFiles(files: DraftFile[]): DraftFile[] {
  return [...files].sort((a, b) =>
    Number(b.kind === 'map') - Number(a.kind === 'map')
    || DISPOSITION_ORDER.indexOf(a.disposition) - DISPOSITION_ORDER.indexOf(b.disposition)
    || a.file.localeCompare(b.file, undefined, { sensitivity: 'base' }))
}

export function dispositionCounts(files: DraftFile[]): { disposition: FileDisposition; count: number }[] {
  return DISPOSITION_ORDER
    .map((disposition) => ({ disposition, count: files.filter((file) => file.disposition === disposition).length }))
    .filter((entry) => entry.count > 0)
}

export function shippedBytes(files: DraftFile[]): number {
  return files.filter((file) => file.disposition === 'install').reduce((total, file) => total + file.size, 0)
}

export type DraftField = 'checks' | 'name' | 'author' | 'gameplay' | 'screenshot' | 'version' | 'code'

const BLOCK_FIELD: Partial<Record<BlockCode, DraftField>> = {
  bad_prefix: 'name',
  bad_characters: 'name',
  name_too_long: 'name',
  name_taken: 'name',
  name_empty: 'name',
  author_missing: 'author',
  difficulty_missing: 'gameplay',
  code_package_unacknowledged: 'code',
  version_target_invalid: 'version',
  version_target_has_successor: 'version',
}

const WARNING_FIELD: Partial<Record<WarningCode, DraftField>> = {
  required_players_mismatch: 'gameplay',
  no_screenshot: 'screenshot',
  code_package: 'code',
  event_pool: 'version',
}

export function blockField(code: BlockCode): DraftField | null {
  return BLOCK_FIELD[code] ?? null
}

export function warningField(code: WarningCode): DraftField | null {
  return WARNING_FIELD[code] ?? null
}

export function draftFieldId(draftId: number, field: DraftField): string {
  return `map-upload-draft-${draftId}-${field}`
}

export function scrollToDraftField(draftId: number, field: DraftField): void {
  document.getElementById(draftFieldId(draftId, field))?.scrollIntoView({ behavior: 'smooth', block: field === 'checks' ? 'start' : 'center' })
}

export type ReadinessState = 'ok' | 'todo' | 'warn' | 'optional'

export interface ReadinessItem {
  id: string
  state: ReadinessState
  label: string
  field: DraftField | null
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

function authorName(values: DraftFormValues): string | null {
  if (values.authorMode === 'player') return values.authorUser ? values.authorUser.alias || 'a linked player' : null
  return values.authorStr.trim() || null
}

const DETAIL_BLOCKS: BlockCode[] = ['author_missing', 'difficulty_missing']

export function readinessItems(draft: Draft, values: DraftFormValues): ReadinessItem[] {
  const blocks = draft.blocks.filter((block) => !DETAIL_BLOCKS.includes(block.code))
  const author = authorName(values)
  const items: ReadinessItem[] = [
    author
      ? { id: 'author', state: 'ok', label: `By ${author}`, field: 'author' }
      : { id: 'author', state: 'todo', label: 'Set the author', field: 'author' },
    values.difficulty === null
      ? { id: 'difficulty', state: 'todo', label: 'Set the difficulty', field: 'gameplay' }
      : { id: 'difficulty', state: 'ok', label: `Difficulty ${values.difficulty}`, field: 'gameplay' },
    values.requiredPlayers === null
      ? { id: 'players', state: 'todo', label: 'Set the required players', field: 'gameplay' }
      : { id: 'players', state: 'ok', label: plural(values.requiredPlayers, 'player'), field: 'gameplay' },
    blocks.length === 0
      ? { id: 'blocks', state: 'ok', label: 'Nothing else blocks publishing', field: 'checks' }
      : { id: 'blocks', state: 'todo', label: `${plural(blocks.length, 'block')} to fix`, field: 'checks' },
    draft.warnings.length === 0
      ? { id: 'warnings', state: 'ok', label: 'No warnings', field: 'checks' }
      : { id: 'warnings', state: 'warn', label: `${plural(draft.warnings.length, 'warning')} to read`, field: 'checks' },
  ]
  if (hasCodePackage(draft)) {
    items.push(values.codePackageAcknowledged
      ? { id: 'code', state: 'ok', label: 'Code package reviewed', field: 'code' }
      : { id: 'code', state: 'todo', label: 'Review the code package', field: 'code' })
  }
  if (values.versionTarget === null) {
    items.push({ id: 'version', state: 'ok', label: 'A new map', field: 'version' })
  } else if (values.versionMode === null) {
    items.push({ id: 'version', state: 'todo', label: `Choose what happens to ${values.versionTarget}`, field: 'version' })
  } else {
    const verb = values.versionMode === 'rework-keep-both' ? 'Sits beside' : 'Replaces'
    items.push({ id: 'version', state: 'ok', label: `${verb} ${values.versionTarget}`, field: 'version' })
  }
  items.push(draft.screenshot.source === 'none'
    ? { id: 'screenshot', state: 'optional', label: 'No screenshot (optional)', field: 'screenshot' }
    : { id: 'screenshot', state: 'ok', label: 'Screenshot set', field: 'screenshot' })
  return items
}
