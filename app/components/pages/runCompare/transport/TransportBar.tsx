import type { CSSProperties } from 'react'
import { Captions, ChevronDown, Keyboard, Maximize, Minimize, Pause, Play, StepBack, StepForward, Volume2 } from 'lucide-react'
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { useDeviceEnvironment } from '@/app/device/useDeviceEnvironment'
import { RunIdentity } from '../analysis/RunIdentity'
import { zoneLabel } from '../analysis/analysisLabels'
import type { CueModel, CuePoint } from '../model/cueModel'
import type { GapGraph as GapGraphModel } from '../model/gapGraphModel'
import { SIDE_TAGS } from '../model/laneModel'
import type { SideChoice } from '../model/referenceModel'
import { formatRaceTime, type RaceModel } from '../model/raceModel'
import { PLAYBACK_RATES, SKIP_SECONDS } from '../playback/playbackConstants'
import type { PlaybackController, PlaybackState } from '../playback/playbackController'
import { usePlaybackSelector } from '../stage/usePlaybackSelector'
import type { VideoTags } from '../stage/videoTags'
import type { CompareSync } from '../url/compareUrl'
import { CueTicks } from './CueTicks'
import { GapGraph } from './GapGraph'
import type { CueSync } from './useCueSync'

export const SYNC_MODES: { mode: CompareSync; label: string }[] = [
    { mode: 'race', label: 'Race' },
    { mode: 'position', label: 'Same Spot' },
]

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

function Clock({ controller, end }: { controller: PlaybackController | null; end: number }) {
    const t = usePlaybackSelector(controller, playheadOf)
    return (
        <span className="run-compare-clock font-mono tabular-nums">
            <span className="text-foreground">{formatRaceTime(t)}</span>
            <span className="text-muted-foreground"> / {formatRaceTime(end)}</span>
        </span>
    )
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
            style={{ '--run-compare-progress': `${end > 0 ? (Math.min(t, end) / end) * 100 : 0}%` } as CSSProperties}
            onPointerDown={event => {
                event.currentTarget.setPointerCapture(event.pointerId)
                controller?.beginScrub()
            }}
            onLostPointerCapture={() => controller?.endScrub()}
            onChange={event => controller?.seek(Number(event.currentTarget.value))}
        />
    )
}

export interface TransportAudio {
    volume: number
    onVolume: (volume: number) => void
}

export interface TransportSides {
    choice: SideChoice
    onSide: (side: number) => void
}

export interface TransportTags {
    shown: VideoTags
    onChange: (next: VideoTags) => void
}

export interface FullscreenControl {
    active: boolean
    toggle: () => void
}

interface TransportBarProps {
    controller: PlaybackController | null
    race: RaceModel
    graph: GapGraphModel
    cues: CueModel
    cueSync: CueSync
    syncMode: CompareSync
    onSync: (mode: CompareSync) => void
    sides?: TransportSides | null
    audio: TransportAudio
    tags: TransportTags | null
    fullscreen: FullscreenControl | null
    onShortcuts: () => void
    compact: boolean
    sectionRef?: (element: HTMLElement | null) => void
}

function RateMenu({ controller, rate }: { controller: PlaybackController | null; rate: number }) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button type="button" aria-label="Playback rate" disabled={!controller} className="run-compare-pill-button font-mono tabular-nums">
                    {rate}×
                    <ChevronDown className="size-3.5" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="run-compare-menu">
                <DropdownMenuLabel>Playback Rate</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={String(rate)} onValueChange={value => controller?.setRate(Number(value))}>
                    {PLAYBACK_RATES.map(option => (
                        <DropdownMenuRadioItem key={option} value={String(option)}>{option}×</DropdownMenuRadioItem>
                    ))}
                </DropdownMenuRadioGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

