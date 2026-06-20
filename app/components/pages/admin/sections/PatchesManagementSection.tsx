import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Package, Plus, Pencil, Trash2, RefreshCw, Power, PowerOff, ExternalLink, AlertTriangle, Download, Check,
} from 'lucide-react'
import {
  fetchAdminPatches, createPatch, updatePatch, setPatchActive, deletePatch, derivePatch,
  type AdminPatch, type PatchChannel, type CreatePatchInput,
} from '@/app/utils/api'
import { cn } from '@/lib/utils'
import type { AdminSectionProps } from '../types'
import { SectionShell } from '../components/SectionShell'
import {
  SearchInput, Feedback, ActionButton, AdminSelect, Copyable, ConfirmDialog, relTime, errMessage,
} from '../components/controls'
import { useAdminTable, type AdminColumn } from '../components/useAdminTable'
import { useAdminFilterPresets } from '../components/useAdminFilterPresets'
import { TableControls } from '../components/TableControls'
import { PANEL_LABEL, minWidthFor } from '../components/shared'
import { Modal } from '@/app/components/ui/modal'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { FilterPanelRow } from '@/app/components/ui/filter-panel-row'
import { FilterPresetsMenu } from '@/app/components/shared/FilterPresetsMenu'
import { ActiveFilterChip } from '@/app/components/shared/ActiveFilterChip'
import { useNavState } from '@/app/components/navigation/useNavState'
import {
  DataTableShell, DataTableHeaderRow, DataTableHeaderCell, DataTableRow, DataTableCell,
  DataTableEmpty, DataTableSkeletonRow, type SortDirection,
} from '@/app/components/shared/DataTable'

const CHANNEL_OPTIONS = [
  { value: 'stable', label: 'Stable' },
  { value: 'rc', label: 'Release candidate' },
]

type StatusFilter = 'all' | 'active' | 'inactive'

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Any status' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]

type PatchSortKey = 'channel' | 'tag' | 'asset' | 'status' | 'added'

const PATCH_COLUMNS: AdminColumn[] = [
  { id: 'channel', label: 'Channel', required: true },
  { id: 'tag', label: 'Tag', required: true },
  { id: 'asset', label: 'Asset' },
  { id: 'hashes', label: 'Hashes' },
  { id: 'notes', label: 'Notes' },
  { id: 'status', label: 'Status', required: true },
  { id: 'added', label: 'Added' },
  { id: 'actions', label: 'Actions', required: true },
]

const LAYOUT: Record<string, { width?: string; align?: 'left' | 'center' | 'right' }> = {
  channel: { width: '6rem', align: 'left' },
  tag: { width: '16rem', align: 'left' },
  asset: { align: 'left' },
  hashes: { width: '17rem', align: 'left' },
  notes: { width: '5rem', align: 'center' },
  status: { width: '7rem', align: 'center' },
  added: { width: '8rem', align: 'left' },
  actions: { width: '10rem', align: 'center' },
}

const SORTABLE: Record<string, PatchSortKey> = {
  channel: 'channel', tag: 'tag', asset: 'asset', status: 'status', added: 'added',
}

interface PatchFilters {
  search: string
  channel: string
  status: StatusFilter
  sortKey: PatchSortKey
  sortDir: 'asc' | 'desc'
}

function fieldLabel(text: string) {
  return <label className={PANEL_LABEL}>{text}</label>
}

function ChannelChip({ channel }: { channel: string }) {
  const stable = channel === 'stable'
  return (
    <span className={cn(
      'inline-flex items-center text-[11px] font-medium rounded px-1.5 py-0.5 border uppercase tracking-wide',
      stable ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-amber-500/10 border-amber-500/30 text-amber-200',
    )}>
      {channel}
    </span>
  )
}

type PatchForm = {
  channel: PatchChannel
  tag: string
  asset_name: string
  asset_url: string
  sha256: string
  exe_md5: string
  release_notes_url: string
  active: boolean
}

