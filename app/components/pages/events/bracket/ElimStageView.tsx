import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { EventBracketStage, EventMatch } from '@/app/utils/api'
import { MatchCard, teamLabel } from './bracketShared'
import { TeamName } from '../TeamRoster'

interface Round {
    no: number
    label: string
    matches: EventMatch[]
}

function buildRounds(stage: EventBracketStage): Round[] {
    const byRound = new Map<number, EventMatch[]>()

    for (const match of stage.matches) {
        byRound.set(match.round_no, [...(byRound.get(match.round_no) ?? []), match])
    }

    return [...byRound.entries()]
        .sort(([a], [b]) => a - b)
        .map(([no, matches]) => ({
            no,
            label: matches[0]?.round_label ?? `Round ${no}`,
            matches: matches.sort((a, b) => a.ordinal - b.ordinal),
        }))
}

function ByeCard({ match }: { match: EventMatch }) {
    return (
        <div className="rounded-lg border border-dashed border-white/10 bg-card/20 px-2.5 py-2 flex items-center gap-2 min-w-0">
            <TeamName teamId={match.team_a?.id} className="truncate text-sm text-muted-foreground">
                {teamLabel(match.team_a, match.slot_a_label)}
            </TeamName>
            <span className="ml-auto shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground/70">bye</span>
        </div>
    )
}

export function ElimStageView({ stage, onMapSelect }: {
    stage: EventBracketStage
    onMapSelect?: (mapName: string) => void
}) {
    const rounds = useMemo(() => buildRounds(stage), [stage])

    if (rounds.length === 0) {
        return <p className="text-sm text-muted-foreground">This stage has not been drawn yet.</p>
    }

    return (
        <div className="overflow-x-auto pb-2">
            <div className="flex gap-4 min-w-max lg:min-w-0">
                {rounds.map(round => (
                    <div key={round.no} className="flex-1 min-w-[15rem] space-y-2">
                        <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground sticky top-0">
                            {round.label}
                        </h3>
                        <div className={cn(
                            'space-y-2',
                            round.no > 1 && 'lg:flex lg:flex-col lg:justify-around lg:h-[calc(100%-1.5rem)]',
                        )}>
                            {round.matches.map(match => (
                                match.status === 'bye'
                                    ? <ByeCard key={match.id} match={match} />
                                    : <MatchCard key={match.id} match={match} onMapSelect={onMapSelect} />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
