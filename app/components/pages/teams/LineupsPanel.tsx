import { useState } from 'react'
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/app/components/ui/button'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { ConfirmModal } from '@/app/components/shared/ConfirmModal'
import {
    createLineup, deleteLineup, updateLineup,
    type Lineup, type TeamDetail, type TeamMember,
} from '@/app/utils/api'
import { ErrorBanner, SectionCard, teamInputClass, teamErrorMessage } from './teamsShared'

const LINEUP_MIN_MEMBERS = 2
const LINEUP_MAX_MEMBERS = 12

interface LineupsPanelProps {
    accessToken: string
    team: TeamDetail
    canManage: boolean
    onTeamChange: (team: TeamDetail) => void
}

export function LineupsPanel({ accessToken, team, canManage, onTeamChange }: LineupsPanelProps) {
    const [creating, setCreating] = useState(false)
    const [newLabel, setNewLabel] = useState('')
    const [selected, setSelected] = useState<Set<string>>(new Set())
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editLabel, setEditLabel] = useState('')
    const [deleteTarget, setDeleteTarget] = useState<Lineup | null>(null)

    const activeMembers = team.members.filter(m => m.status === 'active')
    const memberById = new Map<string, TeamMember>(team.members.map(m => [String(m.user), m]))

    const patch = (lineups: Lineup[]) => onTeamChange({ ...team, lineups })

    const toggleMember = (userId: string) => {
        setSelected(prev => {
            const next = new Set(prev)
            if (next.has(userId)) next.delete(userId)
            else {
                if (next.size >= LINEUP_MAX_MEMBERS) return prev
                next.add(userId)
            }
            return next
        })
    }

    const resetCreate = () => {
        setCreating(false)
        setNewLabel('')
        setSelected(new Set())
    }

    const create = async () => {
        setBusy(true)
        setError(null)
        try {
            const lineup = await createLineup(accessToken, team.id, {
                label: newLabel.trim(),
                members: Array.from(selected),
            })
            patch([...team.lineups, lineup])
            resetCreate()
        } catch (e) {
            setError(teamErrorMessage(e))
        } finally {
            setBusy(false)
        }
    }

    const rename = async (lineup: Lineup) => {
        setBusy(true)
        setError(null)
        try {
            const updated = await updateLineup(accessToken, team.id, lineup.id, editLabel.trim())
            patch(team.lineups.map(l => (l.id === lineup.id ? updated : l)))
            setEditingId(null)
        } catch (e) {
            setError(teamErrorMessage(e))
        } finally {
            setBusy(false)
        }
    }

    const remove = async (lineup: Lineup) => {
        setBusy(true)
        setError(null)
        try {
            await deleteLineup(accessToken, team.id, lineup.id)
            patch(team.lineups.filter(l => l.id !== lineup.id))
        } catch (e) {
            setError(teamErrorMessage(e))
        } finally {
            setBusy(false)
            setDeleteTarget(null)
        }
    }

    const action = canManage && !creating
        ? (
            <Button size="sm" variant="secondary" onClick={() => setCreating(true)}>
                <Plus className="size-3.5" /> New lineup
            </Button>
        )
        : undefined

    return (
        <SectionCard
            title="Lineups"
            subtitle="A lineup is a named combination of members that will show together on team map leaderboards."
            action={action}
        >
            <ErrorBanner message={error} />

            {creating && (
                <div className="space-y-3 p-3 bg-white/5 border border-white/5 rounded-lg">
                    <label className="flex flex-col gap-1.5">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Lineup label</span>
                        <input
                            value={newLabel}
                            onChange={e => setNewLabel(e.target.value)}
                            maxLength={40}
                            placeholder="e.g. Duo A"
                            className={teamInputClass}
                        />
                    </label>
                    <div className="space-y-1.5">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            Members{' '}
                            <span className="normal-case text-muted-foreground/70">
                                — select {LINEUP_MIN_MEMBERS}–{LINEUP_MAX_MEMBERS} ({selected.size} selected)
                            </span>
                        </span>
                        <div className="flex flex-wrap gap-2">
                            {activeMembers.map(m => {
                                const id = String(m.user)
                                const on = selected.has(id)
                                const atMax = !on && selected.size >= LINEUP_MAX_MEMBERS
                                return (
                                    <button
                                        key={id}
                                        type="button"
                                        disabled={atMax}
                                        onClick={() => toggleMember(id)}
                                        className={cn(
                                            'flex items-center gap-2 px-2 py-1.5 rounded-md border transition-colors cursor-pointer',
                                            on
                                                ? 'bg-accent-500/20 border-accent-500/50'
                                                : 'bg-card/50 border-white/10 hover:border-white/20',
                                            atMax && 'opacity-40 cursor-not-allowed',
                                        )}
                                    >
                                        <PlayerInfo userId={m.user} alias={m.alias} size="sm" interactive={false} />
                                        {on && <Check className="size-3.5 text-accent-300" />}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                        {(selected.size < LINEUP_MIN_MEMBERS || selected.size > LINEUP_MAX_MEMBERS) && (
                            <span className="mr-auto text-[11px] text-muted-foreground">
                                Select between {LINEUP_MIN_MEMBERS} and {LINEUP_MAX_MEMBERS} members.
                            </span>
                        )}
                        <Button size="sm" variant="ghost" onClick={resetCreate}>Cancel</Button>
                        <Button
                            size="sm"
                            onClick={create}
                            disabled={busy || newLabel.trim().length === 0 || selected.size < LINEUP_MIN_MEMBERS || selected.size > LINEUP_MAX_MEMBERS}
                        >
                            {busy ? 'Saving…' : 'Create lineup'}
                        </Button>
                    </div>
                </div>
            )}

            {team.lineups.length === 0 && !creating ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No lineups yet.</p>
            ) : (
                <div className="space-y-2">
                    {team.lineups.map(lineup => (
                        <div key={lineup.id} className="px-3 py-2.5 bg-white/5 border border-white/5 rounded-lg space-y-2">
                            <div className="flex items-center gap-2">
                                {editingId === lineup.id ? (
                                    <>
                                        <input
                                            value={editLabel}
                                            onChange={e => setEditLabel(e.target.value)}
                                            maxLength={40}
                                            className={cn(teamInputClass, 'flex-1 py-1')}
                                        />
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            disabled={busy || editLabel.trim().length === 0}
                                            onClick={() => rename(lineup)}
                                            className="text-emerald-300 hover:text-emerald-200 hover:bg-emerald-500/10 px-2"
                                        >
                                            <Check className="size-4" />
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => setEditingId(null)}
                                            className="text-muted-foreground hover:text-white hover:bg-white/5 px-2"
                                        >
                                            <X className="size-4" />
                                        </Button>
                                    </>
                                ) : (
                                    <>
                                        <span className="text-sm font-semibold text-white flex-1 truncate">{lineup.label}</span>
                                        {canManage && (
                                            <>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => { setEditingId(lineup.id); setEditLabel(lineup.label) }}
                                                    className="text-muted-foreground hover:text-white hover:bg-white/5 px-2"
                                                >
                                                    <Pencil className="size-3.5" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => setDeleteTarget(lineup)}
                                                    className="text-red-300 hover:text-red-200 hover:bg-red-500/10 px-2"
                                                >
                                                    <Trash2 className="size-3.5" />
                                                </Button>
                                            </>
                                        )}
                                    </>
                                )}
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                                {lineup.members.map(uid => {
                                    const m = memberById.get(String(uid))
                                    return (
                                        <PlayerInfo
                                            key={uid}
                                            userId={uid}
                                            alias={m?.alias ?? String(uid)}
                                            size="sm"
                                            interactive={false}
                                        />
                                    )
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <ConfirmModal
                isOpen={deleteTarget !== null}
                onClose={() => setDeleteTarget(null)}
                onConfirm={() => { if (deleteTarget) void remove(deleteTarget) }}
                title="Delete lineup?"
                message={deleteTarget ? `Delete the "${deleteTarget.label}" lineup?` : ''}
                confirmText="Delete"
                cancelText="Cancel"
                variant="error"
            />
        </SectionCard>
    )
}
