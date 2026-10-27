import { cn } from '@/lib/utils'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { PICK_BAN_HUES, PICK_BAN_TONES } from '@/app/components/broadcast/broadcastTone'
import type { EventTeamStatsPickBan, PickBanStepAction } from '@/app/utils/api'
import { pickBanStepViews } from './teamPageView'
import { useTeamPage } from './teamShared'

const ACTION_TONES: Record<PickBanStepAction, string> = {
    ban: 'text-red-300',
    pick: 'text-emerald-300',
    decider: PICK_BAN_TONES.gold.text,
}

export function PickBanSteps({ pickBan }: { pickBan: EventTeamStatsPickBan }) {
    const { names, accentOf } = useTeamPage()
    const steps = pickBanStepViews(pickBan, names)

    return (
        <ol className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-4" aria-label="Pick and ban steps">
            {steps.map(step => (
                <li
                    key={step.key}
                    className="flex min-w-0 items-center gap-2 rounded-lg border border-hairline/10 bg-hairline/[0.03] px-2 py-1.5"
                    style={{ borderLeft: `3px solid ${step.teamId ? accentOf(step.teamId) : PICK_BAN_HUES.gold}` }}
                >
                    <span className="shrink-0 text-lg font-black tabular-nums text-muted-foreground">{step.number}</span>
                    <span className="flex min-w-0 flex-col">
                        <span className="flex min-w-0 items-center gap-1.5 text-[10px]">
                            <span className={cn('shrink-0 font-bold uppercase tracking-wider', ACTION_TONES[step.action])}>{step.actionLabel}</span>
                            {step.teamName && <span className="truncate text-muted-foreground">{step.teamName}</span>}
                            {step.actor && (
                                <>
                                    <span aria-hidden className="text-muted-foreground">·</span>
                                    <PlayerInfo userId={step.actor.id} alias={step.actor.name} size="sm" presentation="name" />
                                </>
                            )}
                        </span>
                        <span className="truncate text-xs font-semibold text-foreground">{step.displayName}</span>
                    </span>
                </li>
            ))}
        </ol>
    )
}
