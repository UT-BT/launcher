import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { runStartupUpdate, type StartupUpdateDeps } from './startup-update'

const never = () => new Promise<boolean>(() => {})

function makeDeps(overrides: Partial<StartupUpdateDeps> = {}): StartupUpdateDeps {
  return {
    check: () => Promise.resolve(true),
    download: () => Promise.resolve(true),
    install: vi.fn(),
    checkTimeoutMs: 5_000,
    downloadTimeoutMs: 120_000,
    ...overrides,
  }
}

describe('runStartupUpdate', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('downloads and installs an available update before launch', async () => {
    const deps = makeDeps()

    await expect(runStartupUpdate(deps)).resolves.toBe(true)

    expect(deps.install).toHaveBeenCalledOnce()
  })

  it('launches normally when no update is available', async () => {
    const download = vi.fn(() => Promise.resolve(true))
    const deps = makeDeps({ check: () => Promise.resolve(false), download })

    await expect(runStartupUpdate(deps)).resolves.toBe(false)

    expect(download).not.toHaveBeenCalled()
    expect(deps.install).not.toHaveBeenCalled()
  })

  it('launches normally when the check fails', async () => {
    const deps = makeDeps({ check: () => Promise.reject(new Error('offline')) })

    await expect(runStartupUpdate(deps)).resolves.toBe(false)

    expect(deps.install).not.toHaveBeenCalled()
  })

  it('stops waiting for a slow check and launches', async () => {
    const deps = makeDeps({ check: never })

    const result = runStartupUpdate(deps)
    await vi.advanceTimersByTimeAsync(5_000)

    await expect(result).resolves.toBe(false)
    expect(deps.install).not.toHaveBeenCalled()
  })

  it('launches normally when the download fails', async () => {
    const deps = makeDeps({ download: () => Promise.resolve(false) })

    await expect(runStartupUpdate(deps)).resolves.toBe(false)

    expect(deps.install).not.toHaveBeenCalled()
  })

  it('stops waiting for a slow download and launches', async () => {
    const deps = makeDeps({ download: never })

    const result = runStartupUpdate(deps)
    await vi.advanceTimersByTimeAsync(119_999)
    expect(deps.install).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)

    await expect(result).resolves.toBe(false)
    expect(deps.install).not.toHaveBeenCalled()
  })

  it('does not install when a download finishes after the wait ran out', async () => {
    let finishDownload: (value: boolean) => void = () => {}
    const deps = makeDeps({
      download: () => new Promise<boolean>((resolve) => { finishDownload = resolve }),
    })

    const result = runStartupUpdate(deps)
    await vi.advanceTimersByTimeAsync(120_000)
    await expect(result).resolves.toBe(false)

    finishDownload(true)
    await vi.runAllTimersAsync()

    expect(deps.install).not.toHaveBeenCalled()
  })
})
