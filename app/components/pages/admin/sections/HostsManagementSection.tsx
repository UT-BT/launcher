import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Server, Plus, KeyRound, Ban, Link2, Check, TriangleAlert, Pencil, RefreshCw, CircleCheck, CircleX, Activity,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/app/components/ui/input'
import { Modal } from '@/app/components/ui/modal'
import { Button } from '@/app/components/ui/button'
import {
  fetchAdminHosts, createAdminHost, updateAdminHost, setAdminHostServers,
  issueAdminHostToken, removeAdminHostToken, updateAdminServer,
  type AdminHost, type AdminHostInput, type AdminHostServer, type AdminHostToken, type AdminServerUpdate,
} from '@/app/utils/api'
import { SectionShell } from '../components/SectionShell'
import { ActionButton, AdminSelect, ConfirmDialog, Copyable, Feedback, SearchInput, errMessage, relTime } from '../components/controls'
import { PANEL_LABEL } from '../components/shared'
import { ActionMenu, type ActionMenuItem } from '../components/ActionMenu'
import { HostMetricsModal } from './HostMetricsModal'
import { TableControls } from '../components/TableControls'
import { useAdminTable } from '../components/useAdminTable'
import { useRegisterPageRefresh } from '@/app/components/navigation/PageRefreshContext'
import {
  DataTableCell,
  DataTableEmpty,
  DataTableHeaderCell,
  DataTableHeaderRow,
  DataTableRow,
  DataTableShell,
  DataTableSkeletonRow,
} from '@/app/components/shared/DataTable'
import type { AdminSectionProps } from '../types'

const DEFAULT_AGENT_PORT = 80
const MAX_INLINE_SERVER_CHIPS = 3

const COLUMNS = [
  { id: 'host', label: 'Host', required: true },
  { id: 'agent', label: 'Agent' },
  { id: 'address', label: 'Address' },
  { id: 'servers', label: 'Servers' },
  { id: 'token', label: 'Token' },
  { id: 'actions', label: 'Actions', required: true },
]

const RESPONSIVE_COLUMNS = [
  { id: 'host', width: '14rem', required: true },
  { id: 'actions', width: '5rem', required: true },
  { id: 'agent', width: '10rem', priority: 45 },
  { id: 'servers', width: '16rem', priority: 40 },
  { id: 'token', width: '12rem', priority: 30 },
  { id: 'address', width: '11rem', priority: 20 },
]

const SERVER_STATE_OPTIONS = [
  { value: 'Online', label: 'Online' },
  { value: 'Offline', label: 'Offline' },
  { value: 'Maintenance', label: 'Maintenance' },
]

const HOST_STATUS_OPTIONS = [
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Disabled' },
]

const SERVER_STATUS_OPTIONS = [
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Inactive' },
]

const SERVER_RECORDS_OPTIONS = [
  { value: 'true', label: 'Certified records' },
  { value: 'false', label: 'Casual records' },
]

const SERVER_STATE_META: Record<string, { Icon: typeof CircleCheck; className: string }> = {
  Online: { Icon: CircleCheck, className: 'text-emerald-400' },
  Offline: { Icon: CircleX, className: 'text-red-400' },
  Maintenance: { Icon: TriangleAlert, className: 'text-amber-400' },
}

function assertPort(port: number, label: string) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`${label} must be between 1 and 65535.`)
}

function ModalFooter({ children }: { children: ReactNode }) {
  return <div className="p-4 border-t border-border bg-muted/50 flex justify-end gap-2">{children}</div>
}

function ServerChip({ server, onClick }: { server: AdminHostServer; onClick: () => void }) {
  const meta = SERVER_STATE_META[server.state ?? ''] ?? SERVER_STATE_META.Offline
  const StateIcon = meta.Icon

  return (
    <button
      type="button"
      onClick={onClick}
      title={`${server.name} — ${server.state ?? 'Unknown'}${server.active ? '' : ', inactive'}. Click to edit.`}
      className={cn(
        'px-2 py-0.5 rounded-md border text-[11px] inline-flex items-center gap-1.5 transition-colors cursor-pointer',
        'border-hairline/20 bg-card/40 hover:bg-hairline/10 hover:border-hairline/40',
        server.active ? 'text-foreground' : 'text-muted-foreground',
      )}
    >
      <StateIcon className={cn('size-3 shrink-0', meta.className)} aria-hidden />
      <span className="sr-only">{server.state ?? 'Unknown'}: </span>
      {server.name}
    </button>
  )
}

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

