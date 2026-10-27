import { useId, useState, type ReactNode } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/app/components/ui/button'
import { useNavState } from '@/app/components/navigation/useNavState'
import { useAsync } from '@/app/hooks/useAsync'
import { fetchEventStats, type EventStats, type EventStatsTeam } from '@/app/utils/api'
import {
    DEFAULT_TEAM_SORT, accentSlots, sortTeams, stageChips, stageScopeLabel, statsMode, teamCardView, teamNames,
    type TeamCardView, type TeamSortKey,
} from './statsView'
import { StageChips } from './StageChips'
import { TeamCardsGrid, TeamSortControl } from './TeamCardsGrid'
import { CupAtAGlance } from './CupAtAGlance'
import { MapStatsTable } from './MapStatsTable'

export function overviewTeamCards(stats: EventStats, allTeams: readonly EventStatsTeam[] | null, sort: TeamSortKey): TeamCardView[] {
    const known = allTeams ?? stats.teams
    const slots = accentSlots(known)
    const names = teamNames([...known, ...stats.teams])
    return sortTeams(stats.teams, sort).map(team => teamCardView(team, { slots, names }))
}

export type OverviewTeam = Pick<TeamCardView, 'id' | 'name' | 'members' | 'accentSlot'>

export function overviewTeams(cards: readonly OverviewTeam[]): Record<string, OverviewTeam> {
    return Object.fromEntries(cards.map(card => [card.id, card]))
}

interface StatsOverviewProps {
    eventSlug: string
    accessToken: string
    refreshKey: unknown
    roster: ReactNode
}

export function StatsOverview({ eventSlug, accessToken, refreshKey, roster }: StatsOverviewProps) {
    const [stage, setStage] = useNavState<string | null>('event.statsStage', null)
    const [sort, setSort] = useNavState<TeamSortKey>('event.statsSort', DEFAULT_TEAM_SORT)
    const read = useAsync(
        signal => fetchEventStats(accessToken, eventSlug, stage, signal),
        [accessToken, eventSlug, stage, refreshKey],
        { errorMessage: 'Failed to load the event stats.' },
    )
    const stats = read.data
    const [allTeams, setAllTeams] = useState<EventStatsTeam[] | null>(null)
    if (stats && stats.stage === null && stats.teams !== allTeams) setAllTeams(stats.teams)
    const teamsHeadingId = useId()
    const mapsHeadingId = useId()

    if (!stats) {
        if (read.error) return <StatsError message={read.error} onRetry={read.reload} />
        return (
            <div role="status" aria-label="Loading event stats" className="flex items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="size-6 animate-spin" />
            </div>
        )
    }

    if (statsMode(stats) === 'roster') return <>{roster}</>

    const cards = overviewTeamCards(stats, allTeams, sort)
    const teams = overviewTeams(cards)

    return (
        <div className={cn('flex flex-col gap-6 transition-opacity', read.loading && 'opacity-60')} aria-busy={read.loading}>
            {read.error && <StatsError message={read.error} onRetry={read.reload} compact />}

            <div className="flex flex-wrap items-center justify-between gap-3">
                <StageChips chips={stageChips(stats.stages, stage)} onSelect={setStage} />
                <TeamSortControl value={sort} onChange={setSort} />
            </div>

            <CupAtAGlance records={stats.records} teams={teams} eventSlug={eventSlug} />

            <section aria-labelledby={teamsHeadingId} className="flex flex-col gap-2.5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <h2 id={teamsHeadingId} className="text-[10px] uppercase tracking-wider text-muted-foreground">Teams</h2>
                    <span className="text-xs text-muted-foreground">{stageScopeLabel(stats.stages, stats.stage)} · official results only</span>
                </div>
                <TeamCardsGrid cards={cards} eventSlug={eventSlug} />
            </section>

            <section aria-labelledby={mapsHeadingId} className="flex flex-col gap-2.5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <h2 id={mapsHeadingId} className="text-[10px] uppercase tracking-wider text-muted-foreground">Maps</h2>
                    <span className="text-xs text-muted-foreground">Bans and picks from fully revealed pick & bans · renamed maps grouped under their newest name</span>
                </div>
                <MapStatsTable maps={stats.maps} teams={teams} eventSlug={eventSlug} />
            </section>
        </div>
    )
}

function StatsError({ message, onRetry, compact = false }: { message: string; onRetry: () => void; compact?: boolean }) {
    if (compact) {
        return (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                {message}
                <Button variant="secondary" size="sm" onClick={onRetry}>Try again</Button>
            </div>
        )
    }
    return (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <AlertTriangle className="size-10 text-muted-foreground/30" />
            <p className="font-medium text-muted-foreground">{message}</p>
            <Button variant="secondary" onClick={onRetry}>Try again</Button>
        </div>
    )
}