const EMPTY_FORM: PatchForm = {
  channel: 'stable', tag: '', asset_name: '', asset_url: '', sha256: '', exe_md5: '', release_notes_url: '', active: true,
}

const RELEASES_PREFIX = 'https://github.com/OldUnreal/UnrealTournamentPatches/releases/'
const RELEASES_PAGE = 'https://github.com/OldUnreal/UnrealTournamentPatches/releases'
const URL_PLACEHOLDER = 'https://github.com/OldUnreal/UnrealTournamentPatches/releases/download/v469e/…-Windows.zip'

function validateAssetUrl(url: string): string | null {
  const u = url.trim()
  if (!u.startsWith(RELEASES_PREFIX)) return 'Must be an OldUnreal UnrealTournamentPatches release asset URL.'
  const name = (u.split('/').pop() ?? '').toLowerCase()
  if (!name.endsWith('.zip')) return 'The asset must be a .zip file.'
  if (!name.includes('windows')) return 'The filename must contain "Windows".'
  if (name.includes('windowsxp')) return 'WindowsXP patches are not supported.'
  return null
}

function DerivedField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="space-y-1 min-w-0">
      {fieldLabel(label)}
      {mono ? <Copyable value={value} /> : <div className="text-sm text-foreground truncate" title={value}>{value}</div>}
    </div>
  )
}

