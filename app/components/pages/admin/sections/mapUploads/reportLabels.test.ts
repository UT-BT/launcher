import { describe, expect, it } from 'vitest'
import { mapUploadFixture } from '@/app/utils/fixtures/mapUploadFixtures'
import { BLOCK_CODES, DRAFT_STATUSES, FILE_DISPOSITIONS, FILE_KINDS, WARNING_CODES } from '@/app/utils/mapUploadTypes'
import {
  BLOCK_TITLE, DISPOSITION_LABEL, DRAFT_STATUS_LABEL, FILE_KIND_LABEL, WARNING_TITLE, countLabel, fileReason,
} from './reportLabels'

describe('report labels', () => {
  it('names every status, disposition, kind, block and warning in words', () => {
    const labels = [
      ...DRAFT_STATUSES.map((s) => DRAFT_STATUS_LABEL[s].label),
      ...FILE_DISPOSITIONS.map((d) => DISPOSITION_LABEL[d].label),
      ...FILE_KINDS.map((k) => FILE_KIND_LABEL[k]),
      ...BLOCK_CODES.map((c) => BLOCK_TITLE[c]),
      ...WARNING_CODES.map((c) => WARNING_TITLE[c]),
    ]
    for (const label of labels) {
      expect(label.trim()).not.toBe('')
      expect(label).not.toMatch(/_/)
    }
  })
})

describe('fileReason', () => {
  const files = mapUploadFixture('draft').files

  it('uses the reason the report gives', () => {
    const readme = files.find((f) => f.file === 'readme.txt')
    expect(readme && fileReason(readme)).toBe('Not an Unreal package.')
  })

  it('explains an install that carries no reason', () => {
    const map = files.find((f) => f.file === 'CTF-BT-Foo.unr')
    expect(map && fileReason(map)).toBe('New to the servers, so it will be installed.')
  })
})

describe('countLabel', () => {
  it('pluralises', () => {
    expect(countLabel(1, 'block')).toBe('1 block')
    expect(countLabel(2, 'warning')).toBe('2 warnings')
    expect(countLabel(0, 'block')).toBe('0 blocks')
  })
})
