import { useEffect, useMemo, useRef, useState } from 'react'
import { Play, Pause, Minus, Plus, RotateCcw, Loader2, Flag, Volume2, VolumeX } from 'lucide-react'
import { Modal } from '@/app/components/ui/modal'
import { Tooltip } from '@/app/components/ui/tooltip'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { formatCapTime, displayMapName } from '@/app/utils/format'
import { cn } from '@/lib/utils'
import type { ActiveTitle, CapCheckpoint } from '@/app/utils/api'
import { buildSyncAnchors, formatSignedDelta, deltaClass } from '@/app/components/pages/capDetail/capStats'
import { CompareScrubber, type ScrubTick } from './CompareScrubber'
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
    runA: CompareRun
    runB: CompareRun
}

const NUDGE_STEP = 0.1
const END_EPS = 0.06
const FRAME_STEP = 1 / 30

function isFiniteDuration(d: number | undefined | null): d is number {
    return d != null && Number.isFinite(d) && d > 0
}

function lastPassedIdx(cpTimes: number[], vt: number): number {
    let idx = -1
    for (let i = 0; i < cpTimes.length; i++) if (cpTimes[i] <= vt) idx = i
    return idx
}

export function VideoCompareModal({ open, onClose, mapName, runA, runB }: VideoCompareModalProps) {
    const videoARef = useRef<HTMLVideoElement>(null)
    const videoBRef = useRef<HTMLVideoElement>(null)
    const rafRef = useRef<number | null>(null)
    const nudgeARef = useRef(0)
    const nudgeBRef = useRef(0)
    const masterRef = useRef(0)

    const [playing, setPlaying] = useState(false)
    const [master, setMasterState] = useState(0)
    const [nudgeA, setNudgeAState] = useState(0)
    const [nudgeB, setNudgeBState] = useState(0)
    const [errorA, setErrorA] = useState(false)
    const [errorB, setErrorB] = useState(false)
    const [bufferingA, setBufferingA] = useState(false)
    const [bufferingB, setBufferingB] = useState(false)
    const [durationA, setDurationA] = useState<number | null>(null)
    const [durationB, setDurationB] = useState<number | null>(null)
    const [mutedA, setMutedA] = useState(true)
    const [mutedB, setMutedB] = useState(true)

    const setMaster = (t: number) => { masterRef.current = t; setMasterState(t) }

    const tMax = Math.max(durationA ?? 0, durationB ?? 0)

    const seekVideo = (video: HTMLVideoElement | null, nudge: number, T: number) => {
        if (!video) return
        const dur = video.duration
        const target = T - nudge
        const hi = isFiniteDuration(dur) ? dur : Math.max(0, target)
        video.currentTime = Math.min(hi, Math.max(0, target))
    }
    const seekToMaster = (T: number) => {
        seekVideo(videoARef.current, nudgeARef.current, T)
        seekVideo(videoBRef.current, nudgeBRef.current, T)
    }

    const onDurationKnown = (video: HTMLVideoElement | null, setDuration: (d: number | null) => void) => {
        if (!video) return
        setDuration(isFiniteDuration(video.duration) ? video.duration : null)
        if (!playing) seekToMaster(masterRef.current)
    }

    const stopPlay = () => {
        if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
        rafRef.current = null
        videoARef.current?.pause()
        videoBRef.current?.pause()
        setPlaying(false)
    }

    const startPlay = () => {
        const va = videoARef.current, vb = videoBRef.current
        if (!va || !vb || errorA || errorB) return
        if (!isFiniteDuration(va.duration) || !isFiniteDuration(vb.duration)) return
        seekToMaster(masterRef.current)
        setPlaying(true)
        va.play().catch(() => {})
        vb.play().catch(() => {})
        const loop = () => {
            const a = videoARef.current, b = videoBRef.current
            const ta = a ? a.currentTime + nudgeARef.current : -Infinity
            const tb = b ? b.currentTime + nudgeBRef.current : -Infinity
            setMaster(Math.max(0, ta, tb))
            const aEnded = !a || a.ended || (isFiniteDuration(a.duration) && a.currentTime >= a.duration - END_EPS)
            const bEnded = !b || b.ended || (isFiniteDuration(b.duration) && b.currentTime >= b.duration - END_EPS)
            if (aEnded && bEnded) { stopPlay(); return }
            rafRef.current = requestAnimationFrame(loop)
        }
        rafRef.current = requestAnimationFrame(loop)
    }

    const handleScrubStart = () => { if (playing) stopPlay() }
    const handleScrub = (t: number) => { setMaster(t); seekToMaster(t) }
    const handleScrubEnd = () => { seekToMaster(masterRef.current) }

    const applyNudge = (
        ref: React.MutableRefObject<number>,
        setState: (n: number) => void,
        v: number,
    ) => {
        const clamped = Math.round(Math.min(10, Math.max(-10, v)) * 100) / 100
        ref.current = clamped
        setState(clamped)
        if (!playing) seekToMaster(masterRef.current)
    }
    const setNudgeA = (v: number) => applyNudge(nudgeARef, setNudgeAState, v)
    const setNudgeB = (v: number) => applyNudge(nudgeBRef, setNudgeBState, v)
    const stepNudgeA = (dir: number) => applyNudge(nudgeARef, setNudgeAState, nudgeARef.current + dir * NUDGE_STEP)
    const stepNudgeB = (dir: number) => applyNudge(nudgeBRef, setNudgeBState, nudgeBRef.current + dir * NUDGE_STEP)

    useEffect(() => {
        if (!open) return
        setPlaying(false)
        setMaster(0)
        nudgeARef.current = 0; setNudgeAState(0)
        nudgeBRef.current = 0; setNudgeBState(0)
        setErrorA(false); setErrorB(false)
        setBufferingA(false); setBufferingB(false)
        setDurationA(null); setDurationB(null)
        setMutedA(true); setMutedB(true)
    }, [open, runA.capId, runB.capId])

    useEffect(() => { if (videoARef.current) videoARef.current.muted = mutedA }, [mutedA])
    useEffect(() => { if (videoBRef.current) videoBRef.current.muted = mutedB }, [mutedB])

    useEffect(() => () => {
        if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
        videoARef.current?.pause()
        videoBRef.current?.pause()
    }, [])

    useEffect(() => {
        if (!open) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
            const t = e.target as HTMLElement | null
            if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
            if (tMax <= 0) return
            e.preventDefault()
            if (rafRef.current != null) stopPlay()
            const dir = e.key === 'ArrowRight' ? 1 : -1
            const next = Math.min(tMax, Math.max(0, masterRef.current + dir * FRAME_STEP))
            setMaster(next)
            seekToMaster(next)
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, tMax])

    const anchors = useMemo(
        () => buildSyncAnchors(runA.checkpoints, runB.checkpoints, runA.capTime, runB.capTime),
        [runA.checkpoints, runB.checkpoints, runA.capTime, runB.capTime],
    )
    const cpAnchors = useMemo(() => anchors.filter(a => a.label !== 'SPAWN' && a.label !== 'CAP'), [anchors])
    const deltaPoints = useMemo(
        () => cpAnchors.length === 0 ? [] : anchors.map(a => ({ x: a.aTime + nudgeA, delta: a.aTime - a.bTime })),
        [anchors, cpAnchors, nudgeA],
    )
    const aTimes = useMemo(() => cpAnchors.map(a => a.aTime), [cpAnchors])
    const bTimes = useMemo(() => cpAnchors.map(a => a.bTime), [cpAnchors])
    const ticksA = useMemo<ScrubTick[]>(
        () => [...cpAnchors.map(a => ({ t: a.aTime + nudgeA, isCap: false })), { t: runA.capTime + nudgeA, isCap: true }],
        [cpAnchors, runA.capTime, nudgeA],
    )
    const ticksB = useMemo<ScrubTick[]>(
        () => [...cpAnchors.map(a => ({ t: a.bTime + nudgeB, isCap: false })), { t: runB.capTime + nudgeB, isCap: true }],
        [cpAnchors, runB.capTime, nudgeB],
    )

    const vtA = master - nudgeA
    const vtB = master - nudgeB
    const endedA = durationA != null && vtA >= durationA - END_EPS
    const endedB = durationB != null && vtB >= durationB - END_EPS

    const deltas = useMemo(() => cpAnchors.map(a => a.aTime - a.bTime), [cpAnchors])
    const idxA = lastPassedIdx(aTimes, vtA)
    const idxB = lastPassedIdx(bTimes, vtB)
    const atCapA = vtA >= runA.capTime - END_EPS
    const atCapB = vtB >= runB.capTime - END_EPS
    const capDelta = runA.capTime - runB.capTime
    const labelA = atCapA ? 'CAP' : idxA < 0 ? 'SPAWN' : `CP${idxA + 1}`
    const labelB = atCapB ? 'CAP' : idxB < 0 ? 'SPAWN' : `CP${idxB + 1}`
    const deltaA = atCapA ? capDelta : idxA < 0 ? null : deltas[idxA]
    const deltaB = atCapB ? -capDelta : idxB < 0 ? null : -deltas[idxB]

    const durationsReady = isFiniteDuration(durationA) && isFiniteDuration(durationB)
    const canPlay = !errorA && !errorB && durationsReady

    return (
        <Modal
            isOpen={open}
            onClose={onClose}
            title={`Replay Comparison — ${displayMapName(mapName)}`}
            offsetSidebar
            className="bg-[#0a0a0b]/98 border-white/5"
            maxWidth="min(95vw, 1500px)"
            footer={
                <div className="p-3 border-t border-border bg-muted/50 flex items-center justify-end shrink-0">
                    <div className="text-xs text-muted-foreground flex items-center">
                        Powered by{' '}
                        <a
                            href="https://democonverter.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-1 text-blue-400 hover:underline"
                        >
                            democonverter.com
                        </a>
                    </div>
                </div>
            }
        >
            <div className="flex flex-col gap-3">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <VideoPane
                        run={runA} videoRef={videoARef} error={errorA} buffering={bufferingA} ended={endedA}
                        totalDelta={capDelta} muted={mutedA}
                        onDurationKnown={() => onDurationKnown(videoARef.current, setDurationA)}
                        onBufferingChange={setBufferingA}
                        onError={() => setErrorA(true)}
                    />
                    <VideoPane
                        run={runB} videoRef={videoBRef} error={errorB} buffering={bufferingB} ended={endedB}
                        totalDelta={-capDelta} muted={mutedB}
                        onDurationKnown={() => onDurationKnown(videoBRef.current, setDurationB)}
                        onBufferingChange={setBufferingB}
                        onError={() => setErrorB(true)}
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                    <PaneControls
                        cpText={labelA} delta={deltaA} ended={endedA}
                        nudge={nudgeA} onStep={stepNudgeA} onReset={() => setNudgeA(0)}
                    />
                    <div className="flex items-center gap-2">
                        <MuteButton muted={mutedA} onToggle={() => setMutedA(m => !m)} who={runA.alias ?? 'this run'} />
                        <Tooltip
                            content={canPlay ? 'Play both at real speed from the cursor' : 'Preparing videos…'}
                            side="top"
                        >
                            <button
                                type="button"
                                onClick={() => (playing ? stopPlay() : startPlay())}
                                disabled={!canPlay}
                                className={cn(
                                    'inline-flex items-center gap-2 h-9 px-5 rounded-md text-xs font-medium border transition-colors cursor-pointer',
                                    'bg-blue-500/15 border-blue-500/40 text-blue-200 hover:bg-blue-500/25',
                                    'disabled:opacity-40 disabled:cursor-default disabled:hover:bg-blue-500/15',
                                )}
                            >
                                {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
                                {playing ? 'Pause' : 'Play'}
                            </button>
                        </Tooltip>
                        <MuteButton muted={mutedB} onToggle={() => setMutedB(m => !m)} who={runB.alias ?? 'baseline'} />
                    </div>
                    <PaneControls
                        cpText={labelB} delta={deltaB} ended={endedB}
                        nudge={nudgeB} onStep={stepNudgeB} onReset={() => setNudgeB(0)}
                    />
                </div>

                <CompareScrubber
                    master={master}
                    duration={tMax}
                    ticksA={ticksA}
                    ticksB={ticksB}
                    onScrub={handleScrub}
                    onScrubStart={handleScrubStart}
                    onScrubEnd={handleScrubEnd}
                    aliasA={runA.alias ?? 'This run'}
                    aliasB={runB.alias ?? 'Baseline'}
                />

                {deltaPoints.length > 0 && (
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
            </div>
        </Modal>
    )
}

interface VideoPaneProps {
    run: CompareRun
    videoRef: React.RefObject<HTMLVideoElement | null>
    error: boolean
    buffering: boolean
    ended: boolean
    totalDelta: number
    muted: boolean
    onDurationKnown: () => void
    onBufferingChange: (b: boolean) => void
    onError: () => void
}

function VideoPane({
    run, videoRef, error, buffering, ended, totalDelta, muted,
    onDurationKnown, onBufferingChange, onError,
}: VideoPaneProps) {
    return (
        <div className="flex flex-col gap-2 min-w-0">
            <div className="flex items-center justify-between gap-2 min-w-0 min-h-10">
                <PlayerInfo userId={run.userId} alias={run.alias} title={run.title} size="sm" />
                <span className="shrink-0 flex items-baseline gap-1.5">
                    <span className="text-sm font-mono tabular-nums text-amber-300">{formatCapTime(run.capTime)}</span>
                    <span className={cn('text-xs font-mono tabular-nums', deltaClass(totalDelta))}>
                        ({formatSignedDelta(totalDelta)})
                    </span>
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
                            ref={videoRef}
                            key={run.url}
                            src={run.url}
                            muted={muted}
                            playsInline
                            preload="auto"
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
                            className="w-full max-h-[38vh] object-contain bg-black"
                        />
                        {ended && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black text-muted-foreground">
                                <Flag className="size-5 text-emerald-300" />
                                <span className="text-xs">Capped: {formatCapTime(run.capTime)}</span>
                            </div>
                        )}
                        {buffering && !ended && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
                                <Loader2 className="size-6 animate-spin text-white/70" />
                            </div>
                        )}
                    </>
                )}
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
                    'inline-flex items-center justify-center size-9 rounded-md border transition-colors cursor-pointer',
                    muted
                        ? 'bg-white/[0.03] border-white/10 text-muted-foreground hover:text-white hover:border-white/20'
                        : 'bg-blue-500/20 border-blue-500/50 text-blue-100 hover:bg-blue-500/30',
                )}
            >
                {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
            </button>
        </Tooltip>
    )
}

