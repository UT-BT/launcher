import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ShieldAlert, RefreshCw, ExternalLink, ShieldOff, ShieldCheck, Undo2 } from 'lucide-react'
import {
  fetchAcShared, fetchAcSharedCount, fetchAcCapDelta, fetchAcCapDeltaCount, fetchAcLowFpsWr, fetchAcLowFpsWrCount,
  fetchAcIdentifier, fetchAcCapStats, fetchAcCapMapComparison, disallowCap, reallowCap, allowCap, unallowCap,
  bulkAllowCaps, bulkDisallowCaps, toActiveTitle,
  type AcSharedGroup, type AcSharedType, type AcView, type AcCapDeltaRow, type AcLowFpsWrRow, type ActiveTitle,
  type AcIdentifierDetail, type AcIdentifierCap, type AcCapStats, type AcMapComparison, type AcMetricCmp, type AcPopulationVerdict,
} from '@/app/utils/api'
import { cn } from '@/lib/utils'
import { formatCapTime } from '@/app/utils/format'
import type { AdminSectionProps } from '../types'
import { SectionShell } from '../components/SectionShell'
import { Pager, Feedback, ActionButton, AdminSelect, ConfirmDialog, Copyable, relTime, errMessage } from '../components/controls'
import { useAdminTable, type AdminColumn } from '../components/useAdminTable'
import { TableControls } from '../components/TableControls'
import { useResetOnChange, useAdminPageSize } from '../components/shared'
import { MapLink } from '../components/MapLink'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { CapTimeLink, openCap } from '@/app/components/shared/CapTimeLink'
import { Modal } from '@/app/components/ui/modal'
import { Button } from '@/app/components/ui/button'
import { Checkbox } from '@/app/components/ui/checkbox'
import { useNavState } from '@/app/components/navigation/useNavState'
import {
  DataTableShell, DataTableHeaderRow, DataTableHeaderCell, DataTableRow, DataTableCell, DataTableEmpty,
  DataTableSkeletonRow, type SortDirection, type ResponsiveColumn,
} from '@/app/components/shared/DataTable'

type TableLayout = Record<string, { width?: string; align?: 'left' | 'center' | 'right' }>

const TABS = [
  { id: 'shared', label: 'Shared HWID / IP' },
  { id: 'cap-delta', label: 'High Cap Delta' },
  { id: 'low-fps', label: 'Low FPS WRs' },
] as const
type TabId = typeof TABS[number]['id']

function titleFor(t: AcSharedGroup['players'][number]['active_title']): ActiveTitle | null {
  return toActiveTitle(t)
}

function TypeBadge({ type }: { type: 'hwid' | 'ip' }) {
  const hwid = type === 'hwid'
  return (
    <span className={cn(
      'inline-flex items-center text-[11px] font-medium rounded px-1.5 py-0.5 border uppercase tracking-wide',
      hwid ? 'bg-amber-500/10 border-amber-500/30 text-amber-200' : 'bg-accent-500/10 border-accent-500/30 text-accent-200',
    )}>
      {type}
    </span>
  )
}

function CapStatus({ verified, disallowed }: { verified: boolean; disallowed: boolean }) {
  if (disallowed) return <span className="text-red-300 text-xs">Disallowed</span>
  if (verified) return <span className="text-emerald-300 text-xs">Verified</span>
  return <span className="text-muted-foreground text-xs">Unverified</span>
}

function StatChip({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-hairline/10 bg-card/30 px-2.5 py-1 text-xs">
      <span className="text-muted-foreground uppercase tracking-wider text-[10px]">{label}</span>
      <span className="tabular-nums font-semibold text-foreground">{value.toLocaleString()}</span>
    </span>
  )
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: 'red' }) {
  return (
    <div className="rounded-md border border-hairline/10 bg-card/30 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn('text-sm font-semibold tabular-nums mt-0.5', tone === 'red' ? 'text-red-300' : 'text-foreground')}>{value}</div>
    </div>
  )
}

function KV({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1 min-w-0">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      {children}
    </div>
  )
}

function netspeedText(s: AcCapStats): string {
  if (s.netspeed_min == null && s.netspeed_max == null) return '—'
  if (s.netspeed_min === s.netspeed_max) return String(s.netspeed_min ?? '—')
  return `${s.netspeed_min ?? '?'}–${s.netspeed_max ?? '?'}`
}

const SHARED_MODAL_COLUMNS: AdminColumn[] = [
  { id: 'player', label: 'Player', required: true },
  { id: 'map', label: 'Map' },
  { id: 'time', label: 'Time' },
  { id: 'status', label: 'Status' },
  { id: 'added', label: 'Added' },
]

const SHARED_MODAL_LAYOUT: TableLayout = {
  player: { align: 'left' },
  map: { width: '11rem', align: 'left' },
  time: { width: '8rem', align: 'right' },
  status: { width: '7rem', align: 'center' },
  added: { width: '7rem', align: 'left' },
}

const SHARED_MODAL_PRIORITY: Record<string, number> = {
  player: 80,
  map: 60,
  time: 60,
  status: 30,
  added: 20,
}

function SharedDetailModal({ open, onClose, token, group, onMapSelect }: {
  open: boolean; onClose: () => void; token: string; group: AcSharedGroup | null; onMapSelect?: (mapName: string) => void
}) {
  const tbl = useAdminTable('utbt:admin:ac.sharedmodal:cols:v2', SHARED_MODAL_COLUMNS, { defaultFiltersOpen: false })
  const PAGE = useAdminPageSize()
  const [detail, setDetail] = useState<AcIdentifierDetail | null>(null)
  const [offset, setOffset] = useNavState('admin.anticheat.sharedmodal.offset', 0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { setOffset(0); setDetail(null) }, [group, setOffset, PAGE])

  useEffect(() => {
    if (!open || !group) return
    const c = new AbortController()
    setLoading(true); setError(null)
    fetchAcIdentifier(token, { type: group.type, value: group.value, limit: PAGE, offset }, c.signal)
      .then((d) => { setDetail(d); setLoading(false) })
      .catch((e) => { if (!c.signal.aborted) { setError(errMessage(e)); setLoading(false) } })
    return () => c.abort()
  }, [open, group, token, offset, PAGE])

  const responsiveColumns = useMemo<ResponsiveColumn[]>(
    () => tbl.columnOrder.filter(tbl.isVisible).map((id) => ({ id, width: SHARED_MODAL_LAYOUT[id]?.width, priority: SHARED_MODAL_PRIORITY[id], required: tbl.requiredColumns.has(id) })),
    [tbl.columnOrder, tbl.isVisible, tbl.requiredColumns],
  )
  const [resolvedSharedModal, setResolvedSharedModal] = useState<Set<string> | null>(null)
  const handleResolveSharedModal = useCallback((ids: Set<string>) => { setResolvedSharedModal(ids) }, [])
  const isShownSharedModal = useCallback((id: string) => tbl.isVisible(id) && (!resolvedSharedModal || resolvedSharedModal.has(id)), [tbl, resolvedSharedModal])
  const effectiveCountSharedModal = tbl.columnOrder.filter(isShownSharedModal).length

  const renderHeader = (id: string): ReactNode => {
    if (!isShownSharedModal(id)) return null
    const layout = SHARED_MODAL_LAYOUT[id]
    return <DataTableHeaderCell key={id} width={layout.width} align={layout.align}>{tbl.columnLabels[id]}</DataTableHeaderCell>
  }

  const renderCell = (id: string, c: AcIdentifierCap): ReactNode => {
    if (!isShownSharedModal(id)) return null
    const align = SHARED_MODAL_LAYOUT[id].align
    switch (id) {
      case 'player':
        return <DataTableCell key={id} align={align}><PlayerInfo userId={c.user} alias={c.alias} title={titleFor(c.active_title)} size="sm" /></DataTableCell>
      case 'map':
        return <DataTableCell key={id} align={align}><MapLink name={c.map} onSelect={onMapSelect} className="text-sm" /></DataTableCell>
      case 'time':
        return <DataTableCell key={id} align={align} className="tabular-nums"><CapTimeLink capId={c.cap_id} seconds={c.cap_time_seconds ?? 0} className="text-sm" /></DataTableCell>
      case 'status':
        return <DataTableCell key={id} align={align}><CapStatus verified={c.verified} disallowed={c.disallowed} /></DataTableCell>
      case 'added':
        return <DataTableCell key={id} align={align} className="text-xs text-muted-foreground whitespace-nowrap">{relTime(c.added)}</DataTableCell>
      default:
        return null
    }
  }

  return (
    <Modal isOpen={open} onClose={onClose} title={group ? `${group.type.toUpperCase()} detail` : 'Detail'} offsetSidebar maxWidth="52rem">
      <div className="space-y-4">
        {group && (
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <TypeBadge type={group.type} />
              <Copyable value={group.value} />
            </div>
            <div className="flex items-center gap-2">
              <TableControls table={tbl} showFilters={false} />
            </div>
          </div>
        )}
        <Feedback message={error} tone="red" onDismiss={() => setError(null)} />
        {detail && (
          <div className="flex flex-wrap gap-2">
            <StatChip label="Caps" value={detail.summary.cap_count} />
            <StatChip label="Maps" value={detail.summary.map_count} />
            <StatChip label="Players" value={detail.summary.player_count} />
          </div>
        )}
        <DataTableShell className="flex-none" responsive={{ columns: responsiveColumns, nameFloorRem: 14, extraRem: 0, onResolve: handleResolveSharedModal }}>
          <DataTableHeaderRow>
            {tbl.columnOrder.map((id) => renderHeader(id))}
          </DataTableHeaderRow>
          <tbody>
            {loading && (!detail || detail.items.length === 0) ? (
              Array.from({ length: 6 }).map((_, i) => <DataTableSkeletonRow key={i} columnCount={effectiveCountSharedModal} />)
            ) : !detail || detail.items.length === 0 ? (
              <DataTableEmpty colSpan={effectiveCountSharedModal} message="No caps on this identifier." />
            ) : detail.items.map((c) => (
              <DataTableRow key={c.cap_id}>{tbl.columnOrder.map((id) => renderCell(id, c))}</DataTableRow>
            ))}
          </tbody>
        </DataTableShell>
        <Pager offset={offset} limit={PAGE} total={detail?.total ?? null} loading={loading}
          onPrev={() => setOffset(Math.max(0, offset - PAGE))} onNext={() => setOffset(offset + PAGE)} />
      </div>
    </Modal>
  )
}

