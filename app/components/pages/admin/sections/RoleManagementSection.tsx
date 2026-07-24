import { useCallback, useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/app/components/ui/input'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { PlayerSearchInput } from '@/app/components/pages/teams/PlayerSearchInput'
import { ROLE_LABELS } from '@/app/utils/roles'
import {
  fetchAdminRoles, setUserRole, revokeUserRole, eventErrorMessage,
  type AdminRoleRow, type PlayerListRow,
} from '@/app/utils/api'
import { ActionButton, AdminSelect, ConfirmDialog, Feedback, formatDateTime } from '../components/controls'
import { PANEL_LABEL } from '../components/shared'
import type { AdminSectionProps } from '../types'

const ROLE_OPTIONS = [
  { value: '0', label: 'User (no staff role)' },
  { value: '1', label: 'Moderator' },
  { value: '2', label: 'Admin' },
  { value: '3', label: 'Cup Admin' },
]

function RoleBadge({ role }: { role: number }) {
  const meta = ROLE_LABELS[role]
  if (!meta) {
    return <span className="px-2 py-0.5 rounded-md border border-hairline/20 text-[11px] text-muted-foreground">User</span>
  }
  return <span className={cn('px-2 py-0.5 rounded-md border text-[11px] font-medium', meta.className)}>{meta.label}</span>
}

export function RoleManagementSection({ userProfile }: AdminSectionProps) {
  const token = userProfile?.accessToken ?? ''
  const selfId = userProfile?.id != null ? String(userProfile.id) : null

  const [rows, setRows] = useState<AdminRoleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyUser, setBusyUser] = useState<string | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<AdminRoleRow | null>(null)
  const [grantTarget, setGrantTarget] = useState<PlayerListRow | null>(null)
  const [grantRole, setGrantRole] = useState('3')
  const [grantNote, setGrantNote] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    fetchAdminRoles(token)
      .then(setRows)
      .catch((e) => setError(eventErrorMessage(e)))
      .finally(() => setLoading(false))
  }, [token])

  useEffect(() => { load() }, [load])

  const changeRole = async (userId: string, role: number, note?: string) => {
    setBusyUser(userId)
    setError(null)
    try {
      await setUserRole(token, userId, role, note)
      setGrantTarget(null)
      setGrantNote('')
      load()
    } catch (e) {
      setError(eventErrorMessage(e))
    } finally {
      setBusyUser(null)
    }
  }

  const revoke = async (userId: string) => {
    setBusyUser(userId)
    setError(null)
    try {
      await revokeUserRole(token, userId)
      setRevokeTarget(null)
      load()
    } catch (e) {
      setError(eventErrorMessage(e))
    } finally {
      setBusyUser(null)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Staff Roles</h2>
        <p className="text-xs text-muted-foreground">
          Grant or revoke moderator, admin and cup admin roles. Removing an assignment may revert legacy staff to their
          hardcoded role — set the role to User to force-demote them.
        </p>
      </div>

      <Feedback message={error} tone="red" onDismiss={() => setError(null)} />

      <div className="rounded-lg border border-hairline/10 bg-card/30 p-4 space-y-3">
        <label className={PANEL_LABEL}>Assign a role</label>
        {grantTarget ? (
          <div className="flex flex-wrap items-center gap-3">
            <PlayerInfo userId={grantTarget.id} alias={grantTarget.alias} size="sm" />
            <AdminSelect value={grantRole} onChange={setGrantRole} options={ROLE_OPTIONS} ariaLabel="Role to assign" className="w-52" />
            <Input
              value={grantNote}
              onChange={(e) => setGrantNote(e.target.value)}
              placeholder="Note (optional)"
              className="h-9 w-56"
              maxLength={200}
            />
            <ActionButton
              loading={busyUser === grantTarget.id}
              onClick={() => { void changeRole(grantTarget.id, Number(grantRole), grantNote.trim() || undefined) }}
            >
              Assign
            </ActionButton>
            <ActionButton tone="amber" onClick={() => setGrantTarget(null)}>Cancel</ActionButton>
          </div>
        ) : (
          <PlayerSearchInput
            accessToken={token}
            onPick={setGrantTarget}
            placeholder="Search players to assign a role…"
          />
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading role assignments…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No role assignments in the database yet.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => {
            const isSelf = selfId != null && row.user === selfId
            return (
              <div key={row.user} className="rounded-lg border border-hairline/10 bg-card/30 px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <PlayerInfo userId={row.user} alias={row.alias} size="sm" />
                    <RoleBadge role={row.role} />
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                    {row.granted_by_alias && <span>granted by {row.granted_by_alias}</span>}
                    {row.granted_at && <span>{formatDateTime(`${row.granted_at.replace(' ', 'T')}Z`)}</span>}
                    {row.note && <span className="italic">“{row.note}”</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <AdminSelect
                    value={String(row.role)}
                    onChange={(v) => { void changeRole(row.user, Number(v), row.note ?? undefined) }}
                    options={ROLE_OPTIONS}
                    ariaLabel={`Role for ${row.alias ?? row.user}`}
                    className={cn('w-44', isSelf && 'pointer-events-none opacity-50')}
                  />
                  <ActionButton
                    tone="red"
                    icon={Trash2}
                    disabled={isSelf}
                    loading={busyUser === row.user}
                    title={isSelf ? 'You cannot change your own role' : 'Remove this role assignment'}
                    onClick={() => setRevokeTarget(row)}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!revokeTarget}
        title="Remove role assignment"
        message={
          <span>
            Remove the {ROLE_LABELS[revokeTarget?.role ?? 0]?.label ?? 'User'} assignment of{' '}
            <span className="font-medium text-foreground">{revokeTarget?.alias ?? revokeTarget?.user}</span>?
            Legacy staff may revert to a hardcoded role — assign User instead to force-demote.
          </span>
        }
        confirmLabel="Remove"
        tone="red"
        busy={!!revokeTarget && busyUser === revokeTarget.user}
        onConfirm={() => { if (revokeTarget) void revoke(revokeTarget.user) }}
        onCancel={() => setRevokeTarget(null)}
      />
    </div>
  )
}
