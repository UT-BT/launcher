import { useCallback, useEffect, useRef, useState } from 'react'
import type { CamToolStatus } from '@/lib/conveyor/schemas/stream-kit-schema'
import { usePlatform } from '@/app/platform'
import { createPoller } from '@/app/utils/poller'
import type { Server } from '@/app/utils/server-utils'

const SERVER_POLL_MS = 30_000
const CAM_STATUS_POLL_MS = 3_000

export function useInstallPath() {
    const [installPath, setInstallPath] = useState<string | null | undefined>(undefined)

    const reload = useCallback(async () => {
        try {
            const path = await window.conveyor.app.getUt99InstallPath()
            setInstallPath(path?.trim() ? path : null)
        } catch {
            setInstallPath(null)
        }
    }, [])

    useEffect(() => {
        void reload()
        const stopWatching = window.utPatch?.onInstallationPathUpdated(() => void reload())
        window.addEventListener('focus', reload)
        return () => {
            stopWatching?.()
            window.removeEventListener('focus', reload)
        }
    }, [reload])

    return installPath
}

export function useServerList() {
    const { gateway } = usePlatform()
    const [servers, setServers] = useState<Server[] | null>(null)
    const [failed, setFailed] = useState(false)

    useEffect(() => {
        let active = true
        const poller = createPoller({
            poll: async () => {
                const list = await gateway.fetchServers()
                if (active) setServers(list)
            },
            intervalMs: () => SERVER_POLL_MS,
            onSettled: outcome => {
                if (active) setFailed(!outcome.ok)
            },
        })
        poller.start()
        return () => {
            active = false
            poller.stop()
        }
    }, [gateway])

    return { servers, failed }
}

export function useCamStatus() {
    const [status, setLatestStatus] = useState<CamToolStatus | null>(null)
    const version = useRef(0)
    const anyRunning = status?.cams.some(cam => cam.running) ?? false

    const setStatus = useCallback((next: CamToolStatus) => {
        version.current += 1
        setLatestStatus(next)
    }, [])

    const read = useCallback(async () => {
        const started = ++version.current
        try {
            const next = await window.conveyor.streamKit.getCamStatus()
            if (version.current === started) setLatestStatus(next)
        } catch {
            return
        }
    }, [])

    useEffect(() => {
        void read()
    }, [read])

    useEffect(() => {
        if (!anyRunning) return
        const poller = createPoller({ poll: read, intervalMs: () => CAM_STATUS_POLL_MS, pollOnStart: false })
        poller.start()
        return () => poller.stop()
    }, [anyRunning, read])

    return { status, setStatus, read }
}
