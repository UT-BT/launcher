import { describe, expect, it } from 'vitest'
import { mapUploadFixture } from '@/app/utils/fixtures/mapUploadFixtures'
import { filterDriftRows, formatSize, shortSha } from './driftView'

const rows = mapUploadFixture('drift')

describe('filterDriftRows', () => {
  it('keeps every row for an empty or blank filter', () => {
    expect(filterDriftRows(rows, '')).toEqual(rows)
    expect(filterDriftRows(rows, '   ')).toEqual(rows)
  })

  it('matches part of the file name, ignoring case and surrounding spaces', () => {
    expect(filterDriftRows(rows, ' footex ').map((r) => r.file)).toEqual(['FooTex.utx'])
    expect(filterDriftRows(rows, 'TEX.UTX').map((r) => r.file)).toEqual(['FooTex.utx', 'OldTex.utx'])
  })

  it('matches the file name only, not a location', () => {
    expect(filterDriftRows(rows, 'eu2')).toEqual([])
  })
})

describe('shortSha', () => {
  it('keeps the first 12 characters', () => {
    expect(shortSha('81f4a4bbbcd0c586b2000cda86105d6fa992bd4df812138f903c88a526fa10f3')).toBe('81f4a4bbbcd0')
  })
})

describe('formatSize', () => {
  it('reads bytes, KB and MB', () => {
    expect(formatSize(10)).toBe('10 B')
    expect(formatSize(2048)).toBe('2.0 KB')
    expect(formatSize(5 * 1024 * 1024 + 1)).toBe('5.0 MB')
  })
})
