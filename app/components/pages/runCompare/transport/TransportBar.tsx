import { Pause, Play, StepBack, StepForward } from 'lucide-react'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { formatRaceTime, type RaceModel, type RaceRun } from '../model/raceModel'
import { PLAYBACK_RATES } from '../playback/playbackConstants'
import type { PlaybackController, PlaybackState } from '../playback/playbackController'
import { usePlaybackSelector } from '../stage/usePlaybackSelector'

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

function LaneRow({ lane }: { lane: RaceRun }) {
    const { run } = lane
    return (
        <li className="run-compare-row run-compare-lane">
            <PlayerInfo userId={run.user} alias={run.alias} title={run.title} size="sm" className="min-h-11 min-w-0" />
            <span className="font-mono tabular-nums text-foreground">{formatRaceTime(run.timeSeconds)}</span>
            {lane.badges.map(badge => <span key={badge} className="run-compare-badge">{badge}</span>)}
        </li>
    )
}

interface TransportBarProps {
    controller: PlaybackController | null
    race: RaceModel
}

export function TransportBar({ controller, race }: TransportBarProps) {
    const { playing, rate, end, buffering } = usePlaybackSelector(controller, controlsOf, sameControls)
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
            </div>
            <Timeline controller={controller} end={end} />
            {race.dataOnly.length > 0 && (
                <ol aria-label="Lanes" className="run-compare-lanes">
                    {race.dataOnly.map(lane => <LaneRow key={lane.run.capId} lane={lane} />)}
                </ol>
            )}
        </section>
    )
}
