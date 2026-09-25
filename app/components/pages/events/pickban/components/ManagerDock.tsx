import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { AnimatePresence, motion, type Transition } from 'framer-motion'
import {
    ArrowLeftRight,
    Check,
    CheckCircle2,
    ChevronDown,
    CircleDashed,
    CircleX,
    DoorOpen,
    Link2,
    ListOrdered,
    Loader2,
    LockOpen,
    MonitorPlay,
    Pause,
    PencilLine,
    Play,
    RotateCcw,
    SlidersHorizontal,
    Swords,
    TriangleAlert,
    Undo2,
    type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/app/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu'
import { Modal } from '@/app/components/ui/modal'
import { Tooltip } from '@/app/components/ui/tooltip'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import type { MatchLinks } from '@/app/components/navigation/matchLinks'
import { useCopyFeedback } from '@/app/hooks/useCopyFeedback'
import { fetchPickBanConfig, type PickBanActor, type PickBanSide, type PickBanStageConfig } from '@/app/utils/api'
import {
    sequenceChoices,
    type ManagerAChoice,
    type ManagerButton,
    type ManagerDock as ManagerDockModel,
    type ManagerHandOverMember,
    type ManagerPrimary,
    type ManagerReadiness,
    type ManagerSequence,
    type ManagerSequenceChoice,
    type ManagerSides,
    type ManagerSideTile,
    type ManagerStartBlock,
} from '../managerDock'
import type { UseManagerDockResult } from '../useManagerDock'
import { CaptainDock, Rejection } from './CaptainDock'
import { EditFinalEditor } from './EditFinalEditor'
import { PickBanBannerNote } from './PickBanBannerNote'
import { PickBanStatusChip } from './PickBanStatusChip'
import { PICK_BAN_TONES, teamTone } from './pickBanTone'
import { INDICATOR_TRANSITION } from './stageMotion'

interface ManagerDockProps {
    manager: UseManagerDockResult
    slug: string
    accessToken: string | undefined
    links: MatchLinks
}

interface HandOverBody {
    side: PickBanSide
    user_id: string | null
}

type PrimaryCommand = ManagerPrimary['command']

type ZoneCommand = ManagerDockModel['history'][number]['command'] | ManagerDockModel['danger'][number]['command']

const ICON_BUTTON = 'inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border transition-colors sm:size-8'

const PRIMARY_BUTTON = 'inline-flex h-12 w-full shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg border px-5 text-base font-bold shadow-lg transition-[background-color,border-color,box-shadow,opacity] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none @md/primary:w-48'

const PRIMARY_TONES: Record<PrimaryCommand, string> = {
    open: 'border-transparent bg-accent-500 text-white shadow-accent-500/25 hover:bg-accent-400',
    start: 'border-transparent bg-emerald-600 text-white shadow-emerald-500/25 hover:bg-emerald-500 disabled:hover:bg-emerald-600',
    pause: 'border-amber-500/40 bg-amber-500/15 text-amber-300 shadow-none hover:border-amber-500/60 hover:bg-amber-500/25',
    resume: 'border-transparent bg-emerald-600 text-white shadow-emerald-500/25 hover:bg-emerald-500',
}

const PRIMARY_ICONS: Record<PrimaryCommand, LucideIcon> = {
    open: DoorOpen,
    start: Play,
    pause: Pause,
    resume: Play,
}

const ZONE_BUTTON = 'inline-flex h-11 w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 sm:h-8 sm:w-auto sm:rounded-md sm:text-xs'

const ZONE_TONES = {
    calm: 'border-hairline/10 bg-card/50 text-muted-foreground hover:border-hairline/20 hover:text-foreground',
    danger: 'border-red-500/40 bg-transparent text-red-300 hover:border-red-500/60 hover:bg-red-500/10 hover:text-red-200',
}

const ZONE_ICONS: Record<ZoneCommand, LucideIcon> = {
    undo: Undo2,
    reopen: LockOpen,
    'edit-final': PencilLine,
    restart: RotateCcw,
    cancel: CircleX,
}

const FIELD = 'flex w-full cursor-pointer items-center gap-2.5 rounded-lg border border-hairline/10 bg-card/60 text-left transition-colors hover:border-hairline/20 disabled:cursor-not-allowed disabled:opacity-50 data-[state=open]:border-accent-500/50'

const MENU = 'border-hairline/10 bg-card/95 backdrop-blur-xl'

const MENU_ITEM = 'min-h-11 cursor-pointer gap-2 text-sm focus:bg-hairline/10 sm:min-h-9'

const SMALL_CAPS = 'text-[10px] font-bold uppercase tracking-wider text-muted-foreground'

const SWAP_TRANSITION: Transition = { type: 'spring', stiffness: 260, damping: 28 }

const ARROW_STEPS: Partial<Record<string, number>> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }

