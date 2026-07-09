import { useState, type ReactNode } from 'react'
import { Pencil, ArrowRightLeft, Trash2, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/app/components/ui/button'
import { Modal } from '@/app/components/ui/modal'
import { ConfirmModal } from '@/app/components/shared/ConfirmModal'
import { formatAddedDate } from '@/app/utils/format'
import {
    disbandTeam, leaveTeam, transferTeamOwnership, updateTeam,
    type TeamDetail, type TeamTagPosition, type UserProfile,
} from '@/app/utils/api'
import { formatTaggedAlias } from './tagFormat'
import { AccessBadge, AccessToggle, ErrorBanner, TagChip, teamInputClass, teamErrorMessage } from './teamsShared'

interface TeamHeaderCardProps {
    accessToken: string
    team: TeamDetail
    isOwner: boolean
    isManager: boolean
    isOwnTeam: boolean
    canLeave: boolean
    rightExtra?: ReactNode
    userProfile?: UserProfile
    onTeamChange: (team: TeamDetail) => void
    onLeftOrDisbanded: () => void
}

const TAG_POSITIONS: TeamTagPosition[] = ['prefix', 'suffix']

export function TeamHeaderCard({
    accessToken, team, isOwner, isManager, isOwnTeam, canLeave, rightExtra,
    userProfile, onTeamChange, onLeftOrDisbanded,
}: TeamHeaderCardProps) {
    const [editing, setEditing] = useState(false)
    const [transferring, setTransferring] = useState(false)
    const [confirmDelete, setConfirmDelete] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [leaving, setLeaving] = useState(false)

    const leave = async () => {
        setLeaving(true)
        setError(null)
        try {
            await leaveTeam(accessToken, team.id)
            onLeftOrDisbanded()
        } catch (e) {
            setError(teamErrorMessage(e))
        } finally {
            setLeaving(false)
        }
    }

    const myPreview = formatTaggedAlias(userProfile?.alias, team.tag, team.tag_position)

    return (
        <section className="bg-card/30 border border-white/10 rounded-xl p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2.5 flex-wrap">
                        <h1 className="text-2xl font-bold text-white leading-tight">{team.name}</h1>
                        <TagChip tag={team.tag} />
                        <AccessBadge isOpen={team.is_open} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {team.member_count} {team.member_count === 1 ? 'member' : 'members'}
                        {' · '}{team.lineups.length} {team.lineups.length === 1 ? 'lineup' : 'lineups'}
                        {team.added ? ` · Created ${formatAddedDate(team.added)}` : ''}
                        {isOwnTeam && (
                            <> · You appear as <span className="text-white font-medium">{myPreview}</span></>
                        )}
                    </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    {rightExtra}
                    {isManager && (
                        <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
                            <Pencil className="size-3.5" /> Edit
                        </Button>
                    )}
                    {isOwner && (
                        <Button size="sm" variant="secondary" onClick={() => setTransferring(true)}>
                            <ArrowRightLeft className="size-3.5" /> Transfer
                        </Button>
                    )}
                    {isOwner && (
                        <Button size="sm" variant="destructive" onClick={() => setConfirmDelete(true)}>
                            <Trash2 className="size-3.5" /> Delete
                        </Button>
                    )}
                    {canLeave && (
                        <Button size="sm" variant="destructive" disabled={leaving} onClick={leave}>
                            <LogOut className="size-3.5" /> {leaving ? 'Leaving…' : 'Leave'}
                        </Button>
                    )}
                </div>
            </div>

            <ErrorBanner message={error} />

            {editing && (
                <EditTeamModal
                    accessToken={accessToken}
                    team={team}
                    onClose={() => setEditing(false)}
                    onSaved={t => { onTeamChange(t); setEditing(false) }}
                />
            )}

            {transferring && (
                <TransferOwnershipModal
                    accessToken={accessToken}
                    team={team}
                    onClose={() => setTransferring(false)}
                    onTransferred={t => { onTeamChange(t); setTransferring(false) }}
                />
            )}

            <ConfirmModal
                isOpen={confirmDelete}
                onClose={() => setConfirmDelete(false)}
                onConfirm={async () => {
                    setConfirmDelete(false)
                    setError(null)
                    try {
                        await disbandTeam(accessToken, team.id)
                        onLeftOrDisbanded()
                    } catch (e) {
                        setError(teamErrorMessage(e))
                    }
                }}
                title="Delete team?"
                message={`This permanently deletes ${team.name}, its members, and its lineups.`}
                detail="This cannot be undone."
                confirmText="Delete"
                cancelText="Cancel"
                variant="error"
            />
        </section>
    )
}

function EditTeamModal({ accessToken, team, onClose, onSaved }: {
    accessToken: string
    team: TeamDetail
    onClose: () => void
    onSaved: (team: TeamDetail) => void
}) {
    const [name, setName] = useState(team.name)
    const [tag, setTag] = useState(team.tag ?? '')
    const [tagPosition, setTagPosition] = useState<TeamTagPosition>(team.tag_position ?? 'prefix')
    const [isOpen, setIsOpen] = useState(team.is_open)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const save = async () => {
        setSaving(true)
        setError(null)
        try {
            const detail = await updateTeam(accessToken, team.id, {
                name: name.trim(),
                tag: tag.trim(),
                tag_position: tagPosition,
                is_open: isOpen,
            })
            onSaved(detail)
        } catch (e) {
            setError(teamErrorMessage(e))
            setSaving(false)
        }
    }

    return (
        <Modal
            isOpen
            onClose={onClose}
            title="Edit Team"
            offsetSidebar
            maxWidth="34rem"
            footer={
                <div className="p-4 border-t border-border bg-muted/50 flex justify-end gap-2 shrink-0">
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button onClick={save} disabled={saving || name.trim().length === 0 || tag.trim().length === 0}>
                        {saving ? 'Saving…' : 'Save'}
                    </Button>
                </div>
            }
        >
            <div className="space-y-4">
                <label className="flex flex-col gap-1.5">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Team name</span>
                    <input value={name} onChange={e => setName(e.target.value)} maxLength={40} className={teamInputClass} />
                </label>
                <label className="flex flex-col gap-1.5">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Clan tag</span>
                    <input value={tag} onChange={e => setTag(e.target.value)} maxLength={8} className={teamInputClass} />
                </label>
                <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Tag position</span>
                    <div className="flex items-center gap-1">
                        {TAG_POSITIONS.map(pos => (
                            <button
                                key={pos}
                                type="button"
                                onClick={() => setTagPosition(pos)}
                                className={cn(
                                    'px-3 py-1.5 rounded-md text-xs font-medium border transition-colors cursor-pointer capitalize',
                                    tagPosition === pos
                                        ? 'bg-accent-500/20 border-accent-500/50 text-accent-300'
                                        : 'bg-card/50 border-white/10 text-muted-foreground hover:text-white hover:border-white/20',
                                )}
                            >
                                {pos}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Access</span>
                    <AccessToggle isOpen={isOpen} onChange={setIsOpen} />
                </div>
                <ErrorBanner message={error} />
            </div>
        </Modal>
    )
}

function TransferOwnershipModal({ accessToken, team, onClose, onTransferred }: {
    accessToken: string
    team: TeamDetail
    onClose: () => void
    onTransferred: (team: TeamDetail) => void
}) {
    const candidates = team.members.filter(m => m.status === 'active' && m.role !== 'owner')
    const [selected, setSelected] = useState(candidates[0]?.user ?? '')
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const transfer = async () => {
        if (!selected) return
        setSaving(true)
        setError(null)
        try {
            onTransferred(await transferTeamOwnership(accessToken, team.id, selected))
        } catch (e) {
            setError(teamErrorMessage(e))
            setSaving(false)
        }
    }

    return (
        <Modal
            isOpen
            onClose={onClose}
            title="Transfer Ownership"
            offsetSidebar
            maxWidth="34rem"
            footer={
                <div className="p-4 border-t border-border bg-muted/50 flex justify-end gap-2 shrink-0">
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button variant="destructive" onClick={transfer} disabled={saving || !selected}>
                        {saving ? 'Transferring…' : 'Transfer'}
                    </Button>
                </div>
            }
        >
            <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                    You will become an admin and the chosen member becomes the new owner.
                </p>
                {candidates.length === 0 ? (
                    <p className="text-sm text-muted-foreground">There are no other active members to transfer to.</p>
                ) : (
                    <label className="flex flex-col gap-1.5">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">New owner</span>
                        <select
                            value={selected}
                            onChange={e => setSelected(e.target.value)}
                            style={{ colorScheme: 'dark' }}
                            className={cn(teamInputClass, 'cursor-pointer')}
                        >
                            {candidates.map(m => (
                                <option key={m.user} value={m.user}>{m.alias || m.user}</option>
                            ))}
                        </select>
                    </label>
                )}
                <ErrorBanner message={error} />
            </div>
        </Modal>
    )
}
