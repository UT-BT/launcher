import { describe, expect, it } from 'vitest'
import { splashUpdateStatus } from './splashUpdateStatus'

describe('splashUpdateStatus', () => {
  it('shows nothing once the launch is no longer held', () => {
    expect(splashUpdateStatus({ holdingLaunch: false, phase: 'downloading', version: '1.29.0', progressPercent: 40 })).toBeNull()
  })

  it.each(['idle', 'checking', 'not-available', 'error'] as const)('reads as checking while held in the %s phase', phase => {
    expect(splashUpdateStatus({ holdingLaunch: true, phase })).toEqual({ kind: 'checking', label: 'Checking for updates' })
  })

  it('names the version and rounds the progress while downloading', () => {
    expect(splashUpdateStatus({ holdingLaunch: true, phase: 'downloading', version: '1.29.0', progressPercent: 41.6 })).toEqual({
      kind: 'downloading',
      label: 'Updating to v1.29.0',
      percent: 42,
    })
  })

  it('starts the bar at zero as soon as an update is found', () => {
    expect(splashUpdateStatus({ holdingLaunch: true, phase: 'available', version: '1.29.0' })).toEqual({
      kind: 'downloading',
      label: 'Updating to v1.29.0',
      percent: 0,
    })
  })

  it('keeps the percentage between 0 and 100', () => {
    expect(splashUpdateStatus({ holdingLaunch: true, phase: 'downloading', version: '1.29.0', progressPercent: 140 })).toMatchObject({ percent: 100 })
    expect(splashUpdateStatus({ holdingLaunch: true, phase: 'downloading', version: '1.29.0', progressPercent: -3 })).toMatchObject({ percent: 0 })
  })

  it('falls back to a generic label without a version', () => {
    expect(splashUpdateStatus({ holdingLaunch: true, phase: 'downloading' })).toMatchObject({ label: 'Updating UTBT' })
  })

  it.each(['downloaded', 'installing'] as const)('reads as restarting once the update is %s', phase => {
    expect(splashUpdateStatus({ holdingLaunch: true, phase, version: '1.29.0' })).toEqual({
      kind: 'restarting',
      label: 'Restarting to finish the update',
    })
  })
})
