import { useEffect, useRef } from 'react'
import { Spinner } from '@/app/components/ui/spinner'
import { useDeviceEnvironment } from '@/app/device/useDeviceEnvironment'
import { usePrefersReducedMotion } from '@/app/hooks/usePrefersReducedMotion'
import { cn } from '@/lib/utils'
import type { TileOverlay as TileOverlayModel } from '../model/overlayModel'
import type { StageView } from '../model/phoneStage'
import type { TileSlot, VideoSlot } from '../model/raceModel'
import type { SetEdit } from '../model/setEdits'
import type { SlotRect, StageLayout } from '../model/stageLayout'
import type { PlaybackController } from '../playback/playbackController'
import { createVideoMedia } from '../playback/videoMedia'
import { DeltaChips } from './DeltaChips'
import { TileOverlay } from './TileOverlay'
import type { AttachMedia } from './useRacePlayback'
import { useOverlayIdle } from './useOverlayIdle'
import { useSwipe } from './useSwipe'
import { usePlaybackSelector } from './usePlaybackSelector'

export interface StageAudio {
    audible: string | null
    volume: number
    onAudio: (capId: string) => void
    onVolume: (volume: number) => void
}

export interface StageFocus {
    focused: string | null
    onFocus: (capId: string) => void
}

export interface StageOverlays {
    overlays: ReadonlyMap<string, TileOverlayModel>
    audio: StageAudio
    onEdit: (edit: SetEdit) => void
}

interface TileProps<S extends TileSlot> {
    slot: S
    rect: SlotRect | null
    frozen: boolean
    attachMedia: AttachMedia
    onVideoFailed: (capId: string) => void
    controller: PlaybackController | null
    overlay: TileOverlayModel | undefined
    overlaysShown: boolean
    tileOverlays: StageOverlays
    focus: StageFocus
    touch: boolean
    focusable: boolean
    others: readonly TileOverlayModel[]
}

function VideoTile({ slot, rect, frozen, attachMedia, onVideoFailed, controller, overlay, overlaysShown, tileOverlays, focus, touch, focusable, others }: TileProps<VideoSlot>) {
    const videoRef = useRef<HTMLVideoElement>(null)
    const wakingTap = useRef(false)
    const focused = focus.focused === slot.id
    const { run } = slot
    const { audio, onEdit } = tileOverlays
    const audible = audio.audible === slot.id
    const streaming = rect !== null

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

    useEffect(() => {
        if (!streaming) videoRef.current?.load()
    }, [streaming])

    return (
        <div
            role="group"
            aria-label={run.alias?.trim() || run.user}
            className={cn('run-compare-tile bg-black', frozen && 'is-frozen', focused && 'is-focused', slot.highlighted && 'is-highlighted')}
            hidden={!rect}
            style={rect ? { left: rect.x, top: rect.y, width: rect.width, height: rect.height } : undefined}
        >
            {slot.src ? (
                <video
                    key={slot.src}
                    ref={videoRef}
                    src={streaming ? slot.src : undefined}
                    muted
                    playsInline
                    preload="auto"
                    onError={() => onVideoFailed(slot.id)}
                />
            ) : (
                <div className="run-compare-tile-wait text-muted-foreground"><Spinner className="size-6" /></div>
            )}
            {focusable && <button
                type="button"
                aria-label="Focus"
                aria-pressed={focused}
                className="run-compare-tile-focus"
                onPointerDown={() => { wakingTap.current = touch && !overlaysShown }}
                onClick={() => {
                    if (wakingTap.current) wakingTap.current = false
                    else focus.onFocus(slot.id)
                }}
            />}
            {overlay && (
                <TileOverlay
                    overlay={overlay}
                    controller={controller}
                    shown={overlaysShown}
                    audio={{ ...audio, audible }}
                    onEdit={onEdit}
                />
            )}
            <DeltaChips overlays={others} controller={controller} />
            {frozen && <p className="run-compare-result font-mono tabular-nums">{slot.result}</p>}
        </div>
    )
}

function frozenKey(frozen: readonly string[]): string {
    return frozen.join(',')
}

interface RaceStageProps {
    layout: StageLayout<TileSlot>
    tiles: readonly TileSlot[]
    view: StageView
    onSwipe: (step: 1 | -1) => void
    controller: PlaybackController | null
    stageRef: (element: HTMLElement | null) => void
    attachMedia: AttachMedia
    onVideoFailed: (capId: string) => void
    tileOverlays: StageOverlays
    focus: StageFocus
}

export function RaceStage({ layout, tiles, view, onSwipe, controller, stageRef, attachMedia, onVideoFailed, tileOverlays, focus }: RaceStageProps) {
    const frozen = new Set(usePlaybackSelector(controller, state => frozenKey(state.frozen)).split(','))
    const shown = useOverlayIdle(controller)
    const still = usePrefersReducedMotion()
    const touch = useDeviceEnvironment(environment => environment.touch)
    const swipe = useSwipe(direction => {
        if (direction === 'left') onSwipe(1)
        if (direction === 'right') onSwipe(-1)
    })
    const rects = new Map(layout.placed.map(({ slot, rect }) => [slot.id, rect]))
    const others = view.switcher ? tiles.flatMap(slot => (rects.has(slot.id) ? [] : tileOverlays.overlays.get(slot.id) ?? [])) : []

    return (
        <section
            ref={stageRef}
            aria-label="Stage"
            className={cn('run-compare-stage', still && 'is-still', view.switcher && 'is-swipeable')}
            {...(view.switcher ? swipe : {})}
        >
            {tiles.map(slot => (
                <VideoTile
                    key={slot.id}
                    slot={slot}
                    rect={rects.get(slot.id) ?? null}
                    frozen={frozen.has(slot.id)}
                    attachMedia={attachMedia}
                    onVideoFailed={onVideoFailed}
                    controller={controller}
                    overlay={tileOverlays.overlays.get(slot.id)}
                    overlaysShown={shown}
                    tileOverlays={tileOverlays}
                    focus={focus}
                    touch={touch}
                    focusable={view.mode === 'grid'}
                    others={slot.id === view.pov ? others : []}
                />
            ))}
        </section>
    )
}