const VERDICT_META: Record<AcPopulationVerdict, { label: string; text: string; pill: string; marker: string; severity: number }> = {
  well_below_map_normal: { label: 'Well below map normal', text: 'text-red-300', pill: 'bg-red-500/[0.12] border-red-500/40 text-red-300', marker: 'bg-red-300', severity: 4 },
  below_map_normal: { label: 'Below map normal', text: 'text-amber-200', pill: 'bg-amber-500/[0.12] border-amber-500/40 text-amber-200', marker: 'bg-amber-200', severity: 3 },
  typical: { label: 'Typical for this map', text: 'text-muted-foreground', pill: 'bg-hairline/10 border-hairline/15 text-muted-foreground', marker: 'bg-foreground/70', severity: 1 },
  above_map_normal: { label: 'Above map normal', text: 'text-emerald-300', pill: 'bg-emerald-500/[0.12] border-emerald-500/40 text-emerald-300', marker: 'bg-emerald-300', severity: 1 },
  insufficient_data: { label: 'Not enough data', text: 'text-muted-foreground/60', pill: '', marker: '', severity: 0 },
}

const POP_METRICS: { key: keyof AcMapComparison['metrics']; label: string }[] = [
  { key: 'fps_1pc', label: 'FPS 1%' },
  { key: 'fps_5pc', label: 'FPS 5%' },
  { key: 'fps_25pc', label: 'FPS 25%' },
  { key: 'fps_50pc', label: 'FPS 50%' },
]

function popPct(value: number, min: number, max: number): number {
  if (max <= min) return 50
  return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100))
}

function VerdictPill({ verdict }: { verdict: AcPopulationVerdict }) {
  const meta = VERDICT_META[verdict]
  if (!meta.pill) return null
  return <span className={cn('inline-flex items-center text-[10px] font-semibold rounded px-1.5 py-0.5 border uppercase tracking-wide', meta.pill)}>{meta.label}</span>
}

function MetricRangeBar({ label, metric }: { label: string; metric: AcMetricCmp }) {
  const meta = VERDICT_META[metric.verdict]
  const { min, max, p10, p50, p90, value } = metric
  const hasBand = metric.sufficient && min != null && max != null && p10 != null && p50 != null && p90 != null
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums">
          {value != null
            ? <span className={meta.text}>this {value}</span>
            : <span className="text-muted-foreground/40">not reported</span>}
          {p50 != null && <span className="text-muted-foreground/50"> · map ~{p50}</span>}
          {metric.percentile_rank != null && <span className="text-muted-foreground/40"> · p{Math.round(metric.percentile_rank)}</span>}
        </span>
      </div>
      {hasBand ? (
        <div className="relative h-2 rounded-full bg-hairline/10">
          <div className="absolute inset-y-0 rounded-full bg-accent-500/20"
            style={{ left: `${popPct(p10, min, max)}%`, right: `${100 - popPct(p90, min, max)}%` }} />
          <div className="absolute inset-y-0 w-px bg-foreground/40" style={{ left: `${popPct(p50, min, max)}%` }} />
          {value != null && meta.marker && (
            <div className={cn('absolute inset-y-[-2px] w-0.5 rounded-full', meta.marker)} style={{ left: `${popPct(value, min, max)}%` }} />
          )}
        </div>
      ) : (
        <div className="h-2 rounded-full bg-hairline/10 flex items-center">
          <span className="text-[10px] text-muted-foreground/40 px-2">not enough data</span>
        </div>
      )}
    </div>
  )
}

function MapComparisonSection({ token, capId }: { token: string; capId: string }) {
  const [data, setData] = useState<AcMapComparison | null>(null)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const c = new AbortController()
    setLoading(true); setFailed(false); setData(null)
    fetchAcCapMapComparison(token, capId, c.signal)
      .then((d) => { setData(d); setLoading(false) })
      .catch(() => { if (!c.signal.aborted) { setFailed(true); setLoading(false) } })
    return () => c.abort()
  }, [token, capId])

  const present = data ? POP_METRICS.map((m) => data.metrics[m.key]).filter((m): m is AcMetricCmp => m != null) : []
  const headline = present.reduce<AcPopulationVerdict | null>((acc, m) => {
    if (m.value == null) return acc
    return VERDICT_META[m.verdict].severity > (acc ? VERDICT_META[acc].severity : -1) ? m.verdict : acc
  }, null)

  return (
    <div className="border-t border-hairline/10 pt-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Compared to this map</span>
        {headline && <VerdictPill verdict={headline} />}
      </div>
      {loading ? (
        <div className="text-sm text-muted-foreground">Comparing to map population…</div>
      ) : failed ? (
        <div className="text-xs text-muted-foreground/60">Comparison unavailable.</div>
      ) : data && !data.population.sufficient ? (
        <div className="text-xs text-muted-foreground/60">Only {data.population.n_total} caps on this map — not enough to compare.</div>
      ) : data ? (
        <>
          <div className="space-y-2.5">
            {POP_METRICS.map((m) => {
              const metric = data.metrics[m.key]
              return metric ? <MetricRangeBar key={m.key} label={m.label} metric={metric} /> : null
            })}
          </div>
          <p className="text-[10px] text-muted-foreground/50">Excludes disallowed · includes unverified · {data.population.n_total} caps on this map</p>
        </>
      ) : null}
    </div>
  )
}

const CAP_STATS_COLUMNS: AdminColumn[] = [
  { id: 'bucket', label: 'Percentile', required: true },
  { id: 'fps', label: 'FPS' },
  { id: 'ping', label: 'Ping' },
]

const CAP_STATS_LAYOUT: TableLayout = {
  bucket: { width: '8rem', align: 'left' },
  fps: { width: '8rem', align: 'right' },
  ping: { width: '8rem', align: 'right' },
}

