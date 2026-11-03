import { useEffect, useRef } from 'react'
import { Spinner } from '@/app/components/ui/spinner'
import { usePrefersReducedMotion } from '@/app/hooks/usePrefersReducedMotion'
import { cn } from '@/lib/utils'
import type { TileOverlay as TileOverlayModel } from '../model/overlayModel'
import type { TileSlot, VideoSlot } from '../model/raceModel'
import type { SetEdit } from '../model/setEdits'
import type { SlotRect, StageLayout } from '../model/stageLayout'
import type { PlaybackController } from '../playback/playbackController'
import { createVideoMedia } from '../playback/videoMedia'
import { TileOverlay } from './TileOverlay'
import type { AttachMedia } from './useRacePlayback'
import { useOverlayIdle } from './useOverlayIdle'
import { usePlaybackSelector } from './usePlaybackSelector'

export interface StageAudio {
    audible: string | null
    volume: number
    onAudio: (capId: string) => void
    onVolume: (volume: number) => void
}

export interface StageOverlays {
    overlays: ReadonlyMap<string, TileOverlayModel>
    audio: StageAudio
    onEdit: (edit: SetEdit) => void
}

interface TileProps<S extends TileSlot> {
    slot: S
    rect: SlotRect
    frozen: boolean
    attachMedia: AttachMedia
    onVideoFailed: (capId: string) => void
    controller: PlaybackController | null
    overlay: TileOverlayModel | undefined
    overlaysShown: boolean
    tileOverlays: StageOverlays
}

function VideoTile({ slot, rect, frozen, attachMedia, onVideoFailed, controller, overlay, overlaysShown, tileOverlays }: TileProps<VideoSlot>) {
    const videoRef = useRef<HTMLVideoElement>(null)
    const { run } = slot
    const { audio, onEdit } = tileOverlays
    const audible = audio.audible === slot.id

    useEffect(() => {
        const video = videoRef.current
        if (!video) return
        attachMedia(slot.id, createVideoMedia(video))
        return () => attachMedia(slot.id, null)
    }, [slot.id, slot.src, attachMedia])

    useEffect(() => {
        const video = videoRef.current
        if (!video) return
        video.volume = audio.volume
        createVideoMedia(video).setMuted(!audible)
    }, [slot.src, audible, audio.volume])

    return (
        <div
            role="group"
            aria-label={run.alias?.trim() || run.user}
            className={cn('run-compare-tile bg-black', frozen && 'is-frozen')}
            style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
        >
            {slot.src ? (
                <video
                    key={slot.src}
                    ref={videoRef}
                    src={slot.src}
                    muted
                    playsInline
                    preload="auto"
                    onError={() => onVideoFailed(slot.id)}
                />
            ) : (
                <div className="run-compare-tile-wait text-muted-foreground"><Spinner className="size-6" /></div>
            )}
            {overlay && (
                <TileOverlay
                    overlay={overlay}
                    controller={controller}
                    shown={overlaysShown}
                    audio={{ ...audio, audible }}
                    onEdit={onEdit}
                />
            )}
            {frozen && <p className="run-compare-result font-mono tabular-nums">{slot.result}</p>}
        </div>
    )
}

function frozenKey(frozen: readonly string[]): string {
    return frozen.join(',')
}

interface RaceStageProps {
    layout: StageLayout<TileSlot>
    controller: PlaybackController | null
    stageRef: (element: HTMLElement | null) => void
    attachMedia: AttachMedia
    onVideoFailed: (capId: string) => void
    tileOverlays: StageOverlays
}

export function RaceStage({ layout, controller, stageRef, attachMedia, onVideoFailed, tileOverlays }: RaceStageProps) {
    const frozen = new Set(usePlaybackSelector(controller, state => frozenKey(state.frozen)).split(','))
    const shown = useOverlayIdle(controller)
    const still = usePrefersReducedMotion()

    return (
        <section ref={stageRef} aria-label="Stage" className={cn('run-compare-stage', still && 'is-still')}>
            {layout.placed.map(({ slot, rect }) => (
                <VideoTile
                    key={slot.id}
                    slot={slot}
                    rect={rect}
                    frozen={frozen.has(slot.id)}
                    attachMedia={attachMedia}
                    onVideoFailed={onVideoFailed}
                    controller={controller}
                    overlay={tileOverlays.overlays.get(slot.id)}
                    overlaysShown={shown}
                    tileOverlays={tileOverlays}
                />
            ))}
        </section>
    )
}
