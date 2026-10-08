import { describe, expect, it } from 'vitest'
import {
  ACTIVATION_KINDS, DRIFT_LOCATION_STATES, PUBLISH_HOST_STATES, PUBLISH_STATES, VERSION_MODES,
} from '@/app/utils/mapUploadTypes'
import { ACTIVATION_LABEL, DRIFT_STATE_LABEL, HOST_STATE_LABEL, PUBLISH_STATE_LABEL, VERSION_MODE_LABEL } from './publishLabels'

describe('publish labels', () => {
  it('names every publish state, host state, activation, version mode and drift state in words', () => {
    const labels = [
      ...PUBLISH_STATES.map((s) => PUBLISH_STATE_LABEL[s].label),
      ...PUBLISH_HOST_STATES.map((s) => HOST_STATE_LABEL[s].label),
      ...ACTIVATION_KINDS.map((k) => ACTIVATION_LABEL[k]),
      ...VERSION_MODES.map((m) => VERSION_MODE_LABEL[m]),
      ...DRIFT_LOCATION_STATES.map((s) => DRIFT_STATE_LABEL[s].label),
    ]
    for (const label of labels) {
      expect(label.trim()).not.toBe('')
      expect(label).not.toMatch(/[_-]/)
    }
  })

  it('makes conflicts and errors stand out in red', () => {
    expect(HOST_STATE_LABEL.conflict.tone).toBe('red')
    expect(HOST_STATE_LABEL.error.tone).toBe('red')
    expect(DRIFT_STATE_LABEL.conflict.tone).toBe('red')
    expect(DRIFT_STATE_LABEL.error.tone).toBe('red')
    expect(PUBLISH_STATE_LABEL.failed.tone).toBe('red')
  })
})