export function ManagerDock({ manager, slug, accessToken, links }: ManagerDockProps) {
    const titleId = useId()
    const { dock } = manager
    if (!dock) return null
    const { actFor, busy, confirm, finalEditor, primary, sides, sequence } = dock

    const runZone = (command: ZoneCommand) => {
        if (command === 'edit-final') manager.openFinalEditor()
        else manager.run({ command })
    }

    return (
        <>
            <section aria-labelledby={titleId} className="@container/dock overflow-hidden rounded-xl border border-accent-500/25 bg-card/30">
                <header className="flex items-center gap-3 border-b border-hairline/5 bg-gradient-to-r from-accent-500/10 to-transparent to-70% px-3 py-2.5 sm:px-4">
                    <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-accent-500/30 bg-accent-500/15 text-accent-200">
                        <SlidersHorizontal className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1 space-y-1">
                        <h2 id={titleId} className="text-sm font-bold leading-none text-foreground">Match control</h2>
                        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                            <PickBanStatusChip status={dock.status} />
                            {dock.phase && <span className="min-w-0 break-words text-xs text-muted-foreground">{dock.phase}</span>}
                        </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                        <CopyLinkButton link={links.playerLink} label="Copy player link" copiedLabel="Player link copied" icon={Link2} />
                        <CopyLinkButton link={links.streamLink} label="Copy stream link" copiedLabel="Stream link copied" icon={MonitorPlay} />
                    </div>
                </header>

                <div className="flex flex-col gap-3 p-3 sm:p-4">
                    {dock.voided && <PickBanBannerNote banner={dock.voided} className="border-2 text-base" />}
                    {dock.resultsWarning && <PickBanBannerNote banner={{ kind: 'warning', key: 'results', message: dock.resultsWarning }} />}
                    {dock.rejection && <Rejection message={dock.rejection} onDismiss={manager.dismiss} />}
                    {actFor && (
                        <CaptainDock
                            dock={actFor.dock}
                            ab={actFor.ab}
                            actingFor={actFor.teamName}
                            reconnecting={false}
                            onLockIn={manager.lockIn}
                            onDismiss={manager.dismiss}
                            className="static shadow-none"
                        />
                    )}
                    <div className={cn('grid gap-3', sides && '@3xl/dock:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] @3xl/dock:items-start')}>
                        <div className="flex min-w-0 flex-col gap-3">
                            {primary ? (
                                <PrimaryCard
                                    primary={primary}
                                    pending={dock.submitting === primary.command}
                                    onRun={(command) => manager.run({ command })}
                                />
                            ) : dock.done && <DoneCard message={dock.done} />}
                            {sequence && (
                                <SequenceField
                                    sequence={sequence}
                                    slug={slug}
                                    accessToken={accessToken}
                                    disabled={busy}
                                    pending={dock.submitting === 'override-sequence'}
                                    onChange={(body) => manager.run({ command: 'override-sequence', body })}
                                />
                            )}
                        </div>
                        {sides && (
                            <SidesBoard
                                sides={sides}
                                busy={busy}
                                submitting={dock.submitting}
                                onChooseA={(side) => manager.run({ command: 'choose-a', body: { side } })}
                                onSwap={() => manager.run({ command: 'swap' })}
                                onHandOver={(body) => manager.run({ command: 'hand-over', body })}
                            />
                        )}
                    </div>
                </div>

                {(dock.history.length > 0 || dock.danger.length > 0) && (
                    <footer className="flex flex-col gap-3 border-t border-hairline/5 bg-hairline/5 px-3 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-4">
                        {dock.history.length > 0 && (
                            <ZoneGroup label="History">
                                {dock.history.map((button) => (
                                    <ZoneButton key={button.command} button={button} tone="calm" pending={dock.submitting === button.command} onClick={() => runZone(button.command)} />
                                ))}
                            </ZoneGroup>
                        )}
                        {dock.danger.length > 0 && (
                            <ZoneGroup label="Danger zone" className="sm:ml-auto">
                                {dock.danger.map((button) => (
                                    <ZoneButton key={button.command} button={button} tone="danger" pending={dock.submitting === button.command} onClick={() => runZone(button.command)} />
                                ))}
                            </ZoneGroup>
                        )}
                    </footer>
                )}
            </section>

            {finalEditor && !confirm && (
                <DockModal
                    title="Edit the final maps"
                    onClose={manager.closeFinalEditor}
                    dismissLabel="Discard"
                    maxWidth="48rem"
                    action={(
                        <Button disabled={busy || !finalEditor.body || finalEditor.outdated} onClick={() => manager.run({ command: 'edit-final' })}>
                            {finalEditor.saving ? 'Saving…' : 'Save…'}
                        </Button>
                    )}
                >
                    <EditFinalEditor
                        editor={finalEditor}
                        resultsWarning={dock.resultsWarning}
                        onChange={manager.changeFinalEditor}
                        onReload={manager.openFinalEditor}
                        onDismissRejection={manager.dismiss}
                    />
                </DockModal>
            )}
            {confirm && (
                <DockModal
                    title={confirm.title}
                    onClose={manager.dismissConfirm}
                    dismissLabel={confirm.dismissLabel}
                    action={(
                        <Button variant={confirm.command === 'edit-final' ? 'default' : 'destructive'} disabled={busy} onClick={manager.confirm}>
                            {confirm.confirmLabel}
                        </Button>
                    )}
                >
                    <p className="text-sm text-muted-foreground">{confirm.message}</p>
                </DockModal>
            )}
        </>
    )
}

