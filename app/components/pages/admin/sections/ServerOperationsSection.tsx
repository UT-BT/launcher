import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { BellRing, CircleCheck, CircleHelp, CirclePause, CircleSlash, Play, RefreshCw, RotateCcw, Server, ServerCog, Square, TriangleAlert } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  fetchAdminServerOperations,
  restartServer,
  startServer,
  stopServer,
  type AdminAlert,
  type AdminOperationsServer,
  type AdminServerOperations,
  type ServerAction,
  type ServerActionOutcome,
} from '@/app/utils/api'
import { capabilities } from '@/app/platform'
import { cn } from '@/lib/utils'
import type { AdminSectionProps, Tone } from '../types'
import { SectionShell } from '../components/SectionShell'
import { StatCard } from '../components/StatCard'
import { TableControls } from '../components/TableControls'
import { useAdminTable, type AdminColumn } from '../components/useAdminTable'
import { AdminCardFace, adminCardsPlaceholder } from '../components/AdminCardFace'
import { AdminSelect, ConfirmDialog, Feedback, SearchInput, errMessage, relTime } from '../components/controls'
import { ActionMenu, type ActionMenuItem } from '../components/ActionMenu'
import { useRegisterPageRefresh } from '@/app/components/navigation/PageRefreshContext'
import { AlertsPanel } from './AlertsPanel'
import {
  SERVER_ACTION_LABELS,
  isDownHealth,
  isHungHealth,
  isProblemHealth,
  serverActionConfirm,
  serverActionFailureMessage,
  serverActionSuccessMessage,
  serverActionsFor,
  serverHealth,
  type Health,
  type HealthKey,
} from './serverControl'
import {
  DataTableCell,
  DataTableEmpty,
  DataTableHeaderCell,
  DataTableHeaderRow,
  DataTableRow,
  DataTableShell,
  DataTableSkeletonRow,
} from '@/app/components/shared/DataTable'

const AUTO_REFRESH_MS = 30_000

const COLUMNS: AdminColumn[] = [
  { id: 'server', label: 'Server', required: true, tier: 'essential' },
  { id: 'health', label: 'Health', required: true, tier: 'essential' },
  { id: 'host', label: 'Host', tier: 'detail' },
  { id: 'probe', label: 'Probe', tier: 'detail' },
  { id: 'process', label: 'Process', tier: 'detail' },
  { id: 'players', label: 'Players', tier: 'detail' },
  { id: 'map', label: 'Map', tier: 'detail' },
  { id: 'region', label: 'Region', tier: 'detail' },
  { id: 'actions', label: 'Actions', required: true, tier: 'essential' },
]

const LAYOUT: Record<string, { width: string; priority?: number }> = {
  server: { width: '15rem' },
  health: { width: '9rem' },
  host: { width: '10rem', priority: 50 },
  players: { width: '7rem', priority: 40 },
  probe: { width: '8rem', priority: 30 },
  process: { width: '8rem', priority: 25 },
  map: { width: '12rem', priority: 20 },
  region: { width: '8rem', priority: 10 },
  actions: { width: '5rem' },
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All servers' },
  { value: 'problems', label: 'Problems only' },
  { value: 'hung', label: 'Hung' },
  { value: 'answering', label: 'Answering' },
  { value: 'down', label: 'Not answering' },
  { value: 'unlinked', label: 'Not linked to a host' },
]

const HEALTH_ICON: Record<HealthKey, LucideIcon> = {
  held: CirclePause,
  crash_loop: RotateCcw,
  watchdog: TriangleAlert,
  healthy: CircleCheck,
  hung: TriangleAlert,
  down: CircleSlash,
  unknown: CircleHelp,
  unlisted: CircleHelp,
}

const HEALTH_CLASS: Record<Tone, string> = {
  emerald: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
  amber: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
  red: 'bg-red-500/10 border-red-500/30 text-red-300',
  accent: 'bg-card/40 border-hairline/20 text-muted-foreground',
}

const ACTION_ICON: Record<ServerAction, LucideIcon> = { restart: RefreshCw, start: Play, stop: Square }

const SEND_ACTION: Record<ServerAction, (token: string, serverId: string) => Promise<ServerActionOutcome>> = {
  restart: restartServer,
  start: startServer,
  stop: stopServer,
}