interface PaneControlsProps {
    cpText: string
    delta: number | null
    ended: boolean
    nudge: number
    onStep: (dir: number) => void
    onReset: () => void
}

function PaneControls({ cpText, delta, ended, nudge, onStep, onReset }: PaneControlsProps) {
    return (
        <div className="flex flex-col items-center gap-1.5">
            <div className="flex items-center justify-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                <span>{ended ? 'Capped' : cpText}</span>
                {delta != null && (
                    <span className={cn('font-mono tabular-nums normal-case', deltaClass(delta))}>
                        ({formatSignedDelta(delta)})
                    </span>
                )}
            </div>
            <div className="flex flex-col items-center gap-1 text-[10px] text-muted-foreground">
                <span className="uppercase tracking-wider text-muted-foreground/70">sync</span>
                <div className="flex items-center gap-1.5">
                    <NudgeButton onStep={() => onStep(-1)} aria="Nudge earlier (hold to repeat)">
                        <Minus className="size-3" />
                    </NudgeButton>
                    <span className="font-mono tabular-nums w-14 text-center text-white/80">
                        {nudge > 0 ? '+' : nudge < 0 ? '−' : '±'}{Math.abs(nudge).toFixed(2)}s
                    </span>
                    <NudgeButton onStep={() => onStep(1)} aria="Nudge later (hold to repeat)">
                        <Plus className="size-3" />
                    </NudgeButton>
                </div>
                <NudgeButton
                    onStep={onReset}
                    repeat={false}
                    aria="Reset sync"
                    className={cn('mt-0.5', nudge === 0 && 'invisible')}
                >
                    <RotateCcw className="size-3" />
                </NudgeButton>
            </div>
        </div>
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
                'inline-flex items-center justify-center size-5 rounded border border-white/10 bg-white/[0.03] text-muted-foreground hover:text-white hover:border-white/20 transition-colors cursor-pointer touch-none select-none',
                className,
            )}
        >
            {children}
        </button>
    )
}
