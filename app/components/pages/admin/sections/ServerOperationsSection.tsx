import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CircleCheck, CircleHelp, CircleSlash, Server, ServerCog, TriangleAlert } from 'lucide-react'
import { fetchAdminServerOperations, type AdminOperationsServer, type AdminServerOperations } from '@/app/utils/api'
import { capabilities } from '@/app/platform'
import { cn } from '@/lib/utils'
import type { AdminSectionProps, Tone } from '../types'
import { SectionShell } from '../components/SectionShell'
import { StatCard } from '../components/StatCard'
import { TableControls } from '../components/TableControls'
import { useAdminTable } from '../components/useAdminTable'
import { AdminSelect, Feedback, SearchInput, errMessage, relTime } from '../components/controls'
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

const AUTO_REFRESH_MS = 30_000

const COLUMNS = [
  { id: 'server', label: 'Server', required: true },
  { id: 'health', label: 'Health', required: true },
  { id: 'host', label: 'Host' },
  { id: 'probe', label: 'Probe' },
  { id: 'process', label: 'Process' },
  { id: 'players', label: 'Players' },
  { id: 'map', label: 'Map' },
  { id: 'region', label: 'Region' },
]

const RESPONSIVE_COLUMNS = [
  { id: 'server', width: '15rem', required: true },
  { id: 'health', width: '9rem', required: true },
  { id: 'host', width: '10rem', priority: 50 },
  { id: 'players', width: '7rem', priority: 40 },
  { id: 'probe', width: '8rem', priority: 30 },
  { id: 'process', width: '8rem', priority: 25 },
  { id: 'map', width: '12rem', priority: 20 },
  { id: 'region', width: '8rem', priority: 10 },
]

const STATUS_OPTIONS = [
  { value: 'all', label: 'All servers' },
  { value: 'problems', label: 'Problems only' },
  { value: 'hung', label: 'Hung' },
  { value: 'answering', label: 'Answering' },
  { value: 'down', label: 'Not answering' },
  { value: 'unlinked', label: 'Not linked to a host' },
]

type Health = { key: 'healthy' | 'hung' | 'down' | 'unknown' | 'unlisted'; label: string; tone: Tone; hint: string }

function healthOf(server: AdminOperationsServer): Health {
  const answering = server.probe.answering
  const runtime = server.runtime
  const processKnown = runtime?.known && !runtime.stale

  if (!server.active) {
    return { key: 'unlisted', label: 'Inactive', tone: 'accent', hint: 'Not listed in the browser' }
  }
  if (answering) {
    return { key: 'healthy', label: 'Healthy', tone: 'emerald', hint: 'Answering player queries' }
  }
  if (processKnown && runtime.process_up) {
    return {
      key: 'hung',
      label: 'Hung',
      tone: 'amber',
      hint: 'The process is running but the server is not answering queries. A restart usually clears this.',
    }
  }
  if (processKnown && runtime.process_up === false) {
    return { key: 'down', label: 'Down', tone: 'red', hint: 'The process is not running on its host' }
  }
  return { key: 'unknown', label: 'No reply', tone: 'red', hint: 'Not answering, and its host has not reported in' }
}

const HEALTH_ICON = {
  healthy: CircleCheck,
  hung: TriangleAlert,
  down: CircleSlash,
  unknown: CircleHelp,
  unlisted: CircleHelp,
} as const

const HEALTH_CLASS: Record<Tone, string> = {
  emerald: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
  amber: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
  red: 'bg-red-500/10 border-red-500/30 text-red-300',
  accent: 'bg-card/40 border-hairline/20 text-muted-foreground',
}