const CAP_STATS_BUCKETS: { label: string; fps: keyof AcCapStats; ping: keyof AcCapStats }[] = [
  { label: '1%', fps: 'fps_1pc', ping: 'ping_1pc' },
  { label: '5%', fps: 'fps_5pc', ping: 'ping_5pc' },
  { label: '25%', fps: 'fps_25pc', ping: 'ping_25pc' },
  { label: '50%', fps: 'fps_50pc', ping: 'ping_50pc' },
]

function CapPercentileTable({ stats }: { stats: AcCapStats }) {
  const tbl = useAdminTable('utbt:admin:ac.capstats:cols:v2', CAP_STATS_COLUMNS, { defaultFiltersOpen: false })

  const responsiveColumns = useMemo<ResponsiveColumn[]>(
    () => tbl.columnOrder.filter(tbl.isVisible).map((id) => ({ id, width: CAP_STATS_LAYOUT[id]?.width, required: true })),
    [tbl.columnOrder, tbl.isVisible],
  )

  const renderHeader = (id: string): ReactNode => {
    if (!tbl.isVisible(id)) return null
    const layout = CAP_STATS_LAYOUT[id]
    return <DataTableHeaderCell key={id} width={layout.width} align={layout.align}>{tbl.columnLabels[id]}</DataTableHeaderCell>
  }

  const renderCell = (id: string, bucket: typeof CAP_STATS_BUCKETS[number]): ReactNode => {
    if (!tbl.isVisible(id)) return null
    const align = CAP_STATS_LAYOUT[id].align
    switch (id) {
      case 'bucket':
        return <DataTableCell key={id} align={align} className="text-xs uppercase tracking-wider text-muted-foreground">{bucket.label}</DataTableCell>
      case 'fps':
        return <DataTableCell key={id} align={align} className="tabular-nums">{fpsCell(stats[bucket.fps] as number | null)}</DataTableCell>
      case 'ping':
        return <DataTableCell key={id} align={align} className="tabular-nums text-foreground">{(stats[bucket.ping] as number | null) ?? <span className="text-muted-foreground/40">—</span>}</DataTableCell>
      default:
        return null
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Frame rate &amp; ping percentiles</span>
        <TableControls table={tbl} showFilters={false} />
      </div>
      <DataTableShell className="flex-none" responsive={{ columns: responsiveColumns }}>
        <DataTableHeaderRow>
          {tbl.columnOrder.map((id) => renderHeader(id))}
        </DataTableHeaderRow>
        <tbody>
          {CAP_STATS_BUCKETS.map((bucket) => (
            <DataTableRow key={bucket.label}>{tbl.columnOrder.map((id) => renderCell(id, bucket))}</DataTableRow>
          ))}
        </tbody>
      </DataTableShell>
    </div>
  )
}

function CapStatsModal({ open, onClose, token, capId, onMapSelect }: {
  open: boolean; onClose: () => void; token: string; capId: string | null; onMapSelect?: (mapName: string) => void
}) {
  const [stats, setStats] = useState<AcCapStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !capId) { setStats(null); return }
    const c = new AbortController()
    setLoading(true); setError(null)
    fetchAcCapStats(token, capId, c.signal)
      .then((s) => { setStats(s); setLoading(false) })
      .catch((e) => { if (!c.signal.aborted) { setError(errMessage(e)); setLoading(false) } })
    return () => c.abort()
  }, [open, capId, token])

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="Cap stats"
      offsetSidebar
      maxWidth="40rem"
      footer={capId && (
        <div className="p-4 border-t border-border bg-muted/50 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <ActionButton tone="accent" icon={ExternalLink} onClick={() => { openCap(capId); onClose() }}>Open cap detail</ActionButton>
        </div>
      )}
    >
      <div className="space-y-4">
        <Feedback message={error} tone="red" onDismiss={() => setError(null)} />
        {loading && !stats ? (
          <div className="text-sm text-muted-foreground py-8 text-center">Loading…</div>
        ) : stats && (
          <>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <PlayerInfo userId={stats.user} alias={stats.alias} title={titleFor(stats.active_title)} size="lg" interactive={false} />
              <CapStatus verified={stats.verified} disallowed={stats.disallowed} />
            </div>
            <div className="flex flex-wrap gap-2 items-center text-sm">
              <MapLink name={stats.map} onSelect={onMapSelect} className="font-medium" />
              <span className="text-muted-foreground/60">·</span>
              <span className="tabular-nums font-mono">{formatCapTime(stats.cap_time_seconds ?? 0)}</span>
              <span className="text-muted-foreground/60">·</span>
              <span className="text-muted-foreground text-xs">{relTime(stats.added)}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Stat label="Client Δ" value={deltaText(stats.client_cap_delta)} tone="red" />
              <Stat label="Spawns" value={stats.spawn_count ?? '—'} />
              <Stat label="Team" value={stats.team ?? '—'} />
              <Stat label="Netspeed" value={netspeedText(stats)} tone={isOutOfNetBand(stats.netspeed_min, stats.netspeed_max) ? 'red' : undefined} />
              <Stat label="Set FPS cap" value={capText(stats.set_fps_min, stats.set_fps_max)} tone={isLowCap(stats.set_fps_min, stats.set_fps_max) ? 'red' : undefined} />
            </div>
            <CapPercentileTable stats={stats} />
            {capId && <MapComparisonSection token={token} capId={capId} />}
            <div className="grid sm:grid-cols-2 gap-3">
              <KV label="IP"><Copyable value={stats.ip ?? '—'} /></KV>
              <KV label="HWID"><Copyable value={stats.hwid ?? '—'} /></KV>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}

type CapMutation = (token: string, capId: string, reason?: string) => Promise<unknown>

function useCapAction(mutation: CapMutation, token: string, reload: () => void, onError: (m: string) => void) {
  const [target, setTarget] = useState<{ capId: string; label: ReactNode } | null>(null)
  const [busy, setBusy] = useState(false)
  const confirm = async (reason?: string) => {
    if (!target) return
    setBusy(true)
    try {
      await mutation(token, target.capId, reason)
      setTarget(null)
      reload()
    } catch (e) {
      onError(errMessage(e))
      setTarget(null)
    } finally {
      setBusy(false)
    }
  }
  return { target, setTarget, busy, confirm }
}

type CapActionState = ReturnType<typeof useCapAction>

function DisallowConfirm({ state }: { state: CapActionState }) {
  return (
    <ConfirmDialog
      open={!!state.target}
      title="Disallow cap"
      tone="red"
      confirmLabel="Disallow"
      withReason
      reasonRequired
      reasonPlaceholder="Why is this cap being disallowed?"
      busy={state.busy}
      onConfirm={state.confirm}
      onCancel={() => state.setTarget(null)}
      message={state.target?.label ?? null}
    />
  )
}

function AllowConfirm({ state }: { state: CapActionState }) {
  return (
    <ConfirmDialog
      open={!!state.target}
      title="Mark cap as legitimate"
      tone="accent"
      confirmLabel="Allow"
      withReason
      reasonRequired
      reasonPlaceholder="Why is this cap legitimate?"
      busy={state.busy}
      onConfirm={state.confirm}
      onCancel={() => state.setTarget(null)}
      message={state.target?.label ?? null}
    />
  )
}

function UnallowConfirm({ state }: { state: CapActionState }) {
  return (
    <ConfirmDialog
      open={!!state.target}
      title="Remove from allow list"
      tone="accent"
      confirmLabel="Re-flag"
      withReason
      reasonPlaceholder="Optional note for the audit log"
      busy={state.busy}
      onConfirm={state.confirm}
      onCancel={() => state.setTarget(null)}
      message={state.target?.label ?? null}
    />
  )
}

function ReallowConfirm({ state }: { state: CapActionState }) {
  return (
    <ConfirmDialog
      open={!!state.target}
      title="Re-allow cap"
      tone="accent"
      confirmLabel="Re-allow"
      withReason
      reasonPlaceholder="Optional note for the audit log"
      busy={state.busy}
      onConfirm={state.confirm}
      onCancel={() => state.setTarget(null)}
      message={state.target?.label ?? null}
    />
  )
}

function disallowLabel(alias: string | null, user: string, map: string): ReactNode {
  return (
    <>Disallow <span className="text-foreground font-medium">{alias || user}</span>&apos;s cap on{' '}
    <span className="text-foreground font-medium">{map}</span>? It leaves the leaderboard and the reason is recorded in the audit log.</>
  )
}

function allowLabel(alias: string | null, user: string, map: string): ReactNode {
  return (
    <>Mark <span className="text-foreground font-medium">{alias || user}</span>&apos;s cap on{' '}
    <span className="text-foreground font-medium">{map}</span> as legitimate? It is removed from the flagged list (but stays on the
    leaderboard) and the reason is recorded in the audit log.</>
  )
}

function unallowLabel(alias: string | null, user: string, map: string): ReactNode {
  return (
    <>Remove <span className="text-foreground font-medium">{alias || user}</span>&apos;s cap on{' '}
    <span className="text-foreground font-medium">{map}</span> from the allow list? It returns to the flagged list.</>
  )
}

function reallowLabel(alias: string | null, user: string, map: string): ReactNode {
  return (
    <>Re-allow <span className="text-foreground font-medium">{alias || user}</span>&apos;s cap on{' '}
    <span className="text-foreground font-medium">{map}</span>? It leaves the denied list and returns to the
    leaderboard, and the reason is recorded in the audit log.</>
  )
}

function ViewToggle({ view, onChange, counts }: {
  view: AcView; onChange: (v: AcView) => void; counts: Record<AcView, number | null>
}) {
  const opts: { id: AcView; label: string; count: number | null }[] = [
    { id: 'flagged', label: 'Flagged', count: counts.flagged },
    { id: 'allowed', label: 'Allowed', count: counts.allowed },
    { id: 'denied', label: 'Denied', count: counts.denied },
  ]
  return (
    <div className="inline-flex items-center gap-0.5 rounded-md border border-hairline/10 bg-card/30 p-0.5">
      {opts.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={cn(
            'h-7 px-2.5 rounded text-xs inline-flex items-center gap-1.5 cursor-pointer transition-colors',
            view === o.id ? 'bg-accent-500/15 text-accent-200' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {o.label}
          {o.count != null && <span className="text-[10px] tabular-nums rounded bg-hairline/10 px-1 py-0.5">{o.count}</span>}
        </button>
      ))}
    </div>
  )
}

function useSelection<T extends { cap_id: string }>(rows: T[], resetKey: string) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const clear = useCallback(() => setSelected(new Set()), [])
  useEffect(() => { clear() }, [resetKey, clear])
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.cap_id))
  const someSelected = selected.size > 0 && !allSelected
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.cap_id)))
  const toggleOne = (id: string) => setSelected((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })
  return { selected, clear, allSelected, someSelected, toggleAll, toggleOne }
}

