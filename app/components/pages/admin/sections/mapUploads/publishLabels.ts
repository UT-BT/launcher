import type { ActivationKind, DriftLocationState, PublishHostState, PublishState, VersionMode } from '@/app/utils/mapUploadTypes'
import type { Tone } from '../../types'

export const PUBLISH_STATE_LABEL: Record<PublishState, { label: string; tone: Tone }> = {
  validating: { label: 'Checking', tone: 'amber' },
  storing: { label: 'Storing files', tone: 'amber' },
  compressing: { label: 'Preparing downloads', tone: 'amber' },
  registering: { label: 'Adding the map', tone: 'amber' },
  distributing: { label: 'Waiting on hosts', tone: 'accent' },
  active: { label: 'Live', tone: 'emerald' },
  failed: { label: 'Failed', tone: 'red' },
}

export const HOST_STATE_LABEL: Record<PublishHostState, { label: string; tone: Tone }> = {
  pending: { label: 'Pending', tone: 'amber' },
  installed: { label: 'Installed', tone: 'emerald' },
  conflict: { label: 'Conflict', tone: 'red' },
  error: { label: 'Error', tone: 'red' },
}

export const ACTIVATION_LABEL: Record<ActivationKind, string> = {
  auto: 'Automatic',
  forced: 'Forced',
}

export const VERSION_MODE_LABEL: Record<VersionMode, string> = {
  update: 'Update, records move to the new map',
  'rework-retire': 'Rework, retire old',
  'rework-keep-both': 'Rework, keep both',
}

export const DRIFT_STATE_LABEL: Record<DriftLocationState, { label: string; tone: Tone }> = {
  present: { label: 'Present', tone: 'emerald' },
  conflict: { label: 'Conflict', tone: 'red' },
  error: { label: 'Error', tone: 'red' },
}