function CopyLinkButton({ link, label, copiedLabel, icon: Icon }: { link: string; label: string; copiedLabel: string; icon: LucideIcon }) {
    const { copiedKey, copy } = useCopyFeedback(error => console.error('Copy pick/ban link failed', error))
    const copied = copiedKey === link

    return (
        <Tooltip content={copied ? 'Copied' : label} side="bottom">
            <button
                type="button"
                aria-label={label}
                onClick={() => copy(link, link)}
                className={cn(
                    ICON_BUTTON,
                    copied
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                        : 'border-hairline/10 bg-card/50 text-muted-foreground hover:border-hairline/20 hover:text-foreground',
                )}
            >
                <AnimatePresence initial={false} mode="popLayout">
                    <motion.span
                        key={copied ? 'copied' : 'idle'}
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.5 }}
                        transition={{ duration: 0.15 }}
                        className="flex"
                    >
                        {copied ? <Check className="size-4" /> : <Icon className="size-4" />}
                    </motion.span>
                </AnimatePresence>
            </button>
            <span role="status" className="sr-only">{copied ? copiedLabel : ''}</span>
        </Tooltip>
    )
}

function PrimaryCard({ primary, pending, onRun }: { primary: ManagerPrimary; pending: boolean; onRun: (command: PrimaryCommand) => void }) {
    const hintId = useId()
    const blockedId = useId()
    const Icon = PRIMARY_ICONS[primary.command]

    return (
        <div className="@container/primary flex min-w-0 flex-col gap-3 rounded-lg border border-hairline/10 bg-card/40 p-3">
            <div className="flex flex-col gap-2.5 @md/primary:flex-row @md/primary:items-center @md/primary:gap-4">
                <button
                    type="button"
                    disabled={primary.disabled}
                    aria-describedby={primary.blocked ? `${hintId} ${blockedId}` : hintId}
                    onClick={() => onRun(primary.command)}
                    className={cn(PRIMARY_BUTTON, PRIMARY_TONES[primary.command])}
                >
                    {pending ? <Loader2 className="size-5 animate-spin" /> : <Icon className="size-5" />}
                    {primary.label}
                </button>
                <p id={hintId} className="text-xs text-muted-foreground @md/primary:flex-1">{primary.hint}</p>
            </div>
            {primary.readiness && <ReadinessList readiness={primary.readiness} />}
            {primary.blocked && <StartBlocked id={blockedId} block={primary.blocked} />}
        </div>
    )
}

