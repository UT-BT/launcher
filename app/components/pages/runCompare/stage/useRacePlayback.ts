import { useCallback, useEffect, useRef, useState } from 'react'
import type { RaceRun } from '../model/raceModel'
import { createPlaybackController, type PlaybackController } from '../playback/playbackController'
import type { PlaybackMedia } from '../playback/playbackMedia'
import { browserTimeSource } from '../playback/videoMedia'

export type AttachMedia = (capId: string, media: PlaybackMedia | null) => void

export interface RacePlayback {
    controller: PlaybackController | null
    attachMedia: AttachMedia
}

export function useRacePlayback(runs: readonly RaceRun[], seed: number | null): RacePlayback {
    const [controller, setController] = useState<PlaybackController | null>(null)
    const [media, setMedia] = useState<ReadonlyMap<string, PlaybackMedia>>(() => new Map())
    const seeded = useRef(false)

    useEffect(() => {
        const created = createPlaybackController({ time: browserTimeSource })
        setController(created)
        return () => created.dispose()
    }, [])

    useEffect(() => {
        if (!controller || runs.length === 0) return
        controller.setRuns(runs.map(({ run, cap, offset, fps, tile, hidden, group }) => ({
            id: run.capId,
            group,
            cap,
            offset,
            fps,
            media: tile ? media.get(run.capId) ?? null : null,
            hidden,
        })))
        if (seeded.current) return
        seeded.current = true
        if (seed !== null) controller.seek(seed)
    }, [controller, runs, media, seed])

    const attachMedia = useCallback<AttachMedia>((capId, next) => {
        setMedia(previous => {
            const updated = new Map(previous)
            if (next) updated.set(capId, next)
            else updated.delete(capId)
            return updated
        })
    }, [])

    return { controller, attachMedia }
}