type BulkMutation = (token: string, capIds: string[], reason?: string) => Promise<unknown>

function useBulkAcAction(mutation: BulkMutation, token: string, reload: () => void, onError: (m: string) => void, onDone: () => void) {
  const [target, setTarget] = useState<{ ids: string[]; label: ReactNode } | null>(null)
  const [busy, setBusy] = useState(false)
  const confirm = async (reason?: string) => {
    if (!target) return
    setBusy(true)
    try {
      await mutation(token, target.ids, reason)
      setTarget(null)
      onDone()
      reload()
    } catch (e) {
      onError(errMessage(e))
      setTarget(null)
    } finally {
      setBusy(false)
    }
  }
  return { target, setTarget, busy, confirm }
}
type BulkAcActionState = ReturnType<typeof useBulkAcAction>

function bulkLabel(verb: string, n: number, tail: ReactNode): ReactNode {
  return <>{verb} <span className="text-foreground font-medium">{n}</span> selected cap{n === 1 ? '' : 's'}? {tail}</>
}

function BulkBar({ count, allow, disallow, onClear }: {
  count: number; allow: () => void; disallow: () => void; onClear: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-accent-500/30 bg-accent-500/10 px-3 py-2">
      <span className="text-xs text-foreground">{count} selected</span>
      <div className="flex items-center gap-1.5 ml-auto">
        <ActionButton tone="emerald" icon={ShieldCheck} onClick={allow}>Mark legitimate</ActionButton>
        <ActionButton tone="red" icon={ShieldOff} onClick={disallow}>Disallow</ActionButton>
        <button type="button" onClick={onClear}
          className="text-xs text-muted-foreground hover:text-foreground px-2 cursor-pointer">Clear</button>
      </div>
    </div>
  )
}

function BulkDisallowConfirm({ state }: { state: BulkAcActionState }) {
  return (
    <ConfirmDialog open={!!state.target} title="Disallow caps" tone="red" confirmLabel="Disallow"
      withReason reasonRequired reasonPlaceholder="Why are these caps being disallowed?"
      busy={state.busy} onConfirm={state.confirm} onCancel={() => state.setTarget(null)} message={state.target?.label ?? null} />
  )
}

function BulkAllowConfirm({ state }: { state: BulkAcActionState }) {
  return (
    <ConfirmDialog open={!!state.target} title="Mark caps as legitimate" tone="accent" confirmLabel="Allow"
      withReason reasonRequired reasonPlaceholder="Why are these caps legitimate?"
      busy={state.busy} onConfirm={state.confirm} onCancel={() => state.setTarget(null)} message={state.target?.label ?? null} />
  )
}

const SHARED_COLUMNS: AdminColumn[] = [
  { id: 'type', label: 'Type', required: true },
  { id: 'identifier', label: 'Identifier', required: true },
  { id: 'players', label: 'Shared by' },
  { id: 'caps', label: 'Caps' },
  { id: 'lastSeen', label: 'Last seen' },
]

const SHARED_LAYOUT: TableLayout = {
  type: { width: '6rem', align: 'left' },
  identifier: { width: '16rem', align: 'left' },
  players: { align: 'left' },
  caps: { width: '6rem', align: 'right' },
  lastSeen: { width: '8rem', align: 'left' },
}

const SHARED_PRIORITY: Record<string, number> = {
  players: 80,
  caps: 50,
  lastSeen: 20,
}

