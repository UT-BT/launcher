import { useCallback, useEffect, useMemo, useState } from 'react'
import { Server, Plus, KeyRound, Ban, Link2, Check, AlertTriangle, Pencil, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/app/components/ui/input'
import { Modal } from '@/app/components/ui/modal'
import {
  fetchAdminHosts, createAdminHost, updateAdminHost, setAdminHostServers,
  issueAdminHostToken, removeAdminHostToken,
  type AdminHost, type AdminHostServer, type AdminHostToken,
} from '@/app/utils/api'
import { SectionShell } from '../components/SectionShell'
import { ActionButton, ConfirmDialog, Copyable, Feedback, errMessage, relTime } from '../components/controls'
import { PANEL_LABEL } from '../components/shared'
import type { AdminSectionProps } from '../types'

const DEFAULT_AGENT_PORT = 80

function StatusPill({ active, activeLabel, inactiveLabel }: { active: boolean; activeLabel: string; inactiveLabel: string }) {
  return (
    <span
      className={cn(
        'px-2 py-0.5 rounded-md border text-[11px] font-medium',
        active
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
          : 'border-hairline/20 bg-card/40 text-muted-foreground',
      )}
    >
      {active ? activeLabel : inactiveLabel}
    </span>
  )
}

function TokenState({ token }: { token: AdminHostToken | null }) {
  if (!token) {
    return (
      <p className="text-xs text-amber-300/90 flex items-center gap-1.5">
        <AlertTriangle className="size-3" />
        No token. This host's agent cannot fetch personal bests for its players.
      </p>
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-hairline/10 bg-card/20 px-3 py-2">
      <KeyRound className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="text-xs font-medium text-foreground">{token.name}</span>
      <span className="text-[11px] text-muted-foreground">{token.scopes.join(', ') || 'no scopes'}</span>
      <span className="text-[11px] text-muted-foreground">
        {token.last_seen_at ? `last seen ${relTime(token.last_seen_at)}` : 'never used'}
      </span>
    </div>
  )
}

export function HostsManagementSection({ userProfile }: AdminSectionProps) {
  const token = userProfile?.accessToken ?? ''

  const [hosts, setHosts] = useState<AdminHost[]>([])
  const [servers, setServers] = useState<AdminHostServer[]>([])
  const [scopes, setScopes] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const [creating, setCreating] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [draftRegion, setDraftRegion] = useState('')
  const [draftIp, setDraftIp] = useState('')
  const [draftPort, setDraftPort] = useState(String(DEFAULT_AGENT_PORT))

  const [editHost, setEditHost] = useState<AdminHost | null>(null)
  const [linkHost, setLinkHost] = useState<AdminHost | null>(null)
  const [linkSelection, setLinkSelection] = useState<Set<string>>(new Set())
  const [replaceTarget, setReplaceTarget] = useState<AdminHost | null>(null)
  const [removeTarget, setRemoveTarget] = useState<AdminHost | null>(null)
  const [issuedToken, setIssuedToken] = useState<{ host: string; secret: string; replaced: boolean } | null>(null)

  const load = useCallback((signal?: AbortSignal) => {
    setLoading(true)
    setError(null)
    fetchAdminHosts(token, signal)
      .then((data) => {
        setHosts(data.hosts ?? [])
        setServers(data.servers ?? [])
        setScopes(data.available_scopes ?? [])
      })
      .catch((e) => { if (!signal?.aborted) setError(errMessage(e)) })
      .finally(() => { if (!signal?.aborted) setLoading(false) })
  }, [token])

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
    return () => controller.abort()
  }, [load])

  const serversByHost = useMemo(() => {
    const grouped = new Map<string, AdminHostServer[]>()
    for (const server of servers) {
      if (!server.host_ref) continue
      const list = grouped.get(server.host_ref) ?? []
      list.push(server)
      grouped.set(server.host_ref, list)
    }
    return grouped
  }, [servers])

  const unassigned = useMemo(() => servers.filter((s) => !s.host_ref), [servers])

  const run = async (key: string, action: () => Promise<void>) => {
    setBusy(key)
    setError(null)
    try {
      await action()
    } catch (e) {
      setError(errMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const create = () => run('create', async () => {
    const port = Number(draftPort)
    if (!draftName.trim()) throw new Error('A host name is required.')
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Agent port must be between 1 and 65535.')

    await createAdminHost(token, {
      name: draftName.trim(),
      region: draftRegion.trim() || null,
      ip: draftIp.trim() || null,
      agent_port: port,
    })

    setCreating(false)
    setDraftName(''); setDraftRegion(''); setDraftIp(''); setDraftPort(String(DEFAULT_AGENT_PORT))
    setNotice(`Host “${draftName.trim()}” created. Issue it a token next.`)
    load()
  })

  const saveEdit = (host: AdminHost, patch: Partial<AdminHost>) => run(`edit:${host.id}`, async () => {
    await updateAdminHost(token, host.id, {
      region: patch.region ?? host.region,
      ip: patch.ip ?? host.ip,
      agent_port: patch.agent_port ?? host.agent_port,
      active: patch.active ?? host.active,
    })
    setEditHost(null)
    load()
  })

  const saveLinks = (host: AdminHost) => run(`link:${host.id}`, async () => {
    const result = await setAdminHostServers(token, host.id, Array.from(linkSelection))
    setServers(result.servers ?? [])
    setLinkHost(null)
    setNotice(`Updated the servers on “${host.name}”.`)
  })

  const issue = (host: AdminHost) => run(`token:${host.id}`, async () => {
    const result = await issueAdminHostToken(token, host.id, { name: host.name, scopes })
    setReplaceTarget(null)
    setIssuedToken({ host: host.name, secret: result.token, replaced: result.replaced })
    load()
  })

  const removeToken = (host: AdminHost) => run(`token:${host.id}`, async () => {
    await removeAdminHostToken(token, host.id)
    setRemoveTarget(null)
    setNotice(`Removed the token for “${host.name}”.`)
    load()
  })

  const openLinkEditor = (host: AdminHost) => {
    setLinkHost(host)
    setLinkSelection(new Set((serversByHost.get(host.id) ?? []).map((s) => s.id)))
  }

  const toggleLink = (serverId: string) => {
    setLinkSelection((prev) => {
      const next = new Set(prev)
      if (next.has(serverId)) next.delete(serverId)
      else next.add(serverId)
      return next
    })
  }

  const linkCandidates = linkHost
    ? servers.filter((s) => !s.host_ref || s.host_ref === linkHost.id || linkSelection.has(s.id))
    : []

  return (
    <SectionShell
      title="Game Hosts"
      description="The physical boxes that run game servers. Each one runs an agent that serves the map list to its servers and the players on them."
      icon={Server}
      actions={
        <ActionButton icon={Plus} onClick={() => setCreating((v) => !v)}>
          {creating ? 'Cancel' : 'Add host'}
        </ActionButton>
      }
    >
      <Feedback message={error} tone="red" onDismiss={() => setError(null)} />
      <Feedback message={notice} tone="emerald" onDismiss={() => setNotice(null)} />

      {creating && (
        <div className="rounded-lg border border-hairline/10 bg-card/30 p-4 space-y-3">
          <label className={PANEL_LABEL}>New host</label>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <span className={PANEL_LABEL}>Name</span>
              <Input value={draftName} onChange={(e) => setDraftName(e.target.value)} placeholder="public-au" className="h-9 w-48" maxLength={64} />
            </div>
            <div className="space-y-1">
              <span className={PANEL_LABEL}>Region</span>
              <Input value={draftRegion} onChange={(e) => setDraftRegion(e.target.value)} placeholder="Australia" className="h-9 w-44" maxLength={64} />
            </div>
            <div className="space-y-1">
              <span className={PANEL_LABEL}>Address</span>
              <Input value={draftIp} onChange={(e) => setDraftIp(e.target.value)} placeholder="203.0.113.10" className="h-9 w-44" maxLength={45} />
            </div>
            <div className="space-y-1">
              <span className={PANEL_LABEL}>Agent port</span>
              <Input value={draftPort} onChange={(e) => setDraftPort(e.target.value)} className="h-9 w-24" inputMode="numeric" />
            </div>
            <ActionButton icon={Check} loading={busy === 'create'} onClick={create}>Create host</ActionButton>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading hosts…</p>
      ) : hosts.length === 0 ? (
        <div className="rounded-lg border border-hairline/10 bg-card/30 px-4 py-8 text-center space-y-1">
          <p className="text-sm text-foreground">No hosts registered yet.</p>
          <p className="text-xs text-muted-foreground">Add one for each box that runs game servers, then mint it a token.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {hosts.map((host) => {
            const linked = serversByHost.get(host.id) ?? []
            return (
              <div key={host.id} className="rounded-lg border border-hairline/10 bg-card/30 p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{host.name}</span>
                      <StatusPill active={host.active} activeLabel="Active" inactiveLabel="Disabled" />
                      {host.region && <span className="text-[11px] text-muted-foreground">{host.region}</span>}
                    </div>
                    <div className="text-[11px] text-muted-foreground tabular-nums">
                      {host.ip ? `${host.ip}:${host.agent_port}` : `agent port ${host.agent_port}`}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <ActionButton icon={Pencil} onClick={() => setEditHost(host)}>Edit</ActionButton>
                    <ActionButton icon={Link2} onClick={() => openLinkEditor(host)}>Servers</ActionButton>
                    {host.token ? (
                      <>
                        <ActionButton tone="amber" icon={RefreshCw} onClick={() => setReplaceTarget(host)}>
                          Replace token
                        </ActionButton>
                        <ActionButton tone="red" icon={Ban} onClick={() => setRemoveTarget(host)}>
                          Remove token
                        </ActionButton>
                      </>
                    ) : (
                      <ActionButton icon={KeyRound} loading={busy === `token:${host.id}`} onClick={() => issue(host)}>
                        Issue token
                      </ActionButton>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className={PANEL_LABEL}>Servers on this host</span>
                  {linked.length === 0 ? (
                    <p className="text-xs text-muted-foreground">None linked yet.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {linked.map((server) => (
                        <span key={server.id} className="px-2 py-0.5 rounded-md border border-hairline/20 bg-card/40 text-[11px] text-foreground">
                          {server.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <span className={PANEL_LABEL}>Token</span>
                  <TokenState token={host.token} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {unassigned.length > 0 && !loading && (
        <div className="rounded-lg border border-hairline/10 bg-card/20 px-4 py-3 space-y-1">
          <span className={PANEL_LABEL}>Servers not on any host ({unassigned.length})</span>
          <div className="flex flex-wrap gap-1.5">
            {unassigned.map((server) => (
              <span key={server.id} className="px-2 py-0.5 rounded-md border border-hairline/20 bg-card/40 text-[11px] text-muted-foreground">
                {server.name}
              </span>
            ))}
          </div>
        </div>
      )}

      <Modal isOpen={!!editHost} onClose={() => setEditHost(null)} title={`Edit ${editHost?.name ?? ''}`} offsetSidebar>
        {editHost && (
          <EditHostForm
            host={editHost}
            busy={busy === `edit:${editHost.id}`}
            onCancel={() => setEditHost(null)}
            onSave={(patch) => saveEdit(editHost, patch)}
          />
        )}
      </Modal>

      <Modal isOpen={!!linkHost} onClose={() => setLinkHost(null)} title={`Servers on ${linkHost?.name ?? ''}`} offsetSidebar>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Tick every server that runs on this box. A server already on another host is not listed — unlink it there first.
          </p>
          {linkCandidates.length === 0 ? (
            <p className="text-sm text-muted-foreground">No servers available to link.</p>
          ) : (
            <div className="max-h-80 overflow-y-auto space-y-1 pr-1">
              {linkCandidates.map((server) => {
                const checked = linkSelection.has(server.id)
                return (
                  <button
                    key={server.id}
                    type="button"
                    onClick={() => toggleLink(server.id)}
                    className={cn(
                      'w-full flex items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors cursor-pointer',
                      checked
                        ? 'border-emerald-500/30 bg-emerald-500/10'
                        : 'border-hairline/10 bg-card/20 hover:bg-hairline/5',
                    )}
                  >
                    <span className={cn(
                      'size-4 rounded border flex items-center justify-center shrink-0',
                      checked ? 'border-emerald-400/60 bg-emerald-500/20' : 'border-hairline/30',
                    )}>
                      {checked && <Check className="size-3 text-emerald-300" />}
                    </span>
                    <span className="min-w-0 flex-1 text-xs text-foreground truncate">{server.name}</span>
                    {server.region && <span className="text-[11px] text-muted-foreground shrink-0">{server.region}</span>}
                  </button>
                )
              })}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <ActionButton tone="amber" onClick={() => setLinkHost(null)}>Cancel</ActionButton>
            <ActionButton
              icon={Check}
              loading={!!linkHost && busy === `link:${linkHost.id}`}
              onClick={() => { if (linkHost) saveLinks(linkHost) }}
            >
              Save
            </ActionButton>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!issuedToken} onClose={() => setIssuedToken(null)} title="Host token" offsetSidebar>
        <div className="space-y-3">
          <p className="text-xs text-amber-300/90 flex items-start gap-1.5">
            <AlertTriangle className="size-3.5 shrink-0 mt-px" />
            This is the only time this token is shown. Put it in the agent's config on {issuedToken?.host} and restart it — the
            token cannot be retrieved later, only replaced.
          </p>
          {issuedToken?.replaced && (
            <p className="text-xs text-muted-foreground">
              The previous token is already revoked. Until the agent is restarted with this one, players on that host will not
              see their personal best times in the mapvote.
            </p>
          )}
          <Copyable value={issuedToken?.secret ?? ''} />
          <div className="flex justify-end">
            <ActionButton icon={Check} onClick={() => setIssuedToken(null)}>Done</ActionButton>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!replaceTarget}
        title="Replace host token"
        message={
          <span>
            This revokes the current token for <span className="font-medium text-foreground">{replaceTarget?.name}</span>{' '}
            immediately and issues a new one. Until you put the new token in that host's agent config and restart it, players on
            that host will not see their personal best times in the mapvote. The map list itself keeps working.
          </span>
        }
        confirmLabel="Replace token"
        tone="red"
        busy={!!replaceTarget && busy === `token:${replaceTarget.id}`}
        onConfirm={() => { if (replaceTarget) issue(replaceTarget) }}
        onCancel={() => setReplaceTarget(null)}
      />

      <ConfirmDialog
        open={!!removeTarget}
        title="Remove host token"
        message={
          <span>
            This revokes the token for <span className="font-medium text-foreground">{removeTarget?.name}</span> and does not
            replace it. That host's agent stops authenticating, so players on it lose their personal best times in the mapvote
            until a new token is issued. The map list itself keeps working. This cannot be undone — the token can only be
            reissued, never recovered.
          </span>
        }
        confirmLabel="Remove token"
        tone="red"
        busy={!!removeTarget && busy === `token:${removeTarget.id}`}
        onConfirm={() => { if (removeTarget) removeToken(removeTarget) }}
        onCancel={() => setRemoveTarget(null)}
      />
    </SectionShell>
  )
}

function EditHostForm({ host, busy, onCancel, onSave }: {
  host: AdminHost
  busy: boolean
  onCancel: () => void
  onSave: (patch: Partial<AdminHost>) => void
}) {
  const [region, setRegion] = useState(host.region ?? '')
  const [ip, setIp] = useState(host.ip ?? '')
  const [port, setPort] = useState(String(host.agent_port))
  const [active, setActive] = useState(host.active)

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <span className={PANEL_LABEL}>Region</span>
          <Input value={region} onChange={(e) => setRegion(e.target.value)} className="h-9" maxLength={64} />
        </div>
        <div className="space-y-1">
          <span className={PANEL_LABEL}>Address</span>
          <Input value={ip} onChange={(e) => setIp(e.target.value)} className="h-9" maxLength={45} />
        </div>
        <div className="space-y-1">
          <span className={PANEL_LABEL}>Agent port</span>
          <Input value={port} onChange={(e) => setPort(e.target.value)} className="h-9" inputMode="numeric" />
        </div>
        <div className="space-y-1">
          <span className={PANEL_LABEL}>Status</span>
          <ActionButton tone={active ? 'emerald' : 'amber'} onClick={() => setActive((v) => !v)}>
            {active ? 'Active' : 'Disabled'}
          </ActionButton>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <ActionButton tone="amber" onClick={onCancel}>Cancel</ActionButton>
        <ActionButton
          icon={Check}
          loading={busy}
          onClick={() => onSave({ region: region.trim() || null, ip: ip.trim() || null, agent_port: Number(port), active })}
        >
          Save
        </ActionButton>
      </div>
    </div>
  )
}
