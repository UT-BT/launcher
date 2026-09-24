import type { ReactNode } from 'react'
import { AlertTriangle, Check, Loader2, Lock, WifiOff, X, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { displayMapName } from '@/app/utils/format'
import type { PickBanActor, PickBanStepAction } from '@/app/utils/api'
import type { CaptainControls, CaptainDock as CaptainDockModel } from '../captainPlay'
import type { PickBanTurn } from '../pickBanView'
import { CountdownBar, CountdownText } from './Countdown'
import { PICK_BAN_TONES, stepTone, teamTone, type PickBanToneClasses } from './pickBanTone'

interface CaptainDockProps {
    dock: CaptainDockModel
    ab: PickBanActor | null
    reconnecting: boolean
    actingFor?: string
    onLockIn: () => void
    onToggleReady?: () => void
    onDismiss: () => void
    className?: string
}

const BUTTON = 'inline-flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-bold transition-colors sm:w-44'

const LOCKED_BUTTON = cn(BUTTON, 'cursor-not-allowed border-hairline/10 bg-hairline/5 text-muted-foreground')

const LOCKED_EYEBROW: Record<Extract<CaptainControls, { kind: 'locked' }>['reason'], string> = {
    intro: 'Starting',
    spotlight: 'Revealing',
    paused: 'Paused',
}

function stepLabel(action: PickBanStepAction, mapNumber: number | null): string {
    if (action === 'ban') return 'Ban a map'
    return mapNumber === null ? 'Pick a map' : `Pick map ${mapNumber}`
}

function upNext(next: PickBanTurn | null): string {
    if (!next) return 'The first step is coming up'
    if (next.viewerActs) return `You’re up: ${stepLabel(next.action, next.mapNumber).toLowerCase()}`
    return `Up next: ${next.actionLabel}`
}

export function CaptainDock({ dock, ab, reconnecting, actingFor, onLockIn, onToggleReady, onDismiss, className }: CaptainDockProps) {
    const tone = PICK_BAN_TONES[teamTone(ab)]

    return (
        <section
            aria-label={actingFor ? `Acting for ${actingFor}` : 'Your team’s controls'}
            className={cn('sticky bottom-3 z-20 flex flex-col gap-3 rounded-xl border bg-card p-3 shadow-lg shadow-black/30 sm:p-4', tone.line, className)}
        >
            {dock.rejection && <Rejection message={dock.rejection} onDismiss={onDismiss} />}
            {dock.controls && <Controls controls={dock.controls} tone={tone} actingFor={actingFor} onLockIn={onLockIn} onToggleReady={onToggleReady} />}
            {reconnecting && (
                <p role="status" className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-300">
                    <WifiOff className="size-3.5" />
                    Reconnecting… your controls may be out of date.
                </p>
            )}
        </section>
    )
}

export function Rejection({ message, onDismiss }: { message: string; onDismiss: () => void }) {
    return (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p className="min-w-0 flex-1 break-words">{message}</p>
            <button
                type="button"
                onClick={onDismiss}
                aria-label="Dismiss"
                className="-m-1 shrink-0 cursor-pointer rounded-md p-1 transition-colors hover:bg-red-500/25 hover:text-red-200"
            >
                <X className="size-4" />
            </button>
        </div>
    )
}

function Controls({ controls, tone, actingFor, onLockIn, onToggleReady }: {
    controls: CaptainControls
    tone: PickBanToneClasses
    actingFor?: string
    onLockIn: () => void
    onToggleReady?: () => void
}) {
    switch (controls.kind) {
        case 'ready':
            return (
                <ControlRow
                    eyebrow={<Eyebrow className="text-muted-foreground">Lobby</Eyebrow>}
                    title={controls.ready ? 'Your team is ready' : 'Ready up when your team is set'}
                    detail="An admin starts the pick/ban once both teams are here."
                    action={
                        <button
                            type="button"
                            onClick={onToggleReady}
                            disabled={controls.busy}
                            aria-pressed={controls.ready}
                            className={cn(
                                BUTTON,
                                'cursor-pointer disabled:cursor-wait disabled:opacity-70',
                                controls.ready
                                    ? 'border-hairline/10 bg-card/50 text-muted-foreground hover:border-hairline/20 hover:text-foreground'
                                    : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:border-emerald-500/50 hover:bg-emerald-500/25 hover:text-emerald-200',
                            )}
                        >
                            {controls.busy ? <Loader2 className="size-4 animate-spin" /> : !controls.ready && <Check className="size-4" />}
                            {controls.ready ? 'Unready' : 'Ready'}
                        </button>
                    }
                />
            )
        case 'choose':
            return (
                <ControlRow
                    eyebrow={<Eyebrow className={tone.text}>{actingFor ? `Acting for ${actingFor}` : 'Your turn'}</Eyebrow>}
                    title={stepLabel(controls.action, controls.mapNumber)}
                    detail={controls.selectedMap
                        ? <>Selected: <span className="font-semibold text-foreground">{displayMapName(controls.selectedMap)}</span></>
                        : 'Select a map in the pool, then lock it in.'}
                    action={
                        <button
                            type="button"
                            onClick={onLockIn}
                            disabled={!controls.canLockIn}
                            className={cn(
                                BUTTON,
                                'border-transparent',
                                tone.solid,
                                tone.onSolid,
                                'cursor-pointer hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:brightness-100',
                            )}
                        >
                            <Lock className="size-4" />
                            Lock in
                        </button>
                    }
                />
            )
        case 'locked_in':
            return (
                <ControlRow
                    eyebrow={<Eyebrow className="text-emerald-300">Locked in</Eyebrow>}
                    title={controls.map ? displayMapName(controls.map) : 'Your choice is in'}
                    detail="Everyone sees it revealed in a moment."
                    action={<LockedButton icon={Check} label="Locked in" />}
                />
            )
        case 'locked':
            return (
                <ControlRow
                    eyebrow={
                        <Eyebrow className="text-muted-foreground">
                            {LOCKED_EYEBROW[controls.reason]}
                            {controls.countdown && (
                                <>
                                    <span aria-hidden> · </span>
                                    <CountdownText countdown={controls.countdown} className="text-foreground" />
                                </>
                            )}
                        </Eyebrow>
                    }
                    title={upNext(controls.next)}
                    detail={controls.reason === 'paused'
                        ? 'Controls unlock when an admin resumes.'
                        : controls.next?.viewerActs ? 'Your controls unlock when the countdown ends.' : 'Controls are locked until then.'}
                    bar={controls.countdown && <CountdownBar countdown={controls.countdown} tone={controls.next ? stepTone(controls.next.ab) : 'neutral'} />}
                    action={<LockedButton icon={Lock} label="Locked" />}
                />
            )
        case 'waiting':
            return (
                <ControlRow
                    eyebrow={<Eyebrow className="text-muted-foreground">Waiting</Eyebrow>}
                    title={controls.turn.actionLabel}
                    detail="Your controls unlock on your turn."
                    action={<LockedButton icon={Lock} label="Locked" />}
                />
            )
    }
}

function Eyebrow({ className, children }: { className?: string; children: ReactNode }) {
    return <p className={cn('flex items-center text-[10px] font-bold uppercase tracking-wider', className)}>{children}</p>
}

function ControlRow({ eyebrow, title, detail, bar, action }: {
    eyebrow: ReactNode
    title: string
    detail: ReactNode
    bar?: ReactNode
    action: ReactNode
}) {
    return (
        <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1 basis-56 space-y-1">
                {eyebrow}
                <p aria-live="polite" className="break-words text-base font-bold leading-tight text-foreground">{title}</p>
                <p className="text-xs text-muted-foreground">{detail}</p>
                {bar}
            </div>
            {action}
        </div>
    )
}

function LockedButton({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
    return (
        <button type="button" disabled className={LOCKED_BUTTON}>
            <Icon className="size-4" />
            {label}
        </button>
    )
}
