import { useState } from 'react'
import { downloadDemo, type LeaderboardEntry } from '@/app/utils/api'
import { formatCapTime } from '@/app/utils/format'
import { saveDemoFile } from '@/app/platform'
import { trackOutcome } from '@/app/utils/telemetry'

export type DemoDownloadState =
    | { status: 'downloading'; capId: string; filename: string }
    | { status: 'success'; capId: string; filename: string; path: string; bytes: number }
    | { status: 'error'; capId: string; filename: string; reason: string }

export function useDemoDownload() {
    const [download, setDownload] = useState<DemoDownloadState | null>(null)

    const start = async (entry: LeaderboardEntry, mapName: string, demoCapId?: string | null) => {
        const sourceCapId = demoCapId ?? entry.id
        const cleanMap = mapName.replace(/[^a-zA-Z0-9_-]/g, '_')
        const cleanAlias = (entry.alias || 'player').replace(/[^a-zA-Z0-9_-]/g, '_')
        const timeStr = formatCapTime(entry.cap_time_seconds).replace(/[:.]/g, '-')
        const filename = `${cleanMap}__${timeStr}__${cleanAlias}.dem`
        setDownload({ status: 'downloading', capId: entry.id, filename })
        trackOutcome('demo_download_started')
        try {
            const buffer = await downloadDemo(sourceCapId)
            const bytes = new Uint8Array(buffer)
            const res = await saveDemoFile(filename, bytes)
            if (res.ok) {
                setDownload({ status: 'success', capId: entry.id, filename, path: res.path, bytes: res.bytes })
                trackOutcome('demo_download_succeeded')
            } else {
                setDownload({ status: 'error', capId: entry.id, filename, reason: res.reason })
                trackOutcome('demo_download_failed')
            }
        } catch (err) {
            console.error('Demo download failed:', err)
            setDownload({ status: 'error', capId: entry.id, filename, reason: 'fetch-error' })
        }
    }

    return {
        download,
        start,
        clear: () => setDownload(null),
    }
}
