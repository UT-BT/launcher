import { useState } from 'react'
import { Button } from '@/app/components/ui/button'
import { Tooltip } from '@/app/components/ui/tooltip'
import { NavLink } from '@/app/components/navigation/NavLink'
import { acceptTeamInvite, declineTeamInvite, type TeamCore, type TeamDetail } from '@/app/utils/api'
import { ErrorBanner, SectionCard, TagChip, teamErrorMessage } from './teamsShared'

interface InvitationsSectionProps {
    accessToken: string
    invitations: TeamCore[]
    hasActiveTeam: boolean
    onAccepted: (team: TeamDetail) => void
    onDeclined: (teamId: string) => void
    onSelect: (teamId: string) => void
}

export function InvitationsSection({
    accessToken, invitations, hasActiveTeam, onAccepted, onDeclined, onSelect,
}: InvitationsSectionProps) {
    const [busyId, setBusyId] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    if (invitations.length === 0) return null

    const accept = async (team: TeamCore) => {
        setBusyId(team.id)
        setError(null)
        try {
            onAccepted(await acceptTeamInvite(accessToken, team.id))
        } catch (e) {
            setError(teamErrorMessage(e))
            setBusyId(null)
        }
    }

    const decline = async (team: TeamCore) => {
        setBusyId(team.id)
        setError(null)
        try {
            await declineTeamInvite(accessToken, team.id)
            onDeclined(team.id)
        } catch (e) {
            setError(teamErrorMessage(e))
        } finally {
            setBusyId(null)
        }
    }

    return (
        <SectionCard
            title="Your Invitations"
            subtitle={hasActiveTeam ? 'Leave your current team to accept an invitation.' : 'Accept to join a team.'}
        >
            <ErrorBanner message={error} />
            <div className="space-y-2">
                {invitations.map(team => {
                    const busy = busyId === team.id
                    const acceptButton = (
                        <Button
                            size="sm"
                            disabled={hasActiveTeam || busy}
                            onClick={() => accept(team)}
                            className="shrink-0"
                        >
                            {busy ? 'Working…' : 'Accept'}
                        </Button>
                    )
                    return (
                        <div key={team.id} className="flex items-center gap-3 px-3 py-2.5 bg-white/5 border border-white/5 rounded-lg">
                            <NavLink
                                view="team-detail"
                                params={{ teamId: team.id }}
                                onActivate={() => onSelect(team.id)}
                                className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer group"
                            >
                                <span className="text-sm font-semibold text-white truncate group-hover:underline underline-offset-2">
                                    {team.name}
                                </span>
                                <TagChip tag={team.tag} />
                            </NavLink>
                            <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                                {team.member_count} {team.member_count === 1 ? 'member' : 'members'}
                            </span>
                            {hasActiveTeam ? (
                                <Tooltip content="Leave your current team to accept">
                                    {acceptButton}
                                </Tooltip>
                            ) : acceptButton}
                            <Button size="sm" variant="secondary" disabled={busy} onClick={() => decline(team)} className="shrink-0">
                                Decline
                            </Button>
                        </div>
                    )
                })}
            </div>
        </SectionCard>
    )
}
