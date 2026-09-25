import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { ActionButton } from '@/app/components/pages/admin/components/controls'
import { ErrorBanner, SectionCard } from '@/app/components/pages/teams/teamsShared'
import {
    eventErrorMessage, setPickBanStageConfig, setPickBanStagePool,
    type PickBanBlock, type PickBanStageConfig,
} from '@/app/utils/api'
import { PickBanPoolEditor, type PoolProblem } from './PickBanPoolEditor'
import { PickBanSequenceSettings } from './PickBanSequenceSettings'
import {
    configChanged, configErrors, configInput, draftFromStage, poolChanged, poolError, poolInput, stageWarnings,
    validateConfigDraft, warningMessage, type PickBanStageDraft, type PickBanWarning,
} from './pickBanEditor'

interface PickBanStageCardProps {
    accessToken: string
    slug: string
    stage: PickBanStageConfig
    stageIndex: number
    draft: PickBanStageDraft | undefined
    copySources: PickBanStageConfig[]
    open: boolean
    onOpenChange: (open: boolean) => void
    onMapSelect?: (mapName: string) => void
    onDraftChange: (draft: PickBanStageDraft | null) => void
    onSaved: (written: { config: boolean; pool: boolean }, block: PickBanBlock | null) => Promise<void>
    onPoolCopied: () => Promise<void>
}

function WarningList({ warnings, configured }: { warnings: PickBanWarning[]; configured: boolean }) {
    if (!configured) {
        return <p className="text-[11px] text-muted-foreground">Choose a sequence preset to see whether the pool is big enough.</p>
    }

    if (warnings.length === 0) {
        return (
            <p className="flex items-center gap-1.5 text-[11px] text-emerald-300">
                <CheckCircle2 className="size-3.5 shrink-0" />
                The pool fits the full sequence for every match, and the sequence matches the stage&apos;s best-of.
            </p>
        )
    }

    return (
        <ul className="flex flex-col gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5" aria-label="Picks & Bans warnings">
            {warnings.map(warning => (
                <li key={`${warning.kind}-${'scope' in warning ? warning.scope : 'sequence'}`} className="flex items-start gap-1.5 text-[11px] leading-snug text-amber-300">
                    <AlertTriangle className="size-3.5 shrink-0 mt-px" />
                    <span>{warningMessage(warning)}</span>
                </li>
            ))}
        </ul>
    )
}

function stageSubtitle(stage: PickBanStageConfig, draft: PickBanStageDraft): string {
    const maps = `${draft.pool.length} map${draft.pool.length === 1 ? '' : 's'} in the pool`
    const sequence = draft.presetId ?? (draft.sequence ? 'custom sequence' : 'no sequence yet')
    return `Best of ${stage.best_of} · ${maps} · ${sequence}`
}

export function PickBanStageCard({
    accessToken, slug, stage, stageIndex, draft, copySources, open, onOpenChange, onMapSelect,
    onDraftChange, onSaved, onPoolCopied,
}: PickBanStageCardProps) {
    const editing = useMemo(() => draft ?? draftFromStage(stage), [draft, stage])
    const [busy, setBusy] = useState(false)
    const [serverErrors, setServerErrors] = useState<Record<string, string>>({})
    const [cardError, setCardError] = useState<string | null>(null)
    const [poolProblem, setPoolProblem] = useState<PoolProblem | null>(null)

    const configDirty = !!draft && configChanged(stage, draft)
    const poolDirty = !!draft && poolChanged(stage, draft)
    const validation = configDirty ? validateConfigDraft(editing) : {}
    const blocked = Object.keys(validation).length > 0
    const errors = { ...validation, ...serverErrors }
    const warnings = stageWarnings(stage, draft)

    const clearProblems = () => {
        setServerErrors({})
        setCardError(null)
        setPoolProblem(null)
    }

    const change = (next: PickBanStageDraft) => {
        clearProblems()
        onDraftChange(next)
    }

    const discard = () => {
        clearProblems()
        onDraftChange(null)
    }

    const save = async () => {
        if (!draft || blocked) return

        setBusy(true)
        clearProblems()
        const written = { config: false, pool: false }
        let block: PickBanBlock | null = null

        const input = configDirty ? configInput(draft) : null
        if (input) {
            try {
                block = (await setPickBanStageConfig(accessToken, slug, stage.key, input)).pick_ban
                written.config = true
            } catch (e) {
                const placed = configErrors(eventErrorMessage(e), stageIndex)
                setServerErrors(placed.fields)
                setCardError(placed.general ?? 'The sequence settings were not saved. See the highlighted fields.')
            }
        }

        if (poolDirty) {
            try {
                await setPickBanStagePool(accessToken, slug, stage.key, poolInput(draft))
                written.pool = true
            } catch (e) {
                setPoolProblem(poolError(eventErrorMessage(e), draft.pool))
            }
        }

        if (written.config || written.pool) await onSaved(written, block)
        setBusy(false)
    }

    const copied = async () => {
        clearProblems()
        await onPoolCopied()
    }

    return (
        <SectionCard
            title={stage.name}
            subtitle={stageSubtitle(stage, editing)}
            collapsible
            open={open}
            onOpenChange={onOpenChange}
            accentClass={draft ? 'bg-amber-300' : 'bg-accent-400'}
            action={
                <div className="flex flex-wrap items-center gap-2">
                    {draft && <span className="text-[11px] font-medium text-amber-300">Unsaved changes</span>}
                    <ActionButton onClick={discard} disabled={!draft || busy}>Discard</ActionButton>
                    <ActionButton
                        tone="emerald"
                        onClick={() => void save()}
                        loading={busy}
                        disabled={!draft || blocked}
                        title={blocked ? 'Fix the highlighted fields first' : undefined}
                    >
                        Save Stage
                    </ActionButton>
                </div>
            }
        >
            <ErrorBanner message={cardError} />
            <WarningList warnings={warnings} configured={!!editing.sequence} />

            <div className="grid gap-4 items-start xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
                <PickBanSequenceSettings
                    stage={stage}
                    draft={editing}
                    errors={errors}
                    disabled={busy}
                    onChange={change}
                />
                <PickBanPoolEditor
                    accessToken={accessToken}
                    slug={slug}
                    stage={stage}
                    draft={editing}
                    poolDirty={poolDirty}
                    copySources={copySources}
                    problem={poolProblem}
                    disabled={busy}
                    onMapSelect={onMapSelect}
                    onChange={change}
                    onProblem={setPoolProblem}
                    onCopied={copied}
                />
            </div>
        </SectionCard>
    )
}
