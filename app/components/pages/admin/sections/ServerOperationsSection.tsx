import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CircleCheck, CircleSlash, Server, ServerCog, Unlink } from 'lucide-react'
import { fetchAdminServerOperations, type AdminOperationsServer, type AdminServerOperations } from '@/app/utils/api'
import { capabilities } from '@/app/platform'
import { cn } from '@/lib/utils'
import type { AdminSectionProps } from '../types'
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
  { id: 'host', label: 'Host' },
  { id: 'probe', label: 'Probe' },
  { id: 'players', label: 'Players' },
  { id: 'map', label: 'Map' },
  { id: 'region', label: 'Region' },
]

const RESPONSIVE_COLUMNS = [
  { id: 'server', width: '16rem', required: true },
  { id: 'probe', width: '9rem', priority: 50 },
  { id: 'host', width: '10rem', priority: 40 },
  { id: 'players', width: '7rem', priority: 30 },
  { id: 'map', width: '12rem', priority: 20 },
  { id: 'region', width: '8rem', priority: 10 },
]

const STATUS_OPTIONS = [
  { value: 'all', label: 'All servers' },
  { value: 'answering', label: 'Answering' },
  { value: 'down', label: 'Not answering' },
  { value: 'unlinked', label: 'Not linked to a host' },
]

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
    return {
      up: active.filter((server) => server.probe.answering).length,
      down: active.filter((server) => !server.probe.answering).length,
      unlinked: rows.filter((server) => !server.host_ref).length,
      hosts: (data?.hosts ?? []).filter((host) => host.active).length,
    }
  }, [data])

  const columnCount = 1 + (['host', 'probe', 'players', 'map', 'region'] as const).filter(shows).length

  return (
    <SectionShell
      title="Server Operations"
      description="Every registered game server, the host it runs on, and whether it is answering."
      icon={ServerCog}
    >
      <Feedback message={error} tone="red" onDismiss={() => setError(null)} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Answering" value={totals.up} icon={CircleCheck} tone="emerald" />
        <StatCard label="Not answering" value={totals.down} icon={CircleSlash} tone={totals.down > 0 ? 'red' : 'accent'} />
        <StatCard label="Unlinked" value={totals.unlinked} icon={Unlink} tone={totals.unlinked > 0 ? 'amber' : 'accent'} hint="No host assigned" />
        <StatCard label="Active hosts" value={totals.hosts} icon={Server} />
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
                <ProbePill server={server} />
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
          <DataTableHeaderCell width="16rem">Server</DataTableHeaderCell>
          {shows('host') && <DataTableHeaderCell width="10rem">Host</DataTableHeaderCell>}
          {shows('probe') && <DataTableHeaderCell align="center" width="9rem">Probe</DataTableHeaderCell>}
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
              <DataTableCell width="16rem">
                <div className="min-w-0">
                  <div className="font-medium truncate">{server.name}</div>
                  <div className="text-xs text-muted-foreground tabular-nums">{server.port}</div>
                </div>
              </DataTableCell>
              {shows('host') && (
                <DataTableCell width="10rem">
                  {server.host_name ?? <span className="text-amber-300/80">Not linked</span>}
                </DataTableCell>
              )}
              {shows('probe') && (
                <DataTableCell align="center" width="9rem"><ProbePill server={server} /></DataTableCell>
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
