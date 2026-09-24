import { useEffect, useState, type ComponentProps, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/app/components/ui/button'
import { Modal } from '@/app/components/ui/modal'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { fetchPickBanConfig, type PickBanSide, type PickBanStageConfig } from '@/app/utils/api'
import {
    sequenceChoices,
    type ManagerButton,
    type ManagerDock as ManagerDockModel,
    type ManagerHandOverTeam,
    type ManagerSequenceChoice,
} from '../managerDock'
import type { UseManagerDockResult } from '../useManagerDock'
import { CaptainDock, Rejection } from './CaptainDock'
import { PickBanBannerNote } from './PickBanBannerNote'
import { PICK_BAN_TONES, teamTone } from './pickBanTone'

interface ManagerDockProps {
    dock: ManagerDockModel
    manager: UseManagerDockResult
    slug: string
    accessToken: string | undefined
    children: ReactNode
}

type Picker = 'sequence' | 'hand-over'

const BUTTON = 'inline-flex h-11 w-full cursor-pointer items-center justify-center rounded-lg border px-3 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-40 sm:h-8 sm:w-auto sm:text-xs'

const TONES = {
    accent: 'border-accent-500/40 bg-accent-500/15 text-accent-200 hover:border-accent-500/60 hover:bg-accent-500/25',
    red: 'border-red-500/30 bg-red-500/10 text-red-300 hover:border-red-500/50 hover:bg-red-500/25 hover:text-red-200',
    neutral: 'border-hairline/10 bg-card/50 text-muted-foreground hover:border-hairline/20 hover:text-foreground',
}

const TONE_OF: Partial<Record<ManagerButton['command'], keyof typeof TONES>> = {
    open: 'accent',
    start: 'accent',
    resume: 'accent',
    restart: 'red',
    cancel: 'red',
}

export function ManagerDock({ dock, manager, slug, accessToken, children }: ManagerDockProps) {
    const [picker, setPicker] = useState<Picker | null>(null)
    const { actFor, busy } = dock
    if (picker !== null && !(picker === 'sequence' ? dock.overrideSequence : dock.handOver)) setPicker(null)

    return (
        <>
            {actFor && (
                <CaptainDock
                    dock={actFor.dock}
                    ab={actFor.ab}
                    actingFor={actFor.teamName}
                    reconnecting={false}
                    onLockIn={manager.lockIn}
                    onDismiss={manager.dismiss}
                    className="static"
                />
            )}

            <section aria-label="Match admin controls" className="flex flex-col gap-3 rounded-xl border border-accent-500/30 bg-card/30 p-3 sm:p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-[10px] uppercase tracking-wider text-muted-foreground">Match admin</h2>
                    <div className="flex flex-wrap gap-2">{children}</div>
                </div>
                {dock.voided && <PickBanBannerNote banner={dock.voided} className="border-2 text-base" />}
                {dock.resultsWarning && (
                    <p role="status" className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-300">
                        {dock.resultsWarning}
                    </p>
                )}
                {dock.rejection && <Rejection message={dock.rejection} onDismiss={manager.dismiss} />}
                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
                    {dock.buttons.map(({ command, label, disabled }) => (
                        <DockButton key={command} tone={TONE_OF[command]} disabled={disabled} onClick={() => manager.run({ command })}>
                            {label}
                        </DockButton>
                    ))}
                    {dock.chooseA?.map(({ side, name, chosen }) => (
                        <DockButton
                            key={side}
                            tone={chosen ? 'accent' : undefined}
                            className={cn(chosen && 'disabled:opacity-100')}
                            disabled={busy || chosen}
                            aria-pressed={chosen}
                            onClick={() => manager.run({ command: 'choose-a', body: { side } })}
                        >
                            <span className="truncate">A: {name}</span>
                        </DockButton>
                    ))}
                    {dock.overrideSequence && <DockButton disabled={busy} onClick={() => setPicker('sequence')}>Change sequence…</DockButton>}
                    {dock.handOver && <DockButton disabled={busy} onClick={() => setPicker('hand-over')}>Hand over…</DockButton>}
                </div>
                {dock.startBlockedBy && <p className="text-xs text-amber-300">Start is blocked: {dock.startBlockedBy}</p>}
            </section>

            {dock.confirm && (
                <DockModal
                    title={dock.confirm.title}
                    onClose={manager.dismissConfirm}
                    action={<Button variant="destructive" disabled={busy} onClick={manager.confirm}>{dock.confirm.confirmLabel}</Button>}
                >
                    <p className="text-sm text-muted-foreground">{dock.confirm.message}</p>
                </DockModal>
            )}
            {picker === 'sequence' && (
                <SequencePicker
                    slug={slug}
                    accessToken={accessToken}
                    onClose={() => setPicker(null)}
                    onApply={(body) => {
                        manager.run({ command: 'override-sequence', body })
                        setPicker(null)
                    }}
                />
            )}
            {picker === 'hand-over' && dock.handOver && (
                <HandOverPicker
                    teams={dock.handOver}
                    onClose={() => setPicker(null)}
                    onHandOver={(body) => {
                        manager.run({ command: 'hand-over', body })
                        setPicker(null)
                    }}
                />
            )}
        </>
    )
}

function DockButton({ tone, className, ...props }: ComponentProps<'button'> & { tone?: keyof typeof TONES }) {
    return <button type="button" className={cn(BUTTON, TONES[tone ?? 'neutral'], className)} {...props} />
}

function DockModal({ title, onClose, action, children }: { title: string; onClose: () => void; action?: ReactNode; children: ReactNode }) {
    return (
        <Modal
            isOpen
            onClose={onClose}
            offsetSidebar
            maxWidth="34rem"
            title={title}
            footer={
                <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border bg-muted/50 p-4">
                    <Button variant="outline" onClick={onClose}>{action ? 'Keep it' : 'Close'}</Button>
                    {action}
                </div>
            }
        >
            {children}
        </Modal>
    )
}

function SequencePicker({ slug, accessToken, onClose, onApply }: {
    slug: string
    accessToken: string | undefined
    onClose: () => void
    onApply: (body: ManagerSequenceChoice['body']) => void
}) {
    const [stages, setStages] = useState<PickBanStageConfig[] | null>(null)
    const [choice, setChoice] = useState(0)
    const choices = sequenceChoices(stages ?? [])

    useEffect(() => {
        const controller = new AbortController()
        fetchPickBanConfig(accessToken, slug, controller.signal)
            .then((config) => setStages(config.stages))
            .catch(() => {
                if (!controller.signal.aborted) setStages([])
            })
        return () => controller.abort()
    }, [accessToken, slug])

    return (
        <DockModal title="Change the sequence" onClose={onClose} action={<Button onClick={() => onApply(choices[choice].body)}>Apply</Button>}>
            <label className="flex flex-col gap-2 text-xs text-muted-foreground">
                For this match only: run a preset, or another stage’s sequence.
                <select
                    value={choice}
                    onChange={(event) => setChoice(Number(event.target.value))}
                    style={{ colorScheme: 'dark' }}
                    className="h-11 rounded-lg border border-hairline/10 bg-card/50 px-3 text-sm text-foreground focus:border-accent-500/50 focus:outline-none"
                >
                    {choices.map(({ label }, index) => <option key={label} value={index}>{label}</option>)}
                </select>
                {stages === null && 'Loading the other stages…'}
            </label>
        </DockModal>
    )
}

function HandOverPicker({ teams, onClose, onHandOver }: {
    teams: ManagerHandOverTeam[]
    onClose: () => void
    onHandOver: (body: { side: PickBanSide; user_id: string | null }) => void
}) {
    return (
        <DockModal title="Hand over a side" onClose={onClose}>
            <p className="mb-4 text-xs text-muted-foreground">Choose who makes that side’s choices in this match. Choosing the captain gives control back to them.</p>
            <div className="grid gap-4 sm:grid-cols-2">
                {teams.map(({ side, ab, name, members }) => (
                    <div key={side} className="min-w-0 space-y-2">
                        <h3 className={cn('break-words text-sm font-bold', PICK_BAN_TONES[teamTone(ab)].text)}>{name}</h3>
                        {members.map(({ member, controls, userId }) => (
                            <button
                                key={member.id}
                                type="button"
                                disabled={controls}
                                aria-pressed={controls}
                                onClick={() => onHandOver({ side, user_id: userId })}
                                className={cn(
                                    'flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors disabled:cursor-default',
                                    controls ? 'border-accent-500/50 bg-accent-500/15' : 'border-hairline/10 bg-card/50 hover:border-hairline/20',
                                )}
                            >
                                <PlayerInfo userId={member.id} alias={member.display_name} size="sm" interactive={false} className="min-w-0 flex-1" />
                                <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                    {controls ? 'In control' : member.captain ? 'Captain' : ''}
                                </span>
                            </button>
                        ))}
                    </div>
                ))}
            </div>
        </DockModal>
    )
}
