import type { BlockCode, DraftFile, DraftStatus, FileDisposition, FileKind, WarningCode } from '@/app/utils/mapUploadTypes'
import type { Tone } from '../../types'

export const DRAFT_STATUS_LABEL: Record<DraftStatus, { label: string; tone: Tone }> = {
  analyzing: { label: 'Analysing', tone: 'amber' },
  ready: { label: 'Ready', tone: 'emerald' },
  invalid: { label: 'Blocked', tone: 'red' },
  published: { label: 'Published', tone: 'accent' },
}

export const DISPOSITION_LABEL: Record<FileDisposition, { label: string; tone: Tone }> = {
  install: { label: 'Install', tone: 'emerald' },
  'skip-identical': { label: 'Skip, identical', tone: 'accent' },
  'keep-existing': { label: 'Keep ours', tone: 'amber' },
  dropped: { label: 'Dropped', tone: 'red' },
}

export const FILE_KIND_LABEL: Record<FileKind, string> = {
  map: 'Map',
  texture: 'Textures',
  sound: 'Sounds',
  music: 'Music',
  code: 'Code package',
  companion: 'Code strings (.int)',
  other: 'Not a UT package',
}

export const BLOCK_TITLE: Record<BlockCode, string> = {
  bad_prefix: 'The map name must start with CTF-BT- or CTF-BT+',
  bad_characters: 'The map name has characters UT cannot use',
  name_too_long: 'The map name is longer than 63 characters',
  name_taken: 'A map with this name already exists',
  missing_package: 'The map needs a package that players cannot get',
  host_only_package: 'The map needs a package that players cannot download',
  reserved_name: 'A package uses a reserved name',
  collision_missing_objects: 'A package clashes with a different copy we already have',
  collision_unverifiable: 'A package clashes with a copy that cannot be checked',
  code_package_unacknowledged: 'The code package has not been reviewed yet',
  version_target_invalid: 'The map this replaces cannot be used',
  version_target_has_successor: 'The map this replaces already has a newer version',
}

export const WARNING_TITLE: Record<WarningCode, string> = {
  required_players_mismatch: 'Required players differs from the map name',
  no_screenshot: 'No screenshot',
  code_package: 'Ships a code package',
  event_pool: 'The old map is in an event that is still running',
  name_normalised: 'The map name prefix was corrected',
}

const DEFAULT_REASON: Record<FileDisposition, string> = {
  install: 'New to the servers, so it will be installed.',
  'skip-identical': 'An identical copy is already on the servers.',
  'keep-existing': 'A different copy is already on the servers and the map works with it.',
  dropped: 'It will not be published.',
}

export function fileReason(file: DraftFile): string {
  return file.reason || DEFAULT_REASON[file.disposition]
}

export function countLabel(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}
