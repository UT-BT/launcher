import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { UserCog, Settings2 } from 'lucide-react'
import { fetchAdminUsers, fetchAdminUsersCount, toActiveTitle, type AdminUserRow, type AdminUserSort } from '@/app/utils/api'
import { ROLE_LABELS } from '@/app/utils/roles'
import { cn } from '@/lib/utils'
import type { AdminSectionProps } from '../types'
import { SectionShell } from '../components/SectionShell'
import { SearchInput, Pager, Feedback, ActionButton, AdminSelect, errMessage } from '../components/controls'
import { useAdminTable, type AdminColumn } from '../components/useAdminTable'
import { useAdminFilterPresets } from '../components/useAdminFilterPresets'
import { TableControls } from '../components/TableControls'
import { PANEL_LABEL, minWidthFor, useResetOnChange, useAdminPageSize } from '../components/shared'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { FilterPanelRow } from '@/app/components/ui/filter-panel-row'
import { FilterPresetsMenu } from '@/app/components/shared/FilterPresetsMenu'
import { ActiveFilterChip } from '@/app/components/shared/ActiveFilterChip'
import { useNavState } from '@/app/components/navigation/useNavState'
import {
  DataTableShell, DataTableHeaderRow, DataTableHeaderCell, DataTableRow, DataTableCell,
  DataTableEmpty, DataTableSkeletonRow, type SortDirection,
} from '@/app/components/shared/DataTable'
import { UserDetailModal } from './UserDetailModal'

const COLUMNS: AdminColumn[] = [
  { id: 'player', label: 'Player', required: true },
  { id: 'id', label: 'Discord ID' },
  { id: 'role', label: 'Role' },
  { id: 'status', label: 'Status' },
  { id: 'warnings', label: 'Warnings' },
  { id: 'bans', label: 'Bans' },
  { id: 'manage', label: 'Manage', required: true },
]

const LAYOUT: Record<string, { width?: string; align?: 'left' | 'center' | 'right' }> = {
  player: { align: 'left' },
  id: { width: '11rem', align: 'left' },
  role: { width: '9rem', align: 'left' },
  status: { width: '9rem', align: 'center' },
  warnings: { width: '6rem', align: 'right' },
  bans: { width: '6rem', align: 'right' },
  manage: { width: '8rem', align: 'center' },
}

const SORTABLE: Record<string, AdminUserSort> = {
  player: 'name', id: 'id', role: 'role', status: 'status', warnings: 'warnings', bans: 'bans',
}

const DEFAULT_ORDER: Record<AdminUserSort, 'asc' | 'desc'> = {
  name: 'asc', id: 'asc', role: 'desc', status: 'desc', warnings: 'desc', bans: 'desc',
}

type UserStatus = 'all' | 'active' | 'banned'

const STATUS_OPTIONS: { value: UserStatus; label: string }[] = [
  { value: 'all', label: 'Any status' },
  { value: 'active', label: 'Active' },
  { value: 'banned', label: 'Banned' },
]

const ROLE_OPTIONS = [
  { value: 'all', label: 'Any role' },
  { value: '0', label: 'User' },
  { value: '1', label: 'Moderator' },
  { value: '2', label: 'Admin' },
  { value: '3', label: 'Cup Admin' },
]

interface UserFilters {
  search: string
  status: UserStatus
  role: string
  sort: AdminUserSort
  order: 'asc' | 'desc'
}

