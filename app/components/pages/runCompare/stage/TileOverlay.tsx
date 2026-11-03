import { useCallback } from 'react'
import { Pin, Trash2, Volume2, VolumeX } from 'lucide-react'
import { TONE_TEXT } from '@/app/components/pages/capDetail/runDelta/deltaStyles'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { cn } from '@/lib/utils'
import { sameReadout, tileReadout, type TileOverlay as TileOverlayModel, type TileReadout } from '../model/overlayModel'
import type { SetEdit } from '../model/setEdits'
import type { PlaybackController, PlaybackState } from '../playback/playbackController'
import { usePlaybackSelector } from './usePlaybackSelector'

function LiveReadout({ overlay, controller }: { overlay: TileOverlayModel; controller: PlaybackController | null }) {
    const select = useCallback(
        (state: PlaybackState) => tileReadout(overlay, { seconds: state.runTimes[overlay.capId] ?? state.t, playing: state.playing }),
        [overlay],
    )
    const readout = usePlaybackSelector<TileReadout>(controller, select, sameReadout)
    return (
        <div className="run-compare-tile-readout font-mono tabular-nums">
            {readout.delta && (
                <span className={cn('run-compare-tile-delta', TONE_TEXT[readout.delta.tone])}>{readout.delta.label}</span>
            )}
            {readout.flash && (
                <span key={readout.flash.index} className="run-compare-tile-flash">
                    <span className="text-muted-foreground">{readout.flash.label}</span>
                    <span className={TONE_TEXT[readout.flash.gap.tone]}>{readout.flash.gap.label}</span>
                </span>
            )}
        </div>
    )
}

export interface TileAudio {
    audible: boolean
    volume: number
    onAudio: (capId: string) => void
    onVolume: (volume: number) => void
}

interface TileOverlayProps {
    overlay: TileOverlayModel
    controller: PlaybackController | null
    shown: boolean
    audio: TileAudio
    onEdit: (edit: SetEdit) => void
}

export function TileOverlay({ overlay, controller, shown, audio, onEdit }: TileOverlayProps) {
    const { run, capId } = overlay
    return (
        <div className={cn('run-compare-overlay', !shown && 'is-hidden')}>
            <div className="run-compare-tile-top run-compare-row">
                {overlay.teamColour && <span className="run-compare-team-bar" style={{ background: overlay.teamColour }} />}
                <PlayerInfo userId={run.user} alias={run.alias} title={run.title} size="sm" interactive={false} className="min-w-0" />
                <span className="run-compare-tile-time font-mono tabular-nums text-foreground">{overlay.time}</span>
                {overlay.reference && <span className="run-compare-badge is-reference">REF</span>}
                {overlay.badges.map(badge => <span key={badge} className="run-compare-badge">{badge}</span>)}
            </div>
            <div className="run-compare-tile-aside">
                <LiveReadout overlay={overlay} controller={controller} />
                <div className="run-compare-tile-actions">
                    {audio.audible && (
                        <input
                            type="range"
                            aria-label="Volume"
                            aria-valuetext={`${Math.round(audio.volume * 100)}%`}
                            className="run-compare-tile-volume"
                            min={0}
                            max={1}
                            step={0.05}
                            value={audio.volume}
                            onChange={event => audio.onVolume(Number(event.currentTarget.value))}
                        />
                    )}
                    <button
                        type="button"
                        aria-label="Audio"
                        aria-pressed={audio.audible}
                        className="run-compare-tile-action"
                        onClick={() => audio.onAudio(capId)}
                    >
                        {audio.audible ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
                    </button>
                    <button
                        type="button"
                        aria-label="Pin"
                        aria-pressed={overlay.pinned}
                        className="run-compare-tile-action"
                        onClick={() => onEdit({ kind: overlay.pinned ? 'unpin' : 'pin', capId })}
                    >
                        <Pin className="size-4" />
                    </button>
                    <button
                        type="button"
                        aria-label="Remove"
                        disabled={!overlay.removable}
                        className="run-compare-tile-action"
                        onClick={() => onEdit({ kind: 'remove', capId })}
                    >
                        <Trash2 className="size-4" />
                    </button>
                </div>
            </div>
        </div>
    )
}
