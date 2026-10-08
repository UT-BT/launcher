import { describe, expect, it } from 'vitest'
import { ApiError } from '@/app/utils/api'
import { mapUploadErrorFixture, mapUploadFixture } from '@/app/utils/fixtures/mapUploadFixtures'
import { PUBLISH_STATES, type Publish, type PublishState } from '@/app/utils/mapUploadTypes'
import {
  hostProgress, publishSteps,
  forceActivateFailure, forceAvailability, forceConfirmation, isPublishSettled, publishErrorMessage, publishStragglers,
  shouldPollPublish,
} from './publishState'

const publish = mapUploadFixture('publish')
const opensAt = Date.parse(publish.force_available_at ?? '')

function withState(state: PublishState, changes: Partial<Publish> = {}): Publish {
  return { ...publish, state, ...changes }
}

function apiError(name: Parameters<typeof mapUploadErrorFixture>[0]): ApiError {
  const body = mapUploadErrorFixture(name)
  return new ApiError(409, body.error, 'fallback', body.code)
}

describe('publishStragglers', () => {
  it('lists every host that has not installed the map, conflicts and errors included, in the order sent', () => {
    expect(publish.hosts.map((h) => h.state)).toEqual(['error', 'installed', 'conflict', 'pending'])
    expect(publishStragglers(publish.hosts).map((h) => h.host)).toEqual(['au1', 'eu2', 'us2'])
  })

  it('is empty once every host has installed it', () => {
    expect(publishStragglers(publish.hosts.map((h) => ({ ...h, state: 'installed' as const })))).toEqual([])
  })
})

describe('forceAvailability', () => {
  it('waits until force_available_at, then opens', () => {
    expect(forceAvailability(publish, opensAt - 60_000)).toEqual({ kind: 'waiting', opensAt: publish.force_available_at, msLeft: 60_000 })
    expect(forceAvailability(publish, opensAt - 1)).toMatchObject({ kind: 'waiting', msLeft: 1 })
    expect(forceAvailability(publish, opensAt)).toEqual({ kind: 'available' })
    expect(forceAvailability(publish, opensAt + 3_600_000)).toEqual({ kind: 'available' })
  })

  it('waits without a time while the server has not set one', () => {
    expect(forceAvailability(withState('distributing', { force_available_at: null }), opensAt)).toEqual({ kind: 'waiting', opensAt: null, msLeft: null })
  })

  it.each(PUBLISH_STATES.filter((s) => s !== 'distributing'))('is closed while the publish is %s', (state) => {
    expect(forceAvailability(withState(state), opensAt + 60_000)).toEqual({ kind: 'closed' })
  })

  it('is closed when no host is left to force past', () => {
    const allInstalled = publish.hosts.map((h) => ({ ...h, state: 'installed' as const }))
    expect(forceAvailability(withState('distributing', { hosts: allInstalled }), opensAt + 60_000)).toEqual({ kind: 'closed' })
  })
})

describe('forceConfirmation', () => {
  it('names the stragglers and sends exactly those names', () => {
    const confirmation = forceConfirmation(publish)

    expect(confirmation.publishId).toBe(3)
    expect(confirmation.hosts.map((h) => h.host)).toEqual(['au1', 'eu2', 'us2'])
    expect(confirmation.payload).toEqual({ confirm_hosts: ['au1', 'eu2', 'us2'] })
  })

  it('follows the hosts of the publish it is given', () => {
    const fewer = publish.hosts.map((h) => (h.host === 'us2' ? { ...h, state: 'installed' as const } : h))
    expect(forceConfirmation(withState('distributing', { hosts: fewer })).payload).toEqual({ confirm_hosts: ['au1', 'eu2'] })
  })
})

describe('polling', () => {
  it.each(['active', 'failed'] as const)('stops once the publish is %s', (state) => {
    expect(isPublishSettled(state)).toBe(true)
    expect(shouldPollPublish(withState(state))).toBe(false)
  })

  it.each(PUBLISH_STATES.filter((s) => s !== 'active' && s !== 'failed'))('keeps polling while the publish is %s', (state) => {
    expect(isPublishSettled(state)).toBe(false)
    expect(shouldPollPublish(withState(state))).toBe(true)
  })

  it('keeps polling a publish it has not read yet', () => {
    expect(shouldPollPublish(null)).toBe(true)
  })

  it('stops polling a publish that no longer exists', () => {
    expect(shouldPollPublish(null, true)).toBe(false)
    expect(shouldPollPublish(withState('distributing'), true)).toBe(false)
  })
})

describe('forceActivateFailure', () => {
  it('asks again when the stragglers changed', () => {
    const failure = forceActivateFailure(apiError('errorStragglersChanged'))
    expect(failure.askAgain).toBe(true)
    expect(failure.message).toMatch(/changed/)
  })

  it.each(['errorTooEarly', 'errorNotDistributing'] as const)('gives %s a plain message without asking again', (name) => {
    const failure = forceActivateFailure(apiError(name))
    expect(failure.askAgain).toBe(false)
    expect(failure.message).not.toMatch(/_/)
    expect(failure.message).not.toBe('fallback')
  })

  it('gives each force error its own message', () => {
    const messages = (['errorTooEarly', 'errorStragglersChanged', 'errorNotDistributing'] as const)
      .map((name) => forceActivateFailure(apiError(name)).message)
    expect(new Set(messages).size).toBe(3)
  })

  it('passes anything else through without asking again', () => {
    expect(forceActivateFailure(new Error('Offline'))).toEqual({ message: 'Offline', askAgain: false })
  })
})

describe('publishErrorMessage', () => {
  it('says a missing publish is gone, not a draft', () => {
    expect(publishErrorMessage(new ApiError(404, 'Not found', 'fallback'))).toBe('This publish no longer exists.')
  })

  it('falls back to the map upload messages', () => {
    expect(publishErrorMessage(apiError('errorNotDistributing'))).toMatch(/no longer waiting on hosts/)
    expect(publishErrorMessage(new Error('Offline'))).toBe('Offline')
  })
})

describe('publishSteps', () => {
  it('marks the steps before the current state done and the rest to do', () => {
    expect(publishSteps('compressing')?.map((step) => step.status)).toEqual(['done', 'done', 'current', 'todo', 'todo', 'todo'])
  })

  it('marks every step done once the map is live', () => {
    expect(publishSteps('active')?.every((step) => step.status === 'done')).toBe(true)
  })

  it('has no steps for a failed publish, which does not say where it stopped', () => {
    expect(publishSteps('failed')).toBeNull()
  })

  it('covers every state but failed, in order', () => {
    expect(publishSteps('validating')?.map((step) => step.state)).toEqual(PUBLISH_STATES.filter((state) => state !== 'failed'))
  })
})

describe('hostProgress', () => {
  it('counts the installed hosts', () => {
    const hosts = mapUploadFixture('publish').hosts
    expect(hostProgress(hosts)).toEqual({ installed: hosts.filter((h) => h.state === 'installed').length, total: hosts.length })
  })
})
