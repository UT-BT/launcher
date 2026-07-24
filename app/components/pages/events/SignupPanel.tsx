import { useState } from 'react'
import { Check, LogIn, Trash2, UserPlus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/app/components/ui/button'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { ConfirmModal } from '@/app/components/shared/ConfirmModal'
import { requestLogin } from '@/app/components/shared/AuthRequiredModal'
import {
    acceptEventInvite, createEventTeam, declineEventInvite, deleteEventTeam, deleteEventVolunteer,
    eventErrorMessage, inviteEventPartner, joinEventLfp, leaveEventLfp, setEventVolunteer, updateEventTeam,
    type EventDetail, type EventTeam, type MyEventStatus, type UserProfile,
} from '@/app/utils/api'
import { ErrorBanner, SectionCard, StatusBadge, teamInputClass } from '@/app/components/pages/teams/teamsShared'
import { PlayerSearchInput } from '@/app/components/pages/teams/PlayerSearchInput'
import { BROWSER_TIMEZONE } from './eventsShared'
import { emptySignupFields, SignupFieldsInputs, toSignupPayload, VolunteerCheckboxes, type SignupFieldsValue } from './SignupFieldsInputs'

interface SignupPanelProps {
    accessToken?: string
    userProfile?: UserProfile
    event: EventDetail
    my: MyEventStatus | null
    myLoading: boolean
    onRefresh: () => void
}

function TeamStatusLine({ team, teamSize }: { team: EventTeam; teamSize: number }) {
    if (team.status === 'registered') {
        return <p className="text-xs text-emerald-300">Your team is registered. See you in the cup!</p>
    }
    return (
        <p className="text-xs text-amber-300">
            Roster incomplete ({team.member_count}/{teamSize}) — your team counts once every spot is filled.
        </p>
    )
}

export function SignupPanel({ accessToken, userProfile, event, my, myLoading, onRefresh }: SignupPanelProps) {
    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)
    const [confirmDelete, setConfirmDelete] = useState(false)
    const [declineTarget, setDeclineTarget] = useState<EventTeam | null>(null)
    const [acceptTargetId, setAcceptTargetId] = useState<string | null>(null)

    const [teamName, setTeamName] = useState('')
    const [partner, setPartner] = useState<{ id: string; alias: string | null } | null>(null)
    const [createFields, setCreateFields] = useState<SignupFieldsValue>(() => emptySignupFields(BROWSER_TIMEZONE))
    const [acceptFields, setAcceptFields] = useState<SignupFieldsValue>(() => emptySignupFields(BROWSER_TIMEZONE))
    const [lfpOpen, setLfpOpen] = useState(false)
    const [lfpFields, setLfpFields] = useState<SignupFieldsValue>(() => emptySignupFields(BROWSER_TIMEZONE))
    const [lfpNote, setLfpNote] = useState('')
    const [renameValue, setRenameValue] = useState<string | null>(null)
    const [volunteerValue, setVolunteerValue] = useState<{ streaming: boolean; casting: boolean; admining: boolean } | null>(null)

    const run = async (action: () => Promise<unknown>) => {
        setBusy(true)
        setError(null)
        try {
            await action()
            onRefresh()
        } catch (e) {
            setError(eventErrorMessage(e))
        } finally {
            setBusy(false)
        }
    }

    if (!accessToken) {
        return (
            <SectionCard title="Sign up" subtitle="Log in with Discord to register for this event.">
                <Button onClick={() => requestLogin({ feature: 'sign up for events' })}>
                    <LogIn className="size-4" /> Log in to sign up
                </Button>
            </SectionCard>
        )
    }

    if (myLoading || !my) {
        return <div className="py-10 text-center text-sm text-muted-foreground">Loading your signup…</div>
    }

    const signupsOpen = event.signups_open
    const team = my.team
    const invitations = my.invitations ?? []
    const isCaptain = !!team && team.captain === String(userProfile?.id ?? '')
    const rosterFull = !!team && team.member_count >= event.team_size
    const pendingInvitee = team?.members.find(member => member.status === 'invited') ?? null
    const selfMember = team?.members.find(member => member.user === String(userProfile?.id ?? '')) ?? null

    return (
        <div className="space-y-4">
            {error && <ErrorBanner message={error} />}
            {!signupsOpen && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-300 text-sm">
                    Signups are currently closed for this event.
                </div>
            )}

            {team && (
                <SectionCard title={team.name} subtitle="Your team for this event">
                    <TeamStatusLine team={team} teamSize={event.team_size} />
                    <div className="space-y-2">
                        {team.members.map(member => (
                            <div key={member.user} className="flex items-center justify-between gap-3 p-2 rounded-lg bg-card/40 border border-white/5">
                                <PlayerInfo userId={member.user} alias={member.alias} size="sm" showYouBadge={member.user === String(userProfile?.id ?? '')} />
                                <div className="flex items-center gap-2">
                                    {member.role === 'captain' && (
                                        <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border bg-accent-500/15 text-accent-300 border-accent-500/30">Captain</span>
                                    )}
                                    <StatusBadge status={member.status === 'invited' ? 'invited' : 'active'} />
                                </div>
                            </div>
                        ))}
                    </div>

                    {isCaptain && !rosterFull && signupsOpen && (
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">
                                {pendingInvitee ? 'Invite someone else (replaces the pending invite)' : 'Invite your partner'}
                            </label>
                            <PlayerSearchInput
                                accessToken={accessToken}
                                disabled={busy}
                                excludeIds={new Set(team.members.map(member => member.user))}
                                onPick={player => void run(() => inviteEventPartner(accessToken, event.slug, team.id, String(player.id)))}
                                placeholder="Search a player to invite…"
                            />
                        </div>
                    )}

                    {signupsOpen && (
                        <div className="flex flex-wrap items-center gap-2">
                            {renameValue === null ? (
                                <Button variant="outline" size="sm" disabled={busy} onClick={() => setRenameValue(team.name)}>
                                    Rename team
                                </Button>
                            ) : (
                                <div className="flex items-center gap-2 flex-wrap">
                                    <input
                                        value={renameValue}
                                        maxLength={24}
                                        onChange={e => setRenameValue(e.target.value)}
                                        className={cn(teamInputClass, 'w-56')}
                                    />
                                    <Button
                                        size="sm"
                                        disabled={busy || !renameValue.trim()}
                                        onClick={() => void run(async () => {
                                            await updateEventTeam(accessToken, event.slug, team.id, { name: renameValue.trim() })
                                            setRenameValue(null)
                                        })}
                                    >
                                        <Check className="size-4" /> Save
                                    </Button>
                                    <Button variant="ghost" size="sm" disabled={busy} onClick={() => setRenameValue(null)}>
                                        <X className="size-4" />
                                    </Button>
                                </div>
                            )}
                            <Button variant="destructive" size="sm" disabled={busy} onClick={() => setConfirmDelete(true)}>
                                <Trash2 className="size-4" /> Delete team
                            </Button>
                        </div>
                    )}

                    {selfMember && (
                        <p className="text-[11px] text-muted-foreground">
                            Your signup info — timezone: {selfMember.timezone || 'not set'} · availability: {selfMember.availability || 'not set'}
                        </p>
                    )}
                </SectionCard>
            )}

            {!team && invitations.length > 0 && (
                <SectionCard
                    title={invitations.length === 1 ? 'Team invitation' : `Team invitations (${invitations.length})`}
                    subtitle={invitations.length === 1
                        ? 'You have been invited to join this team.'
                        : 'You have been invited by several teams — accepting one dismisses the others.'}
                >
                    <div className="space-y-3">
                        {invitations.map(invitation => (
                            <div key={invitation.id} className="p-3 rounded-lg bg-card/40 border border-white/5 space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <h3 className="text-sm font-semibold text-foreground">{invitation.name}</h3>
                                    <div className="flex items-center gap-2">
                                        {acceptTargetId !== invitation.id && (
                                            <Button
                                                size="sm"
                                                disabled={busy || !signupsOpen}
                                                onClick={() => setAcceptTargetId(invitation.id)}
                                            >
                                                <Check className="size-4" /> Accept
                                            </Button>
                                        )}
                                        <Button variant="outline" size="sm" disabled={busy} onClick={() => setDeclineTarget(invitation)}>
                                            <X className="size-4" /> Decline
                                        </Button>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    {invitation.members.filter(member => member.status === 'active').map(member => (
                                        <PlayerInfo key={member.user} userId={member.user} alias={member.alias} size="sm" />
                                    ))}
                                </div>
                                {acceptTargetId === invitation.id && (
                                    <div className="space-y-3 pt-1 border-t border-white/5">
                                        <SignupFieldsInputs value={acceptFields} onChange={setAcceptFields} disabled={busy || !signupsOpen} />
                                        <div className="flex items-center gap-2">
                                            <Button
                                                size="sm"
                                                disabled={busy || !signupsOpen}
                                                onClick={() => void run(() => acceptEventInvite(accessToken, event.slug, invitation.id, toSignupPayload(acceptFields)))}
                                            >
                                                <Check className="size-4" /> Confirm — join {invitation.name}
                                            </Button>
                                            <Button variant="ghost" size="sm" disabled={busy} onClick={() => setAcceptTargetId(null)}>Cancel</Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </SectionCard>
            )}

            {!team && invitations.length === 0 && (
                <SectionCard title="Register a team" subtitle={`Create your ${event.team_size > 1 ? `${event.team_size}-player` : 'solo'} team for this event.`}>
                    <div className="space-y-3">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Team name</label>
                            <input
                                value={teamName}
                                disabled={busy || !signupsOpen}
                                maxLength={24}
                                onChange={e => setTeamName(e.target.value)}
                                placeholder="3-24 characters"
                                className={cn(teamInputClass, 'w-full disabled:opacity-50')}
                            />
                        </div>
                        {event.team_size > 1 && (
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground">Partner (optional, you can invite one later)</label>
                                {partner ? (
                                    <div className="flex items-center justify-between gap-3 p-2 rounded-lg bg-card/40 border border-white/5">
                                        <PlayerInfo userId={partner.id} alias={partner.alias} size="sm" interactive={false} />
                                        <Button variant="ghost" size="sm" disabled={busy} onClick={() => setPartner(null)}>
                                            <X className="size-4" />
                                        </Button>
                                    </div>
                                ) : (
                                    <PlayerSearchInput
                                        accessToken={accessToken}
                                        disabled={busy || !signupsOpen}
                                        excludeIds={new Set([String(userProfile?.id ?? '')])}
                                        onPick={player => setPartner({ id: String(player.id), alias: player.alias })}
                                        placeholder="Search your partner…"
                                    />
                                )}
                            </div>
                        )}
                        <SignupFieldsInputs value={createFields} onChange={setCreateFields} disabled={busy || !signupsOpen} />
                        <Button
                            disabled={busy || !signupsOpen || !teamName.trim()}
                            onClick={() => void run(() => createEventTeam(accessToken, event.slug, {
                                name: teamName.trim(),
                                partner: partner?.id ?? null,
                                ...toSignupPayload(createFields),
                            }))}
                        >
                            <UserPlus className="size-4" /> Sign up team
                        </Button>
                    </div>
                </SectionCard>
            )}

            {!team && (
                <SectionCard title="Looking for a partner?" subtitle="No teammate yet? List yourself so captains can find you.">
                    {my.lfp ? (
                        <div className="space-y-3">
                            <p className="text-sm text-emerald-300">You are on the looking-for-partner list.</p>
                            <Button variant="outline" size="sm" disabled={busy} onClick={() => void run(() => leaveEventLfp(accessToken, event.slug))}>
                                Remove me from the list
                            </Button>
                        </div>
                    ) : lfpOpen ? (
                        <div className="space-y-3">
                            <SignupFieldsInputs value={lfpFields} onChange={setLfpFields} disabled={busy || !signupsOpen} />
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground">Note (optional)</label>
                                <input
                                    value={lfpNote}
                                    disabled={busy || !signupsOpen}
                                    maxLength={500}
                                    onChange={e => setLfpNote(e.target.value)}
                                    placeholder="Anything a potential partner should know"
                                    className={cn(teamInputClass, 'w-full disabled:opacity-50')}
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    disabled={busy || !signupsOpen}
                                    onClick={() => void run(() => joinEventLfp(accessToken, event.slug, {
                                        ...toSignupPayload(lfpFields),
                                        note: lfpNote.trim() || null,
                                    }))}
                                >
                                    Join the list
                                </Button>
                                <Button variant="ghost" size="sm" disabled={busy} onClick={() => setLfpOpen(false)}>Cancel</Button>
                            </div>
                        </div>
                    ) : (
                        <Button variant="outline" disabled={busy || !signupsOpen} onClick={() => setLfpOpen(true)}>
                            Add me to the list
                        </Button>
                    )}
                </SectionCard>
            )}

            <SectionCard title="Volunteer" subtitle="Help run the event — streaming, co-casting or admining matches. No team needed.">
                {volunteerValue === null ? (
                    <div className="flex flex-wrap items-center gap-2">
                        {my.volunteer ? (
                            <>
                                <p className="text-sm text-muted-foreground w-full">
                                    You volunteered for: {[
                                        my.volunteer.streaming && 'streaming',
                                        my.volunteer.casting && 'co-casting',
                                        my.volunteer.admining && 'admining matches',
                                    ].filter(Boolean).join(', ') || 'nothing yet'}.
                                </p>
                                <Button variant="outline" size="sm" disabled={busy} onClick={() => setVolunteerValue({
                                    streaming: my.volunteer!.streaming,
                                    casting: my.volunteer!.casting,
                                    admining: my.volunteer!.admining,
                                })}>
                                    Edit
                                </Button>
                                <Button variant="ghost" size="sm" disabled={busy} onClick={() => void run(() => deleteEventVolunteer(accessToken, event.slug))}>
                                    Withdraw
                                </Button>
                            </>
                        ) : (
                            <Button variant="outline" size="sm" disabled={busy} onClick={() => setVolunteerValue({ streaming: false, casting: false, admining: false })}>
                                Volunteer to help
                            </Button>
                        )}
                    </div>
                ) : (
                    <div className="space-y-3">
                        <VolunteerCheckboxes value={volunteerValue} onChange={setVolunteerValue} disabled={busy} />
                        <div className="flex items-center gap-2">
                            <Button
                                size="sm"
                                disabled={busy || !(volunteerValue.streaming || volunteerValue.casting || volunteerValue.admining)}
                                onClick={() => void run(async () => {
                                    await setEventVolunteer(accessToken, event.slug, volunteerValue)
                                    setVolunteerValue(null)
                                })}
                            >
                                <Check className="size-4" /> Save
                            </Button>
                            <Button variant="ghost" size="sm" disabled={busy} onClick={() => setVolunteerValue(null)}>Cancel</Button>
                        </div>
                    </div>
                )}
            </SectionCard>

            {team && (
                <ConfirmModal
                    isOpen={confirmDelete}
                    onClose={() => setConfirmDelete(false)}
                    onConfirm={() => { setConfirmDelete(false); void run(() => deleteEventTeam(accessToken, event.slug, team.id)) }}
                    title="Delete team"
                    message={`Delete "${team.name}" from this event?`}
                    detail="This removes the whole team, including your partner's signup. You can sign up again while signups are open."
                    confirmText="Delete"
                    cancelText="Keep team"
                    variant="error"
                />
            )}
            {declineTarget && (
                <ConfirmModal
                    isOpen
                    onClose={() => setDeclineTarget(null)}
                    onConfirm={() => {
                        const target = declineTarget
                        setDeclineTarget(null)
                        void run(() => declineEventInvite(accessToken, event.slug, target.id))
                    }}
                    title="Decline invitation"
                    message={`Decline the invitation to "${declineTarget.name}"?`}
                    confirmText="Decline"
                    cancelText="Cancel"
                />
            )}
        </div>
    )
}