function HealthPill({ health }: { health: Health }) {
  const Icon = HEALTH_ICON[health.key]
  return (
    <span
      title={health.hint}
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-medium',
        HEALTH_CLASS[health.tone],
      )}
    >
      <Icon className="size-3" />
      {health.label}
    </span>
  )
}

function ProcessCell({ server }: { server: AdminOperationsServer }) {
  const runtime = server.runtime
  if (!runtime?.known) return <span className="text-xs text-muted-foreground">Not polled</span>
  if (runtime.stale) {
    return <span className="text-xs text-muted-foreground" title={`Last seen ${relTime(runtime.observed_at)}`}>Stale</span>
  }
  return (
    <span
      className={cn('text-xs', runtime.process_up ? 'text-emerald-300' : 'text-red-300')}
      title={runtime.matched_by ? `Matched by ${runtime.matched_by}` : undefined}
    >
      {runtime.process_up ? 'Running' : 'Stopped'}
    </span>
  )
}

function ProbePill({ server }: { server: AdminOperationsServer }) {
  const { answering, updated_at } = server.probe
  const label = answering ? 'Answering' : updated_at ? 'Stale' : 'No reply'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-medium',
        answering
          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
          : 'bg-red-500/10 border-red-500/30 text-red-300',
      )}
      title={updated_at ? `Last probe ${relTime(updated_at)}` : 'Never probed, or the probe record was dropped'}
    >
      {answering ? <CircleCheck className="size-3" /> : <CircleSlash className="size-3" />}
      {label}
    </span>
  )
}

function serverCell(id: string, server: AdminOperationsServer, health: Health, actions: ReactNode): ReactNode {
  switch (id) {
    case 'server':
      return (
        <div className="min-w-0">
          <div className="font-medium truncate">{server.name}</div>
          <div className="text-xs text-muted-foreground tabular-nums">{server.port}</div>
        </div>
      )
    case 'health':
      return <HealthPill health={health} />
    case 'host':
      return server.host_name ?? <span className="text-amber-300/80">Not linked</span>
    case 'probe':
      return <ProbePill server={server} />
    case 'process':
      return <ProcessCell server={server} />
    case 'players':
      return (
        <span className="tabular-nums">
          {server.probe.answering ? `${server.probe.num_players ?? 0}/${server.probe.max_players ?? 0}` : '--'}
        </span>
      )
    case 'map':
      return <span className="truncate block">{server.probe.map_name ?? '--'}</span>
    case 'region':
      return server.region ?? '--'
    case 'actions':
      return actions
    default:
      return null
  }
}

