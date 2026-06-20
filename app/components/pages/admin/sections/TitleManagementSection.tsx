import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Tag, Plus, Trash2, RefreshCw, Pencil, Users } from 'lucide-react'
import {
  fetchAdminTitles, createTitle, updateTitle, deleteTitle, fetchAdminUsers,
  assignTitleToUser, unassignTitleFromUser, fetchTitleHolders, ApiError,
  type AdminTitleSummary, type AdminUserRow, type TitleHolder,
} from '@/app/utils/api'
import { toActiveTitle, type ActiveTitle } from '@/app/utils/api'
import type { AdminSectionProps } from '../types'
import { SectionShell } from '../components/SectionShell'
import {
  ActionButton, Feedback, SearchInput, AdminSelect, ConfirmDialog, errMessage,
} from '../components/controls'
import { useAdminTable, type AdminColumn } from '../components/useAdminTable'
import { useAdminFilterPresets } from '../components/useAdminFilterPresets'
import { TableControls } from '../components/TableControls'
import { PANEL_LABEL } from '../components/shared'
import { Modal } from '@/app/components/ui/modal'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { FilterPanelRow } from '@/app/components/ui/filter-panel-row'
import { FilterPresetsMenu } from '@/app/components/shared/FilterPresetsMenu'
import { ActiveFilterChip } from '@/app/components/shared/ActiveFilterChip'
import { useNavState } from '@/app/components/navigation/useNavState'
import { getTitleTextStyle } from '@/app/utils/titleStyles'
import { cn } from '@/lib/utils'
import {
  DataTableShell, DataTableHeaderRow, DataTableHeaderCell, DataTableRow, DataTableCell,
  DataTableEmpty, DataTableSkeletonRow, type SortDirection, type ResponsiveColumn,
} from '@/app/components/shared/DataTable'

function hexToRgb(hex: string) {
  const m = hex.replace('#', '')
  return { r: parseInt(m.slice(0, 2), 16) || 0, g: parseInt(m.slice(2, 4), 16) || 0, b: parseInt(m.slice(4, 6), 16) || 0 }
}

function rgbToHex(rgb: string) {
  const [r, g, b] = rgb.split(',').map((n) => Math.max(0, Math.min(255, parseInt(n, 10) || 0)))
  return '#' + [r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')
}

const RARITY_OPTIONS = [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }))

function fieldLabel(text: string) {
  return <label className={PANEL_LABEL}>{text}</label>
}

function buildFakeTitle(name: string, r: number, g: number, b: number, rarity: number): ActiveTitle | null {
  return toActiveTitle({ name, rarity, color_r: r, color_g: g, color_b: b })
}

