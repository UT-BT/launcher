import { useState } from 'react'
import { fetchReplayVideo } from '@/app/utils/api'
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
            const replayVideo = await fetchReplayVideo(capId)
            if (replayVideo) {
                setVideo({ video: replayVideo, mapName, time, alias })
            } else {
                setError('Replay video not available yet. Please try again later.')
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