function AgentCell({ host }: { host: AdminHost }) {
  const runtime = host.runtime
  if (!runtime?.known) {
    return <span className="text-xs text-muted-foreground">Not polled</span>
  }
  if (!runtime.reachable) {
    return (
      <div className="min-w-0">
        <div className="text-xs text-red-300">Unreachable</div>
        <div className="text-[11px] text-muted-foreground truncate" title={runtime.last_error ?? undefined}>
          {runtime.polled_at ? relTime(runtime.polled_at) : 'never reached'}
        </div>
      </div>
    )
  }
  return (
    <div className="min-w-0">
      <div className="text-xs text-emerald-300">Online</div>
      <div className="text-[11px] text-muted-foreground tabular-nums truncate">
        {Math.round(runtime.cpu_percent ?? 0)}% cpu · {Math.round(runtime.memory_percent ?? 0)}% mem
      </div>
    </div>
  )
}

function TokenCell({ token }: { token: AdminHostToken | null }) {
  if (!token) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-amber-300/90">
        <TriangleAlert className="size-3 shrink-0" />
        No token
      </span>
    )
  }
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-xs text-foreground">
        <KeyRound className="size-3 shrink-0 text-muted-foreground" />
        <span className="truncate">{token.name}</span>
      </div>
      <div className="text-[11px] text-muted-foreground truncate">
        {token.last_seen_at ? `last seen ${relTime(token.last_seen_at)}` : 'never used'}
      </div>
    </div>
  )
}

