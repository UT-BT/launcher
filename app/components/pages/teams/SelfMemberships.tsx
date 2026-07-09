import { useState } from 'react'
import { Button } from '@/app/components/ui/button'
import { acceptTeamInvite, type TeamCore, type TeamDetail } from '@/app/utils/api'
import { ErrorBanner, SectionCard, TagChip, teamErrorMessage } from './teamsShared'

interface SelfMembershipsProps {
    accessToken: string
    invitations: TeamCore[]
    applications: TeamCore[]
    onAccepted: (team: TeamDetail) => void
}

function TeamRow({ team, action }: { team: TeamCore; action?: React.ReactNode }) {
    return (
        <div className="flex items-center gap-3 px-3 py-2.5 bg-white/5 border border-white/5 rounded-lg">
            <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="text-sm font-semibold text-white truncate">{team.name}</span>
                <TagChip tag={team.tag} />
            </div>
            <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                {team.member_count} {team.member_count === 1 ? 'member' : 'members'}
            </span>
            {action}
        </div>
    )
}

export function SelfMemberships({ accessToken, invitations, applications, onAccepted }: SelfMembershipsProps) {
    const [acceptingId, setAcceptingId] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    const accept = async (team: TeamCore) => {
        setAcceptingId(team.id)
        setError(null)
        try {
            const detail = await acceptTeamInvite(accessToken, team.id)
            onAccepted(detail)
        } catch (e) {
            setError(teamErrorMessage(e))
        } finally {
            setAcceptingId(null)
        }
    }

    if (invitations.length === 0 && applications.length === 0) return null

    return (
        <div className="grid gap-4 lg:grid-cols-2">
            {invitations.length > 0 && (
                <SectionCard title="Your Invitations" subtitle="Accept to join. To decline, simply leave it — a team manager can withdraw the invite.">
                    <ErrorBanner message={error} />
                    <div className="space-y-2">
                        {invitations.map(team => (
                            <TeamRow
                                key={team.id}
                                team={team}
                                action={
                                    <Button
                                        size="sm"
                                        disabled={acceptingId === team.id}
                                        onClick={() => accept(team)}
                                        className="shrink-0"
                                    >
                                        {acceptingId === team.id ? 'Accepting…' : 'Accept'}
                                    </Button>
                                }
                            />
                        ))}
                    </div>
                </SectionCard>
            )}

            {applications.length > 0 && (
                <SectionCard title="Your Applications" subtitle="Waiting for a team manager to approve you.">
                    <div className="space-y-2">
                        {applications.map(team => (
                            <TeamRow
                                key={team.id}
                                team={team}
                                action={
                                    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border bg-amber-500/15 text-amber-300 border-amber-500/30 shrink-0">
                                        Pending
                                    </span>
                                }
                            />
                        ))}
                    </div>
                </SectionCard>
            )}
        </div>
    )
}
