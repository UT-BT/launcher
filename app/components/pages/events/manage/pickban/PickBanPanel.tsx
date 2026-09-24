import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { useNavState } from '@/app/components/navigation/useNavState'
import { ErrorBanner } from '@/app/components/pages/teams/teamsShared'
import {
    eventErrorMessage, fetchEventBracket, fetchPickBanConfig,
    type EventBracket, type EventFormatSpec, type PickBanBlock, type PickBanConfig, type PickBanStageConfig,
} from '@/app/utils/api'
import { PickBanStageCard } from './PickBanStageCard'
import {
    pruneDrafts, rebaseDraft, settledDraft, withDraft, withStagePickBan,
    type PickBanDrafts, type PickBanStageDraft,
} from './pickBanEditor'

export interface PickBanPanelProps {
    accessToken: string
    slug: string
    drafts: PickBanDrafts
    onDraftsChange: Dispatch<SetStateAction<PickBanDrafts>>
    onFormatDraftChange: Dispatch<SetStateAction<EventFormatSpec | null>>
    onBracketChange: (bracket: EventBracket) => void
    onConfigChange: (config: PickBanConfig) => void
    onMapSelect?: (mapName: string) => void
}

export function PickBanPanel({
    accessToken, slug, drafts, onDraftsChange, onFormatDraftChange, onBracketChange, onConfigChange, onMapSelect,
}: PickBanPanelProps) {
    const [config, setConfig] = useState<PickBanConfig | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [collapsed, setCollapsed] = useNavState<Record<string, boolean>>('event.manage.pickban.collapsed', {})

    const reload = useCallback(async () => {
        try {
            const next = await fetchPickBanConfig(accessToken, slug)
            setConfig(next)
            setError(null)
            onDraftsChange(current => pruneDrafts(current, next.stages.map(stage => stage.key)))
            return next
        } catch (e) {
            setError(eventErrorMessage(e))
            return null
        }
    }, [accessToken, slug, onDraftsChange])

    useEffect(() => { void reload() }, [reload])

    const changeDraft = useCallback((stage: PickBanStageConfig, next: PickBanStageDraft | null) => {
        onDraftsChange(current => withDraft(current, stage.key, next && settledDraft(stage, next)))
    }, [onDraftsChange])

    const rebaseAfterWrite = useCallback(async (stageKey: string, written: { config: boolean; pool: boolean }) => {
        const next = await reload()
        if (!next) return

        onConfigChange(next)
        const fresh = next.stages.find(stage => stage.key === stageKey)
        if (!fresh) return

        onDraftsChange(current => {
            const draft = current[stageKey]
            return draft ? withDraft(current, stageKey, rebaseDraft(fresh, draft, written)) : current
        })
    }, [reload, onConfigChange, onDraftsChange])

    const handleSaved = useCallback(async (stageKey: string, written: { config: boolean; pool: boolean }, block: PickBanBlock | null) => {
        await rebaseAfterWrite(stageKey, written)
        if (!written.config) return

        onFormatDraftChange(current => current && withStagePickBan(current, stageKey, block))
        fetchEventBracket(accessToken, slug).then(onBracketChange).catch(() => {})
    }, [rebaseAfterWrite, onFormatDraftChange, onBracketChange, accessToken, slug])

    if (!config) {
        return error
            ? <ErrorBanner message={error} />
            : <p className="text-xs text-muted-foreground">Loading the pick/ban setup…</p>
    }

    return (
        <div className="flex flex-col gap-4">
            <ErrorBanner message={error} />

            {config.stages.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                    This event has no format yet. Set one up on the Format tab, then configure each stage&apos;s pick/ban here.
                </p>
            ) : (
                <section aria-label="Stage pick/ban setup" className="flex flex-col gap-4">
                    <p className="text-xs text-muted-foreground">
                        Every stage keeps its own map pool, sequence, pacing and exclusion rule. Stages that are not drawn yet can be set up ahead of time.
                    </p>
                    {config.stages.map((stage, index) => (
                        <PickBanStageCard
                            key={stage.key}
                            accessToken={accessToken}
                            slug={slug}
                            stage={stage}
                            stageIndex={index}
                            draft={drafts[stage.key]}
                            copySources={config.stages.filter(other => other.key !== stage.key && other.pool.length > 0)}
                            open={!collapsed[stage.key]}
                            onOpenChange={open => setCollapsed({ ...collapsed, [stage.key]: !open })}
                            onMapSelect={onMapSelect}
                            onDraftChange={next => changeDraft(stage, next)}
                            onSaved={(written, block) => handleSaved(stage.key, written, block)}
                            onPoolCopied={() => rebaseAfterWrite(stage.key, { config: false, pool: true })}
                        />
                    ))}
                </section>
            )}
        </div>
    )
}