function TitleFormModal({ open, onClose, token, editing, onSaved, previewUserId, previewAlias }: {
  open: boolean
  onClose: () => void
  token: string
  editing: AdminTitleSummary | null
  onSaved: () => void
  previewUserId?: string | number
  previewAlias?: string | null
}) {
  const isEditing = !!editing
  const [name, setName] = useState('')
  const [color, setColor] = useState('#4f9bff')
  const [rarity, setRarity] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (editing) {
      setName(editing.name)
      setColor(rgbToHex(editing.color))
      setRarity(editing.rarity >= 1 && editing.rarity <= 5 ? editing.rarity : 1)
    } else {
      setName('')
      setColor('#4f9bff')
      setRarity(1)
    }
    setError(null)
  }, [open, editing])

  const submit = async () => {
    if (!name.trim()) { setError('A name is required.'); return }
    setBusy(true); setError(null)
    try {
      const { r, g, b } = hexToRgb(color)
      if (editing) {
        await updateTitle(token, editing.id, { name: name.trim(), r, g, b, rarity })
      } else {
        await createTitle(token, { name: name.trim(), r, g, b, rarity })
      }
      onSaved()
      onClose()
    } catch (e) {
      setError(errMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const { r, g, b } = hexToRgb(color)
  const fakeTitle = buildFakeTitle(name.trim() || 'Preview', r, g, b, rarity)

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={isEditing ? 'Edit title' : 'Add a new title'}
      offsetSidebar
      maxWidth="32rem"
      footer={
        <div className="p-4 border-t border-border bg-muted/50 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? 'Saving…' : isEditing ? 'Save Changes' : 'Create Title'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Feedback message={error} tone="red" onDismiss={() => setError(null)} />

        <div className="space-y-1.5">
          {fieldLabel('Name')}
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Title name" />
        </div>

        <div className="space-y-1.5">
          {fieldLabel('Colour')}
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-9 w-12 rounded-md border border-hairline/10 bg-card/30 cursor-pointer p-1"
              aria-label="Title colour"
            />
            <span className="text-sm text-muted-foreground tabular-nums uppercase">{color}</span>
          </div>
        </div>

        <div className="space-y-1.5">
          {fieldLabel('Rarity')}
          <AdminSelect
            value={String(rarity)}
            onChange={(v) => setRarity(parseInt(v, 10) || 1)}
            options={RARITY_OPTIONS}
            ariaLabel="Title rarity"
            className="w-full"
          />
        </div>

        <div className="space-y-1.5">
          {fieldLabel('Preview')}
          <div className="bg-card/30 border border-hairline/5 rounded-xl p-4 flex items-center justify-center">
            <PlayerInfo
              userId={previewUserId}
              alias={previewAlias || 'Preview'}
              title={fakeTitle}
              size="lg"
              interactive={false}
            />
          </div>
        </div>
      </div>
    </Modal>
  )
}

function userTitleFor(u: AdminUserRow): ActiveTitle | null {
  const t = u.active_title
  if (!t) return null
  return buildFakeTitle(t.name, t.color_r, t.color_g, t.color_b, t.rarity)
}

function ManageHoldersModal({ open, onClose, token, title, onChanged }: {
  open: boolean
  onClose: () => void
  token: string
  title: AdminTitleSummary | null
  onChanged: () => void
}) {
  const [holders, setHolders] = useState<TitleHolder[]>([])
  const [loadingHolders, setLoadingHolders] = useState(false)
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<AdminUserRow[]>([])
  const [searching, setSearching] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [removeTarget, setRemoveTarget] = useState<TitleHolder | null>(null)

  const reload = useCallback((signal?: AbortSignal) => {
    if (!title) return
    setLoadingHolders(true)
    fetchTitleHolders(token, title.id, signal)
      .then((h) => { setHolders(h); setLoadingHolders(false) })
      .catch((e) => { if (!signal?.aborted) { setError(errMessage(e)); setLoadingHolders(false) } })
  }, [token, title])

  useEffect(() => {
    if (!open || !title) return
    setSearch(''); setResults([]); setError(null); setRemoveTarget(null); setSearching(false)
    const ctrl = new AbortController()
    reload(ctrl.signal)
    return () => ctrl.abort()
  }, [open, title, reload])

  useEffect(() => {
    if (!open) return
    const q = search.trim()
    if (!q) { setResults([]); setSearching(false); return }
    setSearching(true)
    const ctrl = new AbortController()
    const handle = setTimeout(() => {
      fetchAdminUsers(token, { search: q, limit: 20 }, ctrl.signal)
        .then((items) => { setResults(items); setSearching(false) })
        .catch((e) => { if (!ctrl.signal.aborted) { setError(errMessage(e)); setSearching(false) } })
    }, 300)
    return () => { clearTimeout(handle); ctrl.abort() }
  }, [search, open, token])

  const holderIds = useMemo(() => new Set(holders.map((h) => h.id)), [holders])

  const add = async (u: AdminUserRow) => {
    if (!title) return
    setBusyId(u.id); setError(null)
    try {
      await assignTitleToUser(token, u.id, title.id)
      reload(); onChanged()
    } catch (e) {
      setError(e instanceof ApiError && e.status === 409 ? 'User already has assigned title' : errMessage(e))
    } finally {
      setBusyId(null)
    }
  }

  const remove = async () => {
    if (!title || !removeTarget) return
    const id = removeTarget.id
    setBusyId(id); setError(null)
    try {
      await unassignTitleFromUser(token, id, title.id)
      setRemoveTarget(null)
      reload(); onChanged()
    } catch (e) {
      setError(errMessage(e)); setRemoveTarget(null)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <Modal
        isOpen={open}
        onClose={onClose}
        title="Manage holders"
        offsetSidebar
        maxWidth="34rem"
        footer={
          <div className="p-4 border-t border-border bg-muted/50 flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Done</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Feedback message={error} tone="red" onDismiss={() => setError(null)} />

          <div className="space-y-1.5">
            {fieldLabel(`Current holders${holders.length ? ` (${holders.length})` : ''}`)}
            <div className="bg-card/30 border border-hairline/5 rounded-xl divide-y divide-hairline/5 max-h-56 overflow-y-auto">
              {loadingHolders ? (
                <div className="px-3 py-6 text-center text-xs text-muted-foreground">Loading…</div>
              ) : holders.length === 0 ? (
                <div className="px-3 py-6 text-center text-xs text-muted-foreground">No one holds this title yet.</div>
              ) : holders.map((h) => (
                <div key={h.id} className="px-3 py-2 flex items-center justify-between gap-3">
                  <PlayerInfo userId={h.id} alias={h.alias} title={null} size="sm" interactive={false} />
                  <ActionButton tone="red" icon={Trash2} loading={busyId === h.id} onClick={() => setRemoveTarget(h)} title="Remove title" />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            {fieldLabel('Add a holder')}
            <SearchInput value={search} onChange={setSearch} placeholder="Search players by name or ID…" />
            <div className="bg-card/30 border border-hairline/5 rounded-xl divide-y divide-hairline/5 max-h-56 overflow-y-auto">
              {!search.trim() ? (
                <div className="px-3 py-6 text-center text-xs text-muted-foreground">Start typing to search players.</div>
              ) : searching ? (
                <div className="px-3 py-6 text-center text-xs text-muted-foreground">Searching…</div>
              ) : results.length === 0 ? (
                <div className="px-3 py-6 text-center text-xs text-muted-foreground">No players match your search.</div>
              ) : results.map((u) => {
                const has = holderIds.has(u.id)
                return (
                  <div key={u.id} className="px-3 py-2 flex items-center justify-between gap-3">
                    <PlayerInfo userId={u.id} alias={u.alias} title={userTitleFor(u)} size="sm" interactive={false} />
                    <ActionButton
                      tone={has ? 'emerald' : 'accent'}
                      icon={has ? undefined : Plus}
                      loading={busyId === u.id}
                      disabled={has}
                      onClick={() => add(u)}
                      title={has ? 'Already a holder' : 'Add holder'}
                    >
                      {has ? 'Added' : 'Add'}
                    </ActionButton>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!removeTarget}
        title="Remove title"
        tone="red"
        confirmLabel="Remove"
        busy={!!removeTarget && busyId === removeTarget.id}
        onConfirm={remove}
        onCancel={() => setRemoveTarget(null)}
        message={
          <>Remove <span className="font-semibold text-foreground">{title?.name}</span> from{' '}
          <span className="font-semibold text-foreground">{removeTarget?.alias || removeTarget?.id}</span>?</>
        }
      />
    </>
  )
}

type SortKey = 'name' | 'rarity' | 'holders'
type SortDir = 'asc' | 'desc'

const COLUMNS: AdminColumn[] = [
  { id: 'title', label: 'Title', required: true },
  { id: 'rarity', label: 'Rarity' },
  { id: 'holders', label: 'Holders' },
  { id: 'actions', label: 'Actions', required: true },
]

const LAYOUT: Record<string, { width?: string; align?: 'left' | 'center' | 'right' }> = {
  title: { align: 'left' },
  rarity: { width: '7rem', align: 'center' },
  holders: { width: '7rem', align: 'right' },
  actions: { width: '11rem', align: 'center' },
}

const SORTABLE: Record<string, SortKey> = {
  title: 'name', rarity: 'rarity', holders: 'holders',
}

const PRIORITY: Record<string, number> = {
  rarity: 50, holders: 50,
}

const RARITY_FILTER_OPTIONS = [
  { value: 'all', label: 'Any rarity' },
  ...[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `Rarity ${n}` })),
]

interface TitleFilters {
  query: string
  rarity: string
  sortKey: SortKey
  sortDir: SortDir
}

export function TitleManagementSection({ userProfile }: AdminSectionProps) {
  const token = userProfile?.accessToken
  const tbl = useAdminTable('utbt:admin:titles:cols:v2', COLUMNS)
  const [titles, setTitles] = useState<AdminTitleSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<AdminTitleSummary | null>(null)
  const [managing, setManaging] = useState<AdminTitleSummary | null>(null)
  const [deleting, setDeleting] = useState<AdminTitleSummary | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [query, setQuery] = useNavState('admin.titles.query', '')
  const [rarity, setRarity] = useNavState('admin.titles.rarity', 'all')
  const [sortKey, setSortKey] = useNavState<SortKey>('admin.titles.sortKey', 'rarity')
  const [sortDir, setSortDir] = useNavState<SortDir>('admin.titles.sortDir', 'desc')

  const load = useCallback((signal?: AbortSignal) => {
    if (!token) return
    setLoading(true); setError(null)
    fetchAdminTitles(token, signal)
      .then((t) => { setTitles(t); setLoading(false) })
      .catch((e) => { if (!signal?.aborted) { setError(errMessage(e)); setLoading(false) } })
  }, [token])

  useEffect(() => {
    const ctrl = new AbortController()
    load(ctrl.signal)
    return () => ctrl.abort()
  }, [load])

  const openCreate = () => { setEditing(null); setFormOpen(true) }
  const openEdit = (t: AdminTitleSummary) => { setEditing(t); setFormOpen(true) }

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(key === 'name' ? 'asc' : 'desc')
    }
  }

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    let filtered = q ? titles.filter((t) => t.name.toLowerCase().includes(q)) : titles
    if (rarity !== 'all') filtered = filtered.filter((t) => String(t.rarity) === rarity)
    const dir = sortDir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      if (sortKey === 'name') return a.name.localeCompare(b.name) * dir
      if (sortKey === 'rarity') return (a.rarity - b.rarity || a.name.localeCompare(b.name)) * dir
      return (a.holders - b.holders || a.name.localeCompare(b.name)) * dir
    })
  }, [titles, query, rarity, sortKey, sortDir])

  const filters: TitleFilters = useMemo(
    () => ({ query, rarity, sortKey, sortDir }),
    [query, rarity, sortKey, sortDir],
  )
  const applyFilters = useCallback((f: TitleFilters) => {
    setQuery(f.query); setRarity(f.rarity ?? 'all'); setSortKey(f.sortKey); setSortDir(f.sortDir)
  }, [setQuery, setRarity, setSortKey, setSortDir])
  const resetFilters = useCallback(() => {
    setQuery(''); setRarity('all')
  }, [setQuery, setRarity])

  const presets = useAdminFilterPresets<TitleFilters>({
    storageKey: 'utbt:admin:titles:filters:v1',
    current: filters,
    isDefault: (f) => !f.query && (f.rarity ?? 'all') === 'all',
    onApply: applyFilters,
  })

  const confirmDelete = async () => {
    if (!token || !deleting) return
    setDeleteBusy(true)
    try {
      await deleteTitle(token, deleting.id)
      setDeleting(null)
      load()
    } catch (e) {
      setError(errMessage(e))
    } finally {
      setDeleteBusy(false)
    }
  }

  const responsiveColumns = useMemo<ResponsiveColumn[]>(
    () => tbl.columnOrder.filter(tbl.isVisible).map((id) => ({ id, width: LAYOUT[id]?.width, priority: PRIORITY[id], required: tbl.requiredColumns.has(id) })),
    [tbl.columnOrder, tbl.isVisible, tbl.requiredColumns],
  )
  const [resolved, setResolved] = useState<Set<string> | null>(null)
  const handleResolve = useCallback((ids: Set<string>) => { setResolved(ids) }, [])
  const isShown = useCallback((id: string) => tbl.isVisible(id) && (!resolved || resolved.has(id)), [tbl, resolved])
  const effectiveCount = tbl.columnOrder.filter(isShown).length

  const renderHeader = (id: string): ReactNode => {
    if (!isShown(id)) return null
    const layout = LAYOUT[id]
    const sortKeyForCol = SORTABLE[id]
    if (sortKeyForCol) {
      return (
        <DataTableHeaderCell key={id} width={layout.width} align={layout.align}
          sortable sortDirection={(sortKey === sortKeyForCol ? sortDir : null) as SortDirection} onSort={() => toggleSort(sortKeyForCol)}>
          {tbl.columnLabels[id]}
        </DataTableHeaderCell>
      )
    }
    return <DataTableHeaderCell key={id} width={layout.width} align={layout.align}>{tbl.columnLabels[id]}</DataTableHeaderCell>
  }

  const renderCell = (id: string, t: AdminTitleSummary): ReactNode => {
    if (!isShown(id)) return null
    const align = LAYOUT[id].align
    switch (id) {
      case 'title': {
        const fakeTitle = buildFakeTitle(t.name, t.color_r, t.color_g, t.color_b, t.rarity)
        return (
          <DataTableCell key={id} align={align}>
            <span className="font-medium" style={getTitleTextStyle(fakeTitle)}>{t.name}</span>
          </DataTableCell>
        )
      }
      case 'rarity':
        return (
          <DataTableCell key={id} align={align} className="text-muted-foreground">
            <span className="tabular-nums">{t.rarity}</span>
          </DataTableCell>
        )
      case 'holders':
        return <DataTableCell key={id} align={align} className="tabular-nums">{t.holders}</DataTableCell>
      case 'actions':
        return (
          <DataTableCell key={id} align={align}>
            <div className="flex justify-center gap-2">
              <ActionButton tone="accent" icon={Users} onClick={() => setManaging(t)} title="Manage holders" />
              <ActionButton tone="accent" icon={Pencil} onClick={() => openEdit(t)} title="Edit title" />
              <ActionButton tone="red" icon={Trash2} onClick={() => setDeleting(t)} title="Delete title" />
            </div>
          </DataTableCell>
        )
      default:
        return null
    }
  }

  return (
    <SectionShell
      title="Title Management"
      icon={Tag}
      actions={
        <>
          <ActionButton tone="accent" icon={RefreshCw} onClick={() => load()} loading={loading} />
          <ActionButton tone="accent" icon={Plus} onClick={openCreate} disabled={!token}>New Title</ActionButton>
        </>
      }
    >
      <Feedback message={error} tone="red" onDismiss={() => setError(null)} />

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={query} onChange={setQuery} placeholder="Search titles…" className="flex-1 min-w-48 max-w-sm" />
        <TableControls table={tbl} />
      </div>

      {presets.hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2">
          {query && <ActiveFilterChip label="Name" value={query} onClear={() => setQuery('')} />}
          {rarity !== 'all' && <ActiveFilterChip label="Rarity" value={rarity} onClear={() => setRarity('all')} />}
        </div>
      )}

      {tbl.filtersOpen && (
        <div className="bg-card/30 border border-hairline/10 rounded-xl p-4 space-y-4">
          <FilterPanelRow label="Filters">
            <div className="flex flex-col gap-1">
              <span className={PANEL_LABEL}>Rarity</span>
              <AdminSelect value={rarity} onChange={setRarity} options={RARITY_FILTER_OPTIONS} ariaLabel="Filter by rarity" className="min-w-36" />
            </div>
          </FilterPanelRow>
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-hairline/5">
            <FilterPresetsMenu<TitleFilters>
            presets={presets.presets}
            activePreset={presets.activePreset}
            hasActiveFilters={presets.hasActiveFilters}
            onSave={presets.onSave}
            onLoad={presets.onLoad}
            onDelete={presets.onDelete}
            captureCurrentFilters={presets.captureCurrentFilters}
            onResetFilters={resetFilters}
            placeholderExample="e.g. Legendary titles"
            />
          </div>
        </div>
      )}

      <DataTableShell className="flex-none" responsive={{ columns: responsiveColumns, nameFloorRem: 14, extraRem: 0, onResolve: handleResolve }}>
        <DataTableHeaderRow>
          {tbl.columnOrder.map((id) => renderHeader(id))}
        </DataTableHeaderRow>
        <tbody>
          {loading && rows.length === 0 ? (
            Array.from({ length: 8 }).map((_, i) => <DataTableSkeletonRow key={i} columnCount={effectiveCount} />)
          ) : rows.length === 0 ? (
            <DataTableEmpty colSpan={effectiveCount} message={query.trim() ? 'No titles match your filter.' : 'No titles yet.'} />
          ) : rows.map((t) => (
            <DataTableRow key={t.id}>{tbl.columnOrder.map((id) => renderCell(id, t))}</DataTableRow>
          ))}
        </tbody>
      </DataTableShell>

      {token && (
        <TitleFormModal
          open={formOpen}
          onClose={() => setFormOpen(false)}
          token={token}
          editing={editing}
          onSaved={() => load()}
          previewUserId={userProfile?.id ?? undefined}
          previewAlias={userProfile?.alias}
        />
      )}

      {token && (
        <ManageHoldersModal
          open={!!managing}
          onClose={() => setManaging(null)}
          token={token}
          title={managing}
          onChanged={() => load()}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        title="Delete Title"
        tone="red"
        confirmLabel="Delete"
        busy={deleteBusy}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
        message={
          <>
            Delete <span className="font-semibold text-foreground">{deleting?.name}</span> and remove it from{' '}
            <span className={cn('font-semibold', (deleting?.holders ?? 0) > 0 ? 'text-red-300' : 'text-foreground')}>
              {deleting?.holders ?? 0}
            </span>{' '}
            holder{deleting?.holders === 1 ? '' : 's'}? This cannot be undone.
          </>
        }
      />
    </SectionShell>
  )
}
