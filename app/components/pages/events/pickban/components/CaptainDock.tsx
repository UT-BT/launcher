import { useState, type ReactNode } from 'react'
import { AlertTriangle, Check, Lock, WifiOff, X, type LucideIcon } from 'lucide-react'
import { Spinner } from '@/app/components/ui/spinner'
import { cn } from '@/lib/utils'
import { displayMapName } from '@/app/utils/format'
import type { PickBanActor, PickBanStepAction, SideColor, VetoChoice } from '@/app/utils/api'
import { sideColorName, sideColorTitle, sideColorTone } from '@/app/utils/sideLabels'
import type { CaptainControls, CaptainDock as CaptainDockModel } from '../captainPlay'
import { actionTagOf, type PickBanCountdown, type PickBanSideCardView, type PickBanSideView, type PickBanTurn, type PickBanVetoView } from '../pickBanView'
import { CountdownBar, CountdownText } from './Countdown'
import { YoureSide } from './YoureSide'
import { PICK_BAN_TONES, stepTone, teamTone, type PickBanToneClasses } from '@/app/components/broadcast/broadcastTone'

interface CaptainDockProps {
    dock: CaptainDockModel
    ab: PickBanActor | null
    reconnecting: boolean
    actingFor?: string
    onLockIn: () => void
    onToggleReady?: () => void
    side?: PickBanSideView
    choosingSide?: SideColor | null
    onChooseSide?: (color: SideColor) => void
    veto?: PickBanVetoView
    vetoCountdown?: PickBanCountdown | null
    choosingVeto?: VetoChoice | null
    onVeto?: (choice: VetoChoice) => void
    onDismiss: () => void
    className?: string
}

const BUTTON = 'inline-flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-lg border px-4 font-pickban text-lg font-black italic uppercase tracking-wide transition-colors sm:w-48'

const LOCKED_BUTTON = cn(BUTTON, 'cursor-not-allowed border-hairline/10 bg-hairline/5 text-muted-foreground')

const PLAIN_SIDE_CARDS: PickBanSideCardView[] = [
    { color: 'red', letter: 'A', title: sideColorTitle('red'), lead: 'Acts first', steps: [] },
    { color: 'blue', letter: 'B', title: sideColorTitle('blue'), lead: 'Acts second', steps: [] },
]

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
    return `Next: ${actionTagOf(next)}`
}

export function CaptainDock({
    dock,
    ab,
    reconnecting,
    actingFor,
    onLockIn,
    onToggleReady,
    side,
    choosingSide = null,
    onChooseSide,
    veto,
    vetoCountdown = null,
    choosingVeto = null,
    onVeto,
    onDismiss,
    className,
}: CaptainDockProps) {
    const tone = PICK_BAN_TONES[teamTone(ab)]

    return (
        <section
            aria-label={actingFor === undefined ? 'Your team’s controls' : 'Act for a team'}
            className={cn('sticky bottom-3 z-20 isolate flex flex-col gap-3 overflow-hidden rounded-2xl border bg-card p-3 shadow-lg shadow-black/30 sm:p-4', tone.line, className)}
        >
            <span aria-hidden className={cn('absolute inset-0 -z-10 bg-gradient-to-r to-transparent to-70%', tone.wash)} />
            {dock.rejection && <Rejection message={dock.rejection} onDismiss={onDismiss} />}
            {veto && <VetoStep veto={veto} countdown={vetoCountdown} choosing={choosingVeto} onChoose={onVeto} />}
            {side && <SideStep side={side} choosing={choosingSide} onChoose={onChooseSide} />}
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
                    detail="An admin starts the Picks & Bans process once both teams are here."
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
                            {controls.busy ? <Spinner className="size-4" /> : !controls.ready && <Check className="size-4" />}
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
                            Lock In
                        </button>
                    }
                />
            )
        case 'locked_in':
            return (
                <ControlRow
                    eyebrow={<Eyebrow className="text-emerald-300">Locked In</Eyebrow>}
                    title={controls.map ? displayMapName(controls.map) : 'Your choice is in'}
                    detail="This will be revealed to everyone shortly…"
                    action={<LockedButton icon={Check} label="Locked In" />}
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
                    detail={actingFor === undefined ? 'Your controls unlock on your turn.' : 'Nothing to act for right now.'}
                    action={<LockedButton icon={Lock} label="Locked" />}
                />
            )
    }
}

const VETO_TONE = PICK_BAN_TONES.gold

function vetoDetail(veto: PickBanVetoView): string {
    if (veto.viewerChoice === 'play') return `You chose to play the ${veto.tag} maps. One veto is enough to remove them.`
    return `A veto removes the ${veto.maps.length} ${veto.tag} maps and leaves ${veto.poolSizes.vetoed}; otherwise all ${veto.poolSizes.played} are played.`
}

