import { describe, expect, it, vi } from 'vitest'
import {
    UT99_DOWNLOAD_CANCELLED,
    isUt99DownloadCancelled,
    runUt99Install,
    type Ut99InstallPort,
    type Ut99InstallerView,
} from './ut99Install'

const IPC_CANCELLED = new Error(`Error invoking remote method 'downloadUt99Iso': AbortError: ${UT99_DOWNLOAD_CANCELLED}`)

function fakeInstaller() {
    let rejectDownload: (error: Error) => void = () => undefined
    let resolveDownload: () => void = () => undefined
    const port: Ut99InstallPort = {
        downloadUt99Iso: vi.fn(() => new Promise<void>((resolve, reject) => {
            resolveDownload = resolve
            rejectDownload = reject
        })),
        mountAndRunUt99Iso: vi.fn(async () => undefined),
    }
    const views: Ut99InstallerView[] = []
    return {
        port,
        views,
        onView: (view: Ut99InstallerView) => views.push(view),
        cancel: () => rejectDownload(IPC_CANCELLED),
        fail: (message: string) => rejectDownload(new Error(message)),
        finish: () => resolveDownload(),
    }
}

describe('isUt99DownloadCancelled', () => {
    it('recognises the abort error after it crossed IPC', () => {
        expect(isUt99DownloadCancelled(IPC_CANCELLED)).toBe(true)
    })

    it('does not treat other failures as a cancel', () => {
        expect(isUt99DownloadCancelled(new Error('Download corrupt: Hash mismatch'))).toBe(false)
        expect(isUt99DownloadCancelled(undefined)).toBe(false)
    })
})

describe('runUt99Install', () => {
    it('cancelling the download returns the UI to idle with the cancelled status and never mounts', async () => {
        const installer = fakeInstaller()
        const run = runUt99Install(installer.port, installer.onView)
        expect(installer.views.at(-1)).toEqual({ step: 'downloading', status: 'Checking existing files...' })

        installer.cancel()
        await run

        expect(installer.views.at(-1)).toEqual({ step: 'idle', status: 'Cancelled' })
        expect(installer.port.mountAndRunUt99Iso).not.toHaveBeenCalled()
    })

    it('a finished download mounts the ISO and ends idle with the browse hint', async () => {
        const installer = fakeInstaller()
        const run = runUt99Install(installer.port, installer.onView)

        installer.finish()
        await run

        expect(installer.views.map(view => view.step)).toEqual(['downloading', 'installing', 'idle'])
        expect(installer.views.at(-1)?.status).toBe('Installation complete. Please select the installation directory below.')
        expect(installer.port.mountAndRunUt99Iso).toHaveBeenCalledTimes(1)
    })

    it('a failed download ends idle with the error', async () => {
        const installer = fakeInstaller()
        const run = runUt99Install(installer.port, installer.onView)

        installer.fail('Download corrupt: Hash mismatch')
        await run

        expect(installer.views.at(-1)).toEqual({ step: 'idle', status: 'Error: Download corrupt: Hash mismatch' })
        expect(installer.port.mountAndRunUt99Iso).not.toHaveBeenCalled()
    })

    it('a failed installer ends idle with the error', async () => {
        const installer = fakeInstaller()
        vi.mocked(installer.port.mountAndRunUt99Iso).mockRejectedValueOnce(new Error('Setup failed'))
        const run = runUt99Install(installer.port, installer.onView)

        installer.finish()
        await run

        expect(installer.views.at(-1)).toEqual({ step: 'idle', status: 'Error: Setup failed' })
    })
})
