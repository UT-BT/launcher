import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Flag, Ban, Check, ShieldOff, ShieldCheck, UploadCloud } from 'lucide-react'
import {
  fetchAdminCaps, fetchAdminCapsCount, disallowCap, reallowCap, bulkDisallowCaps, bulkReallowCaps,
  verifyCapFlag, unverifyCap, toActiveTitle,
  type AdminCapRow, type AdminCapStatus, type AdminCapSort,
} from '@/app/utils/api'
import type { AdminSectionProps } from '../types'
import { SectionShell } from '../components/SectionShell'
import {
  SearchInput, Pager, Feedback, ActionButton, AdminSelect, ConfirmDialog,
  relTime, errMessage,
} from '../components/controls'
import { useAdminTable, type AdminColumn } from '../components/useAdminTable'
import { useAdminFilterPresets } from '../components/useAdminFilterPresets'
import { TableControls } from '../components/TableControls'
import { PANEL_LABEL, minWidthFor, useResetOnChange, useAdminPageSize } from '../components/shared'
import { MapLink } from '../components/MapLink'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { CapTimeLink } from '@/app/components/shared/CapTimeLink'
import { FilterPanelRow } from '@/app/components/ui/filter-panel-row'
import { FilterPresetsMenu } from '@/app/components/shared/FilterPresetsMenu'
import { ActiveFilterChip } from '@/app/components/shared/ActiveFilterChip'
import { useNavState } from '@/app/components/navigation/useNavState'
import {
  DataTableShell, DataTableHeaderRow, DataTableHeaderCell, DataTableRow, DataTableCell,
  DataTableEmpty, DataTableSkeletonRow, type SortDirection,
} from '@/app/components/shared/DataTable'
import { DemoVerifyModal } from './DemoVerifyModal'
import { Checkbox } from '@/app/components/ui/checkbox'

const STATUS_OPTIONS: { value: AdminCapStatus; label: string }[] = [
  { value: 'pending', label: 'Unverified' },
  { value: 'verified', label: 'Verified' },
  { value: 'disallowed', label: 'Disallowed' },
  { value: 'all', label: 'All' },
]

const COLUMNS: AdminColumn[] = [
  { id: 'player', label: 'Player', required: true },
  { id: 'map', label: 'Map' },
  { id: 'time', label: 'Time' },
  { id: 'status', label: 'Status' },
  { id: 'added', label: 'Added' },
  { id: 'actions', label: 'Actions', required: true },
]

const LAYOUT: Record<string, { width?: string; align?: 'left' | 'center' | 'right' }> = {
  player: { align: 'left' },
  map: { width: '11rem', align: 'left' },
  time: { width: '7rem', align: 'right' },
  status: { width: '7rem', align: 'center' },
  added: { width: '8rem', align: 'left' },
  actions: { width: '16rem', align: 'center' },
}

const SORTABLE: Record<string, AdminCapSort> = {
  player: 'player', map: 'map', time: 'time', status: 'status', added: 'added',
}

interface CapFilters {
  status: AdminCapStatus
  search: string
  sort: AdminCapSort
  order: 'asc' | 'desc'
}

type PendingAction = {
  title: string
  message: ReactNode
  tone: 'accent' | 'red'
  confirmLabel: string
  withReason?: boolean
  reasonRequired?: boolean
  run: (reason?: string) => Promise<void>
} | null