function VideoTagsMenu({ tags }: { tags: TransportTags }) {
    const { shown, onChange } = tags
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button type="button" aria-label="Show on Videos" className="run-compare-icon-button">
                    <Captions className="size-4" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="run-compare-menu">
                <DropdownMenuLabel>Show on Videos</DropdownMenuLabel>
                <DropdownMenuCheckboxItem
                    checked={shown.names}
                    onSelect={event => {
                        event.preventDefault()
                        onChange({ ...shown, names: !shown.names })
                    }}
                >
                    Names
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                    checked={shown.gap}
                    onSelect={event => {
                        event.preventDefault()
                        onChange({ ...shown, gap: !shown.gap })
                    }}
                >
                    Live Gap
                </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

function cueLabel(point: CuePoint): string {
    return point.kind === 'zone' ? zoneLabel(point.label) : point.label
}

export function jumpLabel(points: readonly CuePoint[]): string {
    const kinds = new Set(points.map(point => point.kind))
    if (kinds.size === 1 && kinds.has('sector')) return 'Jump to Sector'
    if (kinds.size === 1 && kinds.has('zone')) return 'Jump to Zone'
    return 'Jump To'
}

function JumpMenu({ controller, cues, cueSync }: { controller: PlaybackController | null; cues: CueModel; cueSync: CueSync }) {
    const idle = !controller || cues.points.length === 0
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button type="button" disabled={idle} className="run-compare-pill-button">
                    {jumpLabel(cues.points)}
                    <ChevronDown className="size-3.5" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="run-compare-menu run-compare-jump-menu">
                <DropdownMenuRadioGroup value={cueSync.active ?? ''}>
                    {cues.points.map(point => (
                        <DropdownMenuRadioItem key={point.key} value={point.key} onSelect={() => cueSync.cue(point)}>
                            {cueLabel(point)}
                            <span className="run-compare-menu-aside font-mono tabular-nums">{formatRaceTime(point.atMs / 1000)}</span>
                        </DropdownMenuRadioItem>
                    ))}
                </DropdownMenuRadioGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

const SIDE_CLASSES = ['is-red', 'is-blue'] as const

function SideSwitch({ sides, compact }: { sides: TransportSides; compact: boolean }) {
    const { choice, onSide } = sides
    return (
        <div role="group" aria-label="Analyse Side" className="run-compare-segmented">
            {!compact && <span aria-hidden className="run-compare-segmented-label">Analyse</span>}
            {choice.options.map(option => (
                <button
                    key={option.side}
                    type="button"
                    aria-pressed={choice.focus === option.side}
                    className={cn('run-compare-segment', SIDE_CLASSES[option.side])}
                    onClick={() => onSide(option.side)}
                >
                    {SIDE_TAGS[option.side]}
                    <span className="run-compare-segment-count">{option.runs}</span>
                </button>
            ))}
        </div>
    )
}

function SyncSwitch({ mode, onSync, compact }: { mode: CompareSync; onSync: (mode: CompareSync) => void; compact: boolean }) {
    return (
        <div role="group" aria-label="Sync" className="run-compare-segmented">
            {!compact && <span aria-hidden className="run-compare-segmented-label">Sync</span>}
            {SYNC_MODES.map(option => (
                <button key={option.mode} type="button" aria-pressed={mode === option.mode} className="run-compare-segment" onClick={() => onSync(option.mode)}>
                    {option.label}
                </button>
            ))}
        </div>
    )
}

function VolumeControl({ audio }: { audio: TransportAudio }) {
    return (
        <label className="run-compare-volume">
            <Volume2 aria-hidden className="size-4 text-muted-foreground" />
            <input
                type="range"
                aria-label="Volume"
                aria-valuetext={`${Math.round(audio.volume * 100)}%`}
                min={0}
                max={1}
                step={0.05}
                value={audio.volume}
                onChange={event => audio.onVolume(Number(event.currentTarget.value))}
            />
        </label>
    )
}

export function TransportBar({ controller, race, graph, cues, cueSync, syncMode, onSync, sides = null, audio, tags, fullscreen, onShortcuts, compact, sectionRef }: TransportBarProps) {
    const { playing, rate, end, buffering } = usePlaybackSelector(controller, controlsOf, sameControls)
    const touch = useDeviceEnvironment(environment => environment.touch)
    const stalled = new Set(buffering.split(','))
    const buffered = race.runs.filter(lane => stalled.has(lane.run.capId))

    return (
        <section ref={sectionRef} aria-label="Playback" className={cn('run-compare-transport', compact && 'is-compact')}>
            <GapGraph graph={graph} controller={controller} end={end} sectors={cues.points} />
            <div className="run-compare-track">
                <Clock controller={controller} end={end} />
                <div className="run-compare-scrub">
                    <Timeline controller={controller} end={end} />
                    <CueTicks label="Sectors" kind="sector" points={cues.sectors} end={end} active={cueSync.active} interactive={!touch} labelled={!compact} onCue={cueSync.cue} />
                    <CueTicks label="Zones" kind="zone" points={cues.zones} end={end} active={cueSync.active} interactive={!touch} labelled={false} onCue={cueSync.cue} />
                </div>
            </div>
            <div className="run-compare-controls">
                <button
                    type="button"
                    aria-label={playing ? 'Pause' : 'Play'}
                    disabled={!controller}
                    className="run-compare-play"
                    onClick={() => (playing ? controller?.pause() : controller?.play())}
                >
                    {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
                </button>
                <button type="button" aria-label="Previous frame" disabled={!controller} className="run-compare-icon-button" onClick={() => controller?.stepFrame(-1)}>
                    <StepBack className="size-4" />
                </button>
                <button type="button" aria-label="Next frame" disabled={!controller} className="run-compare-icon-button" onClick={() => controller?.stepFrame(1)}>
                    <StepForward className="size-4" />
                </button>
                {!touch && (
                    <>
                        <button type="button" aria-label={`Back ${SKIP_SECONDS} seconds`} disabled={!controller} className="run-compare-skip font-mono" onClick={() => controller?.skip(-1)}>
                            −{SKIP_SECONDS}s
                        </button>
                        <button type="button" aria-label={`Forward ${SKIP_SECONDS} seconds`} disabled={!controller} className="run-compare-skip font-mono" onClick={() => controller?.skip(1)}>
                            +{SKIP_SECONDS}s
                        </button>
                    </>
                )}
                <span aria-hidden className="run-compare-divider" />
                <JumpMenu controller={controller} cues={cues} cueSync={cueSync} />
                <SyncSwitch mode={syncMode} onSync={onSync} compact={compact} />
                {sides && <SideSwitch sides={sides} compact={compact} />}
                <div aria-live="polite" className="run-compare-buffering text-muted-foreground">
                    {buffered.length > 0 && (
                        <>
                            <span>Buffering:</span>
                            {buffered.map(({ run }) => <RunIdentity key={run.capId} run={run} withTitle={false} />)}
                        </>
                    )}
                </div>
                {!touch && <VolumeControl audio={audio} />}
                {tags && <VideoTagsMenu tags={tags} />}
                <RateMenu controller={controller} rate={rate} />
                {!touch && (
                    <button type="button" aria-label="Shortcuts" aria-haspopup="dialog" className="run-compare-icon-button" onClick={onShortcuts}>
                        <Keyboard className="size-4" />
                    </button>
                )}
                {fullscreen && (
                    <button
                        type="button"
                        aria-label={fullscreen.active ? 'Exit fullscreen' : 'Fullscreen'}
                        className="run-compare-icon-button"
                        onClick={fullscreen.toggle}
                    >
                        {fullscreen.active ? <Minimize className="size-4" /> : <Maximize className="size-4" />}
                    </button>
                )}
            </div>
        </section>
    )
}
