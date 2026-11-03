import { Crosshair, ListVideo, Pause, Play, SkipBack, SkipForward, StepBack, StepForward } from 'lucide-react'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { useDeviceEnvironment } from '@/app/device/useDeviceEnvironment'
import type { CueModel } from '../model/cueModel'
import type { LanesModel } from '../model/laneModel'
import { formatRaceTime, type RaceModel } from '../model/raceModel'
import { PLAYBACK_RATES } from '../playback/playbackConstants'
import type { PlaybackController, PlaybackState } from '../playback/playbackController'
import { usePlaybackSelector } from '../stage/usePlaybackSelector'
import type { CompareSync } from '../url/compareUrl'
import { CueTicks } from './CueTicks'
import { DeltaLanes } from './DeltaLanes'
import type { CueSync } from './useCueSync'

interface Controls {
    playing: boolean
    rate: number
    end: number
    buffering: string
}

function controlsOf(state: PlaybackState): Controls {
    return {
        playing: state.playing,
        rate: state.rate,
        end: state.end,
        buffering: state.playing ? state.stalled.join(',') : '',
    }
}

function sameControls(a: Controls, b: Controls): boolean {
    return a.playing === b.playing && a.rate === b.rate && a.end === b.end && a.buffering === b.buffering
}

function playheadOf(state: PlaybackState): number {
    return state.t
}

function Clock({ controller }: { controller: PlaybackController | null }) {
    const t = usePlaybackSelector(controller, playheadOf)
    return <span className="run-compare-clock font-mono tabular-nums text-foreground">{formatRaceTime(t)}</span>
}

function Timeline({ controller, end }: { controller: PlaybackController | null; end: number }) {
    const t = usePlaybackSelector(controller, playheadOf)
    return (
        <input
            type="range"
            aria-label="Timeline"
            aria-valuetext={formatRaceTime(t)}
            className="run-compare-timeline"
            min={0}
            max={end}
            step="any"
            value={Math.min(t, end)}
            disabled={!controller || end <= 0}
            onPointerDown={event => {
                event.currentTarget.setPointerCapture(event.pointerId)
                controller?.beginScrub()
            }}
            onLostPointerCapture={() => controller?.endScrub()}
            onChange={event => controller?.seek(Number(event.currentTarget.value))}
        />
    )
}

interface TransportBarProps {
    controller: PlaybackController | null
    race: RaceModel
    lanes: LanesModel
    runsOpen: boolean
    onToggleRuns: () => void
    cues: CueModel
    cueSync: CueSync
    syncMode: CompareSync
    onToggleSync: () => void
}

interface CueControlsProps {
    controller: PlaybackController | null
    cues: CueModel
    cueSync: CueSync
}

function CueControls({ controller, cues, cueSync }: CueControlsProps) {
    const idle = !controller || cues.points.length === 0
    return (
        <>
            <button type="button" aria-label="Previous cue" disabled={idle} onClick={cueSync.previousCue}>
                <SkipBack className="size-4" />
            </button>
            <select
                aria-label="Cue"
                value={cueSync.active ?? ''}
                disabled={idle}
                onChange={event => {
                    const point = cues.points.find(candidate => candidate.key === event.currentTarget.value)
                    if (point) cueSync.cue(point)
                }}
                style={{ colorScheme: 'dark' }}
            >
                <option value="" disabled>Cue</option>
                {cues.points.map(point => <option key={point.key} value={point.key}>{point.label}</option>)}
            </select>
            <button type="button" aria-label="Next cue" disabled={idle} onClick={cueSync.nextCue}>
                <SkipForward className="size-4" />
            </button>
        </>
    )
}

export function TransportBar({ controller, race, lanes, runsOpen, onToggleRuns, cues, cueSync, syncMode, onToggleSync }: TransportBarProps) {
    const { playing, rate, end, buffering } = usePlaybackSelector(controller, controlsOf, sameControls)
    const touch = useDeviceEnvironment(environment => environment.touch)
    const stalled = new Set(buffering.split(','))
    const buffered = race.runs.filter(lane => stalled.has(lane.run.capId))

    return (
        <section aria-label="Playback" className="run-compare-transport">
            <div className="run-compare-controls">
                <button
                    type="button"
                    aria-label={playing ? 'Pause' : 'Play'}
                    disabled={!controller}
                    onClick={() => (playing ? controller?.pause() : controller?.play())}
                >
                    {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
                </button>
                <button type="button" aria-label="Previous frame" disabled={!controller} onClick={() => controller?.stepFrame(-1)}>
                    <StepBack className="size-4" />
                </button>
                <button type="button" aria-label="Next frame" disabled={!controller} onClick={() => controller?.stepFrame(1)}>
                    <StepForward className="size-4" />
                </button>
                <select
                    aria-label="Playback rate"
                    value={String(rate)}
                    disabled={!controller}
                    onChange={event => controller?.setRate(Number(event.currentTarget.value))}
                    style={{ colorScheme: 'dark' }}
                >
                    {PLAYBACK_RATES.map(option => <option key={option} value={String(option)}>{option}×</option>)}
                </select>
                <Clock controller={controller} />
                <CueControls controller={controller} cues={cues} cueSync={cueSync} />
                <button
                    type="button"
                    aria-pressed={syncMode === 'position'}
                    className="run-compare-sync-button"
                    onClick={onToggleSync}
                >
                    <Crosshair className="size-4" />
                    <span>Sync by position</span>
                </button>
                <div aria-live="polite" className="run-compare-buffering text-muted-foreground">
                    {buffered.length > 0 && (
                        <>
                            <span>Buffering:</span>
                            {buffered.map(({ run }) => (
                                <PlayerInfo key={run.capId} userId={run.user} alias={run.alias} title={run.title} size="sm" interactive={false} />
                            ))}
                        </>
                    )}
                </div>
                <button
                    type="button"
                    aria-expanded={runsOpen}
                    aria-controls="run-compare-drawer"
                    className="run-compare-runs-button"
                    onClick={onToggleRuns}
                >
                    <ListVideo className="size-4" />
                    <span>Runs</span>
                </button>
            </div>
            <div className="run-compare-track">
                <div className="run-compare-scrub">
                    <CueTicks label="Sectors" kind="sector" points={cues.sectors} end={end} active={cueSync.active} interactive={!touch} onCue={cueSync.cue} />
                    <Timeline controller={controller} end={end} />
                    <CueTicks label="Zones" kind="zone" points={cues.zones} end={end} active={cueSync.active} interactive={!touch} onCue={cueSync.cue} />
                </div>
            </div>
            <DeltaLanes lanes={lanes.lanes} controller={controller} end={end} />
        </section>
    )
}
