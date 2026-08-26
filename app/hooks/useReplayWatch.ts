import { useState } from 'react'
import { resolveReplayForCap } from '@/app/utils/api'
import { REPLAY_UNAVAILABLE_MESSAGE, replayErrorMessage } from '@/app/hooks/replayMessages'
import type { ReplayVideoState } from '@/app/components/shared/ReplayVideoModal'

interface OpenArgs {
    capId?: string | null
    loadingKey?: string
    mapName: string
    time?: number
    alias?: string
}

export function useReplayWatch() {
    const [video, setVideo] = useState<ReplayVideoState | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [loadingCapId, setLoadingCapId] = useState<string | null>(null)

    const openReplay = async ({ capId, loadingKey, mapName, time, alias }: OpenArgs) => {
        const key = loadingKey ?? capId
        if (!key) return
        if (!capId) {
            setError(REPLAY_UNAVAILABLE_MESSAGE)
            return
        }
        setLoadingCapId(key)
        try {
            const { state, url } = await resolveReplayForCap(capId)
            if (state === 'ready' && url) {
                setVideo({ url, mapName, time, alias })
            } else {
                setError(replayErrorMessage(state === 'ready' ? 'unavailable' : state))
            }
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
