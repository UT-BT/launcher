import { useEffect, useMemo, useRef, useState } from 'react'
import { Play, Pause, Minus, Plus, RotateCcw, Loader2, Flag, Volume2, VolumeX, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { Modal } from '@/app/components/ui/modal'
import { Tooltip } from '@/app/components/ui/tooltip'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { formatCapTime, displayMapName } from '@/app/utils/format'
import { cn } from '@/lib/utils'
import type { ActiveTitle, CapCheckpoint } from '@/app/utils/api'
import { buildSyncAnchors, formatSignedDelta, deltaClass } from '@/app/components/pages/capDetail/capStats'
import { CompareScrubber, type ScrubTick, type ScrubLane } from './CompareScrubber'
import { CompareDeltaBar } from './CompareDeltaBar'

export interface CompareRun {
    capId: string
    alias: string | null
    userId: string | number
    title: ActiveTitle | null
    capTime: number
    checkpoints: CapCheckpoint[]
    url: string
}

interface VideoCompareModalProps {
    open: boolean
    onClose: () => void
    mapName: string
    runs: CompareRun[]
}

const NUDGE_STEP = 0.1
const END_EPS = 0.06
const FRAME_STEP = 1 / 30
const SKIP_SECONDS = 5
const RATES = [0.25, 0.5, 1, 1.5, 2] as const

interface RunColor {
    tickColor: string
    capColor: string
    textColor: string
    dot: string
}

const RUN_COLORS: RunColor[] = [
    { tickColor: 'bg-blue-400/40', capColor: 'bg-blue-300', textColor: 'text-blue-300/80', dot: 'bg-blue-300' },
    { tickColor: 'bg-amber-400/40', capColor: 'bg-amber-300', textColor: 'text-amber-300/80', dot: 'bg-amber-300' },
    { tickColor: 'bg-emerald-400/40', capColor: 'bg-emerald-300', textColor: 'text-emerald-300/80', dot: 'bg-emerald-300' },
    { tickColor: 'bg-fuchsia-400/40', capColor: 'bg-fuchsia-300', textColor: 'text-fuchsia-300/80', dot: 'bg-fuchsia-300' },
    { tickColor: 'bg-rose-400/40', capColor: 'bg-rose-300', textColor: 'text-rose-300/80', dot: 'bg-rose-300' },
    { tickColor: 'bg-cyan-400/40', capColor: 'bg-cyan-300', textColor: 'text-cyan-300/80', dot: 'bg-cyan-300' },
    { tickColor: 'bg-violet-400/40', capColor: 'bg-violet-300', textColor: 'text-violet-300/80', dot: 'bg-violet-300' },
    { tickColor: 'bg-lime-400/40', capColor: 'bg-lime-300', textColor: 'text-lime-300/80', dot: 'bg-lime-300' },
]

function isFiniteDuration(d: number | undefined | null): d is number {
    return d != null && Number.isFinite(d) && d > 0
}

function lastPassedIdx(cpTimes: number[], vt: number): number {
    let idx = -1
    for (let i = 0; i < cpTimes.length; i++) if (cpTimes[i] <= vt) idx = i
    return idx
}

function gridColsClass(count: number): string {
    if (count <= 2) return 'grid-cols-1 lg:grid-cols-2'
    if (count === 3) return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
    if (count === 4) return 'grid-cols-2'
    return 'grid-cols-2 lg:grid-cols-3'
}

function paneMaxHeight(count: number): string {
    if (count <= 2) return '38vh'
    if (count <= 4) return '30vh'
    return '22vh'
}

export function VideoCompareModal({ open, onClose, mapName, runs }: VideoCompareModalProps) {
    const n = runs.length
    const runsKey = useMemo(() => runs.map(r => r.capId).join(','), [runs])

    const videoRefs = useRef<(HTMLVideoElement | null)[]>([])
    const nudgeRefs = useRef<number[]>(runs.map(() => 0))
    const masterRef = useRef(0)
    const rafRef = useRef<number | null>(null)

    const [playing, setPlaying] = useState(false)
    const [master, setMasterState] = useState(0)
    const [nudges, setNudges] = useState<number[]>(() => runs.map(() => 0))
    const [errors, setErrors] = useState<boolean[]>(() => runs.map(() => false))
    const [bufferings, setBufferings] = useState<boolean[]>(() => runs.map(() => false))
    const [durations, setDurations] = useState<(number | null)[]>(() => runs.map(() => null))
    const [muteds, setMuteds] = useState<boolean[]>(() => runs.map(() => true))
    const [rate, setRate] = useState(1)

    const setMaster = (t: number) => { masterRef.current = t; setMasterState(t) }

    const tMax = durations.reduce<number>((m, d) => Math.max(m, d ?? 0), 0)

    const refIndex = useMemo(
        () => runs.reduce((maxI, r, i, arr) => (r.capTime > arr[maxI].capTime ? i : maxI), 0),
        [runs],
    )
    const refRun = runs[refIndex] ?? runs[0]

    const seekVideo = (video: HTMLVideoElement | null, nudge: number, T: number) => {
        if (!video) return
        const dur = video.duration
        const target = T - nudge
        const hi = isFiniteDuration(dur) ? dur : Math.max(0, target)
        video.currentTime = Math.min(hi, Math.max(0, target))
    }
    const seekToMaster = (T: number) => {
        videoRefs.current.forEach((v, i) => seekVideo(v, nudgeRefs.current[i] ?? 0, T))
    }

    const onDurationKnown = (i: number) => {
        const video = videoRefs.current[i]
        if (!video) return
        setDurations(prev => {
            const next = [...prev]
            next[i] = isFiniteDuration(video.duration) ? video.duration : null
            return next
        })
        video.playbackRate = rate
        if (!playing) seekToMaster(masterRef.current)
    }

    const setBuffering = (i: number, b: boolean) => {
        setBufferings(prev => {
            if ((prev[i] ?? false) === b) return prev
            const next = [...prev]
            next[i] = b
            return next
        })
    }

    const setError = (i: number) => {
        setErrors(prev => {
            if (prev[i]) return prev
            const next = [...prev]
            next[i] = true
            return next
        })
    }

    const stopPlay = () => {
        if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
        rafRef.current = null
        videoRefs.current.forEach(v => v?.pause())
        setPlaying(false)
    }

    const startPlay = () => {
        const vids = videoRefs.current
        if (vids.length === 0 || errors.some(Boolean)) return
        if (!runs.every((_, i) => isFiniteDuration(vids[i]?.duration))) return
        seekToMaster(masterRef.current)
        vids.forEach(v => { if (v) v.playbackRate = rate })
        setPlaying(true)
        vids.forEach(v => v?.play().catch(() => {}))
        const loop = () => {
            const vs = videoRefs.current
            const times = vs.map((v, i) => (v ? v.currentTime + (nudgeRefs.current[i] ?? 0) : -Infinity))
            setMaster(Math.max(0, ...times))
            const allEnded = vs.every(v =>
                !v || v.ended || (isFiniteDuration(v.duration) && v.currentTime >= v.duration - END_EPS),
            )
            if (allEnded) { stopPlay(); return }
            rafRef.current = requestAnimationFrame(loop)
        }
        rafRef.current = requestAnimationFrame(loop)
    }

    const handleScrubStart = () => { if (playing) stopPlay() }
    const handleScrub = (t: number) => { setMaster(t); seekToMaster(t) }
    const handleScrubEnd = () => { seekToMaster(masterRef.current) }

    const skip = (sec: number) => {
        if (tMax <= 0) return
        const next = Math.min(tMax, Math.max(0, masterRef.current + sec))
        setMaster(next)
        seekToMaster(next)
    }

    const setNudge = (i: number, v: number) => {
        const limit = Math.max(60, tMax)
        const clamped = Math.round(Math.min(limit, Math.max(-limit, v)) * 100) / 100
        const refs = [...nudgeRefs.current]
        refs[i] = clamped
        nudgeRefs.current = refs
        setNudges(prev => {
            const next = [...prev]
            next[i] = clamped
            return next
        })
        if (!playing) seekToMaster(masterRef.current)
    }
    const stepNudge = (i: number, dir: number) => setNudge(i, (nudgeRefs.current[i] ?? 0) + dir * NUDGE_STEP)

    useEffect(() => {
        if (!open) return
        setPlaying(false)
        setMaster(0)
        nudgeRefs.current = runs.map(() => 0)
        setNudges(runs.map(() => 0))
        setErrors(runs.map(() => false))
        setBufferings(runs.map(() => false))
        setDurations(runs.map(() => null))
        setMuteds(runs.map(() => true))
        setRate(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, runsKey])

    useEffect(() => {
        videoRefs.current.forEach((v, i) => { if (v) v.muted = muteds[i] ?? true })
    }, [muteds])
    useEffect(() => {
        videoRefs.current.forEach(v => { if (v) v.playbackRate = rate })
    }, [rate])

    useEffect(() => () => {
        if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
        videoRefs.current.forEach(v => v?.pause())
    }, [])

    useEffect(() => {
        if (!open) return
        const onKey = (e: KeyboardEvent) => {
            const t = e.target as HTMLElement | null
            if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
            if (tMax <= 0) return
            const k = e.key
            if (k === 'ArrowLeft' || k === 'ArrowRight') {
                e.preventDefault()
                if (rafRef.current != null) stopPlay()
                const dir = k === 'ArrowRight' ? 1 : -1
                const next = Math.min(tMax, Math.max(0, masterRef.current + dir * FRAME_STEP))
                setMaster(next)
                seekToMaster(next)
            } else if (k === 'j' || k === 'J') {
                e.preventDefault()
                skip(-SKIP_SECONDS)
            } else if (k === 'l' || k === 'L') {
                e.preventDefault()
                skip(SKIP_SECONDS)
            }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, tMax])

    const paneAnchors = useMemo(
        () => runs.map(r => buildSyncAnchors(r.checkpoints, refRun.checkpoints, r.capTime, refRun.capTime)),
        [runs, refRun],
    )
    const paneCpAnchors = useMemo(
        () => paneAnchors.map(a => a.filter(x => x.label !== 'SPAWN' && x.label !== 'CAP')),
        [paneAnchors],
    )

    const paneTicks = useMemo<ScrubTick[][]>(
        () => runs.map((r, i) => {
            const nudge = nudges[i] ?? 0
            return [
                ...paneCpAnchors[i].map(a => ({ t: a.aTime + nudge, isCap: false })),
                { t: r.capTime + nudge, isCap: true },
            ]
        }),
        [runs, paneCpAnchors, nudges],
    )

    const panes = runs.map((r, i) => {
        const nudge = nudges[i] ?? 0
        const vt = master - nudge
        const cp = paneCpAnchors[i]
        const idx = lastPassedIdx(cp.map(a => a.aTime), vt)
        const atCap = vt >= r.capTime - END_EPS
        const dur = durations[i] ?? null
        const ended = dur != null && vt >= dur - END_EPS
        const capDelta = r.capTime - refRun.capTime
        const label = atCap ? 'CAP' : idx < 0 ? 'SPAWN' : `CP${idx + 1}`
        const delta = atCap ? capDelta : idx < 0 ? null : cp[idx].aTime - cp[idx].bTime
        return { label, delta, ended, capDelta }
    })

    const lanes = useMemo<ScrubLane[]>(
        () => runs.map((r, i) => {
            const c = RUN_COLORS[i % RUN_COLORS.length]
            return {
                alias: r.alias ?? `Run ${i + 1}`,
                ticks: paneTicks[i],
                tickColor: c.tickColor,
                capColor: c.capColor,
                textColor: c.textColor,
            }
        }),
        [runs, paneTicks],
    )

    const showDeltaBar = n === 2
    const pairAnchors = useMemo(
        () => (showDeltaBar ? buildSyncAnchors(runs[0].checkpoints, runs[1].checkpoints, runs[0].capTime, runs[1].capTime) : []),
        [showDeltaBar, runs],
    )
    const deltaPoints = useMemo(() => {
        if (!showDeltaBar) return []
        const cp = pairAnchors.filter(a => a.label !== 'SPAWN' && a.label !== 'CAP')
        if (cp.length === 0) return []
        const nudge = nudges[0] ?? 0
        return pairAnchors.map(a => ({ x: a.aTime + nudge, delta: a.aTime - a.bTime }))
    }, [showDeltaBar, pairAnchors, nudges])

    const durationsReady = runs.every((_, i) => isFiniteDuration(durations[i]))
    const canPlay = !errors.some(Boolean) && durationsReady
    const maxHeight = paneMaxHeight(n)

    return (
        <Modal
            isOpen={open}
            onClose={onClose}
            title={`Replay Comparison — ${displayMapName(mapName)}`}
            offsetSidebar
            className="bg-card/98 border-hairline/5"
            maxWidth="min(95vw, 1500px)"
            footer={
                <div className="p-3 border-t border-border bg-muted/50 flex items-center justify-end shrink-0">
                    <div className="text-xs text-muted-foreground flex items-center">
                        Powered by{' '}
                        <a
                            href="https://democonverter.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-1 text-accent-400 hover:underline"
                        >
                            democonverter.com
                        </a>
                    </div>
                </div>
            }
        >
            <div className="flex flex-col gap-3">
                <div className={cn('grid gap-3', gridColsClass(n))}>
                    {runs.map((run, i) => (
                        <VideoPane
                            key={run.capId}
                            run={run}
                            color={RUN_COLORS[i % RUN_COLORS.length]}
                            isReference={i === refIndex}
                            capDelta={panes[i].capDelta}
                            cpLabel={panes[i].label}
                            delta={panes[i].delta}
                            ended={panes[i].ended}
                            error={errors[i] ?? false}
                            buffering={bufferings[i] ?? false}
                            muted={muteds[i] ?? true}
                            nudge={nudges[i] ?? 0}
                            maxHeight={maxHeight}
                            videoRefCb={el => { videoRefs.current[i] = el }}
                            onDurationKnown={() => onDurationKnown(i)}
                            onBufferingChange={b => setBuffering(i, b)}
                            onError={() => setError(i)}
                            onToggleMute={() => setMuteds(prev => {
                                const next = [...prev]
                                next[i] = !(next[i] ?? true)
                                return next
                            })}
                            onStepNudge={dir => stepNudge(i, dir)}
                            onSetNudge={v => setNudge(i, v)}
                            onResetNudge={() => setNudge(i, 0)}
                        />
                    ))}
                </div>

                <div className="flex flex-col items-center gap-1.5">
                    <div className="flex items-center gap-2">
                        <SkipButton dir={-1} seconds={SKIP_SECONDS} disabled={tMax <= 0} onSkip={skip} />
                        <Tooltip content={canPlay ? 'Play all from the cursor' : 'Preparing videos…'} side="top">
                            <button
                                type="button"
                                onClick={() => (playing ? stopPlay() : startPlay())}
                                disabled={!canPlay}
                                className={cn(
                                    'inline-flex items-center gap-2 h-9 px-5 rounded-md text-xs font-medium border transition-colors cursor-pointer',
                                    'bg-accent-500/15 border-accent-500/40 text-accent-200 hover:bg-accent-500/25',
                                    'disabled:opacity-40 disabled:cursor-default disabled:hover:bg-accent-500/15',
                                )}
                            >
                                {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
                                {playing ? 'Pause' : 'Play'}
                            </button>
                        </Tooltip>
                        <SkipButton dir={1} seconds={SKIP_SECONDS} disabled={tMax <= 0} onSkip={skip} />
                    </div>
                    <SpeedControl rate={rate} onRate={setRate} />
                </div>

                <CompareScrubber
                    master={master}
                    duration={tMax}
                    lanes={lanes}
                    onScrub={handleScrub}
                    onScrubStart={handleScrubStart}
                    onScrubEnd={handleScrubEnd}
                />

                {showDeltaBar && deltaPoints.length > 0 && (
                    <CompareDeltaBar
                        points={deltaPoints}
                        duration={tMax}
                        master={master}
                        onScrub={handleScrub}
                        onScrubStart={handleScrubStart}
                        onScrubEnd={handleScrubEnd}
                    />
                )}
            </div>
        </Modal>
    )
}

interface VideoPaneProps {
    run: CompareRun
    color: RunColor
    isReference: boolean
    capDelta: number
    cpLabel: string
    delta: number | null
    ended: boolean
    error: boolean
    buffering: boolean
    muted: boolean
    nudge: number
    maxHeight: string
    videoRefCb: (el: HTMLVideoElement | null) => void
    onDurationKnown: () => void
    onBufferingChange: (b: boolean) => void
    onError: () => void
    onToggleMute: () => void
    onStepNudge: (dir: number) => void
    onSetNudge: (v: number) => void
    onResetNudge: () => void
}

function VideoPane({
    run, color, isReference, capDelta, cpLabel, delta, ended, error, buffering, muted, nudge, maxHeight,
    videoRefCb, onDurationKnown, onBufferingChange, onError, onToggleMute, onStepNudge, onSetNudge, onResetNudge,
}: VideoPaneProps) {
    return (
        <div className="flex flex-col gap-2 min-w-0">
            <div className="flex items-center justify-between gap-2 min-w-0 min-h-10">
                <div className="flex items-center gap-1.5 min-w-0">
                    <span className={cn('size-2 rounded-full shrink-0', color.dot)} />
                    <PlayerInfo userId={run.userId} alias={run.alias} title={run.title} size="sm" />
                </div>
                <span className="shrink-0 flex items-baseline gap-1.5">
                    <span className="text-sm font-mono tabular-nums text-amber-300">{formatCapTime(run.capTime)}</span>
                    {!isReference && (
                        <span className={cn('text-xs font-mono tabular-nums', deltaClass(capDelta))}>
                            ({formatSignedDelta(capDelta)})
                        </span>
                    )}
                </span>
            </div>

            <div className="relative w-full bg-black rounded overflow-hidden">
                {error ? (
                    <div className="w-full aspect-video flex items-center justify-center text-center px-4 text-xs text-muted-foreground">
                        Couldn't load this replay. The video may still be processing. Try again later.
                    </div>
                ) : (
                    <>
                        <video
                            ref={videoRefCb}
                            key={run.url}
                            src={run.url}
                            muted={muted}
                            playsInline
                            preload="metadata"
                            controls={false}
                            onLoadedMetadata={onDurationKnown}
                            onDurationChange={onDurationKnown}
                            onLoadedData={onDurationKnown}
                            onSeeking={() => onBufferingChange(true)}
                            onWaiting={() => onBufferingChange(true)}
                            onSeeked={() => onBufferingChange(false)}
                            onPlaying={() => onBufferingChange(false)}
                            onCanPlay={() => onBufferingChange(false)}
                            onError={onError}
                            style={{ maxHeight }}
                            className="w-full object-contain bg-black"
                        />
                        {ended && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black text-muted-foreground">
                                <Flag className="size-5 text-emerald-300" />
                                <span className="text-xs">Capped: {formatCapTime(run.capTime)}</span>
                            </div>
                        )}
                        {buffering && !ended && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
                                <Loader2 className="size-6 animate-spin text-foreground/70" />
                            </div>
                        )}
                    </>
                )}
            </div>

            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground min-w-0">
                    <span className="truncate">{ended ? 'Capped' : cpLabel}</span>
                    {delta != null && (
                        <span className={cn('font-mono tabular-nums normal-case', deltaClass(delta))}>
                            ({formatSignedDelta(delta)})
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                    <MuteButton muted={muted} onToggle={onToggleMute} who={run.alias ?? 'this run'} />
                    <div className="flex items-center gap-1">
                        <NudgeButton onStep={() => onStepNudge(-1)} aria="Nudge earlier (hold to repeat)">
                            <Minus className="size-3" />
                        </NudgeButton>
                        <NudgeInput value={nudge} onCommit={onSetNudge} />
                        <NudgeButton onStep={() => onStepNudge(1)} aria="Nudge later (hold to repeat)">
                            <Plus className="size-3" />
                        </NudgeButton>
                        <NudgeButton
                            onStep={onResetNudge}
                            repeat={false}
                            aria="Reset sync"
                            className={cn(nudge === 0 && 'invisible')}
                        >
                            <RotateCcw className="size-3" />
                        </NudgeButton>
                    </div>
                </div>
            </div>
        </div>
    )
}

function MuteButton({ muted, onToggle, who }: { muted: boolean; onToggle: () => void; who: string }) {
    return (
        <Tooltip content={`${muted ? 'Unmute' : 'Mute'} ${who}`} side="top">
            <button
                type="button"
                onClick={onToggle}
                aria-label={`${muted ? 'Unmute' : 'Mute'} ${who}`}
                className={cn(
                    'inline-flex items-center justify-center size-8 rounded-md border transition-colors cursor-pointer',
                    muted
                        ? 'bg-hairline/[0.03] border-hairline/10 text-muted-foreground hover:text-foreground hover:border-hairline/20'
                        : 'bg-accent-500/20 border-accent-500/50 text-accent-100 hover:bg-accent-500/30',
                )}
            >
                {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
            </button>
        </Tooltip>
    )
}

function SkipButton({ dir, seconds, disabled, onSkip }: {
    dir: 1 | -1
    seconds: number
    disabled: boolean
    onSkip: (sec: number) => void
}) {
    const Icon = dir < 0 ? ChevronsLeft : ChevronsRight
    const label = dir < 0 ? `Back ${seconds}s (J)` : `Forward ${seconds}s (L)`
    return (
        <Tooltip content={label} side="top">
            <button
                type="button"
                onClick={() => onSkip(dir * seconds)}
                disabled={disabled}
                aria-label={label}
                className={cn(
                    'inline-flex items-center justify-center gap-0.5 h-9 px-2.5 rounded-md border transition-colors cursor-pointer',
                    'bg-hairline/[0.03] border-hairline/10 text-muted-foreground hover:text-foreground hover:border-hairline/20',
                    'disabled:opacity-40 disabled:cursor-default disabled:hover:text-muted-foreground disabled:hover:border-hairline/10',
                )}
            >
                {dir < 0 && <Icon className="size-3.5" />}
                <span className="text-[11px] font-mono tabular-nums">{seconds}</span>
                {dir > 0 && <Icon className="size-3.5" />}
            </button>
        </Tooltip>
    )
}

function SpeedControl({ rate, onRate }: { rate: number; onRate: (r: number) => void }) {
    return (
        <div className="inline-flex items-center gap-0.5 rounded-md border border-hairline/10 bg-hairline/[0.03] p-0.5">
            {RATES.map(r => (
                <button
                    key={r}
                    type="button"
                    onClick={() => onRate(r)}
                    aria-pressed={rate === r}
                    aria-label={`Playback speed ${r}×`}
                    className={cn(
                        'px-2 h-6 rounded text-[11px] font-mono tabular-nums transition-colors cursor-pointer',
                        rate === r
                            ? 'bg-accent-500/25 text-accent-100'
                            : 'text-muted-foreground hover:text-foreground',
                    )}
                >
                    {r}×
                </button>
            ))}
        </div>
    )
}

function NudgeInput({ value, onCommit }: { value: number; onCommit: (n: number) => void }) {
    const [text, setText] = useState(() => value.toFixed(2))
    const focusedRef = useRef(false)

    useEffect(() => {
        if (!focusedRef.current) setText(value.toFixed(2))
    }, [value])

    const commit = () => {
        const n = Number(text)
        if (Number.isFinite(n)) onCommit(n)
        else setText(value.toFixed(2))
    }

    return (
        <span className="inline-flex items-baseline gap-0.5 font-mono tabular-nums text-foreground/80">
            <span aria-hidden className="invisible select-none">s</span>
            <input
                type="text"
                inputMode="decimal"
                value={text}
                onFocus={e => { focusedRef.current = true; e.currentTarget.select() }}
                onChange={e => setText(e.target.value)}
                onBlur={() => { focusedRef.current = false; commit() }}
                onKeyDown={e => {
                    if (e.key === 'Enter') e.currentTarget.blur()
                    else if (e.key === 'Escape') { setText(value.toFixed(2)); e.currentTarget.blur() }
                }}
                aria-label="Sync offset in seconds"
                className="w-16 bg-transparent text-center tabular-nums outline-none rounded border border-hairline/10 hover:border-hairline/20 focus:border-accent-400/60 transition-colors py-px"
            />
            <span>s</span>
        </span>
    )
}

function NudgeButton({ onStep, aria, repeat = true, className, children }: {
    onStep: () => void
    aria: string
    repeat?: boolean
    className?: string
    children: React.ReactNode
}) {
    const timerRef = useRef<number | null>(null)
    const delayRef = useRef(300)

    const stop = () => {
        if (timerRef.current != null) { window.clearTimeout(timerRef.current); timerRef.current = null }
    }
    useEffect(() => stop, [])

    const start = () => {
        onStep()
        if (!repeat) return
        delayRef.current = 300
        const tick = () => {
            onStep()
            delayRef.current = Math.max(40, delayRef.current * 0.82)
            timerRef.current = window.setTimeout(tick, delayRef.current)
        }
        timerRef.current = window.setTimeout(tick, delayRef.current)
    }

    return (
        <button
            type="button"
            aria-label={aria}
            onPointerDown={e => { e.preventDefault(); start() }}
            onPointerUp={stop}
            onPointerLeave={stop}
            onPointerCancel={stop}
            className={cn(
                'inline-flex items-center justify-center size-5 rounded border border-hairline/10 bg-hairline/[0.03] text-muted-foreground hover:text-foreground hover:border-hairline/20 transition-colors cursor-pointer touch-none select-none',
                className,
            )}
        >
            {children}
        </button>
    )
}