export function HostsManagementSection({ userProfile }: AdminSectionProps) {
  const token = userProfile?.accessToken ?? ''

  const [hosts, setHosts] = useState<AdminHost[]>([])
  const [servers, setServers] = useState<AdminHostServer[]>([])
  const [scopes, setScopes] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [visibleColumns, setVisibleColumns] = useState<Set<string> | null>(null)
  const [compact, setCompact] = useState(false)
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
  const [editServer, setEditServer] = useState<AdminHostServer | null>(null)
  const [metricsHost, setMetricsHost] = useState<AdminHost | null>(null)

  const load = useCallback((signal?: AbortSignal, opts: { silent?: boolean } = {}) => {
    if (opts.silent) setRefreshing(true)
    else setLoading(true)
    setError(null)
    fetchAdminHosts(token, signal)
      .then((data) => {
        setHosts(data.hosts ?? [])
        setServers(data.servers ?? [])
        setScopes(data.available_scopes ?? [])
      })
      .catch((e) => { if (!signal?.aborted) setError(errMessage(e)) })
      .finally(() => {
        if (signal?.aborted) return
        setLoading(false)
        setRefreshing(false)
      })
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

  const table = useAdminTable('utbt:admin:hosts:cols:v1', COLUMNS, { defaultFiltersOpen: false })
  const isVisible = table.isVisible
  const resolveColumns = useCallback((ids: Set<string>) => setVisibleColumns(ids), [])
  const shows = useCallback(
    (id: string) => isVisible(id) && (!visibleColumns || visibleColumns.has(id)),
    [isVisible, visibleColumns],
  )

  useRegisterPageRefresh({
    onRefresh: () => load(undefined, { silent: true }),
    refreshing,
    disabled: !token,
    tooltip: 'Refresh hosts',
  })

  const visibleHosts = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return hosts
    return hosts.filter((host) => (
      host.name.toLowerCase().includes(needle) ||
      (host.region ?? '').toLowerCase().includes(needle) ||
      (host.ip ?? '').toLowerCase().includes(needle)
    ))
  }, [hosts, search])

  const columnCount = 2 + (['address', 'servers', 'token'] as const).filter(shows).length

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
    assertPort(port, 'Agent port')

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

  const saveEdit = (host: AdminHost, patch: Partial<AdminHostInput>) => run(`edit:${host.id}`, async () => {
    if (patch.agent_port !== undefined) assertPort(patch.agent_port, 'Agent port')
    if (patch.control_port !== undefined && patch.control_port !== null) assertPort(patch.control_port, 'Maintenance port')
    await updateAdminHost(token, host.id, patch)
    setEditHost(null)
    load()
  })

  const saveLinks = (host: AdminHost) => run(`link:${host.id}`, async () => {
    await setAdminHostServers(token, host.id, Array.from(linkSelection))
    setLinkHost(null)
    setNotice(`Updated the servers on “${host.name}”.`)
    load()
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

  const saveServer = (server: AdminHostServer, input: AdminServerUpdate) =>
    run(`server:${server.id}`, async () => {
      if (input.port !== undefined) assertPort(input.port, 'Port')
      const result = await updateAdminServer(token, server.id, input)
      setServers((prev) => prev.map((s) => (s.id === result.server.id ? result.server : s)))
      setEditServer(null)
      setNotice(
        result.changed.length === 0
          ? `No changes to the ${result.server.name} server.`
          : `Updated ${result.changed.join(', ')} on the ${result.server.name} server.`,
      )
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

  const hostActions = (host: AdminHost) => {
    const items: ActionMenuItem[] = [
      {
        key: 'metrics',
        label: 'Host metrics',
        icon: Activity,
        hint: host.runtime?.known ? undefined : 'No readings yet',
        onSelect: () => setMetricsHost(host),
      },
      { key: 'edit', label: 'Edit host', icon: Pencil, onSelect: () => setEditHost(host) },
      {
        key: 'servers',
        label: 'Linked servers',
        icon: Link2,
        hint: `${(serversByHost.get(host.id) ?? []).length} linked`,
        onSelect: () => openLinkEditor(host),
      },
    ]

    if (host.token) {
      items.push(
        { key: 'replace', label: 'Replace token', icon: RefreshCw, tone: 'amber', separatorBefore: true, onSelect: () => setReplaceTarget(host) },
        { key: 'revoke', label: 'Remove token', icon: Ban, tone: 'red', onSelect: () => setRemoveTarget(host) },
      )
    } else {
      items.push({ key: 'issue', label: 'Issue token', icon: KeyRound, separatorBefore: true, onSelect: () => issue(host) })
    }

    return <ActionMenu items={items} heading={host.name} busy={busy === `token:${host.id}`} ariaLabel={`Actions for ${host.name}`} />
  }

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

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Search hosts by name, region or address..." className="min-w-[14rem] flex-1" />
        {!compact && <TableControls table={table} showFilters={false} />}
      </div>

      <DataTableShell
        responsive={{
          columns: RESPONSIVE_COLUMNS.filter((column) => column.required || isVisible(column.id)),
          onResolve: resolveColumns,
          onCompactChange: setCompact,
          compactAriaLabel: 'Game hosts',
          compactContent: visibleHosts.map((host) => {
            const linked = serversByHost.get(host.id) ?? []
            return (
              <div key={host.id} role="listitem" className="p-3 space-y-2 border-b border-hairline/5 last:border-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <span className="font-medium truncate">{host.name}</span>
                    <StatusPill active={host.active} activeLabel="Active" inactiveLabel="Disabled" />
                    {host.region && <span className="text-[11px] text-muted-foreground">{host.region}</span>}
                  </div>
                  {hostActions(host)}
                </div>
                <div className="text-[11px] text-muted-foreground tabular-nums">
                  {host.ip ? `${host.ip}:${host.agent_port}` : `agent port ${host.agent_port}`}
                </div>
                <AgentCell host={host} />
                <TokenCell token={host.token} />
                {linked.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {linked.map((server) => (
                      <ServerChip key={server.id} server={server} onClick={() => setEditServer(server)} />
                    ))}
                  </div>
                )}
              </div>
            )
          }),
        }}
      >
        <DataTableHeaderRow>
          <DataTableHeaderCell width="14rem">Host</DataTableHeaderCell>
          {shows('agent') && <DataTableHeaderCell width="10rem">Agent</DataTableHeaderCell>}
          {shows('address') && <DataTableHeaderCell width="11rem">Address</DataTableHeaderCell>}
          {shows('servers') && <DataTableHeaderCell width="18rem">Servers</DataTableHeaderCell>}
          {shows('token') && <DataTableHeaderCell width="13rem">Token</DataTableHeaderCell>}
          <DataTableHeaderCell align="right" width="5rem">Actions</DataTableHeaderCell>
        </DataTableHeaderRow>
        <tbody>
          {loading && Array.from({ length: 4 }).map((_, index) => (
            <DataTableSkeletonRow key={index} columnCount={columnCount} />
          ))}

          {!loading && visibleHosts.length === 0 && (
            <DataTableEmpty
              colSpan={columnCount}
              message={hosts.length === 0 ? 'No hosts registered yet. Add one for each box that runs game servers, then mint it a token.' : 'No hosts match your search.'}
            />
          )}

          {!loading && visibleHosts.map((host) => {
            const linked = serversByHost.get(host.id) ?? []
            const shown = linked.slice(0, MAX_INLINE_SERVER_CHIPS)
            const overflow = linked.length - shown.length
            return (
              <DataTableRow key={host.id} className={cn(!host.active && 'opacity-60')}>
                <DataTableCell width="14rem">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold truncate">{host.name}</span>
                      <StatusPill active={host.active} activeLabel="Active" inactiveLabel="Disabled" />
                    </div>
                    {host.region && <div className="text-[11px] text-muted-foreground truncate">{host.region}</div>}
                  </div>
                </DataTableCell>

                {shows('agent') && (
                  <DataTableCell width="10rem"><AgentCell host={host} /></DataTableCell>
                )}

                {shows('address') && (
                  <DataTableCell width="11rem" className="tabular-nums text-xs text-muted-foreground">
                    {host.ip ? `${host.ip}:${host.agent_port}` : `port ${host.agent_port}`}
                  </DataTableCell>
                )}

                {shows('servers') && (
                  <DataTableCell width="18rem">
                    {linked.length === 0 ? (
                      <span className="text-xs text-muted-foreground">None linked</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {shown.map((server) => (
                          <ServerChip key={server.id} server={server} onClick={() => setEditServer(server)} />
                        ))}
                        {overflow > 0 && (
                          <button
                            type="button"
                            onClick={() => openLinkEditor(host)}
                            className="px-2 py-0.5 rounded-md border border-hairline/20 bg-card/40 text-[11px] text-muted-foreground hover:text-foreground hover:border-hairline/40 transition-colors cursor-pointer"
                          >
                            +{overflow} more
                          </button>
                        )}
                      </div>
                    )}
                  </DataTableCell>
                )}

                {shows('token') && (
                  <DataTableCell width="13rem"><TokenCell token={host.token} /></DataTableCell>
                )}

                <DataTableCell align="right" width="5rem">
                  <div className="flex items-center justify-end">
                    {hostActions(host)}
                  </div>
                </DataTableCell>
              </DataTableRow>
            )
          })}
        </tbody>
      </DataTableShell>

      {unassigned.length > 0 && !loading && (
        <div className="rounded-lg border border-hairline/10 bg-card/20 px-4 py-3 space-y-1">
          <span className={PANEL_LABEL}>Servers not on any host ({unassigned.length})</span>
          <div className="flex flex-wrap gap-1.5">
            {unassigned.map((server) => (
              <ServerChip key={server.id} server={server} onClick={() => setEditServer(server)} />
            ))}
          </div>
        </div>
      )}

      {metricsHost && token && (
        <HostMetricsModal host={metricsHost} token={token} onClose={() => setMetricsHost(null)} />
      )}

      {editServer && (
        <EditServerModal
          server={editServer}
          hosts={hosts}
          busy={busy === `server:${editServer.id}`}
          onCancel={() => setEditServer(null)}
          onSave={(input) => saveServer(editServer, input)}
        />
      )}

      {editHost && (
        <EditHostModal
          host={editHost}
          busy={busy === `edit:${editHost.id}`}
          onCancel={() => setEditHost(null)}
          onSave={(patch) => saveEdit(editHost, patch)}
        />
      )}

      <Modal
        isOpen={!!linkHost}
        onClose={() => setLinkHost(null)}
        title={`Servers on ${linkHost?.name ?? ''}`}
        offsetSidebar
        maxWidth="34rem"
        footer={
          <ModalFooter>
            <Button variant="outline" onClick={() => setLinkHost(null)}>Cancel</Button>
            <Button
              onClick={() => { if (linkHost) saveLinks(linkHost) }}
              disabled={!!linkHost && busy === `link:${linkHost.id}`}
            >
              {!!linkHost && busy === `link:${linkHost.id}` ? 'Saving…' : 'Save'}
            </Button>
          </ModalFooter>
        }
      >
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
        </div>
      </Modal>

      <Modal
        isOpen={!!issuedToken}
        onClose={() => setIssuedToken(null)}
        title="Host token"
        offsetSidebar
        maxWidth="34rem"
        footer={
          <ModalFooter>
            <Button onClick={() => setIssuedToken(null)}>Done</Button>
          </ModalFooter>
        }
      >
        <div className="space-y-3">
          <p className="text-xs text-amber-300/90 flex items-start gap-1.5">
            <TriangleAlert className="size-3.5 shrink-0 mt-px" />
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

function EditHostModal({ host, busy, onCancel, onSave }: {
  host: AdminHost
  busy: boolean
  onCancel: () => void
  onSave: (patch: Partial<AdminHostInput>) => void
}) {
  const [region, setRegion] = useState(host.region ?? '')
  const [ip, setIp] = useState(host.ip ?? '')
  const [port, setPort] = useState(String(host.agent_port))
  const [controlPort, setControlPort] = useState(host.control_port === null ? '' : String(host.control_port))
  const [active, setActive] = useState(host.active)

  return (
    <Modal
      isOpen
      onClose={onCancel}
      title={`Edit ${host.name}`}
      offsetSidebar
      maxWidth="34rem"
      footer={
        <ModalFooter>
          <Button variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button
            disabled={busy}
            onClick={() => onSave({
              region: region.trim() || null,
              ip: ip.trim() || null,
              agent_port: Number(port),
              control_port: controlPort.trim() ? Number(controlPort) : null,
              active,
            })}
          >
            {busy ? 'Saving…' : 'Save'}
          </Button>
        </ModalFooter>
      }
    >
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
          <span className={PANEL_LABEL}>Maintenance port</span>
          <Input
            value={controlPort}
            onChange={(e) => setControlPort(e.target.value)}
            className="h-9"
            inputMode="numeric"
            placeholder="default"
          />
        </div>
        <div className="space-y-1">
          <span className={PANEL_LABEL}>Status</span>
          <AdminSelect
            value={String(active)}
            onChange={(v) => setActive(v === 'true')}
            options={HOST_STATUS_OPTIONS}
            ariaLabel="Host status"
          />
        </div>
      </div>
    </Modal>
  )
}

function EditServerModal({ server, hosts, busy, onCancel, onSave }: {
  server: AdminHostServer
  hosts: AdminHost[]
  busy: boolean
  onCancel: () => void
  onSave: (input: AdminServerUpdate) => void
}) {
  const [name, setName] = useState(server.name)
  const [region, setRegion] = useState(server.region ?? '')
  const [ip, setIp] = useState(server.ip ?? '')
  const [port, setPort] = useState(String(server.port))
  const [state, setState] = useState(server.state ?? 'Online')
  const [active, setActive] = useState(server.active)
  const [certified, setCertified] = useState(server.certified_records)
  const [hostRef, setHostRef] = useState(server.host_ref ?? '')

  const hostOptions = [
    { value: '', label: 'Not on a host' },
    ...hosts.map((h) => ({ value: h.id, label: h.name })),
  ]

  return (
    <Modal
      isOpen
      onClose={onCancel}
      title={server.name}
      offsetSidebar
      maxWidth="36rem"
      footer={
        <ModalFooter>
          <Button variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button
            disabled={busy}
            onClick={() => onSave({
              name: name.trim(),
              region: region.trim(),
              ip: ip.trim(),
              port: Number(port),
              state,
              active,
              certified_records: certified,
              host_ref: hostRef || null,
            })}
          >
            {busy ? 'Saving…' : 'Save'}
          </Button>
        </ModalFooter>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1 col-span-2">
          <span className={PANEL_LABEL}>Name</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9" maxLength={120} />
        </div>
        <div className="space-y-1">
          <span className={PANEL_LABEL}>Address</span>
          <Input value={ip} onChange={(e) => setIp(e.target.value)} className="h-9" placeholder="203.0.113.10" maxLength={45} />
        </div>
        <div className="space-y-1">
          <span className={PANEL_LABEL}>Port</span>
          <Input value={port} onChange={(e) => setPort(e.target.value)} className="h-9" inputMode="numeric" />
        </div>
        <div className="space-y-1">
          <span className={PANEL_LABEL}>Region</span>
          <Input value={region} onChange={(e) => setRegion(e.target.value)} className="h-9" maxLength={64} />
        </div>
        <div className="space-y-1">
          <span className={PANEL_LABEL}>State</span>
          <AdminSelect value={state} onChange={setState} options={SERVER_STATE_OPTIONS} ariaLabel="Server state" />
        </div>
        <div className="space-y-1">
          <span className={PANEL_LABEL}>Status</span>
          <AdminSelect
            value={String(active)}
            onChange={(v) => setActive(v === 'true')}
            options={SERVER_STATUS_OPTIONS}
            ariaLabel="Server status"
          />
        </div>
        <div className="space-y-1">
          <span className={PANEL_LABEL}>Records</span>
          <AdminSelect
            value={String(certified)}
            onChange={(v) => setCertified(v === 'true')}
            options={SERVER_RECORDS_OPTIONS}
            ariaLabel="Record certification"
          />
        </div>
        <div className="space-y-1 col-span-2">
          <span className={PANEL_LABEL}>Game host</span>
          <AdminSelect value={hostRef} onChange={setHostRef} options={hostOptions} ariaLabel="Game host" />
        </div>
        </div>

        <p className="text-[11px] text-muted-foreground">
          Address and port must match what the server actually binds, or players cannot join it from the launcher.
        </p>
      </div>
    </Modal>
  )
}