export function UserManagementSection({ userProfile }: AdminSectionProps) {
  const token = userProfile?.accessToken
  const PAGE = useAdminPageSize()
  const tbl = useAdminTable('utbt:admin:users:cols:v2', COLUMNS)
  const [search, setSearch] = useNavState('admin.users.search', '')
  const [status, setStatus] = useNavState<UserStatus>('admin.users.status', 'all')
  const [role, setRole] = useNavState('admin.users.role', 'all')
  const [sort, setSort] = useNavState<AdminUserSort>('admin.users.sort', 'name')
  const [order, setOrder] = useNavState<'asc' | 'desc'>('admin.users.order', 'asc')
  const [offset, setOffset] = useNavState('admin.users.offset', 0)
  const [rows, setRows] = useState<AdminUserRow[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [manageId, setManageId] = useState<string | null>(null)

  useResetOnChange(() => setOffset(0), [search, status, role, sort, order, PAGE])

  const load = useCallback((signal?: AbortSignal) => {
    if (!token) return
    setLoading(true); setError(null)
    const params = {
      search: search || undefined,
      status: status === 'all' ? undefined : status,
      role: role === 'all' ? undefined : Number(role),
      sort, order, limit: PAGE, offset,
    }
    fetchAdminUsers(token, params, signal)
      .then((items) => { setRows(items); setLoading(false) })
      .catch((e) => { if (!signal?.aborted) { setError(errMessage(e)); setLoading(false) } })
  }, [token, search, status, role, sort, order, offset, PAGE])

  const loadCount = useCallback((signal?: AbortSignal) => {
    if (!token) return
    fetchAdminUsersCount(token, {
      search: search || undefined,
      status: status === 'all' ? undefined : status,
      role: role === 'all' ? undefined : Number(role),
    }, signal)
      .then((count) => setTotal(count))
      .catch(() => { /* ignore */ })
  }, [token, search, status, role])

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

  const toggleSort = (col: AdminUserSort) => {
    if (sort === col) setOrder(order === 'asc' ? 'desc' : 'asc')
    else { setSort(col); setOrder(DEFAULT_ORDER[col]) }
  }

  const filters: UserFilters = useMemo(
    () => ({ search, status, role, sort, order }),
    [search, status, role, sort, order],
  )
  const applyFilters = useCallback((f: UserFilters) => {
    setSearch(f.search); setStatus(f.status ?? 'all'); setRole(f.role ?? 'all'); setSort(f.sort); setOrder(f.order)
  }, [setSearch, setStatus, setRole, setSort, setOrder])
  const resetFilters = useCallback(() => {
    setSearch(''); setStatus('all'); setRole('all')
  }, [setSearch, setStatus, setRole])

  const presets = useAdminFilterPresets<UserFilters>({
    storageKey: 'utbt:admin:users:filters:v1',
    current: filters,
    isDefault: (f) => !f.search && (f.status ?? 'all') === 'all' && (f.role ?? 'all') === 'all',
    onApply: applyFilters,
  })

  const tableMinWidth = useMemo(() => minWidthFor(tbl.columnOrder, tbl.isVisible, LAYOUT, 16), [tbl])

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

  const renderCell = (id: string, u: AdminUserRow): ReactNode => {
    if (!tbl.isVisible(id)) return null
    const align = LAYOUT[id].align
    switch (id) {
      case 'player':
        return <DataTableCell key={id} align={align}><PlayerInfo userId={u.id} alias={u.alias} title={toActiveTitle(u.active_title)} size="sm" /></DataTableCell>
      case 'id':
        return (
          <DataTableCell key={id} align={align} width={LAYOUT[id].width}>
            <span className="font-mono text-xs text-muted-foreground truncate block" title={u.id}>{u.id}</span>
          </DataTableCell>
        )
      case 'role': {
        const roleLabel = ROLE_LABELS[u.utbt_role]
        return (
          <DataTableCell key={id} align={align}>
            {roleLabel ? (
              <span className={cn('text-[11px] font-medium px-2 py-0.5 rounded border', roleLabel.className)}>{roleLabel.label}</span>
            ) : <span className="text-muted-foreground text-xs">—</span>}
          </DataTableCell>
        )
      }
      case 'status':
        return (
          <DataTableCell key={id} align={align}>
            {u.banned ? (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded border bg-red-500/15 border-red-500/40 text-red-300" title={u.ban_reason ?? ''}>Banned</span>
            ) : (
              <span className="text-emerald-300/80 text-xs">Active</span>
            )}
          </DataTableCell>
        )
      case 'warnings':
        return <DataTableCell key={id} align={align} className="tabular-nums">{u.warn_count}</DataTableCell>
      case 'bans':
        return <DataTableCell key={id} align={align} className="tabular-nums">{u.ban_count}</DataTableCell>
      case 'manage':
        return (
          <DataTableCell key={id} align={align}>
            <div className="flex justify-center">
              <ActionButton tone="accent" icon={Settings2} onClick={() => setManageId(u.id)}>Manage</ActionButton>
            </div>
          </DataTableCell>
        )
      default:
        return null
    }
  }

  return (
    <SectionShell title="User Management" icon={UserCog} tone="red">
      <Feedback message={error} tone="red" onDismiss={() => setError(null)} />

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by name or Discord ID…" className="flex-1 min-w-48 max-w-sm" />
        <TableControls table={tbl} />
      </div>

      {presets.hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2">
          {search && <ActiveFilterChip label="Search" value={search} onClear={() => setSearch('')} />}
          {status !== 'all' && <ActiveFilterChip label="Status" value={STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status} onClear={() => setStatus('all')} />}
          {role !== 'all' && <ActiveFilterChip label="Role" value={ROLE_OPTIONS.find((o) => o.value === role)?.label ?? role} onClear={() => setRole('all')} />}
        </div>
      )}

      {tbl.filtersOpen && (
        <div className="bg-card/30 border border-hairline/10 rounded-xl p-4 space-y-4">
          <FilterPanelRow label="Filters">
            <div className="flex flex-col gap-1">
              <span className={PANEL_LABEL}>Status</span>
              <AdminSelect value={status} onChange={(v) => setStatus(v as UserStatus)} options={STATUS_OPTIONS} ariaLabel="Filter by status" className="min-w-36" />
            </div>
            <div className="flex flex-col gap-1">
              <span className={PANEL_LABEL}>Role</span>
              <AdminSelect value={role} onChange={setRole} options={ROLE_OPTIONS} ariaLabel="Filter by role" className="min-w-36" />
            </div>
          </FilterPanelRow>
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-hairline/5">
            <FilterPresetsMenu<UserFilters>
              presets={presets.presets}
              activePreset={presets.activePreset}
              hasActiveFilters={presets.hasActiveFilters}
              onSave={presets.onSave}
              onLoad={presets.onLoad}
              onDelete={presets.onDelete}
              captureCurrentFilters={presets.captureCurrentFilters}
              onResetFilters={resetFilters}
              placeholderExample="e.g. Banned players"
            />
          </div>
        </div>
      )}

      <DataTableShell className="flex-none" minWidth={tableMinWidth}>
        <DataTableHeaderRow>
          {tbl.columnOrder.map((id) => renderHeader(id))}
        </DataTableHeaderRow>
        <tbody>
          {loading && rows.length === 0 ? (
            Array.from({ length: 8 }).map((_, i) => <DataTableSkeletonRow key={i} columnCount={tbl.visibleCount} />)
          ) : rows.length === 0 ? (
            <DataTableEmpty colSpan={tbl.visibleCount} message="No players match your filters." />
          ) : rows.map((u) => (
            <DataTableRow key={u.id}>{tbl.columnOrder.map((id) => renderCell(id, u))}</DataTableRow>
          ))}
        </tbody>
      </DataTableShell>

      <Pager offset={offset} limit={PAGE} total={total} loading={loading}
        onPrev={() => setOffset(Math.max(0, offset - PAGE))}
        onNext={() => setOffset(offset + PAGE)} />

      {token && (
        <UserDetailModal
          open={!!manageId}
          onClose={() => setManageId(null)}
          token={token}
          userId={manageId}
          actorRole={userProfile?.utbt_role ?? 0}
          onChanged={reload}
        />
      )}
    </SectionShell>
  )
}
