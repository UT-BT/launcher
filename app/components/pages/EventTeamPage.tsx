import { AlertTriangle, ArrowLeft, Loader2, Users } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { NavLink } from '@/app/components/navigation/NavLink'
import { useDocumentTitle } from '@/app/components/navigation/useDocumentMeta'
import { SITE_NAME } from '@/app/components/navigation/titles'
import { readTeamOrNotFound, teamPageStatus } from '@/app/components/pages/events/stats/statsView'
import { useAsync } from '@/app/hooks/useAsync'
import { fetchEventTeamStats, type UserProfile } from '@/app/utils/api'

interface EventTeamPageProps {
    eventSlug: string
    eventTeamId: string
    userProfile?: UserProfile
    onBackToTeams: () => void
}

export function EventTeamPage({ eventSlug, eventTeamId, userProfile, onBackToTeams }: EventTeamPageProps) {
    const accessToken = userProfile?.accessToken ?? ''
    const read = useAsync(
        signal => readTeamOrNotFound(fetchEventTeamStats(accessToken, eventSlug, eventTeamId, null, signal)),
        [accessToken, eventSlug, eventTeamId],
        { errorMessage: 'Failed to load this team.' },
    )
    const status = teamPageStatus(read)
    const team = read.data?.team

    useDocumentTitle(team?.name, SITE_NAME)

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

            {status === 'ready' && team && (
                <h1 className="text-2xl font-black leading-tight text-foreground break-words">{team.name}</h1>
            )}
        </div>
    )
}
