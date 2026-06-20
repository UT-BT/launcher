import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Ban, Check, Tag, Trash2, Pencil } from 'lucide-react'
import {
  fetchAdminUser, fetchAdminTitles, setUserAlias, warnUser, banUser, unbanUser,
  assignTitleToUser, unassignTitleFromUser, toActiveTitle,
  type AdminUserDetail, type AdminTitleSummary,
} from '@/app/utils/api'
import { ROLE_LABELS, canActOn } from '@/app/utils/roles'
import { cn } from '@/lib/utils'
import { Modal } from '@/app/components/ui/modal'
import { Input } from '@/app/components/ui/input'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import {
  ActionButton, AdminSelect, ConfirmDialog, Copyable, Feedback, relTime, relTimeLong, formatDateTime, errMessage,
} from '../components/controls'

const BAN_UNITS: { value: string; label: string; minutes: number }[] = [
  { value: 'minutes', label: 'Minutes', minutes: 1 },
  { value: 'hours', label: 'Hours', minutes: 60 },
  { value: 'days', label: 'Days', minutes: 1440 },
  { value: 'weeks', label: 'Weeks', minutes: 10080 },
  { value: 'years', label: 'Years', minutes: 525600 },
  { value: 'permanent', label: 'Permanent', minutes: 0 },
]
const PERMANENT_MINUTES = 52560000
const FIFTY_YEARS_MS = 50 * 365.25 * 24 * 60 * 60 * 1000

function isPermanentBan(end: string | null): boolean {
  if (!end) return true
  const parsed = new Date(end)
  if (Number.isNaN(parsed.getTime())) return false
  if (parsed.getUTCFullYear() >= 9999) return true
  return parsed.getTime() - Date.now() > FIFTY_YEARS_MS
}

interface PendingAction {
  title: string
  message: React.ReactNode
  tone: 'accent' | 'red'
  confirmLabel: string
  run: () => Promise<unknown>
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card/30 border border-hairline/5 rounded-xl p-4 space-y-3">
      <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{title}</h4>
      {children}
    </div>
  )
}

