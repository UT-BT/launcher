import { describe, expect, it } from 'vitest'
import { MAX_MAP_VIDEO_BYTES, checkMapVideoFile } from './mapVideoFile'

const MB = 1024 * 1024

describe('checkMapVideoFile', () => {
  it('accepts a WebM up to 150 MB', () => {
    expect(MAX_MAP_VIDEO_BYTES).toBe(150 * MB)
    expect(checkMapVideoFile({ name: 'fly.webm', type: 'video/webm', size: 40 * MB })).toBeNull()
    expect(checkMapVideoFile({ name: 'fly.webm', type: 'video/webm', size: MAX_MAP_VIDEO_BYTES })).toBeNull()
  })

  it('accepts a .webm whose type the system does not know', () => {
    expect(checkMapVideoFile({ name: 'FLY.WEBM', type: '', size: MB })).toBeNull()
  })

  it('refuses anything that is not WebM', () => {
    expect(checkMapVideoFile({ name: 'fly.mp4', type: 'video/mp4', size: MB })).toMatch(/WebM/)
    expect(checkMapVideoFile({ name: 'fly.mkv', type: 'video/x-matroska', size: MB })).toMatch(/WebM/)
  })

  it('refuses a file over 150 MB and says how big it is', () => {
    const message = checkMapVideoFile({ name: 'fly.webm', type: 'video/webm', size: MAX_MAP_VIDEO_BYTES + 1 })
    expect(message).toMatch(/150 MB/)
    expect(checkMapVideoFile({ name: 'fly.webm', type: 'video/webm', size: 400 * MB })).toContain('400 MB')
  })

  it('refuses an empty file', () => {
    expect(checkMapVideoFile({ name: 'fly.webm', type: 'video/webm', size: 0 })).toMatch(/empty/)
  })
})
