import { describe, expect, it } from 'vitest'
import { ApiError, MAP_ARCHIVE_MAX_BYTES } from '@/app/utils/api'
import { mapUploadErrorFixture } from '@/app/utils/fixtures/mapUploadFixtures'
import {
  UPLOAD_IDLE, archiveProblem, uploadOutcome, uploadPercent, uploadReducer,
  type UploadEvent, type UploadState,
} from './uploadState'

function run(events: UploadEvent[], from: UploadState = UPLOAD_IDLE): UploadState {
  return events.reduce(uploadReducer, from)
}

const start: UploadEvent = { type: 'start', fileName: 'foo.zip', size: 1000 }

describe('archiveProblem', () => {
  it.each(['foo.zip', 'FOO.RAR', 'pack.v2.7z'])('accepts %s', (name) => {
    expect(archiveProblem({ name, size: 10 })).toBeNull()
  })

  it.each(['foo.unr', 'foo.tar.gz', 'zip', 'foo.zip.exe'])('refuses %s', (name) => {
    expect(archiveProblem({ name, size: 10 })).toBe('Choose a .zip, .rar or .7z archive.')
  })

  it('accepts an archive at the 1 GB cap and refuses one byte more', () => {
    expect(archiveProblem({ name: 'big.zip', size: MAP_ARCHIVE_MAX_BYTES })).toBeNull()
    expect(archiveProblem({ name: 'big.zip', size: MAP_ARCHIVE_MAX_BYTES + 1 })).toMatch(/over the 1 GB limit/)
  })

  it('refuses an empty file', () => {
    expect(archiveProblem({ name: 'empty.zip', size: 0 })).toBe('This file is empty.')
  })
})

describe('uploadReducer', () => {
  it('starts uploading with the file size as the total', () => {
    expect(run([start])).toEqual({ phase: 'uploading', fileName: 'foo.zip', loaded: 0, total: 1000 })
  })

  it('follows progress and keeps the known total when the browser reports none', () => {
    expect(run([start, { type: 'progress', loaded: 400, total: 2000 }])).toMatchObject({ loaded: 400, total: 2000 })
    expect(run([start, { type: 'progress', loaded: 300, total: 0 }])).toMatchObject({ loaded: 300, total: 1000 })
  })

  it('finishes with the created draft ids', () => {
    expect(run([start, { type: 'succeeded', draftIds: [12, 13] }]))
      .toEqual({ phase: 'done', fileName: 'foo.zip', draftIds: [12, 13] })
  })

  it('fails with a plain message for the server error code', () => {
    const body = mapUploadErrorFixture('errorNoMap')
    const error = new ApiError(422, body.error, 'fallback', body.code)
    expect(run([start, { type: 'failed', error }]))
      .toEqual({ phase: 'error', fileName: 'foo.zip', message: 'This archive has no map in it. It needs at least one .unr file.' })
  })

  it('fails on a 413 with the size limit', () => {
    const state = run([start, { type: 'failed', error: new ApiError(413, undefined, 'Request failed (413)') }])
    expect(state).toMatchObject({ phase: 'error', message: 'This archive is over the 1 GB upload limit.' })
  })

  it('records a file refused before sending', () => {
    expect(run([{ type: 'rejected', fileName: 'notes.txt', message: 'Choose a .zip, .rar or .7z archive.' }]))
      .toEqual({ phase: 'error', fileName: 'notes.txt', message: 'Choose a .zip, .rar or .7z archive.' })
  })

  it('goes back to idle on cancel and ignores the abort that follows', () => {
    const cancelled = run([start, { type: 'progress', loaded: 10, total: 1000 }, { type: 'cancel' }])
    expect(cancelled).toEqual(UPLOAD_IDLE)
    const abort = new DOMException('The upload was cancelled.', 'AbortError')
    expect(run([{ type: 'failed', error: abort }], cancelled)).toEqual(UPLOAD_IDLE)
  })

  it('treats an abort while uploading as a cancel', () => {
    const abort = new DOMException('The upload was cancelled.', 'AbortError')
    expect(run([start, { type: 'failed', error: abort }])).toEqual(UPLOAD_IDLE)
  })

  it('ignores progress and results when no upload is running', () => {
    expect(run([{ type: 'progress', loaded: 5, total: 10 }])).toEqual(UPLOAD_IDLE)
    expect(run([{ type: 'succeeded', draftIds: [1] }])).toEqual(UPLOAD_IDLE)
    expect(run([{ type: 'cancel' }])).toEqual(UPLOAD_IDLE)
  })

  it('does not start or reset over a running upload', () => {
    const uploading = run([start, { type: 'progress', loaded: 10, total: 1000 }])
    expect(run([{ type: 'start', fileName: 'other.zip', size: 5 }], uploading)).toBe(uploading)
    expect(run([{ type: 'rejected', fileName: 'x.txt', message: 'no' }], uploading)).toBe(uploading)
    expect(run([{ type: 'reset' }], uploading)).toBe(uploading)
  })

  it('starts again after an error or a finished upload', () => {
    const failed = run([{ type: 'rejected', fileName: 'x.txt', message: 'no' }])
    expect(run([start], failed).phase).toBe('uploading')
    const done = run([start, { type: 'succeeded', draftIds: [1] }])
    expect(run([{ type: 'reset' }], done)).toEqual(UPLOAD_IDLE)
  })
})

describe('uploadPercent', () => {
  it('rounds down and caps at 100', () => {
    expect(uploadPercent(run([start, { type: 'progress', loaded: 999, total: 1000 }]))).toBe(99)
    expect(uploadPercent(run([start, { type: 'progress', loaded: 1200, total: 1000 }]))).toBe(100)
  })

  it('is 0 before any progress, 100 when done and 0 when idle', () => {
    expect(uploadPercent(run([start]))).toBe(0)
    expect(uploadPercent(run([start, { type: 'progress', loaded: 0, total: 0 }], { phase: 'uploading', fileName: 'a.zip', loaded: 0, total: 0 }))).toBe(0)
    expect(uploadPercent(run([start, { type: 'succeeded', draftIds: [1] }]))).toBe(100)
    expect(uploadPercent(UPLOAD_IDLE)).toBe(0)
  })
})

describe('uploadOutcome', () => {
  it('opens a single draft', () => {
    expect(uploadOutcome([12])).toEqual({ kind: 'open', draftId: 12 })
  })

  it('lists the drafts of a map pack', () => {
    expect(uploadOutcome([12, 13])).toEqual({ kind: 'list', draftIds: [12, 13] })
  })
})