function ReadinessList({ readiness }: { readiness: ManagerReadiness[] }) {
    return (
        <ul aria-label="Ready marks" className="grid gap-1.5 @md/primary:grid-cols-2">
            {readiness.map(({ side, ab, name, ready }) => (
                <li key={side} className="flex min-w-0 items-center gap-2 rounded-md border border-hairline/5 bg-hairline/5 px-2.5 py-1.5">
                    <SideBadge ab={ab} />
                    <span className="min-w-0 flex-1 break-words text-sm font-semibold leading-tight text-foreground">{name}</span>
                    <span
                        className={cn(
                            'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-colors duration-300',
                            ready ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300' : 'border-hairline/10 bg-hairline/5 text-muted-foreground',
                        )}
                    >
                        {ready ? <Check className="size-3" strokeWidth={3} /> : <CircleDashed className="size-3" />}
                        {ready ? 'Ready' : 'Not ready'}
                    </span>
                </li>
            ))}
        </ul>
    )
}

function StartBlocked({ id, block }: { id: string; block: ManagerStartBlock }) {
    return (
        <div id={id} role="status" className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0 space-y-0.5">
                <p className="font-semibold">Start is blocked: {block.reason}</p>
                {block.fix && <p className="text-xs opacity-90">{block.fix}</p>}
            </div>
        </div>
    )
}

function DoneCard({ message }: { message: string }) {
    return (
        <div className="flex min-w-0 items-center gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
            <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
                <CheckCircle2 className="size-5" />
            </span>
            <div className="min-w-0 space-y-0.5">
                <p className="text-sm font-bold text-foreground">Pick/ban complete</p>
                <p className="text-xs text-muted-foreground">{message}</p>
            </div>
        </div>
    )
}

function SideBadge({ ab, className }: { ab: PickBanActor | null; className?: string }) {
    const tone = PICK_BAN_TONES[teamTone(ab)]

    return (
        <span
            aria-hidden
            className={cn(
                'inline-flex size-5 shrink-0 items-center justify-center rounded text-[11px] font-black transition-colors duration-300',
                ab ? cn(tone.solid, tone.onSolid) : 'border border-dashed border-hairline/30 text-muted-foreground',
                className,
            )}
        >
            {ab ?? '?'}
        </span>
    )
}

function FieldLabel({ id, icon: Icon, children }: { id: string; icon: LucideIcon; children: ReactNode }) {
    return (
        <h3 id={id} className={cn('flex items-center gap-1.5', SMALL_CAPS)}>
            <Icon aria-hidden className="size-3.5" />
            {children}
        </h3>
    )
}

