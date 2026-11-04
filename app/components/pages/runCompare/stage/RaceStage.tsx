import { useCallback, useEffect, useRef } from 'react'
import { TONE_TEXT } from '@/app/components/pages/capDetail/runDelta/deltaStyles'
import { Spinner } from '@/app/components/ui/spinner'
import { usePrefersReducedMotion } from '@/app/hooks/usePrefersReducedMotion'
import { cn } from '@/lib/utils'
import type { TileOverlay as TileOverlayModel } from '../model/overlayModel'
import type { StageView } from '../model/phoneStage'
import type { TileSlot, VideoSlot } from '../model/raceModel'
import type { SetEdit } from '../model/setEdits'
import type { SlotRect, StageLayout } from '../model/stageLayout'
import type { TeamRow } from '../model/teamModel'
import { sameTeamDelta, teamDeltaAt } from '../model/teamVersus'
import type { PlaybackController, PlaybackState } from '../playback/playbackController'
import { createVideoMedia } from '../playback/videoMedia'
import { DeltaChips } from './DeltaChips'
import { RunMenu } from './RunMenu'
import { TileFlash, TileTags } from './TileCaption'
import { BaselineTag, NoteTags } from './Tags'
import { TeamLabel } from './TeamLabel'
import type { AttachMedia } from './useRacePlayback'
import { useSwipe } from './useSwipe'
import { usePlaybackSelector } from './usePlaybackSelector'
import type { VideoTags } from './videoTags'

export interface StageAudio {
    audible: readonly string[]
    volume: number
    onAudio: (capId: string) => void
    onVolume: (volume: number) => void
}

export interface StageFocus {
    focused: string | null
    onFocus: (capId: string) => void
    onFocusRow?: (teamCapId: string) => void
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
    tags: VideoTags | null
    attachMedia: AttachMedia
    onVideoFailed: (capId: string) => void
    controller: PlaybackController | null
    overlay: TileOverlayModel | undefined
    tileOverlays: StageOverlays
    focus: StageFocus
    focusable: boolean
    others: readonly TileOverlayModel[]
}

function VideoTile({ slot, rect, frozen, tags, attachMedia, onVideoFailed, controller, overlay, tileOverlays, focus, focusable, others }: TileProps<VideoSlot>) {
    const videoRef = useRef<HTMLVideoElement>(null)
    const focused = focus.focused === slot.id
    const { run } = slot
    const { audio, onEdit } = tileOverlays
    const audible = audio.audible.includes(slot.id)
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
            className={cn('run-compare-tile', frozen && 'is-frozen', focused && 'is-focused', slot.highlighted && 'is-highlighted')}
            hidden={!rect}
            style={rect ? { left: rect.x, top: rect.y, width: rect.width, height: rect.height } : undefined}
        >
            <div className="run-compare-tile-video">
                {slot.src ? (
                    <video
                        key={slot.src}
                        ref={videoRef}
                        src={streaming ? slot.src : undefined}
                        muted
                        playsInline
                        disablePictureInPicture
                        preload="auto"
                        onError={() => onVideoFailed(slot.id)}
                    />
                ) : (
                    <div className="run-compare-tile-wait text-muted-foreground"><Spinner className="size-6" /></div>
                )}
                {focusable && (
                    <button
                        type="button"
                        aria-label="Focus"
                        aria-pressed={focused}
                        className="run-compare-tile-focus"
                        onClick={() => focus.onFocus(slot.id)}
                    />
                )}
                {overlay && <TileFlash overlay={overlay} controller={controller} />}
                <DeltaChips overlays={others} controller={controller} />
                {frozen && <p className="run-compare-result font-mono tabular-nums">{slot.result}</p>}
                {tags && overlay && (
                    <TileTags overlay={overlay} controller={controller} audio={{ audible, onAudio: audio.onAudio }} onEdit={onEdit} shown={tags} />
                )}
            </div>
        </div>
    )
}

