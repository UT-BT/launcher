import { useCallback } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { TONE_TEXT } from '@/app/components/pages/capDetail/runDelta/deltaStyles'
import { cn } from '@/lib/utils'
import { RunIdentity, runName } from '../analysis/RunIdentity'
import { sameReadout, tileReadout, type TileOverlay, type TileReadout } from '../model/overlayModel'
import type { SetEdit } from '../model/setEdits'
import type { PlaybackController, PlaybackState } from '../playback/playbackController'
import { RunMenu } from './RunMenu'
import { BaselineTag, NoteTags, OlderVideoTag, SideTag } from './Tags'
import { TeamIndex } from './TeamLabel'
import { usePlaybackSelector } from './usePlaybackSelector'
import type { VideoTags } from './videoTags'

function useReadout(overlay: TileOverlay, controller: PlaybackController | null): TileReadout {
    const select = useCallback(
        (state: PlaybackState) => tileReadout(overlay, { seconds: state.runTimes[overlay.capId] ?? state.t, playing: state.playing }),
        [overlay],
    )
    return usePlaybackSelector<TileReadout>(controller, select, sameReadout)
}

function LiveGap({ overlay, controller }: { overlay: TileOverlay; controller: PlaybackController | null }) {
    const { delta } = useReadout(overlay, controller)
    if (!delta) return null
    return (
        <span className="run-compare-gap">
            <span className={cn('run-compare-gap-value font-mono tabular-nums', TONE_TEXT[delta.tone])}>{delta.label}</span>
            {overlay.versus && <span className="run-compare-gap-vs">vs {runName(overlay.versus)}</span>}
        </span>
    )
}

export function TileFlash({ overlay, controller }: { overlay: TileOverlay; controller: PlaybackController | null }) {
    const { flash } = useReadout(overlay, controller)
    if (!flash) return null
    return (
        <span key={flash.index} className="run-compare-flash font-mono tabular-nums">
            <span className="text-muted-foreground">{flash.label}</span>
            <span className={TONE_TEXT[flash.gap.tone]}>{flash.gap.label}</span>
        </span>
    )
}

export interface CaptionAudio {
    audible: boolean
    onAudio: (capId: string) => void
}

interface TileControlsProps {
    overlay: TileOverlay
    audio: CaptionAudio
    onEdit: (edit: SetEdit) => void
}

function seatOf(overlay: TileOverlay): { colour: string; index: number } | null {
    return overlay.teamColour !== null && overlay.teamIndex !== null ? { colour: overlay.teamColour, index: overlay.teamIndex } : null
}

function TileControls({ overlay, audio, onEdit }: TileControlsProps) {
    const { run, capId } = overlay
    const seat = seatOf(overlay)
    return (
        <>
            <button
                type="button"
                aria-label={`Sound from ${runName(run)}`}
                aria-pressed={audio.audible}
                className="run-compare-icon-button run-compare-sound"
                onClick={() => audio.onAudio(capId)}
            >
                {audio.audible ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
            </button>
            <RunMenu
                capId={capId}
                run={run}
                baseline={seat ? null : { pinned: overlay.pinned, reference: overlay.reference }}
                video="on"
                offset={overlay.olderVideo ? { offsetMs: overlay.offsetMs, fps: overlay.fps } : null}
                pairMenu={overlay.pairMenu}
                driving={null}
                removable={seat ? null : overlay.removable}
                onEdit={onEdit}
            />
        </>
    )
}

function TileMark({ overlay }: { overlay: TileOverlay }) {
    const seat = seatOf(overlay)
    if (seat) return <TeamIndex index={seat.index} colour={seat.colour} />
    if (overlay.reference || !overlay.colour) return null
    return <span aria-hidden className="run-compare-tile-swatch" style={{ background: overlay.colour }} />
}

function TileTagList({ overlay, className }: { overlay: TileOverlay; className: string }) {
    return (
        <span className={className}>
            <SideTag side={overlay.run.side} label={overlay.sideLabel} />
            <OlderVideoTag shown={overlay.olderVideo} />
            <NoteTags notes={overlay.badges} />
        </span>
    )
}

function TileGap({ overlay, controller }: { overlay: TileOverlay; controller: PlaybackController | null }) {
    return overlay.reference && !seatOf(overlay) ? <BaselineTag /> : <LiveGap overlay={overlay} controller={controller} />
}

interface TileCaptionProps extends TileControlsProps {
    controller: PlaybackController | null
}

export function TileCaption({ overlay, controller, audio, onEdit }: TileCaptionProps) {
    return (
        <div className="run-compare-caption">
            <TileMark overlay={overlay} />
            <RunIdentity run={overlay.run} presentation="full" className="run-compare-caption-who" />
            <span className="run-compare-caption-time font-mono tabular-nums">{overlay.time}</span>
            <TileTagList overlay={overlay} className="run-compare-caption-tags" />
            <span className="run-compare-caption-fill" />
            <TileGap overlay={overlay} controller={controller} />
            <TileControls overlay={overlay} audio={audio} onEdit={onEdit} />
        </div>
    )
}

interface TileTagsProps extends TileCaptionProps {
    shown: VideoTags
}

export function TileTags({ overlay, controller, audio, onEdit, shown }: TileTagsProps) {
    return (
        <>
            {shown.names && (
                <div className="run-compare-tile-name">
                    <span className="run-compare-tile-name-row">
                        <TileMark overlay={overlay} />
                        <RunIdentity run={overlay.run} presentation="full" withTitle={false} className="run-compare-tile-who" />
                        <span className="run-compare-tile-time font-mono tabular-nums">{overlay.time}</span>
                    </span>
                    <TileTagList overlay={overlay} className="run-compare-tile-tags" />
                </div>
            )}
            {shown.gap && (
                <div className="run-compare-tile-live">
                    <TileGap overlay={overlay} controller={controller} />
                </div>
            )}
            <div className="run-compare-tile-actions">
                <TileControls overlay={overlay} audio={audio} onEdit={onEdit} />
            </div>
        </>
    )
}
