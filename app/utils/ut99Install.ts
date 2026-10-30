export const UT99_DOWNLOAD_CANCELLED = 'UT99 download cancelled'

export function ut99DownloadCancelledError(): Error {
    const error = new Error(UT99_DOWNLOAD_CANCELLED)
    error.name = 'AbortError'
    return error
}

export function isUt99DownloadCancelled(error: unknown): boolean {
    return error instanceof Error && error.message.includes(UT99_DOWNLOAD_CANCELLED)
}

export interface Ut99InstallPort {
    downloadUt99Iso: () => Promise<void>
    mountAndRunUt99Iso: () => Promise<void>
}

export interface Ut99InstallerView {
    step: 'idle' | 'downloading' | 'installing'
    status: string
}

function errorMessage(error: unknown): string {
    return error instanceof Error && error.message ? error.message : 'Unknown error'
}

export async function runUt99Install(port: Ut99InstallPort, onView: (view: Ut99InstallerView) => void): Promise<void> {
    onView({ step: 'downloading', status: 'Checking existing files...' })
    try {
        await port.downloadUt99Iso()
    } catch (error) {
        onView({ step: 'idle', status: isUt99DownloadCancelled(error) ? 'Cancelled' : `Error: ${errorMessage(error)}` })
        return
    }

    onView({ step: 'installing', status: 'Mounting ISO and starting installer...' })
    try {
        await port.mountAndRunUt99Iso()
    } catch (error) {
        onView({ step: 'idle', status: `Error: ${errorMessage(error)}` })
        return
    }

    onView({ step: 'idle', status: 'Installation complete. Please select the installation directory below.' })
}