function HealthPill({ server }: { server: AdminOperationsServer }) {
  const health = healthOf(server)
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

export function ServerOperationsSection({ userProfile }: AdminSectionProps) {
  const token = userProfile?.accessToken
  const [data, setData] = useState<AdminServerOperations | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [visibleColumns, setVisibleColumns] = useState<Set<string> | null>(null)
  const [compact, setCompact] = useState(false)

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

  const servers = useMemo(() => {
    const rows = data?.servers ?? []
    const needle = search.trim().toLowerCase()
    return rows.filter((server) => {
      const health = healthOf(server)
      if (status === 'problems' && (health.key === 'healthy' || health.key === 'unlisted')) return false
      if (status === 'hung' && health.key !== 'hung') return false
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
  }, [data, search, status])

  const totals = useMemo(() => {
    const rows = data?.servers ?? []
    const active = rows.filter((server) => server.active)
    const hosts = data?.hosts ?? []
    return {
      up: active.filter((server) => healthOf(server).key === 'healthy').length,
      hung: active.filter((server) => healthOf(server).key === 'hung').length,
      down: active.filter((server) => ['down', 'unknown'].includes(healthOf(server).key)).length,
      hostsOnline: hosts.filter((host) => host.active && host.runtime?.reachable).length,
      hostsActive: hosts.filter((host) => host.active).length,
    }
  }, [data])

  const columnCount = 2 + (['host', 'probe', 'process', 'players', 'map', 'region'] as const).filter(shows).length

  return (
    <SectionShell
      title="Server Operations"
      description="Every registered game server, the host it runs on, and whether it is answering."
      icon={ServerCog}
    >
      <Feedback message={error} tone="red" onDismiss={() => setError(null)} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Healthy" value={totals.up} icon={CircleCheck} tone="emerald" />
        <StatCard label="Hung" value={totals.hung} icon={TriangleAlert} tone={totals.hung > 0 ? 'amber' : 'accent'} hint="Running but not answering" />
        <StatCard label="Down" value={totals.down} icon={CircleSlash} tone={totals.down > 0 ? 'red' : 'accent'} />
        <StatCard
          label="Hosts online"
          value={`${totals.hostsOnline}/${totals.hostsActive}`}
          icon={Server}
          tone={totals.hostsOnline < totals.hostsActive ? 'amber' : 'accent'}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Search servers, hosts, maps..." className="min-w-[14rem] flex-1" />
        <AdminSelect value={status} onChange={setStatus} options={STATUS_OPTIONS} ariaLabel="Filter by probe status" />
        {!compact && <TableControls table={table} showFilters={false} />}
      </div>

      <DataTableShell
        responsive={{
          columns: RESPONSIVE_COLUMNS.filter((column) => column.required || isVisible(column.id)),
          onResolve: resolveColumns,
          onCompactChange: setCompact,
          compactAriaLabel: 'Game servers',
          compactContent: servers.map((server) => (
            <div key={server.id} role="listitem" className="p-3 space-y-2 border-b border-hairline/5 last:border-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium truncate">{server.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{server.host_name ?? 'No host linked'}</div>
                </div>
                <HealthPill server={server} />
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>{server.probe.map_name ?? '--'}</span>
                <span className="tabular-nums">
                  {server.probe.answering ? `${server.probe.num_players ?? 0}/${server.probe.max_players ?? 0}` : '--'}
                </span>
                <span>{server.region ?? '--'}</span>
              </div>
            </div>
          )),
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
              <DataTableCell width="15rem">
                <div className="min-w-0">
                  <div className="font-medium truncate">{server.name}</div>
                  <div className="text-xs text-muted-foreground tabular-nums">{server.port}</div>
                </div>
              </DataTableCell>
              <DataTableCell align="center" width="9rem"><HealthPill server={server} /></DataTableCell>
              {shows('host') && (
                <DataTableCell width="10rem">
                  {server.host_name ?? <span className="text-amber-300/80">Not linked</span>}
                </DataTableCell>
              )}
              {shows('probe') && (
                <DataTableCell align="center" width="8rem"><ProbePill server={server} /></DataTableCell>
              )}
              {shows('process') && (
                <DataTableCell align="center" width="8rem"><ProcessCell server={server} /></DataTableCell>
              )}
              {shows('players') && (
                <DataTableCell align="center" width="7rem" className="tabular-nums">
                  {server.probe.answering ? `${server.probe.num_players ?? 0}/${server.probe.max_players ?? 0}` : '--'}
                </DataTableCell>
              )}
              {shows('map') && (
                <DataTableCell width="12rem"><span className="truncate block">{server.probe.map_name ?? '--'}</span></DataTableCell>
              )}
              {shows('region') && <DataTableCell width="8rem">{server.region ?? '--'}</DataTableCell>}
            </DataTableRow>
          ))}
        </tbody>
      </DataTableShell>

      {data?.generated_at && (
        <div className="text-xs text-muted-foreground">Updated {relTime(data.generated_at)}</div>
      )}
    </SectionShell>
  )
}