function SharedTable({ token, defaultTotal, onMapSelect }: { token: string; defaultTotal: number | null; onMapSelect?: (mapName: string) => void }) {
  const tbl = useAdminTable('utbt:admin:ac.shared:cols:v2', SHARED_COLUMNS, { defaultFiltersOpen: false })
  const PAGE = useAdminPageSize()
  const [type, setType] = useNavState<AcSharedType>('admin.anticheat.shared.type', 'all')
  const [offset, setOffset] = useNavState('admin.anticheat.shared.offset', 0)
  const [rows, setRows] = useState<AcSharedGroup[]>([])
  const [filteredTotal, setFilteredTotal] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<AcSharedGroup | null>(null)

  const isDefault = type === 'all'
  const total = isDefault ? defaultTotal : filteredTotal

  useResetOnChange(() => setOffset(0), [type, PAGE])

  const load = useCallback((signal?: AbortSignal) => {
    setLoading(true); setError(null)
    Promise.all([
      fetchAcShared(token, { type, limit: PAGE, offset }, signal),
      isDefault ? Promise.resolve<number | null>(null) : fetchAcSharedCount(token, { type }, signal),
    ])
      .then(([items, count]) => { setRows(items); if (count != null) setFilteredTotal(count); setLoading(false) })
      .catch((e) => { if (!signal?.aborted) { setError(errMessage(e)); setLoading(false) } })
  }, [token, type, offset, isDefault, PAGE])

  useEffect(() => { const c = new AbortController(); load(c.signal); return () => c.abort() }, [load])

  const responsiveColumns = useMemo<ResponsiveColumn[]>(
    () => tbl.columnOrder.filter(tbl.isVisible).map((id) => ({ id, width: SHARED_LAYOUT[id]?.width, priority: SHARED_PRIORITY[id], required: tbl.requiredColumns.has(id) })),
    [tbl.columnOrder, tbl.isVisible, tbl.requiredColumns],
  )
  const [resolvedShared, setResolvedShared] = useState<Set<string> | null>(null)
  const handleResolveShared = useCallback((ids: Set<string>) => { setResolvedShared(ids) }, [])
  const isShownShared = useCallback((id: string) => tbl.isVisible(id) && (!resolvedShared || resolvedShared.has(id)), [tbl, resolvedShared])
  const effectiveCountShared = tbl.columnOrder.filter(isShownShared).length

  const renderHeader = (id: string): ReactNode => {
    if (!isShownShared(id)) return null
    const layout = SHARED_LAYOUT[id]
    return <DataTableHeaderCell key={id} width={layout.width} align={layout.align}>{tbl.columnLabels[id]}</DataTableHeaderCell>
  }

  const renderCell = (id: string, g: AcSharedGroup): ReactNode => {
    if (!isShownShared(id)) return null
    const align = SHARED_LAYOUT[id].align
    switch (id) {
      case 'type':
        return <DataTableCell key={id} align={align}><TypeBadge type={g.type} /></DataTableCell>
      case 'identifier':
        return <DataTableCell key={id} align={align}><span className="font-mono text-xs text-foreground truncate block" title={g.value}>{g.value}</span></DataTableCell>
      case 'players':
        return (
          <DataTableCell key={id} align={align}>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 py-1">
              {g.players.map((p) => (
                <PlayerInfo key={p.id} userId={p.id} alias={p.alias} title={titleFor(p.active_title)} size="sm" />
              ))}
            </div>
          </DataTableCell>
        )
      case 'caps':
        return <DataTableCell key={id} align={align} className="tabular-nums text-muted-foreground">{g.cap_count}</DataTableCell>
      case 'lastSeen':
        return <DataTableCell key={id} align={align} className="text-xs text-muted-foreground whitespace-nowrap">{relTime(g.last_seen)}</DataTableCell>
      default:
        return null
    }
  }

  return (
    <div className="space-y-3">
      <Feedback message={error} tone="red" onDismiss={() => setError(null)} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <AdminSelect value={type} onChange={(v) => setType(v as AcSharedType)} ariaLabel="Identifier type"
          options={[{ value: 'all', label: 'HWID & IP' }, { value: 'hwid', label: 'HWID only' }, { value: 'ip', label: 'IP only' }]}
          className="min-w-40" />
        <div className="flex items-center gap-2">
          <TableControls table={tbl} showFilters={false} />
          <ActionButton tone="accent" icon={RefreshCw} onClick={() => load()} loading={loading} />
        </div>
      </div>
      <DataTableShell className="flex-none" responsive={{ columns: responsiveColumns, nameFloorRem: 14, extraRem: 0, onResolve: handleResolveShared }}>
        <DataTableHeaderRow>
          {tbl.columnOrder.map((id) => renderHeader(id))}
        </DataTableHeaderRow>
        <tbody>
          {loading && rows.length === 0 ? (
            Array.from({ length: 8 }).map((_, i) => <DataTableSkeletonRow key={i} columnCount={effectiveCountShared} />)
          ) : rows.length === 0 ? (
            <DataTableEmpty colSpan={effectiveCountShared} message="No accounts share an identifier." />
          ) : rows.map((g) => (
            <DataTableRow key={`${g.type}:${g.value}`} onClick={() => setSelected(g)} className="cursor-pointer">
              {tbl.columnOrder.map((id) => renderCell(id, g))}
            </DataTableRow>
          ))}
        </tbody>
      </DataTableShell>
      <Pager offset={offset} limit={PAGE} total={total} loading={loading}
        onPrev={() => setOffset(Math.max(0, offset - PAGE))} onNext={() => setOffset(offset + PAGE)} />
      <SharedDetailModal open={!!selected} onClose={() => setSelected(null)} token={token} group={selected} onMapSelect={onMapSelect} />
    </div>
  )
}

function deltaText(d: number | null): string {
  if (d == null) return '—'
  return `${d > 0 ? '+' : ''}${d.toFixed(3)}`
}

type CapDeltaSort = 'risk' | 'added'

const CAP_DELTA_COLUMNS: AdminColumn[] = [
  { id: 'player', label: 'Player', required: true },
  { id: 'map', label: 'Map' },
  { id: 'time', label: 'Time' },
  { id: 'delta', label: 'Delta' },
  { id: 'added', label: 'Added' },
  { id: 'action', label: 'Action', required: true },
]

const CAP_DELTA_LAYOUT: TableLayout = {
  player: { align: 'left' },
  map: { width: '11rem', align: 'left' },
  time: { width: '8rem', align: 'right' },
  delta: { width: '7rem', align: 'right' },
  added: { width: '7rem', align: 'left' },
  action: { width: '7rem', align: 'center' },
}

const CAP_DELTA_SORTABLE: Record<string, CapDeltaSort> = {
  delta: 'risk',
  added: 'added',
}

const CAP_DELTA_PRIORITY: Record<string, number> = {
  delta: 80,
  map: 70,
  time: 70,
  added: 20,
}