function VetoStep({ veto, countdown, choosing, onChoose }: {
    veto: PickBanVetoView
    countdown: PickBanCountdown | null
    choosing: VetoChoice | null
    onChoose?: (choice: VetoChoice) => void
}) {
    if (veto.phase === 'veto_choice' && veto.canVeto && onChoose) return <VetoChoiceCards veto={veto} choosing={choosing} onChoose={onChoose} />
    if (veto.phase === 'veto_choice' && veto.viewerChooses) {
        return (
            <ControlRow
                eyebrow={<Eyebrow className="text-muted-foreground">{veto.tag} maps</Eyebrow>}
                title={`Veto or play the ${veto.tag} maps`}
                detail="Your choice unlocks when an admin resumes."
                action={<LockedButton icon={Lock} label="Locked" />}
            />
        )
    }
    if (veto.phase === 'veto_choice') {
        return (
            <ControlRow
                eyebrow={<Eyebrow className="text-muted-foreground">{veto.tag} maps</Eyebrow>}
                title={veto.waiting ?? `Deciding on the ${veto.tag} maps`}
                detail={vetoDetail(veto)}
                action={<LockedButton icon={veto.viewerChoice ? Check : Lock} label={veto.viewerChoice ? 'Locked In' : 'Locked'} />}
            />
        )
    }
    if (veto.phase === 'veto_spotlight' && veto.reveal) {
        return (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-hairline/10 pb-3">
                <Eyebrow className="text-muted-foreground">
                    {veto.tag} maps
                    {countdown && (
                        <>
                            <span aria-hidden> · </span>
                            <CountdownText countdown={countdown} className="text-foreground" />
                        </>
                    )}
                </Eyebrow>
                <p aria-live="polite" className={cn('min-w-0 break-words font-pickban text-lg font-black italic uppercase leading-none tracking-tight', VETO_TONE.text)}>
                    {veto.reveal.text}
                </p>
                <p className="text-xs text-muted-foreground sm:ml-auto">{veto.reveal.mapCount} maps</p>
            </div>
        )
    }
    return null
}

function VetoChoiceCards({ veto, choosing, onChoose }: {
    veto: PickBanVetoView
    choosing: VetoChoice | null
    onChoose: (choice: VetoChoice) => void
}) {
    const [selected, setSelected] = useState<VetoChoice | null>(null)
    const busy = choosing !== null

    return (
        <div className="flex flex-col gap-3">
            <div className="space-y-1">
                <Eyebrow className="text-foreground">Your call</Eyebrow>
                <p aria-live="polite" className="break-words font-pickban text-2xl font-black italic uppercase leading-none tracking-tight text-foreground">
                    Veto or play the {veto.tag} maps
                </p>
                <p className="text-xs text-muted-foreground">One veto removes them for both teams, for every map of the match.</p>
            </div>
            <div role="radiogroup" aria-label={`${veto.tag} maps`} className="grid gap-3 sm:grid-cols-2">
                <VetoCard
                    title={`Veto ${veto.tag} maps`}
                    lead={`Play ${veto.poolSizes.vetoed} maps`}
                    maps={veto.maps}
                    selected={selected === 'veto'}
                    disabled={busy}
                    onSelect={() => setSelected('veto')}
                />
                <VetoCard
                    title={`Play ${veto.tag} maps`}
                    lead={`Play ${veto.poolSizes.played} maps`}
                    selected={selected === 'play'}
                    disabled={busy}
                    onSelect={() => setSelected('play')}
                />
            </div>
            <div className="flex justify-end">
                <button
                    type="button"
                    onClick={() => selected && onChoose(selected)}
                    disabled={selected === null || busy}
                    className={cn(
                        BUTTON,
                        'cursor-pointer border-transparent hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:brightness-100',
                        selected ? cn(VETO_TONE.solid, VETO_TONE.onSolid) : 'bg-hairline/10 text-muted-foreground',
                    )}
                >
                    {busy ? <Spinner className="size-4" /> : <Lock className="size-4" />}
                    {selected === 'veto' ? 'Lock In Veto' : selected === 'play' ? 'Lock In Play' : 'Lock In'}
                </button>
            </div>
        </div>
    )
}

function VetoCard({ title, lead, maps = [], selected, disabled, onSelect }: {
    title: string
    lead: string
    maps?: string[]
    selected: boolean
    disabled: boolean
    onSelect: () => void
}) {
    return (
        <button
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={onSelect}
            disabled={disabled}
            className={cn(
                'flex min-h-28 cursor-pointer flex-col items-start gap-2 rounded-xl border-2 p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 sm:p-4',
                VETO_TONE.line,
                selected ? cn(VETO_TONE.soft, VETO_TONE.border, 'ring-2', VETO_TONE.ring) : 'bg-card/40 hover:bg-hairline/5',
            )}
        >
            <span className={cn('font-pickban text-3xl font-black italic uppercase leading-none tracking-tight', VETO_TONE.text)}>{title}</span>
            <span className="text-sm font-semibold text-foreground">{lead}</span>
            {maps.length > 0 && (
                <ul className="flex flex-wrap gap-1.5" aria-label="Maps removed">
                    {maps.map(map => (
                        <li key={map} className="rounded-md border border-hairline/10 bg-card/60 px-1.5 py-0.5 text-[11px] text-muted-foreground">
                            {displayMapName(map)}
                        </li>
                    ))}
                </ul>
            )}
        </button>
    )
}

