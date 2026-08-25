import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { useNavState } from '@/app/components/navigation/useNavState'
import type { EventBracket, EventBracketStage } from '@/app/utils/api'
import { Chip, STAGE_KIND_LABELS, STAGE_STATUS_LABELS } from './bracketShared'
import { GroupStageView } from './GroupStageView'
import { SwissStageView } from './SwissStageView'
import { ElimStageView } from './ElimStageView'

const STAGE_STATUS_STYLES: Record<EventBracketStage['status'], string> = {
    pending: 'bg-white/5 text-muted-foreground border-white/10',
    active: 'bg-accent-500/15 text-accent-300 border-accent-500/30',
    complete: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
}

export function BracketTab({ bracket, loading, onMapSelect }: {
    bracket: EventBracket | null
    loading: boolean
    onMapSelect?: (mapName: string) => void
}) {
    const stages = useMemo(() => bracket?.stages ?? [], [bracket])
    const [stageKey, setStageKey] = useNavState<string>('event.bracketStage', '')

    // Default to whatever is actually happening, not always the first stage.
    const active = useMemo(() => {
        const chosen = stages.find(stage => stage.key === stageKey)
        if (chosen) return chosen
        return stages.find(stage => stage.status === 'active')
            ?? [...stages].reverse().find(stage => stage.status === 'complete')
            ?? stages[0]
            ?? null
    }, [stages, stageKey])

    const specStage = useMemo(
        () => bracket?.format.spec?.stages.find(stage => stage.key === active?.key) ?? null,
        [bracket, active],
    )

    if (loading && !bracket) {
        return <div className="py-8 text-center text-sm text-muted-foreground">Loading bracket…</div>
    }

    if (stages.length === 0) {
        return (
            <p className="text-sm text-muted-foreground">
                The bracket for this event has not been published yet.
            </p>
        )
    }

    return (
        <div className="space-y-4">
            {stages.length > 1 && (
                <div className="flex flex-wrap items-center gap-1.5">
                    {stages.map(stage => (
                        <button
                            key={stage.key}
                            type="button"
                            onClick={() => setStageKey(stage.key)}
                            className={cn(
                                'px-3 py-1.5 rounded-md text-xs font-medium border transition-colors cursor-pointer',
                                stage.key === active?.key
                                    ? 'bg-accent-500/20 border-accent-500/50 text-accent-300'
                                    : 'bg-card/50 border-white/10 text-muted-foreground hover:text-white hover:border-white/20',
                            )}
                        >
                            {stage.name}
                        </button>
                    ))}
                </div>
            )}

            {active && (
                <>
                    <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-sm font-semibold text-foreground">{active.name}</h2>
                        <Chip className="bg-white/5 text-muted-foreground border-white/10">{STAGE_KIND_LABELS[active.kind]}</Chip>
                        <Chip className={STAGE_STATUS_STYLES[active.status]}>{STAGE_STATUS_LABELS[active.status]}</Chip>
                    </div>

                    {active.kind === 'groups' && <GroupStageView stage={active} specStage={specStage} onMapSelect={onMapSelect} />}
                    {active.kind === 'swiss' && <SwissStageView stage={active} onMapSelect={onMapSelect} />}
                    {active.kind === 'single_elim' && <ElimStageView stage={active} onMapSelect={onMapSelect} />}
                </>
            )}
        </div>
    )
}