function CapDeltaTable({ token, defaultTotal, onMapSelect }: { token: string; defaultTotal: number | null; onMapSelect?: (mapName: string) => void }) {
  const tbl = useAdminTable('utbt:admin:ac.capdelta:cols:v2', CAP_DELTA_COLUMNS, { defaultFiltersOpen: false })
  const PAGE = useAdminPageSize()
  const [sort, setSort] = useNavState<CapDeltaSort>('admin.anticheat.capdelta.sort', 'risk')
  const [view, setView] = useNavState<AcView>('admin.anticheat.capdelta.view', 'flagged')
  const [offset, setOffset] = useNavState('admin.anticheat.capdelta.offset', 0)
  const [rows, setRows] = useState<AcCapDeltaRow[]>([])
  const [counts, setCounts] = useState<Record<AcView, number | null>>({ flagged: defaultTotal, allowed: null, denied: null })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statsCapId, setStatsCapId] = useState<string | null>(null)

  useResetOnChange(() => setOffset(0), [sort, view, PAGE])

  const load = useCallback((signal?: AbortSignal) => {
    setLoading(true); setError(null)
    Promise.all([
      fetchAcCapDelta(token, { sort, view, limit: PAGE, offset }, signal),
      fetchAcCapDeltaCount(token, { view: 'flagged' }, signal),
      fetchAcCapDeltaCount(token, { view: 'allowed' }, signal),
      fetchAcCapDeltaCount(token, { view: 'denied' }, signal),
    ])
      .then(([items, flagged, allowed, denied]) => { setRows(items); setCounts({ flagged, allowed, denied }); setLoading(false) })
      .catch((e) => { if (!signal?.aborted) { setError(errMessage(e)); setLoading(false) } })
  }, [token, sort, view, offset, PAGE])

  useEffect(() => { const c = new AbortController(); load(c.signal); return () => c.abort() }, [load])

  const dis = useCapAction(disallowCap, token, load, setError)
  const allow = useCapAction(allowCap, token, load, setError)
  const unallow = useCapAction(unallowCap, token, load, setError)
  const reallow = useCapAction(reallowCap, token, load, setError)

  const sel = useSelection(rows, `${view}:${sort}:${offset}:${PAGE}`)
  const bulkDis = useBulkAcAction(bulkDisallowCaps, token, load, setError, sel.clear)
  const bulkAllow = useBulkAcAction(bulkAllowCaps, token, load, setError, sel.clear)
  const showSelect = view === 'flagged'

  const toggleSort = (col: CapDeltaSort) => { if (sort !== col) setSort(col) }

  const responsiveColumns = useMemo<ResponsiveColumn[]>(
    () => tbl.columnOrder.filter(tbl.isVisible).map((id) => ({ id, width: CAP_DELTA_LAYOUT[id]?.width, priority: CAP_DELTA_PRIORITY[id], required: tbl.requiredColumns.has(id) })),
    [tbl.columnOrder, tbl.isVisible, tbl.requiredColumns],
  )
  const [resolvedCapDelta, setResolvedCapDelta] = useState<Set<string> | null>(null)
  const handleResolveCapDelta = useCallback((ids: Set<string>) => { setResolvedCapDelta(ids) }, [])
  const isShownCapDelta = useCallback((id: string) => tbl.isVisible(id) && (!resolvedCapDelta || resolvedCapDelta.has(id)), [tbl, resolvedCapDelta])
  const effectiveCountCapDelta = tbl.columnOrder.filter(isShownCapDelta).length

  const renderHeader = (id: string): ReactNode => {
    if (!isShownCapDelta(id)) return null
    const layout = CAP_DELTA_LAYOUT[id]
    const sortKey = CAP_DELTA_SORTABLE[id]
    if (sortKey) {
      return (
        <DataTableHeaderCell key={id} width={layout.width} align={layout.align}
          sortable sortDirection={(sort === sortKey ? 'desc' : null) as SortDirection} onSort={() => toggleSort(sortKey)}>
          {tbl.columnLabels[id]}
        </DataTableHeaderCell>
      )
    }
    return <DataTableHeaderCell key={id} width={layout.width} align={layout.align}>{tbl.columnLabels[id]}</DataTableHeaderCell>
  }

  const renderCell = (id: string, r: AcCapDeltaRow): ReactNode => {
    if (!isShownCapDelta(id)) return null
    const align = CAP_DELTA_LAYOUT[id].align
    switch (id) {
      case 'player':
        return <DataTableCell key={id} align={align}><PlayerInfo userId={r.user} alias={r.alias} title={titleFor(r.active_title)} size="sm" /></DataTableCell>
      case 'map':
        return <DataTableCell key={id} align={align}><MapLink name={r.map} onSelect={onMapSelect} className="text-sm" /></DataTableCell>
      case 'time':
        return <DataTableCell key={id} align={align} className="tabular-nums"><CapTimeLink capId={r.cap_id} seconds={r.cap_time_seconds ?? 0} className="text-sm" /></DataTableCell>
      case 'delta':
        return <DataTableCell key={id} align={align} className="tabular-nums text-red-300 font-medium">{deltaText(r.client_cap_delta)}</DataTableCell>
      case 'added':
        return <DataTableCell key={id} align={align} className="text-xs text-muted-foreground whitespace-nowrap">{relTime(r.added)}</DataTableCell>
      case 'action':
        return (
          <DataTableCell key={id} align={align} onClick={(e) => e.stopPropagation()}>
            {view === 'allowed' ? (
              <div className="flex items-center justify-center">
                <ActionButton tone="accent" icon={Undo2} title="Remove from allow list (re-flag)"
                  loading={unallow.busy && unallow.target?.capId === r.cap_id}
                  onClick={() => unallow.setTarget({ capId: r.cap_id, label: unallowLabel(r.alias, r.user, r.map) })} />
              </div>
            ) : view === 'denied' ? (
              <div className="flex items-center justify-center">
                <ActionButton tone="accent" icon={Undo2} title="Re-allow cap (undo disallow)"
                  loading={reallow.busy && reallow.target?.capId === r.cap_id}
                  onClick={() => reallow.setTarget({ capId: r.cap_id, label: reallowLabel(r.alias, r.user, r.map) })} />
              </div>
            ) : (
              <div className="flex items-center justify-center gap-1.5">
                <ActionButton tone="emerald" icon={ShieldCheck} title="Mark legitimate (allow list)"
                  loading={allow.busy && allow.target?.capId === r.cap_id}
                  onClick={() => allow.setTarget({ capId: r.cap_id, label: allowLabel(r.alias, r.user, r.map) })} />
                <ActionButton tone="red" icon={ShieldOff} title="Disallow cap"
                  loading={dis.busy && dis.target?.capId === r.cap_id}
                  onClick={() => dis.setTarget({ capId: r.cap_id, label: disallowLabel(r.alias, r.user, r.map) })} />
              </div>
            )}
          </DataTableCell>
        )
      default:
        return null
    }
  }

  return (
    <div className="space-y-3">
      <Feedback message={error} tone="red" onDismiss={() => setError(null)} />
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <ViewToggle view={view} onChange={setView} counts={counts} />
        <div className="flex items-center gap-2">
          <TableControls table={tbl} showFilters={false} />
          <ActionButton tone="accent" icon={RefreshCw} onClick={() => load()} loading={loading} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {view === 'allowed'
          ? 'High delta runs reviewed and marked legitimate. Hidden from the flagged list. Re-flag one to send it back.'
          : view === 'denied'
          ? 'High delta caps that were disallowed and removed from the leaderboard. Re-allow one to restore it.'
          : 'Verified world records with a client cap delta over +0.100, meaning the client may have had a 0.1 second speedhack.'}
      </p>
      {showSelect && sel.selected.size > 0 && (
        <BulkBar count={sel.selected.size} onClear={sel.clear}
          allow={() => bulkAllow.setTarget({ ids: [...sel.selected], label: bulkLabel('Mark', sel.selected.size, 'They leave the flagged list but stay on the leaderboard. The reason is recorded in the audit log.') })}
          disallow={() => bulkDis.setTarget({ ids: [...sel.selected], label: bulkLabel('Disallow', sel.selected.size, 'They leave the leaderboard. The reason is recorded in the audit log for each.') })} />
      )}
      <DataTableShell className="flex-none" responsive={{ columns: responsiveColumns, nameFloorRem: 14, extraRem: showSelect ? 3 : 0, onResolve: handleResolveCapDelta }}>
        <DataTableHeaderRow>
          {showSelect && (
            <DataTableHeaderCell width="3rem" align="center">
              <Checkbox checked={sel.allSelected ? true : sel.someSelected ? 'indeterminate' : false}
                onCheckedChange={sel.toggleAll} aria-label="Select all caps on this page" />
            </DataTableHeaderCell>
          )}
          {tbl.columnOrder.map((id) => renderHeader(id))}
        </DataTableHeaderRow>
        <tbody>
          {loading && rows.length === 0 ? (
            Array.from({ length: 8 }).map((_, i) => <DataTableSkeletonRow key={i} columnCount={effectiveCountCapDelta + (showSelect ? 1 : 0)} />)
          ) : rows.length === 0 ? (
            <DataTableEmpty colSpan={effectiveCountCapDelta + (showSelect ? 1 : 0)} message={view === 'allowed' ? 'No allow-listed cap-delta runs.' : view === 'denied' ? 'No disallowed cap-delta runs.' : 'No world-record runs over the delta threshold.'} />
          ) : rows.map((r) => (
            <DataTableRow key={r.cap_id} onClick={() => setStatsCapId(r.cap_id)}
              className={cn('cursor-pointer', sel.selected.has(r.cap_id) && 'bg-accent-500/[0.06]')}>
              {showSelect && (
                <DataTableCell align="center" width="3rem" onClick={(e) => e.stopPropagation()}>
                  <Checkbox checked={sel.selected.has(r.cap_id)} onCheckedChange={() => sel.toggleOne(r.cap_id)} aria-label="Select cap" />
                </DataTableCell>
              )}
              {tbl.columnOrder.map((id) => renderCell(id, r))}
            </DataTableRow>
          ))}
        </tbody>
      </DataTableShell>
      <Pager offset={offset} limit={PAGE} total={counts[view]} loading={loading}
        onPrev={() => setOffset(Math.max(0, offset - PAGE))} onNext={() => setOffset(offset + PAGE)} />
      <CapStatsModal open={!!statsCapId} onClose={() => setStatsCapId(null)} token={token} capId={statsCapId} onMapSelect={onMapSelect} />
      <DisallowConfirm state={dis} />
      <AllowConfirm state={allow} />
      <UnallowConfirm state={unallow} />
      <ReallowConfirm state={reallow} />
      <BulkDisallowConfirm state={bulkDis} />
      <BulkAllowConfirm state={bulkAllow} />
    </div>
  )
}

const TIER_STYLE: Record<AcLowFpsWrRow['tier'], string> = {
  critical: 'bg-red-500/20 border-red-500/50 text-red-200',
  high: 'bg-red-500/[0.12] border-red-500/40 text-red-300',
  medium: 'bg-amber-500/[0.12] border-amber-500/40 text-amber-200',
  low: 'bg-hairline/10 border-hairline/15 text-muted-foreground',
}

const NETSPEED_FLOOR = 3850
const NETSPEED_CEIL = 25000

function isLowCap(min: number | null, max: number | null): boolean {
  return (min != null && min < 60) || (max != null && max < 60)
}

function isLowNet(min: number | null, max: number | null): boolean {
  return (min != null && min < NETSPEED_FLOOR) || (max != null && max < NETSPEED_FLOOR)
}

function isOutOfNetBand(min: number | null, max: number | null): boolean {
  return isLowNet(min, max) || (max != null && max > NETSPEED_CEIL) || (min != null && min > NETSPEED_CEIL)
}

function capText(min: number | null, max: number | null): string {
  if (min == null && max == null) return '—'
  if (min != null && max != null && min !== max) return `${min}–${max}`
  return String(max ?? min)
}