export function CapsManagementSection({ userProfile, onMapSelect }: AdminSectionProps) {
  const token = userProfile?.accessToken
  const PAGE = useAdminPageSize()
  const tbl = useAdminTable('utbt:admin:caps:cols:v2', COLUMNS)
  const [status, setStatus] = useNavState<AdminCapStatus>('admin.caps.status', 'all')
  const [search, setSearch] = useNavState('admin.caps.search', '')
  const [sort, setSort] = useNavState<AdminCapSort>('admin.caps.sort', 'added')
  const [order, setOrder] = useNavState<'asc' | 'desc'>('admin.caps.order', 'desc')
  const [offset, setOffset] = useNavState('admin.caps.offset', 0)
  const [rows, setRows] = useState<AdminCapRow[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [demoCap, setDemoCap] = useState<AdminCapRow | null>(null)
  const [pending, setPending] = useState<PendingAction>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  useResetOnChange(() => setOffset(0), [status, search, sort, order, PAGE])

  useEffect(() => { setSelected(new Set()) }, [status, search, sort, order, offset, PAGE])

  const load = useCallback((signal?: AbortSignal) => {
    if (!token) return
    setLoading(true); setError(null)
    const params = { status, search: search || undefined, sort, order, limit: PAGE, offset }
    fetchAdminCaps(token, params, signal)
      .then((items) => { setRows(items); setLoading(false) })
      .catch((e) => { if (!signal?.aborted) { setError(errMessage(e)); setLoading(false) } })
  }, [token, status, search, sort, order, offset, PAGE])

  const loadCount = useCallback((signal?: AbortSignal) => {
    if (!token) return
    const params = { status, search: search || undefined }
    fetchAdminCapsCount(token, params, signal)
      .then((count) => setTotal(count))
      .catch(() => { /* ignore */ })
  }, [token, status, search])

  useEffect(() => {
    const ctrl = new AbortController()
    const t = setTimeout(() => load(ctrl.signal), 250)
    return () => { clearTimeout(t); ctrl.abort() }
  }, [load])

  useEffect(() => {
    const ctrl = new AbortController()
    const t = setTimeout(() => loadCount(ctrl.signal), 250)
    return () => { clearTimeout(t); ctrl.abort() }
  }, [loadCount])

  const reload = useCallback(() => { load(); loadCount() }, [load, loadCount])

  const toggleSort = (col: AdminCapSort) => {
    if (sort === col) setOrder(order === 'asc' ? 'desc' : 'asc')
    else { setSort(col); setOrder('desc') }
  }

  const filters: CapFilters = useMemo(
    () => ({ status, search, sort, order }),
    [status, search, sort, order],
  )
  const applyFilters = useCallback((f: CapFilters) => {
    setStatus(f.status); setSearch(f.search); setSort(f.sort); setOrder(f.order)
  }, [setStatus, setSearch, setSort, setOrder])
  const resetFilters = useCallback(() => {
    setStatus('all'); setSearch('')
  }, [setStatus, setSearch])

  const presets = useAdminFilterPresets<CapFilters>({
    storageKey: 'utbt:admin:caps:filters:v1',
    current: filters,
    isDefault: (f) => f.status === 'all' && !f.search,
    onApply: applyFilters,
  })

  const statusLabel = STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status

  const act = async (id: string, fn: () => Promise<unknown>) => {
    if (!token) return
    setBusyId(id); setError(null)
    try { await fn(); reload() }
    catch (e) { setError(errMessage(e)) }
    finally { setBusyId(null) }
  }

  const executePending = async (reason?: string) => {
    if (!pending) return
    setConfirmBusy(true); setError(null)
    try { await pending.run(reason); setPending(null); setSelected(new Set()); reload() }
    catch (e) { setError(errMessage(e)) }
    finally { setConfirmBusy(false) }
  }

  const allOnPageSelected = rows.length > 0 && rows.every((r) => selected.has(r.id))
  const someSelected = selected.size > 0 && !allOnPageSelected

  const toggleAll = () => setSelected(allOnPageSelected ? new Set() : new Set(rows.map((r) => r.id)))
  const toggleOne = (id: string) => setSelected((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  const confirmBulkDisallow = () => {
    const ids = [...selected]
    setPending({
      title: 'Disallow caps',
      tone: 'red',
      confirmLabel: `Disallow ${ids.length}`,
      withReason: true,
      reasonRequired: true,
      message: <>Disallow <span className="text-foreground font-medium">{ids.length}</span> selected cap{ids.length === 1 ? '' : 's'}? They will be removed from the leaderboard. The reason is recorded in the audit log for each.</>,
      run: (reason) => bulkDisallowCaps(token!, ids, reason ?? '').then(() => undefined),
    })
  }

  const confirmBulkAllow = () => {
    const ids = [...selected]
    setPending({
      title: 'Reallow caps',
      tone: 'accent',
      confirmLabel: `Reallow ${ids.length}`,
      message: <>Reallow <span className="text-foreground font-medium">{ids.length}</span> selected cap{ids.length === 1 ? '' : 's'}? Any disallowed caps return to the leaderboard. The action is recorded in the audit log.</>,
      run: () => bulkReallowCaps(token!, ids).then(() => undefined),
    })
  }

  const confirmDisallow = (c: AdminCapRow) => setPending({
    title: 'Disallow cap',
    tone: 'red',
    confirmLabel: 'Disallow',
    withReason: true,
    reasonRequired: true,
    message: <>Disallow <span className="text-foreground font-medium">{c.alias || c.user}</span>'s cap on <span className="text-foreground font-medium">{c.map}</span>? It will be removed from the leaderboard. The reason is recorded in the audit log.</>,
    run: (reason) => disallowCap(token!, c.id, reason).then(() => undefined),
  })

  const confirmUnverify = (c: AdminCapRow) => setPending({
    title: 'Unverify cap',
    tone: 'accent',
    confirmLabel: 'Unverify',
    message: <>Remove verification from <span className="text-foreground font-medium">{c.alias || c.user}</span>'s cap on <span className="text-foreground font-medium">{c.map}</span>? It will return to the pending queue.</>,
    run: () => unverifyCap(token!, c.id).then(() => undefined),
  })

  const tableMinWidth = useMemo(() => minWidthFor(tbl.columnOrder, tbl.isVisible, LAYOUT, 14, 3), [tbl])

  const renderHeader = (id: string): ReactNode => {
    if (!tbl.isVisible(id)) return null
    const layout = LAYOUT[id]
    const sortKey = SORTABLE[id]
    if (sortKey) {
      return (
        <DataTableHeaderCell key={id} width={layout.width} align={layout.align}
          sortable sortDirection={(sort === sortKey ? order : null) as SortDirection} onSort={() => toggleSort(sortKey)}>
          {tbl.columnLabels[id]}
        </DataTableHeaderCell>
      )
    }
    return <DataTableHeaderCell key={id} width={layout.width} align={layout.align}>{tbl.columnLabels[id]}</DataTableHeaderCell>
  }

  const renderCell = (id: string, c: AdminCapRow): ReactNode => {
    if (!tbl.isVisible(id)) return null
    const align = LAYOUT[id].align
    const busy = busyId === c.id
    switch (id) {
      case 'player':
        return <DataTableCell key={id} align={align}><PlayerInfo userId={c.user} alias={c.alias} title={toActiveTitle(c.active_title)} size="sm" /></DataTableCell>
      case 'map':
        return <DataTableCell key={id} align={align}><MapLink name={c.map} onSelect={onMapSelect} className="text-sm" /></DataTableCell>
      case 'time':
        return <DataTableCell key={id} align={align} className="font-mono tabular-nums"><CapTimeLink capId={c.id} seconds={c.cap_time_seconds ?? 0} /></DataTableCell>
      case 'status':
        return (
          <DataTableCell key={id} align={align}>
            {c.disallowed ? <span className="text-red-300 text-xs">Disallowed</span>
              : c.verified ? <span className="text-emerald-300 text-xs">Verified</span>
              : <span className="text-muted-foreground text-xs">Unverified</span>}
          </DataTableCell>
        )
      case 'added':
        return <DataTableCell key={id} align={align} className="text-muted-foreground text-xs whitespace-nowrap" title={c.added ?? ''}>{relTime(c.added)}</DataTableCell>
      case 'actions':
        return (
          <DataTableCell key={id} align={align}>
            <div className="flex justify-center gap-1.5">
              {c.disallowed ? (
                <ActionButton tone="emerald" icon={Check} loading={busy} title="Reallow" onClick={() => act(c.id, () => reallowCap(token!, c.id))} />
              ) : (
                <ActionButton tone="red" icon={Ban} loading={busy} title="Disallow" onClick={() => confirmDisallow(c)} />
              )}
              {c.verified ? (
                <ActionButton tone="amber" icon={ShieldOff} loading={busy} title="Unverify" onClick={() => confirmUnverify(c)} />
              ) : (
                <>
                  <ActionButton tone="emerald" icon={ShieldCheck} loading={busy}
                    title={c.has_demo ? 'Verify (manual flag)' : 'Upload a demo for this cap first'}
                    onClick={() => act(c.id, () => verifyCapFlag(token!, c.id))} disabled={c.disallowed || !c.has_demo} />
                  <ActionButton tone="accent" icon={UploadCloud} title="Verify with demo" onClick={() => setDemoCap(c)} disabled={c.disallowed} />
                </>
              )}
            </div>
          </DataTableCell>
        )
      default:
        return null
    }
  }

  return (
    <SectionShell title="Caps Management" icon={Flag}>
      <Feedback message={error} tone="red" onDismiss={() => setError(null)} />

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search player, map or cap ID…" className="flex-1 min-w-48 max-w-sm" />
        <TableControls table={tbl} />
      </div>

      {presets.hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2">
          {status !== 'all' && <ActiveFilterChip label="Status" value={statusLabel} onClear={() => setStatus('all')} />}
          {search && <ActiveFilterChip label="Search" value={search} onClear={() => setSearch('')} />}
        </div>
      )}

      {tbl.filtersOpen && (
        <div className="bg-card/30 border border-hairline/10 rounded-xl p-4 space-y-4">
          <FilterPanelRow label="Filters">
            <div className="flex flex-col gap-1">
              <span className={PANEL_LABEL}>Status</span>
              <AdminSelect value={status} onChange={(v) => setStatus(v as AdminCapStatus)} options={STATUS_OPTIONS} ariaLabel="Filter by status" className="min-w-36" />
            </div>
          </FilterPanelRow>
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-hairline/5">
            <FilterPresetsMenu<CapFilters>
              presets={presets.presets}
              activePreset={presets.activePreset}
              hasActiveFilters={presets.hasActiveFilters}
              onSave={presets.onSave}
              onLoad={presets.onLoad}
              onDelete={presets.onDelete}
              captureCurrentFilters={presets.captureCurrentFilters}
              onResetFilters={resetFilters}
              placeholderExample="e.g. Pending caps on Foo"
            />
          </div>
        </div>
      )}

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-accent-500/30 bg-accent-500/10 px-3 py-2">
          <span className="text-xs text-foreground">{selected.size} selected</span>
          <div className="flex items-center gap-1.5 ml-auto">
            <ActionButton tone="emerald" icon={Check} onClick={confirmBulkAllow}>Allow</ActionButton>
            <ActionButton tone="red" icon={Ban} onClick={confirmBulkDisallow}>Disallow</ActionButton>
            <button type="button" onClick={() => setSelected(new Set())}
              className="text-xs text-muted-foreground hover:text-foreground px-2 cursor-pointer">Clear</button>
          </div>
        </div>
      )}

      <DataTableShell className="flex-none" minWidth={tableMinWidth}>
        <DataTableHeaderRow>
          <DataTableHeaderCell width="3rem" align="center">
            <Checkbox checked={allOnPageSelected ? true : someSelected ? 'indeterminate' : false}
              onCheckedChange={toggleAll} aria-label="Select all caps on this page" />
          </DataTableHeaderCell>
          {tbl.columnOrder.map((id) => renderHeader(id))}
        </DataTableHeaderRow>
        <tbody>
          {loading && rows.length === 0 ? (
            Array.from({ length: 8 }).map((_, i) => <DataTableSkeletonRow key={i} columnCount={tbl.visibleCount + 1} />)
          ) : rows.length === 0 ? (
            <DataTableEmpty colSpan={tbl.visibleCount + 1} message="No caps match these filters." />
          ) : rows.map((c) => (
            <DataTableRow key={c.id} className={selected.has(c.id) ? 'bg-accent-500/[0.06]' : undefined}>
              <DataTableCell align="center" width="3rem">
                <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggleOne(c.id)}
                  aria-label={`Select cap on ${c.map}`} />
              </DataTableCell>
              {tbl.columnOrder.map((id) => renderCell(id, c))}
            </DataTableRow>
          ))}
        </tbody>
      </DataTableShell>

      <Pager offset={offset} limit={PAGE} total={total} loading={loading}
        onPrev={() => setOffset(Math.max(0, offset - PAGE))}
        onNext={() => setOffset(offset + PAGE)} />

      <ConfirmDialog
        open={!!pending}
        title={pending?.title ?? ''}
        message={pending?.message ?? null}
        confirmLabel={pending?.confirmLabel}
        tone={pending?.tone}
        busy={confirmBusy}
        withReason={pending?.withReason}
        reasonRequired={pending?.reasonRequired}
        reasonPlaceholder="Why is this cap being disallowed?"
        onConfirm={executePending}
        onCancel={() => setPending(null)}
      />

      {token && (
        <DemoVerifyModal open={!!demoCap} onClose={() => setDemoCap(null)} token={token} cap={demoCap}
          onVerified={() => { setDemoCap(null); reload() }} />
      )}
    </SectionShell>
  )
}