function SidesBoard({ sides, busy, submitting, onChooseA, onSwap, onHandOver }: {
    sides: ManagerSides
    busy: boolean
    submitting: ManagerDockModel['submitting']
    onChooseA: (side: PickBanSide) => void
    onSwap: () => void
    onHandOver: (body: HandOverBody) => void
}) {
    const labelId = useId()
    const [handingOver, setHandingOver] = useState<PickBanSide | null>(null)
    const [first, second] = sides.tiles
    const tileOf = (tile: ManagerSideTile) => (
        <SideTile
            key={tile.side}
            tile={tile}
            light={sides.chooseA !== null}
            disabled={busy}
            pending={submitting === 'hand-over' && handingOver === tile.side}
            onHandOver={(body) => {
                setHandingOver(body.side)
                onHandOver(body)
            }}
        />
    )

    return (
        <div role="group" aria-labelledby={labelId} className="@container/sides flex min-w-0 flex-col gap-2.5 rounded-lg border border-hairline/10 bg-card/40 p-3">
            <FieldLabel id={labelId} icon={Swords}>Sides</FieldLabel>
            {sides.chooseA && <AChooser choices={sides.chooseA} busy={busy} pending={submitting === 'choose-a'} onChoose={onChooseA} />}
            <div className="grid grid-cols-1 items-center gap-2 @lg/sides:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
                {first && tileOf(first)}
                {sides.swap ? (
                    <SwapButton button={sides.swap} aSide={first?.side ?? null} pending={submitting === 'swap'} onSwap={onSwap} />
                ) : (
                    <span aria-hidden className="mx-auto text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">vs</span>
                )}
                {second && tileOf(second)}
            </div>
            {sides.basis && <p className="text-xs text-muted-foreground">{sides.basis}</p>}
        </div>
    )
}

function SwapButton({ button, aSide, pending, onSwap }: { button: ManagerButton<'swap'>; aSide: PickBanSide | null; pending: boolean; onSwap: () => void }) {
    return (
        <Tooltip content={button.hint} className="mx-auto">
            <button
                type="button"
                aria-label={button.label}
                disabled={button.disabled}
                onClick={onSwap}
                className="flex size-11 cursor-pointer items-center justify-center rounded-full border border-hairline/15 bg-card text-muted-foreground shadow-md shadow-black/20 transition-colors hover:border-accent-500/50 hover:text-accent-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
                {pending ? (
                    <Loader2 className="size-4 animate-spin" />
                ) : (
                    <span className="flex @max-lg/sides:rotate-90">
                        <motion.span animate={{ rotate: aSide === 'team_b' ? 180 : 0 }} transition={SWAP_TRANSITION} className="flex">
                            <ArrowLeftRight className="size-4" />
                        </motion.span>
                    </span>
                )}
            </button>
        </Tooltip>
    )
}

function SideTile({ tile, light, disabled, pending, onHandOver }: {
    tile: ManagerSideTile
    light: boolean
    disabled: boolean
    pending: boolean
    onHandOver: (body: HandOverBody) => void
}) {
    const tone = PICK_BAN_TONES[teamTone(tile.ab)]

    return (
        <motion.div
            layout="position"
            transition={SWAP_TRANSITION}
            className={cn('flex min-w-0 flex-col gap-3 rounded-lg border bg-gradient-to-br to-transparent to-70% p-3 transition-colors duration-300', tone.wash, tone.line)}
        >
            <div className="flex items-center gap-2.5">
                {(!light || tile.ab) && <SideBadge ab={tile.ab} className={light ? 'size-6 rounded-md text-xs' : 'size-7 rounded-md text-sm'} />}
                <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 break-words text-sm font-bold leading-tight text-foreground">{tile.name}</p>
                    {!light && (
                        <p className={SMALL_CAPS}>
                            {tile.ab ? `Team ${tile.ab}` : 'Side to choose'}
                            <span aria-hidden> · </span>
                            {tile.stageSeed === null ? 'No stage seed' : `Stage seed ${tile.stageSeed}`}
                        </p>
                    )}
                </div>
            </div>
            {tile.handOver && <ControlPicker tile={tile} members={tile.handOver} disabled={disabled} pending={pending} onHandOver={onHandOver} />}
        </motion.div>
    )
}

