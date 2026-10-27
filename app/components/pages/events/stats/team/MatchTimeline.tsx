import { cn } from '@/lib/utils'
import { useNavState } from '@/app/components/navigation/useNavState'
import type { EventTeamStatsMatch } from '@/app/utils/api'
import { expandedMatchIds, type MatchToggles } from './teamPageView'
import { MatchCard } from './MatchCard'
import { RESULT_RINGS } from './teamShared'

function nodeTone(match: EventTeamStatsMatch): string {
    if ((match.status === 'complete' || match.status === 'forfeit') && match.result) return RESULT_RINGS[match.result]
    if (match.status === 'live') return 'border-emerald-400 bg-emerald-400'
    return 'border-hairline/30'
}

export function MatchTimeline({ matches, teamId, teamName }: {
    matches: EventTeamStatsMatch[]
    teamId: string
    teamName: string
}) {
    const [toggles, setToggles] = useNavState<MatchToggles>('teamMatches.toggles', {})
    const expanded = expandedMatchIds(matches, toggles)

    if (matches.length === 0) {
        return (
            <div className="rounded-xl border border-hairline/10 bg-card/30 px-4 py-8 text-center text-sm text-muted-foreground">
                No matches in this stage yet.
            </div>
        )
    }

    return (
        <ol className="flex flex-col">
            {matches.map((match, index) => (
                <li key={match.id} className="flex gap-3">
                    <span aria-hidden className="flex w-4 shrink-0 flex-col items-center">
                        <span className={cn('h-5 w-0.5', index > 0 && 'bg-hairline/15')} />
                        <span className={cn('size-4 shrink-0 rounded-full border-[3px] bg-background', nodeTone(match))} />
                        <span className={cn('w-0.5 flex-1', index < matches.length - 1 && 'bg-hairline/15')} />
                    </span>
                    <div className="min-w-0 flex-1 pb-3">
                        <MatchCard
                            match={match}
                            teamId={teamId}
                            teamName={teamName}
                            expanded={expanded.has(match.id)}
                            onToggle={() => setToggles({ ...toggles, [match.id]: !expanded.has(match.id) })}
                        />
                    </div>
                </li>
            ))}
        </ol>
    )
}