function PatchFormModal({ open, onClose, token, editing, onSaved }: {
  open: boolean
  onClose: () => void
  token: string
  editing: AdminPatch | null
  onSaved: () => void
}) {
  const isEdit = !!editing
  const [form, setForm] = useState<PatchForm>(EMPTY_FORM)
  const [derivedFor, setDerivedFor] = useState('')
  const [deriving, setDeriving] = useState(false)
  const [urlError, setUrlError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null); setUrlError(null); setBusy(false); setDeriving(false)
    if (editing) {
      setForm({
        channel: (editing.channel === 'rc' ? 'rc' : 'stable'),
        tag: editing.tag, asset_name: editing.asset_name, asset_url: editing.asset_url,
        sha256: editing.sha256, exe_md5: editing.exe_md5, release_notes_url: editing.release_notes_url,
        active: editing.active,
      })
      setDerivedFor(editing.asset_url)
    } else {
      setForm(EMPTY_FORM)
      setDerivedFor('')
    }
  }, [open, editing])

  const set = (key: keyof PatchForm, value: string | boolean) => setForm((f) => ({ ...f, [key]: value }))

  const ready = !!form.sha256 && !!form.exe_md5 && form.asset_url.trim() !== '' && form.asset_url.trim() === derivedFor

  const fetchDetails = async () => {
    const url = form.asset_url.trim()
    const v = validateAssetUrl(url)
    if (v) { setUrlError(v); return }
    setUrlError(null); setDeriving(true); setError(null)
    try {
      const d = await derivePatch(token, url)
      const refresh = !!editing && d.asset_url !== editing.asset_url
      setForm((f) => ({
        ...f,
        asset_url: d.asset_url,
        asset_name: d.asset_name,
        sha256: d.sha256,
        exe_md5: d.exe_md5,
        release_notes_url: refresh ? d.release_notes_url : (f.release_notes_url.trim() || d.release_notes_url),
        tag: refresh ? d.tag : (f.tag.trim() || d.tag),
      }))
      setDerivedFor(d.asset_url)
    } catch (e) {
      setError(errMessage(e))
    } finally {
      setDeriving(false)
    }
  }

  const blocked = busy || deriving || !ready || !form.tag.trim() || !form.release_notes_url.trim()

  const submit = async () => {
    setBusy(true); setError(null)
    try {
      const payload: CreatePatchInput = {
        channel: form.channel,
        tag: form.tag.trim(),
        asset_name: form.asset_name.trim(),
        asset_url: form.asset_url.trim(),
        sha256: form.sha256.trim(),
        exe_md5: form.exe_md5.trim(),
        release_notes_url: form.release_notes_url.trim(),
        active: form.active,
      }
      if (isEdit && editing) {
        await updatePatch(token, editing.id, payload)
      } else {
        await createPatch(token, payload)
      }
      onSaved(); onClose()
    } catch (e) {
      setError(errMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={isEdit ? `Edit patch — ${editing?.channel}/${editing?.tag}` : 'Publish a new patch'}
      offsetSidebar
      maxWidth="42rem"
      footer={
        <div className="p-4 border-t border-border bg-muted/50 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={blocked}>{busy ? 'Saving…' : isEdit ? 'Save changes' : 'Publish patch'}</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Feedback message={error} tone="red" onDismiss={() => setError(null)} />

        <div className="rounded-xl border border-hairline/10 bg-card/30 p-3 space-y-2">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Paste the <span className="text-foreground font-medium">Windows.zip</span> or <span className="text-foreground font-medium">Windows-x86.zip</span> asset link from an OldUnreal release.
          </p>
          <a href={RELEASES_PAGE} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-accent-300 hover:text-accent-200">
            Open the releases page <ExternalLink className="size-3" />
          </a>
        </div>

        <div className="space-y-1.5">
          {fieldLabel('Patch asset URL (.zip)')}
          <div className="flex gap-2">
            <Input
              value={form.asset_url}
              onChange={(e) => { set('asset_url', e.target.value); setUrlError(null) }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); fetchDetails() } }}
              placeholder={URL_PLACEHOLDER}
              className="h-9 flex-1 font-mono text-xs"
            />
            <ActionButton tone="accent" icon={Download} onClick={fetchDetails} loading={deriving} disabled={!form.asset_url.trim()}>
              {ready ? 'Re-fetch' : 'Fetch'}
            </ActionButton>
          </div>
          {urlError && <p className="text-xs text-red-300">{urlError}</p>}
          {deriving && <p className="text-xs text-muted-foreground">Downloading the archive and computing hashes — this can take a moment…</p>}
        </div>

        {ready && (
          <>
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-3 space-y-3">
              <div className="flex items-center gap-1.5 text-xs text-emerald-300"><Check className="size-3.5" /> Derived from the archive</div>
              <DerivedField label="Asset name" value={form.asset_name} />
              <DerivedField label="Archive SHA-256" value={form.sha256} mono />
              <DerivedField label="Executable MD5" value={form.exe_md5} mono />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                {fieldLabel('Channel')}
                <AdminSelect value={form.channel} onChange={(v) => set('channel', v as PatchChannel)} options={CHANNEL_OPTIONS} ariaLabel="Channel" className="w-full" />
              </div>
              <div className="space-y-1.5">
                {fieldLabel('Status')}
                <label className="flex items-center gap-2 h-9 cursor-pointer select-none">
                  <input type="checkbox" checked={form.active} onChange={(e) => set('active', e.target.checked)} style={{ colorScheme: 'dark' }} className="size-4 accent-emerald-500 cursor-pointer" />
                  <span className="text-sm text-foreground">{form.active ? 'Active' : 'Inactive'}</span>
                </label>
              </div>
            </div>

            <div className="space-y-1.5">
              {fieldLabel('Tag')}
              <Input value={form.tag} onChange={(e) => set('tag', e.target.value)} placeholder="v469e" className="h-9" />
            </div>

            <div className="space-y-1.5">
              {fieldLabel('Release notes URL')}
              <Input value={form.release_notes_url} onChange={(e) => set('release_notes_url', e.target.value)} className="h-9 font-mono text-xs" />
            </div>

            {form.active && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.08] p-3 flex items-start gap-2.5 text-amber-200">
                <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                <p className="text-xs leading-relaxed">
                  This patch is <span className="font-semibold">active</span> — once published it is offered to every launcher on the
                  {' '}<span className="font-semibold">{form.channel}</span> channel and announced in-app.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}

export function PatchesManagementSection({ userProfile }: AdminSectionProps) {
  const token = userProfile?.accessToken
  const tbl = useAdminTable('utbt:admin:patches:cols:v2', PATCH_COLUMNS)

  const [rows, setRows] = useState<AdminPatch[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useNavState('admin.patches.search', '')
  const [channel, setChannel] = useNavState('admin.patches.channel', '')
  const [status, setStatus] = useNavState<StatusFilter>('admin.patches.status', 'all')
  const [sortKey, setSortKey] = useNavState<PatchSortKey>('admin.patches.sortKey', 'added')
  const [sortDir, setSortDir] = useNavState<'asc' | 'desc'>('admin.patches.sortDir', 'desc')

  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<AdminPatch | null>(null)
  const [toggleTarget, setToggleTarget] = useState<AdminPatch | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AdminPatch | null>(null)
  const [actionBusy, setActionBusy] = useState(false)

  const load = useCallback((signal?: AbortSignal) => {
    if (!token) return
    setLoading(true); setError(null)
    fetchAdminPatches(token, signal)
      .then((items) => { setRows(items); setLoading(false) })
      .catch((e) => { if (!signal?.aborted) { setError(errMessage(e)); setLoading(false) } })
  }, [token])

  useEffect(() => {
    const ctrl = new AbortController()
    load(ctrl.signal)
    return () => ctrl.abort()
  }, [load])

  const filtered = useMemo(() => rows.filter((p) => {
    if (channel && p.channel !== channel) return false
    if (status !== 'all' && p.active !== (status === 'active')) return false
    if (search && !p.tag.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [rows, channel, status, search])

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1
    const value = (p: AdminPatch): string | number => {
      switch (sortKey) {
        case 'channel': return p.channel
        case 'tag': return p.tag
        case 'asset': return p.asset_name
        case 'status': return p.active ? 1 : 0
        case 'added': return p.added ? Date.parse(p.added) || 0 : 0
      }
    }
    return [...filtered].sort((a, b) => {
      const av = value(a)
      const bv = value(b)
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
      return String(av).localeCompare(String(bv)) * dir
    })
  }, [filtered, sortKey, sortDir])

  const toggleSort = (col: PatchSortKey) => {
    if (sortKey === col) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else { setSortKey(col); setSortDir('desc') }
  }

  const filters: PatchFilters = useMemo(
    () => ({ search, channel, status, sortKey, sortDir }),
    [search, channel, status, sortKey, sortDir],
  )
  const applyFilters = useCallback((f: PatchFilters) => {
    setSearch(f.search); setChannel(f.channel); setStatus(f.status)
    setSortKey(f.sortKey); setSortDir(f.sortDir)
  }, [setSearch, setChannel, setStatus, setSortKey, setSortDir])
  const resetFilters = useCallback(() => {
    setSearch(''); setChannel(''); setStatus('all')
  }, [setSearch, setChannel, setStatus])

  const presets = useAdminFilterPresets<PatchFilters>({
    storageKey: 'utbt:admin:patches:filters:v1',
    current: filters,
    isDefault: (f) => !f.search && !f.channel && f.status === 'all',
    onApply: applyFilters,
  })

  const channelLabel = CHANNEL_OPTIONS.find((o) => o.value === channel)?.label ?? channel
  const statusLabel = STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status

  const doToggle = useCallback(async () => {
    if (!token || !toggleTarget) return
    setActionBusy(true); setError(null)
    try {
      await setPatchActive(token, toggleTarget.id, !toggleTarget.active)
      setToggleTarget(null)
      load()
    } catch (e) {
      setError(errMessage(e))
    } finally {
      setActionBusy(false)
    }
  }, [token, toggleTarget, load])

  const doDelete = useCallback(async () => {
    if (!token || !deleteTarget) return
    setActionBusy(true); setError(null)
    try {
      await deletePatch(token, deleteTarget.id)
      setDeleteTarget(null)
      load()
    } catch (e) {
      setError(errMessage(e))
    } finally {
      setActionBusy(false)
    }
  }, [token, deleteTarget, load])

  const tableMinWidth = useMemo(() => minWidthFor(tbl.columnOrder, tbl.isVisible, LAYOUT, 14), [tbl])

  const renderHeader = (id: string): ReactNode => {
    if (!tbl.isVisible(id)) return null
    const layout = LAYOUT[id]
    const sortCol = SORTABLE[id]
    if (sortCol) {
      return (
        <DataTableHeaderCell key={id} width={layout.width} align={layout.align}
          sortable sortDirection={(sortKey === sortCol ? sortDir : null) as SortDirection} onSort={() => toggleSort(sortCol)}>
          {tbl.columnLabels[id]}
        </DataTableHeaderCell>
      )
    }
    return <DataTableHeaderCell key={id} width={layout.width} align={layout.align}>{tbl.columnLabels[id]}</DataTableHeaderCell>
  }

  const renderCell = (id: string, p: AdminPatch): ReactNode => {
    if (!tbl.isVisible(id)) return null
    const align = LAYOUT[id].align
    switch (id) {
      case 'channel':
        return <DataTableCell key={id} align={align}><ChannelChip channel={p.channel} /></DataTableCell>
      case 'tag':
        return (
          <DataTableCell key={id} align={align} className="font-medium text-sm">
            <div className="truncate" title={p.tag}>{p.tag}</div>
          </DataTableCell>
        )
      case 'asset':
        return (
          <DataTableCell key={id} align={align}>
            <a href={p.asset_url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-accent-300 hover:text-accent-200 min-w-0" title={p.asset_name}>
              <span className="truncate min-w-0">{p.asset_name}</span>
              <ExternalLink className="size-3 shrink-0" />
            </a>
          </DataTableCell>
        )
      case 'hashes':
        return (
          <DataTableCell key={id} align={align}>
            <div className="flex flex-col gap-1">
              <span className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase text-muted-foreground/60 w-7 shrink-0">zip</span>
                <Copyable value={p.sha256} className="min-w-0" />
              </span>
              <span className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase text-muted-foreground/60 w-7 shrink-0">exe</span>
                <Copyable value={p.exe_md5} className="min-w-0" />
              </span>
            </div>
          </DataTableCell>
        )
      case 'notes':
        return (
          <DataTableCell key={id} align={align}>
            <a href={p.release_notes_url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center justify-center text-muted-foreground hover:text-accent-200" title={p.release_notes_url}>
              <ExternalLink className="size-4" />
            </a>
          </DataTableCell>
        )
      case 'status':
        return (
          <DataTableCell key={id} align={align}>
            {p.active ? <span className="text-emerald-300 text-xs">Active</span> : <span className="text-muted-foreground text-xs">Inactive</span>}
          </DataTableCell>
        )
      case 'added':
        return <DataTableCell key={id} align={align} className="text-xs text-muted-foreground whitespace-nowrap" title={p.added ?? ''}>{relTime(p.added)}</DataTableCell>
      case 'actions':
        return (
          <DataTableCell key={id} align={align}>
            <div className="flex justify-center gap-1.5">
              <ActionButton tone="accent" icon={Pencil} onClick={() => setEditing(p)} title="Edit patch" />
              <ActionButton
                tone={p.active ? 'amber' : 'emerald'}
                icon={p.active ? PowerOff : Power}
                onClick={() => setToggleTarget(p)}
                title={p.active ? 'Deactivate' : 'Activate'}
              />
              <ActionButton tone="red" icon={Trash2} onClick={() => setDeleteTarget(p)} title="Delete patch" />
            </div>
          </DataTableCell>
        )
      default:
        return null
    }
  }

  return (
    <SectionShell
      title="Patch Releases"
      icon={Package}
      actions={
        <>
          <ActionButton tone="accent" icon={RefreshCw} onClick={() => load()} loading={loading} />
          <ActionButton tone="accent" icon={Plus} onClick={() => setAdding(true)} disabled={!token}>New Patch</ActionButton>
        </>
      }
    >
      <Feedback message={error} tone="red" onDismiss={() => setError(null)} />

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search patches…" className="flex-1 min-w-48 max-w-sm" />
        <TableControls table={tbl} />
      </div>

      {presets.hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2">
          {search && <ActiveFilterChip label="Tag" value={search} onClear={() => setSearch('')} />}
          {channel && <ActiveFilterChip label="Channel" value={channelLabel} onClear={() => setChannel('')} />}
          {status !== 'all' && <ActiveFilterChip label="Status" value={statusLabel} onClear={() => setStatus('all')} />}
        </div>
      )}

      {tbl.filtersOpen && (
        <div className="bg-card/30 border border-hairline/10 rounded-xl p-4 space-y-4">
          <FilterPanelRow label="Filters">
            <div className="flex flex-col gap-1">
              <span className={PANEL_LABEL}>Channel</span>
              <AdminSelect value={channel} onChange={setChannel} ariaLabel="Filter by channel"
                options={[{ value: '', label: 'Any channel' }, ...CHANNEL_OPTIONS]} className="min-w-40" />
            </div>
            <div className="flex flex-col gap-1">
              <span className={PANEL_LABEL}>Status</span>
              <AdminSelect value={status} onChange={(v) => setStatus(v as StatusFilter)} ariaLabel="Filter by status"
                options={STATUS_OPTIONS} className="min-w-32" />
            </div>
          </FilterPanelRow>
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-hairline/5">
            <FilterPresetsMenu<PatchFilters>
              presets={presets.presets}
              activePreset={presets.activePreset}
              hasActiveFilters={presets.hasActiveFilters}
              onSave={presets.onSave}
              onLoad={presets.onLoad}
              onDelete={presets.onDelete}
              captureCurrentFilters={presets.captureCurrentFilters}
              onResetFilters={resetFilters}
              placeholderExample="e.g. Active stable patches"
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
          ) : sorted.length === 0 ? (
            <DataTableEmpty colSpan={tbl.visibleCount} message="No patches match these filters." />
          ) : sorted.map((p) => (
            <DataTableRow key={p.id}>{tbl.columnOrder.map((id) => renderCell(id, p))}</DataTableRow>
          ))}
        </tbody>
      </DataTableShell>

      <div className="text-xs text-muted-foreground pt-2 tabular-nums">
        {loading ? '' : `${sorted.length} patch${sorted.length === 1 ? '' : 'es'}`}
      </div>

      {token && <PatchFormModal open={adding} onClose={() => setAdding(false)} token={token} editing={null} onSaved={() => load()} />}
      {token && <PatchFormModal open={!!editing} onClose={() => setEditing(null)} token={token} editing={editing} onSaved={() => load()} />}

      <ConfirmDialog
        open={!!toggleTarget}
        title={toggleTarget?.active ? 'Deactivate this patch?' : 'Activate this patch?'}
        tone="accent"
        confirmLabel={toggleTarget?.active ? 'Deactivate' : 'Activate'}
        busy={actionBusy}
        onCancel={() => setToggleTarget(null)}
        onConfirm={doToggle}
        message={toggleTarget && (
          <span>
            {toggleTarget.active
              ? <>Launchers on the <ChannelChip channel={toggleTarget.channel} /> channel will no longer be offered <span className="font-medium text-foreground">{toggleTarget.tag}</span>.</>
              : <>This makes <span className="font-medium text-foreground">{toggleTarget.tag}</span> live for every launcher on the <ChannelChip channel={toggleTarget.channel} /> channel.</>}
          </span>
        )}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete this patch?"
        tone="red"
        confirmLabel="Delete"
        busy={actionBusy}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={doDelete}
        message={deleteTarget && (
          <span>
            Permanently delete patch <span className="font-medium text-foreground">{deleteTarget.channel}/{deleteTarget.tag}</span>. This
            removes it from the launcher entirely and cannot be rolled back. To temporarily pull a patch, deactivate it instead.
          </span>
        )}
      />
    </SectionShell>
  )
}
