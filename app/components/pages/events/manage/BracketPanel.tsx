import { useCallback, useMemo, useState } from 'react'
import { Eye, EyeOff, Plus, RefreshCw, Shuffle, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ActionButton } from '@/app/components/pages/admin/components/controls'
import { ConfirmModal } from '@/app/components/shared/ConfirmModal'
import { ErrorBanner, SectionCard } from '@/app/components/pages/teams/teamsShared'
import {
    createEventMatch, eventErrorMessage, fetchEventBracket, generateEventRound, generateEventStage,
    resetEventStage, updateEventStage,
    type EventBracket, type EventBracketStage, type EventMatch,
} from '@/app/utils/api'
import { MatchCard, RELAXED_LABELS, STAGE_STATUS_LABELS } from '../bracket/bracketShared'
import { MatchEditorModal } from './MatchEditorModal'

interface BracketPanelProps {
    accessToken: string
    slug: string
    bracket: EventBracket | null
    onBracketChange: (bracket: EventBracket) => void
    onMapSelect?: (mapName: string) => void
}

function relaxedNotice(relaxed: string[]): string | null {
    if (!relaxed.length) return null
    const names = relaxed.map(name => RELAXED_LABELS[name] ?? name)
    return `The draw could not avoid ${names.join(' or ')} — check the pairings before publishing.`
}

export function BracketPanel({ accessToken, slug, bracket, onBracketChange, onMapSelect }: BracketPanelProps) {
    const stages = bracket?.stages ?? []
    const [busyStage, setBusyStage] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [notices, setNotices] = useState<Record<string, string>>({})
    const [resetTarget, setResetTarget] = useState<EventBracketStage | null>(null)
    const [editing, setEditing] = useState<EventMatch | null>(null)

    const refresh = useCallback(async () => {
        onBracketChange(await fetchEventBracket(accessToken, slug))
    }, [accessToken, slug, onBracketChange])

    const run = useCallback(async (stageKey: string, action: () => Promise<unknown>, notice?: string) => {
        setBusyStage(stageKey)
        setError(null)
        setNotices(current => ({ ...current, [stageKey]: '' }))
        try {
            await action()
            await refresh()
            if (notice) setNotices(current => ({ ...current, [stageKey]: notice }))
        } catch (e) {
            setError(eventErrorMessage(e))
        } finally {
            setBusyStage(null)
        }
    }, [refresh])

    const preview = (stage: EventBracketStage) => run(stage.key, async () => {
        const draw = await generateEventStage(accessToken, slug, stage.key, { dryRun: true })
        const summary = draw.stage.matches.length
        const warning = relaxedNotice(draw.relaxed)
        setNotices(current => ({
            ...current,
            [stage.key]: `Preview: ${summary} match${summary === 1 ? '' : 'es'} would be drawn.${warning ? ` ${warning}` : ''}`,
        }))
    })

    const generate = (stage: EventBracketStage, force: boolean) => run(stage.key, async () => {
        const draw = await generateEventStage(accessToken, slug, stage.key, { force })
        const warning = relaxedNotice(draw.relaxed)
        if (warning) setNotices(current => ({ ...current, [stage.key]: warning }))
    })

    const nextRound = (stage: EventBracketStage) => run(stage.key, async () => {
        const draw = await generateEventRound(accessToken, slug, stage.key)
        const warning = relaxedNotice(draw.relaxed)
        setNotices(current => ({
            ...current,
            [stage.key]: warning ?? `Round ${draw.round_no} drawn.`,
        }))
    })

    if (!bracket?.format.spec) {
        return (
            <SectionCard title="Bracket" subtitle="Set a tournament format first">
                <p className="text-sm text-muted-foreground">
                    This event has no format yet. Pick one on the Format tab, then come back to draw the stages.
                </p>
            </SectionCard>
        )
    }

    return (
        <div className="space-y-4">
            <ErrorBanner message={error} />

            {stages.map(stage => (
                <StageCard
                    key={stage.key}
                    stage={stage}
                    busy={busyStage === stage.key}
                    notice={notices[stage.key] || null}
                    onPreview={() => void preview(stage)}
                    onGenerate={force => void generate(stage, force)}
                    onNextRound={() => void nextRound(stage)}
                    onTogglePublished={() => void run(stage.key, () => updateEventStage(accessToken, slug, stage.key, { published: !stage.published }))}
                    onReset={() => setResetTarget(stage)}
                    onAddMatch={() => void run(stage.key, () => createEventMatch(accessToken, slug, { stage_key: stage.key }))}
                    onEditMatch={setEditing}
                    onMapSelect={onMapSelect}
                />
            ))}

            <ConfirmModal
                isOpen={!!resetTarget}
                onClose={() => setResetTarget(null)}
                onConfirm={() => {
                    const stage = resetTarget
                    setResetTarget(null)
                    if (stage) void run(stage.key, () => resetEventStage(accessToken, slug, stage.key))
                }}
                title="Reset stage"
                message={`Reset "${resetTarget?.name}"?`}
                detail="Its matches, groups and results are deleted permanently. Later stages seeded from it will need redrawing."
                confirmText="Reset stage"
                variant="error"
            />

            {editing && (
                <MatchEditorModal
                    accessToken={accessToken}
                    slug={slug}
                    match={editing}
                    entrants={stages.find(stage => stage.id === editing.stage_id)?.entrants ?? []}
                    onClose={() => setEditing(null)}
                    onSaved={() => void refresh()}
                />
            )}
        </div>
    )
}