export function ServerOperationsSection({ userProfile }: AdminSectionProps) {
  const token = userProfile?.accessToken
  const [data, setData] = useState<AdminServerOperations | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [visibleColumns, setVisibleColumns] = useState<Set<string> | null>(null)
  const [openAlerts, setOpenAlerts] = useState(0)
  const [alerts, setAlerts] = useState<AdminAlert[]>([])
  const [pending, setPending] = useState<{ server: AdminOperationsServer; action: ServerAction } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const role = userProfile?.utbt_role

  const table = useAdminTable('utbt:admin:serverops:cols:v1', COLUMNS, { defaultFiltersOpen: false })
  const abortRef = useRef<AbortController | null>(null)

  const resolveColumns = useCallback((ids: Set<string>) => setVisibleColumns(ids), [])
  const isVisible = table.isVisible
  const shows = useCallback(
    (id: string) => isVisible(id) && (!visibleColumns || visibleColumns.has(id)),
    [isVisible, visibleColumns],
  )

  const load = useCallback(async (opts: { silent?: boolean } = {}) => {
    if (!token) return
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    if (opts.silent) setRefreshing(true)
    else setLoading(true)

    try {
      const next = await fetchAdminServerOperations(token, controller.signal)
      setData(next)
      setError(null)
    } catch (e) {
      if (controller.signal.aborted) return
      setError(errMessage(e))
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [token])

  useEffect(() => {
    load()
    return () => abortRef.current?.abort()
  }, [load])

  useEffect(() => {
    const interval = setInterval(async () => {
      if (capabilities.game) {
        try {
          if (await window.conveyor.game.isGameRunning()) return
        } catch {
          /* fall through and refresh anyway */
        }
      }
      load({ silent: true })
    }, AUTO_REFRESH_MS)
    return () => clearInterval(interval)
  }, [load])

  useRegisterPageRefresh({
    onRefresh: () => load({ silent: true }),
    refreshing,
    disabled: !token,
    tooltip: 'Refresh server status',
  })

  const healthById = useMemo(
    () => new Map((data?.servers ?? []).map((server) => [server.id, serverHealth(server, alerts)])),
    [data, alerts],
  )
  const healthOf = useCallback(
    (server: AdminOperationsServer) => healthById.get(server.id) ?? serverHealth(server, alerts),
    [healthById, alerts],
  )

  const servers = useMemo(() => {
    const rows = data?.servers ?? []
    const needle = search.trim().toLowerCase()
    return rows.filter((server) => {
      const health = healthOf(server)
      if (status === 'problems' && !isProblemHealth(health.key)) return false
      if (status === 'hung' && !isHungHealth(health.key)) return false
      if (status === 'answering' && !server.probe.answering) return false
      if (status === 'down' && server.probe.answering) return false
      if (status === 'unlinked' && server.host_ref) return false
      if (!needle) return true
      return (
        server.name.toLowerCase().includes(needle) ||
        (server.host_name ?? '').toLowerCase().includes(needle) ||
        (server.probe.map_name ?? '').toLowerCase().includes(needle) ||
        (server.region ?? '').toLowerCase().includes(needle)
      )
    })
  }, [data, search, status, healthOf])

  const totals = useMemo(() => {
    const rows = data?.servers ?? []
    const active = rows.filter((server) => server.active)
    const hosts = data?.hosts ?? []
    return {
      up: active.filter((server) => healthOf(server).key === 'healthy').length,
      hung: active.filter((server) => isHungHealth(healthOf(server).key)).length,
      down: active.filter((server) => isDownHealth(healthOf(server).key)).length,
      hostsOnline: hosts.filter((host) => host.active && host.runtime?.reachable).length,
      hostsActive: hosts.filter((host) => host.active).length,
    }
  }, [data, healthOf])

  const runAction = async () => {
    if (!pending || !token) return
    const { server, action } = pending
    setBusy(server.id)
    setError(null)
    setNotice(null)
    try {
      const outcome = await SEND_ACTION[action](token, server.id)
      if (outcome.ok) {
        setNotice(serverActionSuccessMessage(action, server, outcome.result.unit_state))
        load({ silent: true })
      } else {
        setError(serverActionFailureMessage(action, outcome.failure))
      }
    } catch (e) {
      setError(errMessage(e))
    } finally {
      setBusy(null)
      setPending(null)
    }
  }

  const serverActions = (server: AdminOperationsServer) => {
    const items: ActionMenuItem[] = serverActionsFor(role, server.control).map((item) => ({
      key: item.action,
      label: SERVER_ACTION_LABELS[item.action],
      icon: ACTION_ICON[item.action],
      tone: item.action === 'stop' ? 'red' : undefined,
      disabled: !item.enabled,
      title: item.reason ?? undefined,
      hint: item.reason ?? undefined,
      onSelect: () => setPending({ server, action: item.action }),
    }))
    return <ActionMenu items={items} heading={server.name} busy={busy === server.id} ariaLabel={`Actions for ${server.name}`} />
  }

  const cell = (id: string, server: AdminOperationsServer) =>
    serverCell(id, server, healthOf(server), id === 'actions' ? serverActions(server) : null)

  const confirm = pending ? serverActionConfirm(pending.action, pending.server) : null

  const columnCount = 3 + (['host', 'probe', 'process', 'players', 'map', 'region'] as const).filter(shows).length

  const columns = table.responsiveColumns<AdminOperationsServer>((id) => ({
    width: LAYOUT[id]?.width, priority: LAYOUT[id]?.priority, cell: (server) => cell(id, server),
  }))

  return (
    <SectionShell
      title="Server Operations"
      description="Every registered game server, the host it runs on, and whether it is answering."
      icon={ServerCog}
    >
      <Feedback message={error} tone="red" onDismiss={() => setError(null)} />
      <Feedback message={notice} tone="emerald" onDismiss={() => setNotice(null)} />

      <AlertsPanel token={token} onCountChange={setOpenAlerts} onAlertsChange={setAlerts} />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard label="Healthy" value={totals.up} icon={CircleCheck} tone="emerald" />
        <StatCard label="Hung" value={totals.hung} icon={TriangleAlert} tone={totals.hung > 0 ? 'amber' : 'accent'} hint="Running but not answering" />
        <StatCard label="Down" value={totals.down} icon={CircleSlash} tone={totals.down > 0 ? 'red' : 'accent'} />
        <StatCard
          label="Hosts online"
          value={`${totals.hostsOnline}/${totals.hostsActive}`}
          icon={Server}
          tone={totals.hostsOnline < totals.hostsActive ? 'amber' : 'accent'}
        />
        <StatCard label="Open alerts" value={openAlerts} icon={BellRing} tone={openAlerts > 0 ? 'amber' : 'accent'} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Search servers, hosts, maps..." className="min-w-[14rem] flex-1" />
        <AdminSelect value={status} onChange={setStatus} options={STATUS_OPTIONS} ariaLabel="Filter by probe status" />
        <TableControls table={table} showFilters={false} />
      </div>

      <DataTableShell
        responsive={{
          columns,
          onResolve: resolveColumns,
          onCompactChange: table.onCompactChange,
          compactAriaLabel: 'Game servers',
          cards: {
            rows: servers,
            rowKey: (server) => server.id,
            rowClassName: (server) => (server.active ? undefined : 'opacity-50'),
            face: (server) => <AdminCardFace columns={columns} row={server} />,
            placeholder: adminCardsPlaceholder(loading, servers.length === 0, 'No servers match your filters.'),
          },
        }}
      >
        <DataTableHeaderRow>
          <DataTableHeaderCell width="15rem">Server</DataTableHeaderCell>
          <DataTableHeaderCell align="center" width="9rem">Health</DataTableHeaderCell>
          {shows('host') && <DataTableHeaderCell width="10rem">Host</DataTableHeaderCell>}
          {shows('probe') && <DataTableHeaderCell align="center" width="8rem">Probe</DataTableHeaderCell>}
          {shows('process') && <DataTableHeaderCell align="center" width="8rem">Process</DataTableHeaderCell>}
          {shows('players') && <DataTableHeaderCell align="center" width="7rem">Players</DataTableHeaderCell>}
          {shows('map') && <DataTableHeaderCell width="12rem">Map</DataTableHeaderCell>}
          {shows('region') && <DataTableHeaderCell width="8rem">Region</DataTableHeaderCell>}
          <DataTableHeaderCell align="right" width="5rem">Actions</DataTableHeaderCell>
        </DataTableHeaderRow>
        <tbody>
          {loading && Array.from({ length: 6 }).map((_, index) => (
            <DataTableSkeletonRow key={index} columnCount={columnCount} />
          ))}

          {!loading && servers.length === 0 && (
            <DataTableEmpty colSpan={columnCount} message="No servers match your filters." />
          )}

          {!loading && servers.map((server) => (
            <DataTableRow key={server.id} className={cn(!server.active && 'opacity-50')}>
              <DataTableCell width="15rem">{cell('server', server)}</DataTableCell>
              <DataTableCell align="center" width="9rem">{cell('health', server)}</DataTableCell>
              {shows('host') && <DataTableCell width="10rem">{cell('host', server)}</DataTableCell>}
              {shows('probe') && <DataTableCell align="center" width="8rem">{cell('probe', server)}</DataTableCell>}
              {shows('process') && <DataTableCell align="center" width="8rem">{cell('process', server)}</DataTableCell>}
              {shows('players') && <DataTableCell align="center" width="7rem">{cell('players', server)}</DataTableCell>}
              {shows('map') && <DataTableCell width="12rem">{cell('map', server)}</DataTableCell>}
              {shows('region') && <DataTableCell width="8rem">{cell('region', server)}</DataTableCell>}
              <DataTableCell align="right" width="5rem">
                <div className="flex items-center justify-end">{cell('actions', server)}</div>
              </DataTableCell>
            </DataTableRow>
          ))}
        </tbody>
      </DataTableShell>

      {data?.generated_at && (
        <div className="text-xs text-muted-foreground">Updated {relTime(data.generated_at)}</div>
      )}

      <ConfirmDialog
        open={!!pending}
        title={confirm?.title ?? ''}
        message={confirm && (
          <>
            <p>
              <span className="font-medium text-foreground">{confirm.server}</span> · {confirm.players}
            </p>
            <p className="mt-2">{confirm.detail}</p>
          </>
        )}
        confirmLabel={confirm?.confirmLabel}
        tone={confirm?.tone}
        busy={!!pending && busy === pending.server.id}
        onConfirm={runAction}
        onCancel={() => setPending(null)}
      />
    </SectionShell>
  )
}
