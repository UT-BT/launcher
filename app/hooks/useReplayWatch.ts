import { useState } from 'react'
import { fetchDemoStatus, getFirstPersonVideoUrl } from '@/app/utils/api'
import type { ReplayVideoState } from '@/app/components/shared/ReplayVideoModal'

interface OpenArgs {
    capId: string
    mapName: string
    time?: number
    alias?: string
}

export function useReplayWatch() {
    const [video, setVideo] = useState<ReplayVideoState | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [loadingCapId, setLoadingCapId] = useState<string | null>(null)

    const openReplay = async ({ capId, mapName, time, alias }: OpenArgs) => {
        if (!capId) return
        setLoadingCapId(capId)
        try {
            const status = await fetchDemoStatus(capId)
            const url = getFirstPersonVideoUrl(status)
            if (url) {
                setVideo({ url, mapName, time, alias })
            } else {
                setError('Demo is still being processed by DemoConverter. Please try again later.')
            }
        } catch {
            setError('Could not load this replay. Please try again later.')
        } finally {
            setLoadingCapId(null)
        }
    }

    return {
        video,
        clearVideo: () => setVideo(null),
        error,
        clearError: () => setError(null),
        loadingCapId,
        openReplay,
    }
}