function ControlPicker({ tile, members, disabled, pending, onHandOver }: {
    tile: ManagerSideTile
    members: ManagerHandOverMember[]
    disabled: boolean
    pending: boolean
    onHandOver: (body: HandOverBody) => void
}) {
    const labelId = useId()
    const valueId = useId()
    const current = members.find((candidate) => candidate.controls) ?? null
    const choose = (id: string) => {
        const next = members.find(({ member }) => member.id === id)
        if (next && !next.controls) onHandOver({ side: tile.side, user_id: next.userId })
    }

    return (
        <div className="space-y-1">
            <p id={labelId} className={SMALL_CAPS}>
                In control<span className="sr-only"> of {tile.name}</span>
            </p>
            <DropdownMenu>
                <DropdownMenuTrigger asChild disabled={disabled}>
                    <button type="button" aria-labelledby={`${labelId} ${valueId}`} className={cn(FIELD, 'min-h-11 px-2.5 py-1.5 sm:min-h-10')}>
                        <span id={valueId} className="flex min-w-0 flex-1 items-center gap-2">
                            {current ? (
                                <>
                                    <PlayerInfo userId={current.member.id} alias={current.member.display_name} size="sm" interactive={false} className="min-w-0" />
                                    <RoleTag>{current.member.captain ? 'Captain' : 'Acting'}</RoleTag>
                                </>
                            ) : (
                                <span className="text-xs text-muted-foreground">Nobody yet</span>
                            )}
                        </span>
                        {pending ? <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" /> : <ChevronDown className="size-4 shrink-0 text-muted-foreground" />}
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className={cn(MENU, 'w-[var(--radix-dropdown-menu-trigger-width)] min-w-64')}>
                    <DropdownMenuLabel className={SMALL_CAPS}>Who makes {tile.name}’s choices</DropdownMenuLabel>
                    <DropdownMenuRadioGroup value={current?.member.id ?? ''} onValueChange={choose}>
                        {members.map(({ member }) => (
                            <DropdownMenuRadioItem key={member.id} value={member.id} className={MENU_ITEM}>
                                <PlayerInfo userId={member.id} alias={member.display_name} size="sm" interactive={false} className="min-w-0 flex-1" />
                                <span title={member.online ? 'Online' : 'Offline'} className={cn('size-2 shrink-0 rounded-full', member.online ? 'bg-emerald-400' : 'bg-hairline/20')}>
                                    <span className="sr-only">{member.online ? 'Online' : 'Offline'}</span>
                                </span>
                                {member.captain && <RoleTag>Captain</RoleTag>}
                            </DropdownMenuRadioItem>
                        ))}
                    </DropdownMenuRadioGroup>
                    <DropdownMenuSeparator />
                    <p className="px-2 py-1.5 text-[11px] text-muted-foreground">For this match only. Choosing the captain gives control back.</p>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    )
}

function RoleTag({ children }: { children: ReactNode }) {
    return (
        <span className="shrink-0 rounded border border-hairline/10 bg-hairline/5 px-1 py-px text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
            {children}
        </span>
    )
}

function AChooser({ choices, busy, pending, onChoose }: {
    choices: ManagerAChoice[]
    busy: boolean
    pending: boolean
    onChoose: (side: PickBanSide) => void
}) {
    const labelId = useId()
    const hintId = useId()
    const radios = useRef<(HTMLButtonElement | null)[]>([])
    const focusable = Math.max(0, choices.findIndex((choice) => choice.chosen))
    const choose = (choice: ManagerAChoice) => {
        if (!busy && !choice.chosen) onChoose(choice.side)
    }
    const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
        const step = ARROW_STEPS[event.key]
        if (step === undefined) return
        event.preventDefault()
        const next = (index + step + choices.length) % choices.length
        radios.current[next]?.focus()
        choose(choices[next])
    }

    return (
        <div className="space-y-2.5 rounded-lg border border-pickban-a/30 bg-pickban-a/5 p-3">
            <div className="space-y-0.5">
                <p id={labelId} className="flex items-center gap-2 text-sm font-bold text-foreground">
                    Who is Team A?
                    {pending && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
                </p>
                <p id={hintId} className="text-xs text-muted-foreground">
                    A normally goes to the better stage seed. These seeds are missing or tied, so choose which team is A.
                </p>
            </div>
            <div role="radiogroup" aria-labelledby={labelId} aria-describedby={hintId} className="grid grid-cols-2 gap-1 rounded-lg border border-hairline/10 bg-card/60 p-1">
                {choices.map((choice, index) => (
                    <button
                        key={choice.side}
                        ref={(node) => {
                            radios.current[index] = node
                        }}
                        type="button"
                        role="radio"
                        aria-checked={choice.chosen}
                        aria-disabled={busy}
                        tabIndex={index === focusable ? 0 : -1}
                        onClick={() => choose(choice)}
                        onKeyDown={(event) => onKeyDown(event, index)}
                        className={cn(
                            'relative flex min-h-11 min-w-0 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-md px-2 py-1.5 text-center transition-colors aria-disabled:cursor-wait sm:min-h-10',
                            choice.chosen ? 'text-white' : 'text-muted-foreground hover:bg-hairline/5 hover:text-foreground',
                        )}
                    >
                        {choice.chosen && (
                            <motion.span
                                layoutId="manager-dock-team-a"
                                transition={INDICATOR_TRANSITION}
                                className="absolute inset-0 rounded-md bg-pickban-a shadow-md shadow-pickban-a/30"
                            />
                        )}
                        <span className="relative line-clamp-2 break-words text-sm font-bold leading-tight">{choice.name}</span>
                        <span className={cn('relative text-[10px] font-bold uppercase tracking-wider', choice.chosen ? 'text-white/80' : 'text-muted-foreground')}>
                            {choice.stageSeed === null ? 'No stage seed' : `Stage seed ${choice.stageSeed}`}
                        </span>
                    </button>
                ))}
            </div>
        </div>
    )
}

function SequenceField({ sequence, slug, accessToken, disabled, pending, onChange }: {
    sequence: ManagerSequence
    slug: string
    accessToken: string | undefined
    disabled: boolean
    pending: boolean
    onChange: (body: ManagerSequenceChoice['body']) => void
}) {
    const labelId = useId()
    const valueId = useId()
    const [stages, setStages] = useState<PickBanStageConfig[] | null>(null)
    const { changeable } = sequence

    useEffect(() => {
        if (!changeable) return
        const controller = new AbortController()
        fetchPickBanConfig(accessToken, slug, controller.signal)
            .then((config) => setStages(config.stages))
            .catch(() => {
                if (!controller.signal.aborted) setStages([])
            })
        return () => controller.abort()
    }, [accessToken, slug, changeable])

    const choices = sequenceChoices(stages ?? [], sequence)
    const presets = choices.filter((choice) => 'preset_id' in choice.body)
    const stageChoices = choices.filter((choice) => 'from_stage_key' in choice.body)
    const fromStage = stages?.find((stage) => stage.key === sequence.fromStageKey)?.name ?? null
    const source = !sequence.changed ? 'The stage’s own sequence' : fromStage ? `Changed for this match: ${fromStage}’s sequence` : 'Changed for this match'
    const choose = (key: string) => {
        const choice = choices.find((candidate) => candidate.key === key)
        if (choice && !choice.current) onChange(choice.body)
    }
    const value = (
        <span id={valueId} className="min-w-0 flex-1 space-y-0.5">
            <span className="block break-words text-sm font-semibold leading-tight text-foreground">{sequence.label}</span>
            <span className="block text-xs text-muted-foreground">{sequence.detail} · {source}</span>
        </span>
    )

    return (
        <div className="flex min-w-0 flex-col gap-2 rounded-lg border border-hairline/10 bg-card/40 p-3">
            <FieldLabel id={labelId} icon={ListOrdered}>Sequence</FieldLabel>
            {changeable ? (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild disabled={disabled}>
                        <button type="button" aria-labelledby={`${labelId} ${valueId}`} className={cn(FIELD, 'min-h-11 px-3 py-2')}>
                            {value}
                            {pending ? <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" /> : <ChevronDown className="size-4 shrink-0 text-muted-foreground" />}
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className={cn(MENU, 'max-h-80 w-[var(--radix-dropdown-menu-trigger-width)] min-w-64 overflow-y-auto')}>
                        <DropdownMenuRadioGroup value={choices.find((choice) => choice.current)?.key ?? ''} onValueChange={choose}>
                            <DropdownMenuLabel className={SMALL_CAPS}>Presets</DropdownMenuLabel>
                            {presets.map((choice) => (
                                <DropdownMenuRadioItem key={choice.key} value={choice.key} className={MENU_ITEM}>{choice.label}</DropdownMenuRadioItem>
                            ))}
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel className={SMALL_CAPS}>A stage’s sequence</DropdownMenuLabel>
                            {stageChoices.map((choice) => (
                                <DropdownMenuRadioItem key={choice.key} value={choice.key} className={MENU_ITEM}>{choice.label}</DropdownMenuRadioItem>
                            ))}
                            {stages === null && <p className="px-2 py-1.5 text-xs text-muted-foreground">Loading the stages…</p>}
                            {stages !== null && stageChoices.length === 0 && <p className="px-2 py-1.5 text-xs text-muted-foreground">No stage has a sequence set.</p>}
                        </DropdownMenuRadioGroup>
                        <DropdownMenuSeparator />
                        <p className="px-2 py-1.5 text-[11px] text-muted-foreground">For this match only, until Start.</p>
                    </DropdownMenuContent>
                </DropdownMenu>
            ) : (
                <div className="flex rounded-lg border border-hairline/5 bg-hairline/5 px-3 py-2">{value}</div>
            )}
        </div>
    )
}

function ZoneGroup({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
    const labelId = useId()

    return (
        <div role="group" aria-labelledby={labelId} className={cn('flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2.5', className)}>
            <p id={labelId} className={SMALL_CAPS}>{label}</p>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">{children}</div>
        </div>
    )
}

function ZoneButton({ button, tone, pending, onClick }: {
    button: ManagerButton<ZoneCommand>
    tone: keyof typeof ZONE_TONES
    pending: boolean
    onClick: () => void
}) {
    const Icon = ZONE_ICONS[button.command]

    return (
        <Tooltip content={button.hint} className="w-full sm:w-auto">
            <button type="button" disabled={button.disabled} onClick={onClick} className={cn(ZONE_BUTTON, ZONE_TONES[tone])}>
                {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Icon className="size-3.5" />}
                {button.label}
            </button>
        </Tooltip>
    )
}

function DockModal({ title, onClose, action, dismissLabel, maxWidth = '34rem', children }: {
    title: string
    onClose: () => void
    action?: ReactNode
    dismissLabel?: string
    maxWidth?: string
    children: ReactNode
}) {
    return (
        <Modal
            isOpen
            onClose={onClose}
            offsetSidebar
            portal
            maxWidth={maxWidth}
            title={title}
            footer={
                <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border bg-muted/50 p-4">
                    <Button variant="outline" onClick={onClose}>{dismissLabel ?? (action ? 'Keep it' : 'Close')}</Button>
                    {action}
                </div>
            }
        >
            {children}
        </Modal>
    )
}
