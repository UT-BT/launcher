import { useState } from 'react'
import { downloadMapZip } from '@/app/utils/api'

export type MapDownloadState =
    | { status: 'downloading'; mapName: string }
    | { status: 'success'; mapName: string; installPath: string; extracted: string[]; skipped: string[] }
    | { status: 'error'; mapName: string; reason: string }

export function useMapDownload() {
    const [download, setDownload] = useState<MapDownloadState | null>(null)

    const start = async (mapName: string) => {
        setDownload({ status: 'downloading', mapName })
        let buffer: ArrayBuffer
        try {
            buffer = await downloadMapZip(mapName)
        } catch (err) {
            const reason = err instanceof Error && err.name === 'AbortError'
                ? 'timeout'
                : err instanceof Error && err.message.startsWith('http-')
                    ? err.message
                    : 'fetch-error'
            console.error('Map download failed:', err)
            setDownload({ status: 'error', mapName, reason })
            return
        }

        try {
            const bytes = new Uint8Array(buffer)
            const res = await window.conveyor.maps.extractToInstall(mapName, bytes)
            if (res.ok) {
                setDownload({
                    status: 'success',
                    mapName,
                    installPath: res.installPath,
                    extracted: res.extracted,
                    skipped: res.skipped,
                })
            } else {
                setDownload({ status: 'error', mapName, reason: res.reason })
            }
        } catch (err) {
            console.error('Map extraction failed:', err)
            setDownload({ status: 'error', mapName, reason: 'extract-error' })
        }
    }

    return {
        download,
        start,
        clear: () => setDownload(null),
    }
}