export function UserDetailModal({ open, onClose, token, userId, actorRole, onChanged }: {
  open: boolean
  onClose: () => void
  token: string
  userId: string | null
  actorRole: number
  onChanged: () => void
}) {
  const [detail, setDetail] = useState<AdminUserDetail | null>(null)
  const [titles, setTitles] = useState<AdminTitleSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<PendingAction | null>(null)

  const [alias, setAlias] = useState('')
  const [warnReason, setWarnReason] = useState('')
  const [banReason, setBanReason] = useState('')
  const [banAmount, setBanAmount] = useState('1')
  const [banUnit, setBanUnit] = useState('days')
  const [banTargets, setBanTargets] = useState({ user: true, hwid: true, ip: true })
  const [assignTitleId, setAssignTitleId] = useState('')

  const reload = useCallback((signal?: AbortSignal) => {
    if (!token || !userId) return
    setLoading(true); setError(null)
    fetchAdminUser(token, userId, signal)
      .then((d) => { setDetail(d); setAlias(d.alias || ''); setLoading(false) })
      .catch((e) => { if (!signal?.aborted) { setError(errMessage(e)); setLoading(false) } })
  }, [token, userId])

  useEffect(() => {
    if (!open) return
    const ctrl = new AbortController()
    reload(ctrl.signal)
    fetchAdminTitles(token, ctrl.signal).then(setTitles).catch(() => {})
    return () => ctrl.abort()
  }, [open, reload, token])

  const execute = async () => {
    if (!pending) return
    setBusy(true); setError(null)
    try {
      await pending.run()
      setPending(null)
      reload()
      onChanged()
    } catch (e) {
      setError(errMessage(e))
      setPending(null)
    } finally {
      setBusy(false)
    }
  }

  const role = detail?.utbt_role ?? 0
  const roleLabel = ROLE_LABELS[role]
  const assignedIds = new Set((detail?.titles ?? []).map((t) => t.title_id))
  const assignableTitles = titles.filter((t) => !assignedIds.has(t.id))
  const canManage = detail ? canActOn({ utbt_role: actorRole }, { utbt_role: detail.utbt_role }) : false

  const selectedTitle = useMemo(() => (detail?.titles ?? []).find((t) => t.selected) ?? null, [detail])
  const headerTitle = toActiveTitle(selectedTitle)

  const unitMinutes = BAN_UNITS.find((u) => u.value === banUnit) ?? BAN_UNITS[2]
  const isPermanent = banUnit === 'permanent'
  const banLengthMinutes = isPermanent ? PERMANENT_MINUTES : Math.max(0, parseInt(banAmount, 10) || 0) * unitMinutes.minutes
  const banDisabled = !canManage || !banReason.trim() || (!isPermanent && banLengthMinutes <= 0)
  const banDescription = isPermanent ? 'permanently' : `for ${banAmount} ${unitMinutes.label.toLowerCase()}`

  const userName = detail ? (detail.alias || detail.id) : 'this user'

  const confirm = (a: PendingAction) => setPending(a)

  return (
    <>
      <Modal isOpen={open} onClose={onClose} title={detail ? (detail.alias || detail.id) : 'User'} offsetSidebar maxWidth="68rem">
        <div className="space-y-5">
          <Feedback message={error} tone="red" onDismiss={() => setError(null)} />

          {loading && !detail ? (
            <div className="text-sm text-muted-foreground py-12 text-center">Loading…</div>
          ) : detail ? (
            <>
              <div className="bg-card/30 border border-hairline/5 rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap">
                <PlayerInfo userId={detail.id} alias={detail.alias || detail.id} title={headerTitle} size="lg" interactive={false} />
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  {roleLabel && (
                    <span className={cn('text-[11px] font-medium px-2 py-0.5 rounded border', roleLabel.className)}>{roleLabel.label}</span>
                  )}
                  <span className="text-xs text-muted-foreground tabular-nums">{detail.cap_count} caps</span>
                  {detail.active_bans.length > 0 && (
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded border bg-red-500/15 border-red-500/40 text-red-300">Banned</span>
                  )}
                </div>
              </div>

              {!canManage && (
                <p className="text-xs text-muted-foreground">You can manage titles, but cannot warn, ban, or rename this staff member.</p>
              )}

              <div className="grid lg:grid-cols-2 gap-5 items-start">
                <div className="space-y-5">
                  <Panel title="Alias">
                    <div className="flex gap-2">
                      <Input value={alias} onChange={(e) => setAlias(e.target.value)} maxLength={36} className="h-9 flex-1" disabled={!canManage} />
                      <ActionButton tone="accent" icon={Pencil}
                        disabled={!canManage || !alias.trim() || alias === detail.alias}
                        onClick={() => confirm({
                          title: 'Rename Player',
                          message: <>Rename <span className="text-foreground font-medium">{userName}</span> to <span className="text-foreground font-medium">{alias.trim()}</span>?</>,
                          tone: 'accent',
                          confirmLabel: 'Save Alias',
                          run: () => setUserAlias(token, detail.id, alias.trim()),
                        })}>Save</ActionButton>
                    </div>
                  </Panel>

                  <Panel title="Titles">
                    {detail.titles.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No titles assigned.</p>
                    ) : (
                      <ul className="space-y-1.5 max-h-48 overflow-y-auto">
                        {detail.titles.map((t) => (
                          <li key={t.title_id} className="flex items-center justify-between gap-2 text-sm">
                            <span className="flex items-center gap-2 min-w-0">
                              <span className="truncate font-medium" style={{ color: `rgb(${t.color})` }}>{t.name}</span>
                              {t.selected && <span className="text-[9px] uppercase tracking-wider text-emerald-300">equipped</span>}
                            </span>
                            <ActionButton tone="red" icon={Trash2}
                              onClick={() => confirm({
                                title: 'Remove Title',
                                message: <>Remove the title <span className="text-foreground font-medium">{t.name}</span> from <span className="text-foreground font-medium">{userName}</span>?</>,
                                tone: 'red',
                                confirmLabel: 'Remove Title',
                                run: () => unassignTitleFromUser(token, detail.id, t.title_id),
                              })} />
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="flex gap-2 pt-1">
                      <AdminSelect
                        value={assignTitleId}
                        onChange={setAssignTitleId}
                        options={assignableTitles.map((t) => ({ value: t.id, label: t.name }))}
                        placeholder="Assign a title…"
                        ariaLabel="Title to assign"
                        className="flex-1"
                      />
                      <ActionButton tone="accent" icon={Tag} disabled={!assignTitleId}
                        onClick={() => {
                          const t = assignableTitles.find((x) => x.id === assignTitleId)
                          confirm({
                            title: 'Assign Title',
                            message: <>Assign the title <span className="text-foreground font-medium">{t?.name ?? ''}</span> to <span className="text-foreground font-medium">{userName}</span>?</>,
                            tone: 'accent',
                            confirmLabel: 'Assign Title',
                            run: async () => { await assignTitleToUser(token, detail.id, assignTitleId); setAssignTitleId('') },
                          })
                        }}>Assign</ActionButton>
                    </div>
                  </Panel>
                </div>

                <div className="space-y-5">
                  <Panel title="Warn">
                    <div className="flex gap-2">
                      <Input value={warnReason} onChange={(e) => setWarnReason(e.target.value)} placeholder="Reason" className="h-9 flex-1" disabled={!canManage} />
                      <ActionButton tone="amber" icon={AlertTriangle} disabled={!canManage || !warnReason.trim()}
                        onClick={() => confirm({
                          title: 'Issue Warning',
                          message: <>Issue a warning to <span className="text-foreground font-medium">{userName}</span>?<br /><span className="text-muted-foreground/70">Reason: {warnReason.trim()}</span></>,
                          tone: 'accent',
                          confirmLabel: 'Issue Warning',
                          run: async () => { await warnUser(token, detail.id, warnReason.trim()); setWarnReason('') },
                        })}>
                        Issue Warning
                      </ActionButton>
                    </div>
                    {detail.warns.length > 0 && (
                      <ul className="text-xs text-muted-foreground space-y-1 max-h-28 overflow-y-auto">
                        {detail.warns.map((w) => (
                          <li key={w.id} className="flex justify-between gap-2">
                            <span className="truncate">{w.reason}</span>
                            <span className="shrink-0 text-muted-foreground/60">{relTime(w.warned_at)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Panel>

                  <Panel title="Ban">
                    {detail.active_bans.length > 0 ? (
                      <>
                        {(() => {
                          const ban = detail.active_bans[0]
                          const permanent = isPermanentBan(ban.end)
                          return (
                            <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3 space-y-2.5">
                              <div className="flex items-center gap-2 flex-wrap text-sm">
                                <span className="text-foreground font-medium tabular-nums">{formatDateTime(ban.start)}</span>
                                <span className="text-muted-foreground/60">→</span>
                                {permanent ? (
                                  <span className="text-red-300 font-medium">Permanent</span>
                                ) : (
                                  <>
                                    <span className="text-foreground font-medium tabular-nums">{formatDateTime(ban.end)}</span>
                                    <span className="text-[11px] text-muted-foreground/70">({relTimeLong(ban.end)})</span>
                                  </>
                                )}
                              </div>
                              <div className="space-y-0.5">
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Reason</p>
                                <p className="text-sm italic text-muted-foreground">{ban.reason ? `“${ban.reason}”` : 'No reason provided.'}</p>
                              </div>
                            </div>
                          )
                        })()}
                        <ActionButton tone="emerald" icon={Check} disabled={!canManage}
                          onClick={() => confirm({
                            title: 'Remove Ban',
                            message: <>Remove the active ban on <span className="text-foreground font-medium">{userName}</span>?</>,
                            tone: 'accent',
                            confirmLabel: 'Remove Ban',
                            run: () => unbanUser(token, detail.id),
                          })}>Remove Ban</ActionButton>
                      </>
                    ) : (
                      <>
                        <Input value={banReason} onChange={(e) => setBanReason(e.target.value)} placeholder="Reason" className="h-9" disabled={!canManage} />
                        <div className="flex gap-2 items-center">
                          <Input
                            type="number"
                            min={1}
                            value={banAmount}
                            onChange={(e) => setBanAmount(e.target.value)}
                            className="h-9 w-24 tabular-nums"
                            disabled={!canManage || isPermanent}
                            aria-label="Ban length"
                          />
                          <AdminSelect
                            value={banUnit}
                            onChange={setBanUnit}
                            options={BAN_UNITS.map((u) => ({ value: u.value, label: u.label }))}
                            ariaLabel="Ban length unit"
                            className="flex-1"
                          />
                        </div>
                        <div className="flex gap-3 text-xs text-muted-foreground">
                          {(['user', 'hwid', 'ip'] as const).map((k) => (
                            <label key={k} className={cn('flex items-center gap-1.5', canManage ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed')}>
                              <input type="checkbox" checked={banTargets[k]} disabled={!canManage} onChange={(e) => setBanTargets((t) => ({ ...t, [k]: e.target.checked }))} style={{ colorScheme: 'dark' }} />
                              {k.toUpperCase()}
                            </label>
                          ))}
                        </div>
                        <ActionButton tone="red" icon={Ban} disabled={banDisabled}
                          onClick={() => confirm({
                            title: 'Ban Player',
                            message: <>Ban <span className="text-foreground font-medium">{userName}</span> {banDescription}?<br /><span className="text-muted-foreground/70">Reason: {banReason.trim()}</span></>,
                            tone: 'red',
                            confirmLabel: 'Ban Player',
                            run: async () => {
                              await banUser(token, detail.id, { lengthMinutes: banLengthMinutes, reason: banReason.trim(), banUser: banTargets.user, banHwid: banTargets.hwid, banIp: banTargets.ip })
                              setBanReason('')
                            },
                          })}>Ban</ActionButton>
                      </>
                    )}
                  </Panel>
                </div>
              </div>

              <Panel title="Connection History">
                <p className="text-xs text-muted-foreground/70 -mt-1">Distinct IPs &amp; HWIDs found in this player's cap history.</p>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">IP Addresses</p>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground/50">Caps · Last used</p>
                    </div>
                    {detail.ip_history.length === 0 ? (
                      <p className="text-xs text-muted-foreground">None recorded.</p>
                    ) : (
                      <ul className="space-y-1.5 max-h-56 overflow-y-auto">
                        {detail.ip_history.map((h) => (
                          <li key={h.value} className="flex items-center justify-between gap-2">
                            <Copyable value={h.value} />
                            <span className="shrink-0 text-[11px] text-muted-foreground/70 tabular-nums">×{h.count} · {relTime(h.last_seen)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">HWIDs</p>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground/50">Caps · Last used</p>
                    </div>
                    {detail.hwid_history.length === 0 ? (
                      <p className="text-xs text-muted-foreground">None recorded.</p>
                    ) : (
                      <ul className="space-y-1.5 max-h-56 overflow-y-auto">
                        {detail.hwid_history.map((h) => (
                          <li key={h.value} className="flex items-center justify-between gap-2">
                            <Copyable value={h.value} />
                            <span className="shrink-0 text-[11px] text-muted-foreground/70 tabular-nums">×{h.count} · {relTime(h.last_seen)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </Panel>
            </>
          ) : null}
        </div>
      </Modal>

      <ConfirmDialog
        open={!!pending}
        title={pending?.title ?? ''}
        message={pending?.message ?? null}
        tone={pending?.tone ?? 'accent'}
        confirmLabel={pending?.confirmLabel}
        busy={busy}
        onConfirm={execute}
        onCancel={() => setPending(null)}
      />
    </>
  )
}