function TeamDelta({ row, controller }: { row: TeamRow; controller: PlaybackController | null }) {
    const select = useCallback((state: PlaybackState) => teamDeltaAt(row, state), [row])
    const gap = usePlaybackSelector(controller, select, sameTeamDelta)
    if (!gap) return null
    return (
        <span className="run-compare-gap">
            <span className={cn('run-compare-gap-value font-mono tabular-nums', TONE_TEXT[gap.tone])}>{gap.label}</span>
            <span className="run-compare-gap-vs">team gap</span>
        </span>
    )
}

interface TeamRowHeaderProps {
    row: TeamRow
    rect: SlotRect
    band: boolean
    removable: boolean
    controller: PlaybackController | null
    onFocusRow: ((teamCapId: string) => void) | null
    onEdit: (edit: SetEdit) => void
}

function TeamRowHeader({ row, rect, band, removable, controller, onFocusRow, onEdit }: TeamRowHeaderProps) {
    const label = <TeamLabel row={row} withTitle={false} className="run-compare-team-names" />
    return (
        <div className={cn('run-compare-team-header', band && 'is-band')} style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}>
            <div className="run-compare-team-top">
                <span className="run-compare-team-swatch" style={{ background: row.colour }} />
                {onFocusRow
                    ? (
                        <button type="button" className="run-compare-team-focus" onClick={() => onFocusRow(row.teamCapId)}>
                            <span className="sr-only">Focus </span>
                            {label}
                        </button>
                    )
                    : label}
                <RunMenu
                    capId={row.teamCapId}
                    run={row.team.members[0]}
                    name={row.label}
                    baseline={{ pinned: row.pinned, reference: row.reference }}
                    video={null}
                    offset={null}
                    pairMenu={null}
                    driving={null}
                    removable={removable}
                    onEdit={onEdit}
                    className="run-compare-team-menu"
                />
            </div>
            <span className="run-compare-team-time font-mono tabular-nums">{row.time}</span>
            <div className="run-compare-team-gap">
                {row.reference ? <BaselineTag /> : <TeamDelta row={row} controller={controller} />}
                <NoteTags notes={row.badges} />
            </div>
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
    tags: VideoTags | null
    onSwipe: (step: 1 | -1) => void
    controller: PlaybackController | null
    stageRef: (element: HTMLElement | null) => void
    attachMedia: AttachMedia
    onVideoFailed: (capId: string) => void
    tileOverlays: StageOverlays
    focus: StageFocus
    teamRows?: readonly TeamRow[]
    transposed?: boolean
    shift?: number
}

function shifted(rect: SlotRect, shift: number): SlotRect {
    return shift === 0 ? rect : { ...rect, y: rect.y - shift }
}

export function RaceStage({ layout, tiles, view, tags, onSwipe, controller, stageRef, attachMedia, onVideoFailed, tileOverlays, focus, teamRows = [], transposed = false, shift = 0 }: RaceStageProps) {
    const frozen = new Set(usePlaybackSelector(controller, state => frozenKey(state.frozen)).split(','))
    const still = usePrefersReducedMotion()
    const swipe = useSwipe(direction => {
        if (direction === 'left') onSwipe(1)
        if (direction === 'right') onSwipe(-1)
    })
    const rects = new Map(layout.placed.map(({ slot, rect }) => [slot.id, shifted(rect, shift)]))
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
                    tags={tags}
                    attachMedia={attachMedia}
                    onVideoFailed={onVideoFailed}
                    controller={controller}
                    overlay={tileOverlays.overlays.get(slot.id)}
                    tileOverlays={tileOverlays}
                    focus={focus}
                    focusable={view.mode === 'grid'}
                    others={slot.id === view.pov ? others : []}
                />
            ))}
            {teamRows.map(row => row.header && (
                <TeamRowHeader
                    key={row.teamCapId}
                    row={row}
                    rect={shifted(row.header, shift)}
                    band={transposed}
                    removable={teamRows.length > 1}
                    controller={controller}
                    onFocusRow={view.mode === 'grid' && focus.onFocusRow ? focus.onFocusRow : null}
                    onEdit={tileOverlays.onEdit}
                />
            ))}
        </section>
    )
}
