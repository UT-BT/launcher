import { ApiError, mapUploadErrorMessage, type ForceActivateInput } from '@/app/utils/api'
import type { Publish, PublishHost, PublishState } from '@/app/utils/mapUploadTypes'

export const SETTLED_PUBLISH_STATES: readonly PublishState[] = ['active', 'failed']

export function isPublishSettled(state: PublishState): boolean {
  return SETTLED_PUBLISH_STATES.includes(state)
}

export function shouldPollPublish(publish: Pick<Publish, 'state'> | null, missing = false): boolean {
  if (missing) return false
  return publish === null || !isPublishSettled(publish.state)
}

export type PublishStepStatus = 'done' | 'current' | 'todo'

export interface PublishStep {
  state: PublishState
  label: string
  status: PublishStepStatus
}

const PUBLISH_STEP_LABELS: [PublishState, string][] = [
  ['validating', 'Checked'],
  ['storing', 'Stored'],
  ['compressing', 'Compressed'],
  ['registering', 'Registered'],
  ['distributing', 'On the hosts'],
  ['active', 'Live'],
]

export function publishSteps(state: PublishState): PublishStep[] | null {
  if (state === 'failed') return null
  const current = PUBLISH_STEP_LABELS.findIndex(([step]) => step === state)
  return PUBLISH_STEP_LABELS.map(([step, label], index) => ({
    state: step,
    label,
    status: state === 'active' || index < current ? 'done' : index === current ? 'current' : 'todo',
  }))
}

export function hostProgress(hosts: PublishHost[]): { installed: number; total: number } {
  return { installed: hosts.filter((host) => host.state === 'installed').length, total: hosts.length }
}

export function publishStragglers(hosts: PublishHost[]): PublishHost[] {
  return hosts.filter((host) => host.state !== 'installed')
}

export type ForceAvailability =
  | { kind: 'closed' }
  | { kind: 'waiting'; opensAt: string | null; msLeft: number | null }
  | { kind: 'available' }

export function forceAvailability(publish: Pick<Publish, 'state' | 'force_available_at' | 'hosts'>, now: number): ForceAvailability {
  if (publish.state !== 'distributing' || publishStragglers(publish.hosts).length === 0) return { kind: 'closed' }
  const opensAt = publish.force_available_at === null ? NaN : Date.parse(publish.force_available_at)
  if (Number.isNaN(opensAt)) return { kind: 'waiting', opensAt: null, msLeft: null }
  if (now < opensAt) return { kind: 'waiting', opensAt: publish.force_available_at, msLeft: opensAt - now }
  return { kind: 'available' }
}

export interface ForceConfirmation {
  publishId: number
  hosts: PublishHost[]
  payload: ForceActivateInput
}

export function forceConfirmation(publish: Pick<Publish, 'id' | 'hosts'>): ForceConfirmation {
  const hosts = publishStragglers(publish.hosts)
  return { publishId: publish.id, hosts, payload: { confirm_hosts: hosts.map((host) => host.host) } }
}

export function forceActivateFailure(e: unknown): { message: string; askAgain: boolean } {
  return {
    message: mapUploadErrorMessage(e),
    askAgain: e instanceof ApiError && e.reason === 'stragglers_changed',
  }
}

export function publishErrorMessage(e: unknown): string {
  if (e instanceof ApiError && e.status === 404) return 'This publish no longer exists.'
  return mapUploadErrorMessage(e)
}