function LimitsCell({ row }: { row: AcLowFpsWrRow }) {
  return (
    <div className="flex flex-col items-end gap-0.5 text-[11px] tabular-nums leading-tight">
      <span className={isLowCap(row.set_fps_min, row.set_fps_max) ? 'text-red-300 font-medium' : 'text-muted-foreground'}>
        <span className="text-muted-foreground/50 mr-1">fps</span>{capText(row.set_fps_min, row.set_fps_max)}
      </span>
      <span className={isOutOfNetBand(row.netspeed_min, row.netspeed_max) ? 'text-red-300 font-medium' : 'text-muted-foreground'}>
        <span className="text-muted-foreground/50 mr-1">net</span>{capText(row.netspeed_min, row.netspeed_max)}
      </span>
    </div>
  )
}

function fpsCell(v: number | null) {
  if (v == null) return <span className="text-muted-foreground/40">—</span>
  return <span className={v < 60 ? 'text-red-300 font-medium' : 'text-foreground'}>{v}</span>
}

function RiskBadge({ tier, flags, baselineFps }: { tier: AcLowFpsWrRow['tier']; flags: string[]; baselineFps: number | null }) {
  return (
    <div className="flex flex-col items-start gap-1">
      <span className={cn('inline-flex items-center text-[10px] font-semibold rounded px-1.5 py-0.5 border uppercase tracking-wide', TIER_STYLE[tier])}>{tier}</span>
      {flags.length > 0 && (
        <span className="text-[10px] text-muted-foreground/70 leading-tight">{flags.join(' · ')}</span>
      )}
      {baselineFps != null && (
        <span className="text-[10px] text-muted-foreground/50 leading-tight">normally ~{baselineFps} fps</span>
      )}
    </div>
  )
}

const LOW_FPS_COLUMNS: AdminColumn[] = [
  { id: 'player', label: 'Player', required: true },
  { id: 'map', label: 'Map' },
  { id: 'time', label: 'Time' },
  { id: 'fps1', label: '1%' },
  { id: 'fps5', label: '5%' },
  { id: 'fps25', label: '25%' },
  { id: 'fps50', label: '50%' },
  { id: 'limits', label: 'Limits' },
  { id: 'spawns', label: 'Spawns' },
  { id: 'risk', label: 'Risk' },
  { id: 'action', label: 'Action', required: true },
]

const LOW_FPS_LAYOUT: TableLayout = {
  player: { align: 'left' },
  map: { width: '11rem', align: 'left' },
  time: { width: '7rem', align: 'right' },
  fps1: { width: '4rem', align: 'right' },
  fps5: { width: '4rem', align: 'right' },
  fps25: { width: '4rem', align: 'right' },
  fps50: { width: '4rem', align: 'right' },
  limits: { width: '6.5rem', align: 'right' },
  spawns: { width: '5rem', align: 'right' },
  risk: { width: '9rem', align: 'left' },
  action: { width: '6.5rem', align: 'center' },
}

const LOW_FPS_PRIORITY: Record<string, number> = {
  risk: 90,
  time: 80,
  map: 70,
  fps1: 40,
  fps5: 35,
  fps25: 30,
  fps50: 25,
  limits: 35,
  spawns: 30,
}

