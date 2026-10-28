import { useMemo } from 'react'
import { AlertTriangle, ArrowLeft, Loader2, Users } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { NavLink } from '@/app/components/navigation/NavLink'
import { useDocumentTitle } from '@/app/components/navigation/useDocumentMeta'
import { useNavState } from '@/app/components/navigation/useNavState'
import { SITE_NAME } from '@/app/components/navigation/titles'
import {
    readTeamOrNotFound, stageChips, teamNames, teamPageStatus, teamPageTeams, teamTilesView,
} from '@/app/components/pages/events/stats/statsView'
import { backdropMapName, emptyStageStats, teamAccentColor, teamPageAccentSlots } from '@/app/components/pages/events/stats/team/teamPageView'
import { TeamPageContext, type TeamPageContextValue } from '@/app/components/pages/events/stats/team/teamShared'
import { TeamHeader } from '@/app/components/pages/events/stats/team/TeamHeader'
import { TeamStageChips } from '@/app/components/pages/events/stats/team/TeamStageChips'
import { TeamTiles } from '@/app/components/pages/events/stats/team/TeamTiles'
import { MatchTimeline } from '@/app/components/pages/events/stats/team/MatchTimeline'
import { MapProfileTable } from '@/app/components/pages/events/stats/team/MapProfileTable'
import { TeamRunsTable } from '@/app/components/pages/events/stats/team/TeamRunsTable'
import '@/app/components/pages/events/stats/team/teamPageAccents.css'
import { useAsync } from '@/app/hooks/useAsync'
import { fetchEventStats, fetchEventTeamStats, type EventTeamStats, type UserProfile } from '@/app/utils/api'

interface EventTeamPageProps {
    eventSlug: string
    eventTeamId: string
    userProfile?: UserProfile
    onBackToTeams: () => void
}

function useStageScope(accessToken: string, eventSlug: string, eventTeamId: string, stage: string | null, whole: EventTeamStats | null | undefined) {
    const read = useAsync(
        signal => readTeamOrNotFound(fetchEventTeamStats(accessToken, eventSlug, eventTeamId, stage, signal)),
        [accessToken, eventSlug, eventTeamId, stage],
        { enabled: stage !== null, errorMessage: 'Failed to load this stage.' },
    )
    if (stage === null || !whole) return { stats: whole ?? null, loading: false, error: null, reload: read.reload }
    if (read.data === undefined) return { stats: null, loading: !read.error, error: read.error, reload: read.reload }
    return {
        stats: read.data ?? emptyStageStats(whole.team),
        loading: read.loading,
        error: read.loading ? null : read.error,
        reload: read.reload,
    }
}

export function EventTeamPage({ eventSlug, eventTeamId, userProfile, onBackToTeams }: EventTeamPageProps) {
    const accessToken = userProfile?.accessToken ?? ''
    const [stage, setStage] = useNavState<string | null>('teamPage.stage', null)
    const read = useAsync(
        signal => readTeamOrNotFound(fetchEventTeamStats(accessToken, eventSlug, eventTeamId, null, signal)),
        [accessToken, eventSlug, eventTeamId],
        { errorMessage: 'Failed to load this team.' },
    )
    const overview = useAsync(
        signal => fetchEventStats(accessToken, eventSlug, null, signal),
        [accessToken, eventSlug],
        { errorMessage: 'Failed to load the event’s stages.' },
    )
    const scope = useStageScope(accessToken, eventSlug, eventTeamId, stage, read.data)
    const status = teamPageStatus(read)
    const whole = read.data ?? null
    const team = whole?.team

    useDocumentTitle(team?.name, SITE_NAME)

    const context = useMemo<TeamPageContextValue | null>(() => {
        if (!whole) return null
        const slots = teamPageAccentSlots(overview.data?.teams ?? null, whole)
        return {
            eventSlug,
            names: teamNames(teamPageTeams(whole)),
            accentOf: teamId => teamAccentColor(teamId ? slots[teamId] : undefined),
        }
    }, [whole, overview.data, eventSlug])

    const stages = overview.data?.published ? overview.data.stages : []
    const chips = stages.length > 0 ? stageChips(stages, stage) : []

    return (
        <div className="flex flex-col gap-4">
            <NavLink
                view="event-detail"
                params={{ eventSlug, eventTab: 'teams' }}
                onActivate={onBackToTeams}
                className="inline-flex w-fit items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
                <ArrowLeft className="size-3.5" />
                All teams
            </NavLink>

            {status === 'loading' && (
                <div role="status" aria-label="Loading team" className="flex items-center justify-center py-24 text-muted-foreground">
                    <Loader2 className="size-6 animate-spin" />
                </div>
            )}

            {status === 'error' && (
                <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
                    <AlertTriangle className="size-10 text-muted-foreground/30" />
                    <p className="font-medium text-muted-foreground">{read.error}</p>
                    <Button variant="secondary" onClick={read.reload}>Try again</Button>
                </div>
            )}

            {status === 'not-found' && (
                <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
                    <Users className="size-10 text-muted-foreground/30" />
                    <p className="font-medium text-muted-foreground">This team has no published matches in this event.</p>
                </div>
            )}

            {status === 'ready' && whole && team && context && (
                <TeamPageContext.Provider value={context}>
                    <TeamHeader team={team} accent={context.accentOf(team.id)} backdropMap={backdropMapName(whole.map_profile)} />

                    {chips.length > 0 && <TeamStageChips chips={chips} onSelect={setStage} />}

                    {scope.error && (
                        <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                            <AlertTriangle className="size-8 text-muted-foreground/30" />
                            <p className="font-medium text-muted-foreground">{scope.error}</p>
                            <Button variant="secondary" onClick={scope.reload}>Try again</Button>
                        </div>
                    )}

                    {!scope.error && !scope.stats && (
                        <div role="status" aria-label="Loading stage" className="flex items-center justify-center py-16 text-muted-foreground">
                            <Loader2 className="size-6 animate-spin" />
                        </div>
                    )}

                    {!scope.error && scope.stats && (
                        <div className="flex flex-col gap-6" aria-busy={scope.loading}>
                            <TeamTiles tiles={teamTilesView(scope.stats)} />

                            <section aria-labelledby="team-matches-heading" className="flex flex-col gap-3">
                                <div className="flex flex-wrap items-baseline justify-between gap-2">
                                    <h2 id="team-matches-heading" className="text-lg font-bold text-foreground">Matches</h2>
                                    <span className="text-xs text-muted-foreground">In play order · official results only</span>
                                </div>
                                <MatchTimeline matches={scope.stats.matches} teamId={team.id} teamName={team.name} />
                            </section>

                            <MapProfileTable rows={scope.stats.map_profile} teamName={team.name} />

                            <TeamRunsTable stats={scope.stats} />
                        </div>
                    )}
                </TeamPageContext.Provider>
            )}
        </div>
    )
}
