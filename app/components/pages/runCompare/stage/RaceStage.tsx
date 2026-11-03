import { useEffect, useRef } from 'react'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { Spinner } from '@/app/components/ui/spinner'
import { cn } from '@/lib/utils'
import type { TileSlot, VideoSlot } from '../model/raceModel'
import type { SlotRect, StageLayout } from '../model/stageLayout'
import type { PlaybackController } from '../playback/playbackController'
import { createVideoMedia } from '../playback/videoMedia'
import type { AttachMedia } from './useRacePlayback'
import { usePlaybackSelector } from './usePlaybackSelector'

interface TileProps<S extends TileSlot> {
    slot: S
    rect: SlotRect
    frozen: boolean
    attachMedia: AttachMedia
    onVideoFailed: (capId: string) => void
}

function VideoTile({ slot, rect, frozen, attachMedia, onVideoFailed }: TileProps<VideoSlot>) {
    const videoRef = useRef<HTMLVideoElement>(null)
    const { run } = slot

    useEffect(() => {
        const video = videoRef.current
        if (!video) return
        attachMedia(slot.id, createVideoMedia(video))
        return () => attachMedia(slot.id, null)
    }, [slot.id, slot.src, attachMedia])

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
            <div className="run-compare-tile-top run-compare-row">
                <PlayerInfo userId={run.user} alias={run.alias} title={run.title} size="sm" interactive={false} />
                {slot.badges.map(badge => <span key={badge} className="run-compare-badge">{badge}</span>)}
            </div>
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
}

export function RaceStage({ layout, controller, stageRef, attachMedia, onVideoFailed }: RaceStageProps) {
    const frozen = new Set(usePlaybackSelector(controller, state => frozenKey(state.frozen)).split(','))

    return (
        <section ref={stageRef} aria-label="Stage" className="run-compare-stage">
            {layout.placed.map(({ slot, rect }) => (
                <VideoTile
                    key={slot.id}
                    slot={slot}
                    rect={rect}
                    frozen={frozen.has(slot.id)}
                    attachMedia={attachMedia}
                    onVideoFailed={onVideoFailed}
                />
            ))}
        </section>
    )
}