function StageCard({
    stage, busy, notice, onPreview, onGenerate, onNextRound, onTogglePublished, onReset, onAddMatch,
    onEditMatch, onMapSelect,
}: {
    stage: EventBracketStage
    busy: boolean
    notice: string | null
    onPreview: () => void
    onGenerate: (force: boolean) => void
    onNextRound: () => void
    onTogglePublished: () => void
    onReset: () => void
    onAddMatch: () => void
    onEditMatch: (match: EventMatch) => void
    onMapSelect?: (mapName: string) => void
}) {
    const drawn = stage.matches.length > 0
    const open = stage.matches.filter(match => match.status === 'pending' || match.status === 'scheduled' || match.status === 'live').length

    const rounds = useMemo(() => {
        const grouped = new Map<number, EventMatch[]>()
        for (const match of stage.matches) {
            grouped.set(match.round_no, [...(grouped.get(match.round_no) ?? []), match])
        }
        return [...grouped.entries()].sort(([a], [b]) => a - b)
    }, [stage.matches])

    const groupNames = useMemo(
        () => new Map(stage.groups.map(group => [group.id, group.name])),
        [stage.groups],
    )

    return (
        <SectionCard
            title={stage.name}
            subtitle={`${STAGE_STATUS_LABELS[stage.status]} · ${stage.matches.length} match${stage.matches.length === 1 ? '' : 'es'}${open ? ` · ${open} still open` : ''}`}
            accentClass={stage.published ? 'bg-emerald-400' : 'bg-white/20'}
            action={
                <div className="flex flex-wrap items-center gap-2 justify-end">
                    {!drawn && <ActionButton icon={Eye} onClick={onPreview} disabled={busy}>Preview draw</ActionButton>}
                    {!drawn && <ActionButton tone="emerald" icon={Shuffle} onClick={() => onGenerate(false)} loading={busy}>Draw stage</ActionButton>}
                    {drawn && stage.kind === 'swiss' && (
                        <ActionButton tone="emerald" icon={Plus} onClick={onNextRound} loading={busy}>Next round</ActionButton>
                    )}
                    {drawn && (
                        <ActionButton icon={RefreshCw} onClick={() => onGenerate(true)} disabled={busy}>Redraw</ActionButton>
                    )}
                    <ActionButton
                        icon={stage.published ? EyeOff : Eye}
                        onClick={onTogglePublished}
                        disabled={busy}
                    >
                        {stage.published ? 'Unpublish' : 'Publish'}
                    </ActionButton>
                    {drawn && <ActionButton tone="red" icon={Trash2} onClick={onReset} disabled={busy}>Reset</ActionButton>}
                </div>
            }
        >
            {notice && <p className="text-[11px] text-amber-300">{notice}</p>}

            {!stage.published && (
                <p className="text-[11px] text-muted-foreground">
                    Hidden from everyone but managers until you publish it.
                </p>
            )}

            {!drawn ? (
                <p className="text-sm text-muted-foreground">
                    Not drawn yet. Preview first if you want to see the pairings before they exist.
                </p>
            ) : (
                <div className="space-y-3">
                    {rounds.map(([round, matches]) => (
                        <div key={round} className="space-y-1.5">
                            <h4 className="text-[11px] uppercase tracking-wider text-muted-foreground">
                                {matches[0]?.round_label ?? `Round ${round}`}
                            </h4>
                            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                                {matches.map(match => (
                                    <MatchCard
                                        key={match.id}
                                        match={match}
                                        onClick={() => onEditMatch(match)}
                                        onMapSelect={onMapSelect}
                                        className={cn(!match.published && 'opacity-60')}
                                        footer={match.group_id ? (
                                            <span className="text-[11px] text-muted-foreground">{groupNames.get(match.group_id)}</span>
                                        ) : undefined}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}

                    <button
                        type="button"
                        onClick={onAddMatch}
                        disabled={busy}
                        className="w-full py-2 rounded-lg border border-dashed border-white/15 text-xs text-muted-foreground hover:text-white hover:border-white/25 transition-colors cursor-pointer disabled:opacity-40"
                    >
                        <Plus className="inline size-3.5 mr-1" /> Add a match by hand
                    </button>
                </div>
            )}
        </SectionCard>
    )
}