function LowFpsTable({ token, defaultTotal, onMapSelect }: { token: string; defaultTotal: number | null; onMapSelect?: (mapName: string) => void }) {
  const tbl = useAdminTable('utbt:admin:ac.lowfps:cols:v2', LOW_FPS_COLUMNS, { defaultFiltersOpen: false })
  const PAGE = useAdminPageSize()
  const [view, setView] = useNavState<AcView>('admin.anticheat.lowfps.view', 'flagged')
  const [offset, setOffset] = useNavState('admin.anticheat.lowfps.offset', 0)
  const [rows, setRows] = useState<AcLowFpsWrRow[]>([])
  const [counts, setCounts] = useState<Record<AcView, number | null>>({ flagged: defaultTotal, allowed: null, denied: null })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statsCapId, setStatsCapId] = useState<string | null>(null)

  useResetOnChange(() => setOffset(0), [view, PAGE])

  const load = useCallback((signal?: AbortSignal) => {
    setLoading(true); setError(null)
    Promise.all([
      fetchAcLowFpsWr(token, { view, limit: PAGE, offset }, signal),
      fetchAcLowFpsWrCount(token, { view: 'flagged' }, signal),
      fetchAcLowFpsWrCount(token, { view: 'allowed' }, signal),
      fetchAcLowFpsWrCount(token, { view: 'denied' }, signal),
    ])
      .then(([items, flagged, allowed, denied]) => { setRows(items); setCounts({ flagged, allowed, denied }); setLoading(false) })
      .catch((e) => { if (!signal?.aborted) { setError(errMessage(e)); setLoading(false) } })
  }, [token, view, offset, PAGE])

  useEffect(() => { const c = new AbortController(); load(c.signal); return () => c.abort() }, [load])

  const dis = useCapAction(disallowCap, token, load, setError)
  const allow = useCapAction(allowCap, token, load, setError)
  const unallow = useCapAction(unallowCap, token, load, setError)
  const reallow = useCapAction(reallowCap, token, load, setError)

  const sel = useSelection(rows, `${view}:${offset}:${PAGE}`)
  const bulkDis = useBulkAcAction(bulkDisallowCaps, token, load, setError, sel.clear)
  const bulkAllow = useBulkAcAction(bulkAllowCaps, token, load, setError, sel.clear)
  const showSelect = view === 'flagged'

  const responsiveColumns = useMemo<ResponsiveColumn[]>(
    () => tbl.columnOrder.filter(tbl.isVisible).map((id) => ({ id, width: LOW_FPS_LAYOUT[id]?.width, priority: LOW_FPS_PRIORITY[id], required: tbl.requiredColumns.has(id) })),
    [tbl.columnOrder, tbl.isVisible, tbl.requiredColumns],
  )
  const [resolvedLowFps, setResolvedLowFps] = useState<Set<string> | null>(null)
  const handleResolveLowFps = useCallback((ids: Set<string>) => { setResolvedLowFps(ids) }, [])
  const isShownLowFps = useCallback((id: string) => tbl.isVisible(id) && (!resolvedLowFps || resolvedLowFps.has(id)), [tbl, resolvedLowFps])
  const effectiveCountLowFps = tbl.columnOrder.filter(isShownLowFps).length

  const renderHeader = (id: string): ReactNode => {
    if (!isShownLowFps(id)) return null
    const layout = LOW_FPS_LAYOUT[id]
    return <DataTableHeaderCell key={id} width={layout.width} align={layout.align}>{tbl.columnLabels[id]}</DataTableHeaderCell>
  }

  const renderCell = (id: string, r: AcLowFpsWrRow): ReactNode => {
    if (!isShownLowFps(id)) return null
    const align = LOW_FPS_LAYOUT[id].align
    switch (id) {
      case 'player':
        return <DataTableCell key={id} align={align}><PlayerInfo userId={r.user} alias={r.alias} title={titleFor(r.active_title)} size="sm" /></DataTableCell>
      case 'map':
        return <DataTableCell key={id} align={align}><MapLink name={r.map} onSelect={onMapSelect} className="text-sm" /></DataTableCell>
      case 'time':
        return <DataTableCell key={id} align={align} className="tabular-nums"><CapTimeLink capId={r.cap_id} seconds={r.cap_time_seconds ?? 0} className="text-sm" /></DataTableCell>
      case 'fps1':
        return <DataTableCell key={id} align={align} className="tabular-nums">{fpsCell(r.fps_1pc)}</DataTableCell>
      case 'fps5':
        return <DataTableCell key={id} align={align} className="tabular-nums">{fpsCell(r.fps_5pc)}</DataTableCell>
      case 'fps25':
        return <DataTableCell key={id} align={align} className="tabular-nums">{fpsCell(r.fps_25pc)}</DataTableCell>
      case 'fps50':
        return <DataTableCell key={id} align={align} className="tabular-nums">{fpsCell(r.fps_50pc)}</DataTableCell>
      case 'limits':
        return <DataTableCell key={id} align={align}><LimitsCell row={r} /></DataTableCell>
      case 'spawns':
        return <DataTableCell key={id} align={align} className={cn('tabular-nums text-xs', r.spawn_count === 0 ? 'text-red-300 font-medium' : 'text-muted-foreground')}>{r.spawn_count ?? '—'}</DataTableCell>
      case 'risk':
        return <DataTableCell key={id} align={align}><RiskBadge tier={r.tier} flags={r.flags} baselineFps={r.baseline_fps} /></DataTableCell>
      case 'action':
        return (
          <DataTableCell key={id} align={align} onClick={(e) => e.stopPropagation()}>
            {view === 'allowed' ? (
              <div className="flex items-center justify-center">
                <ActionButton tone="accent" icon={Undo2} title="Remove from allow list (re-flag)"
                  loading={unallow.busy && unallow.target?.capId === r.cap_id}
                  onClick={() => unallow.setTarget({ capId: r.cap_id, label: unallowLabel(r.alias, r.user, r.map) })} />
              </div>
            ) : view === 'denied' ? (
              <div className="flex items-center justify-center">
                <ActionButton tone="accent" icon={Undo2} title="Re-allow cap (undo disallow)"
                  loading={reallow.busy && reallow.target?.capId === r.cap_id}
                  onClick={() => reallow.setTarget({ capId: r.cap_id, label: reallowLabel(r.alias, r.user, r.map) })} />
              </div>
            ) : (
              <div className="flex items-center justify-center gap-1.5">
                <ActionButton tone="emerald" icon={ShieldCheck} title="Mark legitimate (allow list)"
                  loading={allow.busy && allow.target?.capId === r.cap_id}
                  onClick={() => allow.setTarget({ capId: r.cap_id, label: allowLabel(r.alias, r.user, r.map) })} />
                <ActionButton tone="red" icon={ShieldOff} title="Disallow cap"
                  loading={dis.busy && dis.target?.capId === r.cap_id}
                  onClick={() => dis.setTarget({ capId: r.cap_id, label: disallowLabel(r.alias, r.user, r.map) })} />
              </div>
            )}
          </DataTableCell>
        )
      default:
        return null
    }
  }

  return (
    <div className="space-y-3">
      <Feedback message={error} tone="red" onDismiss={() => setError(null)} />
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <ViewToggle view={view} onChange={setView} counts={counts} />
        <div className="flex items-center gap-2">
          <TableControls table={tbl} showFilters={false} />
          <ActionButton tone="accent" icon={RefreshCw} onClick={() => load()} loading={loading} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {view === 'allowed'
          ? 'Low FPS world records reviewed and marked legitimate. Hidden from the flagged list. Re-flag one to send it back.'
          : view === 'denied'
          ? 'Low FPS caps that were disallowed and removed from the leaderboard. Re-allow one to restore it.'
          : 'World records flagged for deliberate FPS limiting (a netspeed below the legal band, a sub-60 frame rate, or zero spawns). Records should be set at 60 FPS or above; netspeed must stay within 3850–25000.'}
      </p>
      {showSelect && sel.selected.size > 0 && (
        <BulkBar count={sel.selected.size} onClear={sel.clear}
          allow={() => bulkAllow.setTarget({ ids: [...sel.selected], label: bulkLabel('Mark', sel.selected.size, 'They leave the flagged list but stay on the leaderboard. The reason is recorded in the audit log.') })}
          disallow={() => bulkDis.setTarget({ ids: [...sel.selected], label: bulkLabel('Disallow', sel.selected.size, 'They leave the leaderboard. The reason is recorded in the audit log for each.') })} />
      )}
      <DataTableShell className="flex-none" responsive={{ columns: responsiveColumns, nameFloorRem: 14, extraRem: showSelect ? 3 : 0, onResolve: handleResolveLowFps }}>
        <DataTableHeaderRow>
          {showSelect && (
            <DataTableHeaderCell width="3rem" align="center">
              <Checkbox checked={sel.allSelected ? true : sel.someSelected ? 'indeterminate' : false}
                onCheckedChange={sel.toggleAll} aria-label="Select all caps on this page" />
            </DataTableHeaderCell>
          )}
          {tbl.columnOrder.map((id) => renderHeader(id))}
        </DataTableHeaderRow>
        <tbody>
          {loading && rows.length === 0 ? (
            Array.from({ length: 8 }).map((_, i) => <DataTableSkeletonRow key={i} columnCount={effectiveCountLowFps + (showSelect ? 1 : 0)} />)
          ) : rows.length === 0 ? (
            <DataTableEmpty colSpan={effectiveCountLowFps + (showSelect ? 1 : 0)} message={view === 'allowed' ? 'No allow-listed world records.' : view === 'denied' ? 'No disallowed low FPS caps.' : 'No flagged world records.'} />
          ) : rows.map((r) => (
            <DataTableRow key={r.cap_id} onClick={() => setStatsCapId(r.cap_id)}
              className={cn('cursor-pointer', sel.selected.has(r.cap_id) && 'bg-accent-500/[0.06]')}>
              {showSelect && (
                <DataTableCell align="center" width="3rem" onClick={(e) => e.stopPropagation()}>
                  <Checkbox checked={sel.selected.has(r.cap_id)} onCheckedChange={() => sel.toggleOne(r.cap_id)} aria-label="Select cap" />
                </DataTableCell>
              )}
              {tbl.columnOrder.map((id) => renderCell(id, r))}
            </DataTableRow>
          ))}
        </tbody>
      </DataTableShell>
      <Pager offset={offset} limit={PAGE} total={counts[view]} loading={loading}
        onPrev={() => setOffset(Math.max(0, offset - PAGE))} onNext={() => setOffset(offset + PAGE)} />
      <CapStatsModal open={!!statsCapId} onClose={() => setStatsCapId(null)} token={token} capId={statsCapId} onMapSelect={onMapSelect} />
      <DisallowConfirm state={dis} />
      <AllowConfirm state={allow} />
      <UnallowConfirm state={unallow} />
      <ReallowConfirm state={reallow} />
      <BulkDisallowConfirm state={bulkDis} />
      <BulkAllowConfirm state={bulkAllow} />
    </div>
  )
}

export function AntiCheatSection({ userProfile, onMapSelect }: AdminSectionProps) {
  const token = userProfile?.accessToken
  const [tab, setTab] = useNavState<TabId>('admin.anticheat.tab', 'shared')
  const [counts, setCounts] = useState<Record<TabId, number | null>>({ 'shared': null, 'cap-delta': null, 'low-fps': null })

  useEffect(() => {
    if (!token) return
    const c = new AbortController()
    Promise.allSettled([
      fetchAcSharedCount(token, {}, c.signal),
      fetchAcCapDeltaCount(token, {}, c.signal),
      fetchAcLowFpsWrCount(token, {}, c.signal),
    ]).then(([shared, capDelta, lowFps]) => {
      if (c.signal.aborted) return
      setCounts((p) => ({
        shared: shared.status === 'fulfilled' ? shared.value : p.shared,
        'cap-delta': capDelta.status === 'fulfilled' ? capDelta.value : p['cap-delta'],
        'low-fps': lowFps.status === 'fulfilled' ? lowFps.value : p['low-fps'],
      }))
    })
    return () => c.abort()
  }, [token])

  return (
    <SectionShell
      title="Anti-Cheat"
      icon={ShieldAlert}
      tone="amber"
    >
      <div className="flex items-center gap-1.5 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'h-8 px-3 rounded-md border text-xs cursor-pointer transition-colors inline-flex items-center gap-2',
              tab === t.id
                ? 'bg-accent-500/15 border-accent-500/40 text-accent-200'
                : 'border-hairline/10 bg-card/30 text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
            {counts[t.id] != null && (
              <span className="text-[10px] tabular-nums rounded bg-hairline/10 px-1.5 py-0.5">{counts[t.id]}</span>
            )}
          </button>
        ))}
      </div>

      {!token ? null
        : tab === 'shared' ? <SharedTable token={token} defaultTotal={counts['shared']} onMapSelect={onMapSelect} />
        : tab === 'cap-delta' ? <CapDeltaTable token={token} defaultTotal={counts['cap-delta']} onMapSelect={onMapSelect} />
        : <LowFpsTable token={token} defaultTotal={counts['low-fps']} onMapSelect={onMapSelect} />}
    </SectionShell>
  )
}