function SideStep({ side, choosing, onChoose }: {
    side: PickBanSideView
    choosing: SideColor | null
    onChoose?: (color: SideColor) => void
}) {
    if (side.phase === 'side_choice' && side.canChoose && onChoose) {
        return <SideChoice cards={side.cards.length > 0 ? side.cards : PLAIN_SIDE_CARDS} choosing={choosing} onChoose={onChoose} />
    }
    if (side.phase === 'side_choice' && side.viewerChooses) {
        return (
            <ControlRow
                eyebrow={<Eyebrow className="text-muted-foreground">Side choice</Eyebrow>}
                title="Choose Red or Blue"
                detail="Your side choice unlocks when an admin resumes. Red is side A and acts first."
                action={<LockedButton icon={Lock} label="Locked" />}
            />
        )
    }
    if (side.phase === 'side_choice') {
        return (
            <ControlRow
                eyebrow={<Eyebrow className="text-muted-foreground">Side choice</Eyebrow>}
                title={side.waiting ?? 'Choosing sides'}
                detail="Your team gets the other colour. Red is side A and acts first."
                action={<LockedButton icon={Lock} label="Locked" />}
            />
        )
    }
    if (side.phase === 'side_spotlight' && side.reveal) {
        const tone = PICK_BAN_TONES[sideColorTone(side.reveal.color)]
        return (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-hairline/10 pb-3">
                <Eyebrow className="text-muted-foreground">Sides set</Eyebrow>
                <p aria-live="polite" className={cn('min-w-0 break-words font-pickban text-lg font-black italic uppercase leading-none tracking-tight', tone.text)}>{side.reveal.text}</p>
                {side.viewerColor && <YoureSide color={side.viewerColor} className="sm:ml-auto" />}
            </div>
        )
    }
    return null
}

function SideChoice({ cards, choosing, onChoose }: {
    cards: PickBanSideCardView[]
    choosing: SideColor | null
    onChoose: (color: SideColor) => void
}) {
    const [selected, setSelected] = useState<SideColor | null>(null)
    const busy = choosing !== null
    const tone = selected ? PICK_BAN_TONES[sideColorTone(selected)] : null

    return (
        <div className="flex flex-col gap-3">
            <div className="space-y-1">
                <Eyebrow className="text-foreground">Your call</Eyebrow>
                <p aria-live="polite" className="break-words font-pickban text-2xl font-black italic uppercase leading-none tracking-tight text-foreground">Choose Red or Blue</p>
                <p className="text-xs text-muted-foreground">Red is side A and acts first. The other team gets the other colour, for every map of the match.</p>
            </div>
            <div role="radiogroup" aria-label="Side" className="grid gap-3 sm:grid-cols-2">
                {cards.map(card => (
                    <SideCard key={card.color} card={card} selected={selected === card.color} disabled={busy} onSelect={() => setSelected(card.color)} />
                ))}
            </div>
            <div className="flex justify-end">
                <button
                    type="button"
                    onClick={() => selected && onChoose(selected)}
                    disabled={selected === null || busy}
                    className={cn(
                        BUTTON,
                        'cursor-pointer border-transparent hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:brightness-100',
                        tone ? cn(tone.solid, tone.onSolid) : 'bg-hairline/10 text-muted-foreground',
                    )}
                >
                    {busy ? <Spinner className="size-4" /> : <Lock className="size-4" />}
                    {selected ? `Lock In ${sideColorName(selected)}` : 'Lock In'}
                </button>
            </div>
        </div>
    )
}

function SideCard({ card, selected, disabled, onSelect }: {
    card: PickBanSideCardView
    selected: boolean
    disabled: boolean
    onSelect: () => void
}) {
    const tone = PICK_BAN_TONES[sideColorTone(card.color)]

    return (
        <button
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={onSelect}
            disabled={disabled}
            className={cn(
                'flex min-h-28 cursor-pointer flex-col items-start gap-2 rounded-xl border-2 p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 sm:p-4',
                tone.line,
                selected ? cn(tone.soft, tone.border, 'ring-2', tone.ring) : 'bg-card/40 hover:bg-hairline/5',
            )}
        >
            <span className={cn('font-pickban text-3xl font-black italic uppercase leading-none tracking-tight', tone.text)}>{card.title}</span>
            <span className="text-sm font-semibold text-foreground">{card.lead}</span>
            {card.steps.length > 0 && (
                <ul className="flex flex-wrap gap-1.5" aria-label={`${sideColorName(card.color)} steps`}>
                    {card.steps.map(step => (
                        <li key={step.number} className="rounded-md border border-hairline/10 bg-card/60 px-1.5 py-0.5 text-[11px] text-muted-foreground">
                            <span className="font-semibold tabular-nums text-foreground">{step.number}</span> {step.label}
                        </li>
                    ))}
                </ul>
            )}
        </button>
    )
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
                <p aria-live="polite" className="break-words font-pickban text-2xl font-black italic uppercase leading-none tracking-tight text-foreground">{title}</p>
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
