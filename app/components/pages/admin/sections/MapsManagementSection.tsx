import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Map as MapIcon, Plus, Pencil, RefreshCw, X, ImagePlus, AlertTriangle, Search, Megaphone, Gauge, Loader2, CheckCircle2 } from 'lucide-react'
import {
  fetchAdminMaps, fetchAdminMapsCount, createMap, updateMap, fetchAdminUsers, fetchAdminMapTags,
  fetchMapvoteStatus, setMapvoteAnnouncement, regenerateMapvote, toActiveTitle,
  fetchDifficultySyncPreview, applyDifficultySync,
  type AdminMapRow, type AdminMapSort, type AdminUserRow, type MapvoteStatus, type DifficultySyncChange,
} from '@/app/utils/api'
import { cn } from '@/lib/utils'
import type { AdminSectionProps } from '../types'
import { SectionShell } from '../components/SectionShell'
import { SearchInput, Pager, Feedback, ActionButton, AdminSelect, ConfirmDialog, relTime, errMessage } from '../components/controls'
import { useAdminTable, type AdminColumn } from '../components/useAdminTable'
import { useAdminFilterPresets } from '../components/useAdminFilterPresets'
import { TableControls } from '../components/TableControls'
import { PANEL_LABEL, useResetOnChange, useAdminPageSize } from '../components/shared'
import { MapLink } from '../components/MapLink'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { MapThumbnail } from '@/app/components/shared/MapThumbnail'
import { FilterPanelRow } from '@/app/components/ui/filter-panel-row'
import { FilterPresetsMenu } from '@/app/components/shared/FilterPresetsMenu'
import { ActiveFilterChip } from '@/app/components/shared/ActiveFilterChip'
import { useNavState } from '@/app/components/navigation/useNavState'
import { useTheme } from '@/app/theme/ThemeProvider'
import { Modal } from '@/app/components/ui/modal'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import {
  DataTableShell, DataTableHeaderRow, DataTableHeaderCell, DataTableRow, DataTableCell, DataTableEmpty,
  DataTableSkeletonRow, type SortDirection, type ResponsiveColumn,
} from '@/app/components/shared/DataTable'

const MAPVOTE_STALE_KEY = 'utbt:admin:maps:mapvoteStale:v1'
const DIFFICULTY_OPTIONS = Array.from({ length: 10 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))

type MapStatus = 'all' | 'active' | 'inactive'

const STATUS_OPTIONS: { value: MapStatus; label: string }[] = [
  { value: 'all', label: 'Any status' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]

const MAP_COLUMNS: AdminColumn[] = [
  { id: 'map', label: 'Map', required: true },
  { id: 'author', label: 'Author' },
  { id: 'difficulty', label: 'Difficulty' },
  { id: 'tags', label: 'Tags' },
  { id: 'status', label: 'Status' },
  { id: 'superseded', label: 'Superseded' },
  { id: 'edit', label: 'Edit', required: true },
]

const LAYOUT: Record<string, { width?: string; align?: 'left' | 'center' | 'right' }> = {
  map: { align: 'left' },
  author: { width: '15rem', align: 'left' },
  difficulty: { width: '6rem', align: 'center' },
  tags: { width: '16rem', align: 'left' },
  status: { width: '7rem', align: 'center' },
  superseded: { width: '12rem', align: 'left' },
  edit: { width: '6rem', align: 'center' },
}

const SORTABLE: Record<string, AdminMapSort> = {
  map: 'name', difficulty: 'difficulty', status: 'active',
}

const PRIORITY: Record<string, number> = {
  status: 70, difficulty: 70, author: 30, tags: 30, superseded: 30,
}

interface MapFilters {
  search: string
  author: string
  tag: string
  difficulty: string
  status: MapStatus
}

function fieldLabel(text: string) {
  return <label className={PANEL_LABEL}>{text}</label>
}

interface AuthorUser { id: string; alias: string | null }

function AuthorPicker({ mode, setMode, authorStr, setAuthorStr, authorUser, setAuthorUser, token }: {
  mode: 'text' | 'player'
  setMode: (m: 'text' | 'player') => void
  authorStr: string
  setAuthorStr: (v: string) => void
  authorUser: AuthorUser | null
  setAuthorUser: (u: AuthorUser | null) => void
  token: string
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<AdminUserRow[]>([])

  useEffect(() => {
    if (mode !== 'player' || authorUser || !query.trim()) { setResults([]); return }
    const ctrl = new AbortController()
    const t = setTimeout(() => {
      fetchAdminUsers(token, { search: query, limit: 8 }, ctrl.signal).then(setResults).catch(() => {})
    }, 300)
    return () => { clearTimeout(t); ctrl.abort() }
  }, [mode, query, authorUser, token])

  return (
    <div className="space-y-2">
      <div className="inline-flex rounded-md border border-hairline/10 overflow-hidden text-xs">
        {(['text', 'player'] as const).map((m) => (
          <button key={m} type="button" onClick={() => setMode(m)}
            className={cn('px-3 py-1.5 cursor-pointer transition-colors', mode === m ? 'bg-accent-500/15 text-accent-200' : 'text-muted-foreground hover:text-foreground')}>
            {m === 'text' ? 'Name' : 'Player'}
          </button>
        ))}
      </div>

      {mode === 'text' ? (
        <Input value={authorStr} onChange={(e) => setAuthorStr(e.target.value)} placeholder="Author name" className="h-9" />
      ) : authorUser ? (
        <div className="flex items-center justify-between gap-2 bg-card/30 border border-hairline/10 rounded-md px-3 h-10">
          <PlayerInfo userId={authorUser.id} alias={authorUser.alias} title={null} size="sm" interactive={false} />
          <button type="button" onClick={() => setAuthorUser(null)} className="text-muted-foreground/60 hover:text-foreground cursor-pointer shrink-0"><X className="size-4" /></button>
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/60 pointer-events-none" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search players…" className="h-9 pl-9" />
          </div>
          {results.length > 0 && (
            <ul className="bg-card/30 border border-hairline/10 rounded-md divide-y divide-hairline/5 max-h-44 overflow-y-auto">
              {results.map((u) => (
                <li key={u.id}>
                  <button type="button" onClick={() => { setAuthorUser({ id: u.id, alias: u.alias }); setQuery('') }}
                    className="w-full text-left px-3 py-2 hover:bg-hairline/5 cursor-pointer">
                    <PlayerInfo userId={u.id} alias={u.alias} title={toActiveTitle(u.active_title)} size="sm" interactive={false} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function TagEditor({ tags, onChange, suggestions }: { tags: string[]; onChange: (t: string[]) => void; suggestions: string[] }) {
  const [input, setInput] = useState('')
  const q = input.trim().toLowerCase()
  const hasTag = (value: string) => tags.some((t) => t.toLowerCase() === value.toLowerCase())
  const add = (tag: string) => {
    const v = tag.trim()
    if (v && !hasTag(v)) onChange([...tags, v])
    setInput('')
  }
  const matches = q ? suggestions.filter((s) => s.toLowerCase().includes(q) && !hasTag(s)).slice(0, 8) : []
  const exact = !!q && suggestions.some((s) => s.toLowerCase() === q)
  const canAddNew = !!q && !exact && !hasTag(input.trim())
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(input) } }}
          placeholder="Search or add a tag…" className="h-9 flex-1" />
        <ActionButton tone="accent" icon={Plus} onClick={() => add(input)} disabled={!input.trim()}>Add</ActionButton>
      </div>
      {(matches.length > 0 || canAddNew) && (
        <ul className="bg-card/30 border border-hairline/10 rounded-md divide-y divide-hairline/5 max-h-44 overflow-y-auto">
          {matches.map((s) => (
            <li key={s}>
              <button type="button" onClick={() => add(s)} className="w-full text-left px-3 py-2 text-sm hover:bg-hairline/5 cursor-pointer">{s}</button>
            </li>
          ))}
          {canAddNew && (
            <li>
              <button type="button" onClick={() => add(input.trim())} className="w-full text-left px-3 py-2 text-sm text-accent-300 hover:bg-hairline/5 cursor-pointer">
                Add new tag “{input.trim()}”
              </button>
            </li>
          )}
        </ul>
      )}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <span key={t} className="inline-flex items-center gap-1 text-xs bg-accent-500/10 border border-accent-500/20 text-accent-200 rounded px-2 py-0.5">
              {t}
              <button type="button" onClick={() => onChange(tags.filter((x) => x !== t))} className="text-accent-200/60 hover:text-accent-100 cursor-pointer"><X className="size-3" /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function SupersedePicker({ token, value, onChange, excludeName }: {
  token: string
  value: string | null
  onChange: (v: string | null) => void
  excludeName?: string
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<AdminMapRow[]>([])

  useEffect(() => {
    if (value || !query.trim()) { setResults([]); return }
    const ctrl = new AbortController()
    const t = setTimeout(() => {
      fetchAdminMaps(token, { search: query, limit: 8 }, ctrl.signal)
        .then((rows) => setResults(rows.filter((m) => m.name !== excludeName && !m.superseded_by)))
        .catch(() => {})
    }, 300)
    return () => { clearTimeout(t); ctrl.abort() }
  }, [query, value, excludeName, token])

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 bg-card/30 border border-hairline/10 rounded-md px-3 h-10">
        <span className="text-sm text-foreground truncate">{value}</span>
        <button type="button" onClick={() => onChange(null)} className="text-muted-foreground/60 hover:text-foreground cursor-pointer shrink-0"><X className="size-4" /></button>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/60 pointer-events-none" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search a map to supersede…" className="h-9 pl-9" />
      </div>
      {results.length > 0 && (
        <ul className="bg-card/30 border border-hairline/10 rounded-md divide-y divide-hairline/5 max-h-44 overflow-y-auto">
          {results.map((m) => (
            <li key={m.name}>
              <button type="button" onClick={() => { onChange(m.name); setQuery('') }} className="w-full text-left px-3 py-2 text-sm hover:bg-hairline/5 cursor-pointer">{m.name}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const MAP_NAME_PREFIXES = ['CTF-BT-', 'CTF-BT+']

function MapFormModal({ open, onClose, token, editing, onSaved, allTags }: {
  open: boolean
  onClose: () => void
  token: string
  editing: AdminMapRow | null
  onSaved: () => void
  allTags: string[]
}) {
  const isEdit = !!editing
  const [name, setName] = useState('')
  const [difficulty, setDifficulty] = useState('5')
  const [active, setActive] = useState(true)
  const [authorMode, setAuthorMode] = useState<'text' | 'player'>('text')
  const [authorStr, setAuthorStr] = useState('')
  const [authorUser, setAuthorUser] = useState<AuthorUser | null>(null)
  const [tags, setTags] = useState<string[]>([])
  const [url, setUrl] = useState('')
  const [changelog, setChangelog] = useState('')
  const [precededBy, setPrecededBy] = useState<string | null>(null)
  const [transferRecords, setTransferRecords] = useState(false)
  const [supersedeAck, setSupersedeAck] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null); setBusy(false); setUrl(''); setChangelog(''); setPrecededBy(null); setTransferRecords(false); setSupersedeAck(false)
    if (editing) {
      setName(editing.name)
      setDifficulty(String(editing.difficulty ?? 5))
      setActive(editing.active)
      setTags(editing.tags ? editing.tags.split(',').map((t) => t.trim()).filter(Boolean) : [])
      if (editing.author_ref) {
        setAuthorMode('player'); setAuthorUser({ id: editing.author_ref, alias: editing.author_alias }); setAuthorStr('')
      } else {
        setAuthorMode('text'); setAuthorStr(editing.author_str || ''); setAuthorUser(null)
      }
    } else {
      setName(''); setDifficulty('5'); setActive(true); setTags([])
      setAuthorMode('text'); setAuthorStr(''); setAuthorUser(null)
    }
  }, [open, editing])

  const authorPayload = useMemo(() => (
    authorMode === 'player' && authorUser ? { author_ref: authorUser.id } : { author_str: authorStr.trim() }
  ), [authorMode, authorUser, authorStr])

  const authorValid = authorMode === 'player' ? !!authorUser : !!authorStr.trim()
  const nameValid = isEdit || MAP_NAME_PREFIXES.some((p) => name.trim().startsWith(p))
  const blocked = busy || !authorValid || (!isEdit && (!name.trim() || !nameValid)) || (!!precededBy && transferRecords && !supersedeAck)

  const submit = async () => {
    setBusy(true); setError(null)
    try {
      const tagsStr = tags.join(',')
      if (isEdit && editing) {
        await updateMap(token, editing.name, { active, difficulty: parseInt(difficulty, 10), tags: tagsStr, ...authorPayload })
      } else {
        await createMap(token, {
          name: name.trim(), difficulty: parseInt(difficulty, 10), active, tags: tagsStr,
          url: url.trim() || undefined, changelog: changelog.trim() || undefined,
          preceded_by: precededBy || undefined,
          transfer_records: precededBy ? transferRecords : undefined,
          ...authorPayload,
        })
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
      title={isEdit ? `Edit map — ${editing?.name}` : 'Add a new map'}
      offsetSidebar
      maxWidth="42rem"
      footer={
        <div className="p-4 border-t border-border bg-muted/50 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={blocked}>{busy ? 'Saving…' : isEdit ? 'Save changes' : (precededBy ? 'Create & supersede' : 'Create map')}</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Feedback message={error} tone="red" onDismiss={() => setError(null)} />

        {isEdit && editing && (
          <div className="flex justify-center">
            <MapThumbnail mapName={editing.name} className="size-48" />
          </div>
        )}

        <div className="space-y-1.5">
          {fieldLabel(isEdit ? 'Map name (immutable)' : 'Map name')}
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="CTF-BT-Example" className="h-9" disabled={isEdit} />
          {!isEdit && name.trim() && !nameValid && (
            <p className="text-xs text-red-300">Map name must start with “CTF-BT-” or “CTF-BT+”.</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            {fieldLabel('Difficulty')}
            <AdminSelect value={difficulty} onChange={setDifficulty} options={DIFFICULTY_OPTIONS} ariaLabel="Difficulty" className="w-full" />
          </div>
          <div className="space-y-1.5">
            {fieldLabel('Status')}
            <label className="flex items-center gap-2 h-9 cursor-pointer select-none">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} style={{ colorScheme: 'dark' }} className="size-4 accent-emerald-500 cursor-pointer" />
              <span className="text-sm text-foreground">{active ? 'Active' : 'Inactive'}</span>
            </label>
          </div>
        </div>

        <div className="space-y-1.5">
          {fieldLabel('Author')}
          <AuthorPicker mode={authorMode} setMode={setAuthorMode} authorStr={authorStr} setAuthorStr={setAuthorStr}
            authorUser={authorUser} setAuthorUser={setAuthorUser} token={token} />
        </div>

        <div className="space-y-1.5">
          {fieldLabel('Tags')}
          <TagEditor tags={tags} onChange={setTags} suggestions={allTags} />
        </div>

        {!isEdit && (
          <>
            <div className="space-y-1.5">
              {fieldLabel('Download URL (optional)')}
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…/map.zip" className="h-9" />
            </div>
            <div className="space-y-1.5">
              {fieldLabel('Changelog (optional)')}
              <Input value={changelog} onChange={(e) => setChangelog(e.target.value)} placeholder="What changed in this version" className="h-9" />
            </div>
            <div className="space-y-1.5">
              {fieldLabel('Supersedes (optional)')}
              <SupersedePicker token={token} value={precededBy} onChange={(v) => { setPrecededBy(v); setTransferRecords(false); setSupersedeAck(false) }} excludeName={name.trim()} />
              {precededBy && (
                <div className="mt-2 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={transferRecords} onChange={(e) => { setTransferRecords(e.target.checked); setSupersedeAck(false) }} style={{ colorScheme: 'dark' }} className="size-4 accent-emerald-500 cursor-pointer" />
                    <span className="text-sm text-foreground">Transfer records from {precededBy} to this map</span>
                  </label>
                  {transferRecords ? (
                    <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 space-y-2 text-red-300">
                      <div className="flex items-start gap-2.5">
                        <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                        <p className="text-xs leading-relaxed">
                          Every cap, playtime record, and review on <span className="font-semibold">{precededBy}</span> will be moved onto this
                          map, and <span className="font-semibold">{precededBy}</span> will be retired. <span className="font-semibold">This cannot be undone.</span>
                        </p>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer select-none pl-6">
                        <input type="checkbox" checked={supersedeAck} onChange={(e) => setSupersedeAck(e.target.checked)} style={{ colorScheme: 'dark' }} className="size-4 accent-red-500 cursor-pointer" />
                        <span className="text-xs">I understand this is irreversible.</span>
                      </label>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground pl-6">
                      {precededBy} will be deactivated, but its records stay on the old map — this new map starts with a fresh leaderboard.
                    </p>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {isEdit && (
          <div className="space-y-1.5">
            {fieldLabel('Screenshot')}
            <ActionButton tone="accent" icon={ImagePlus} disabled title="Coming soon">Add screenshot (coming soon)</ActionButton>
          </div>
        )}
      </div>
    </Modal>
  )
}

function formatCooldown(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function buildAnnouncementPreviewHead(): string {
  const cs = typeof document !== 'undefined' ? getComputedStyle(document.documentElement) : null
  const bg = cs?.getPropertyValue('--card').trim() || '#12161d'
  const fg = cs?.getPropertyValue('--foreground').trim() || '#e5e7eb'
  const link = cs?.getPropertyValue('--accent-300').trim() || '#7dd3fc'
  return `<style>html,body{margin:0;padding:12px;background:${bg};color:${fg};`
    + 'font-family:system-ui,-apple-system,sans-serif;font-size:14px;line-height:1.5;word-break:break-word;}'
    + `a{color:${link};}img{max-width:100%;}</style>`
}

function MapvoteModal({ open, onClose, token, onRegenerated }: { open: boolean; onClose: () => void; token: string; onRegenerated?: () => void }) {
  const [status, setStatus] = useState<MapvoteStatus | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const [remaining, setRemaining] = useState(0)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<'save' | 'refresh' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [confirmRefresh, setConfirmRefresh] = useState(false)
  const [view, setView] = useState<'edit' | 'preview'>('edit')
  const { themeId } = useTheme()
  const previewHead = useMemo(() => {
    void themeId
    return buildAnnouncementPreviewHead()
  }, [themeId])

  const loadStatus = useCallback((signal?: AbortSignal) => {
    setLoading(true); setError(null)
    fetchMapvoteStatus(token, signal)
      .then((s) => { setStatus(s); setAnnouncement(s.announcement); setRemaining(s.cooldown_seconds_remaining); setLoading(false) })
      .catch((e) => { if (!signal?.aborted) { setError(errMessage(e)); setLoading(false) } })
  }, [token])

  useEffect(() => {
    if (!open) return
    setSuccess(null); setConfirmRefresh(false); setView('edit')
    const ctrl = new AbortController()
    loadStatus(ctrl.signal)
    return () => ctrl.abort()
  }, [open, loadStatus])

  useEffect(() => {
    if (!open) return
    const id = setInterval(() => setRemaining((r) => (r <= 0 ? 0 : r - 1)), 1000)
    return () => clearInterval(id)
  }, [open])

  const prevRemaining = useRef(0)
  useEffect(() => {
    if (open && prevRemaining.current > 0 && remaining === 0) loadStatus()
    prevRemaining.current = remaining
  }, [open, remaining, loadStatus])

  const saveAnnouncement = async () => {
    if (!status) return
    setBusy('save'); setError(null); setSuccess(null)
    try {
      await setMapvoteAnnouncement(token, announcement)
      setSuccess('Announcement saved. It reaches servers on the next refresh.')
      loadStatus()
    } catch (e) {
      setError(errMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const doRefresh = async () => {
    if (!status) return
    setBusy('refresh'); setError(null); setSuccess(null); setConfirmRefresh(false)
    try {
      await regenerateMapvote(token, announcement)
      onRegenerated?.()
      setSuccess('Mapvote refreshed — servers will pick up the new list and announcement shortly.')
      loadStatus()
    } catch (e) {
      setError(errMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const onCooldown = remaining > 0

  return (
    <>
      <Modal isOpen={open} onClose={onClose} title="Mapvote" offsetSidebar maxWidth="40rem"
        footer={
          <div className="p-4 border-t border-border bg-muted/50 flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={!!busy}>Close</Button>
            <ActionButton tone="accent" icon={Megaphone} onClick={saveAnnouncement} loading={busy === 'save'} disabled={!!busy || loading || !status}>
              Save announcement
            </ActionButton>
            <ActionButton tone="emerald" icon={RefreshCw} onClick={() => setConfirmRefresh(true)} loading={busy === 'refresh'} disabled={!!busy || loading || !status || onCooldown}>
              Save &amp; refresh mapvote
            </ActionButton>
          </div>
        }
      >
        <div className="space-y-4">
          <Feedback message={error} tone="red" onDismiss={() => setError(null)} />
          <Feedback message={success} tone="emerald" onDismiss={() => setSuccess(null)} />

          <div className="rounded-xl border border-hairline/10 bg-card/30 p-3 text-xs leading-relaxed text-muted-foreground">
            Refreshing rebuilds the in-game map list, categories, and the announcement, then pushes them to every server.
            It is limited to <span className="text-foreground font-medium">once every 20 minutes</span> for all staff combined, so a
            refresh has time to reach the servers before another one runs. Editing the announcement and refreshing in one step keeps them in sync.
          </div>

          <div className={cn(
            'rounded-xl border p-3 flex items-center gap-2.5 text-xs',
            onCooldown ? 'border-amber-500/30 bg-amber-500/[0.06] text-amber-200' : 'border-emerald-500/25 bg-emerald-500/[0.05] text-emerald-300',
          )}>
            <RefreshCw className="size-4 shrink-0" />
            {loading ? (
              <span>Loading mapvote status…</span>
            ) : onCooldown ? (
              <span>Next refresh available in <span className="font-mono font-semibold tabular-nums">{formatCooldown(remaining)}</span>.</span>
            ) : (
              <span>Ready to refresh{status?.last_regenerated_at ? <> — last refreshed {relTime(status.last_regenerated_at)}</> : null}.</span>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              {fieldLabel('Announcement (basic HTML)')}
              <div className="inline-flex rounded-md border border-hairline/10 overflow-hidden text-xs">
                {(['edit', 'preview'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setView(m)}
                    className={cn(
                      'px-3 py-1 cursor-pointer transition-colors capitalize',
                      view === m ? 'bg-accent-500/15 text-accent-200' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
            {view === 'edit' ? (
              <textarea
                value={announcement}
                onChange={(e) => setAnnouncement(e.target.value)}
                rows={7}
                placeholder="<b>Welcome!</b> Server news goes here — basic HTML is supported."
                style={{ colorScheme: 'dark' }}
                className="w-full rounded-md border border-hairline/10 bg-card/30 px-3 py-2 text-sm font-mono resize-y outline-none focus:border-hairline/20"
              />
            ) : (
              <iframe
                title="Announcement preview"
                sandbox=""
                srcDoc={previewHead + announcement}
                className="w-full h-[11.75rem] rounded-md border border-hairline/10 bg-card/30"
              />
            )}
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmRefresh}
        title="Refresh the mapvote?"
        tone="accent"
        confirmLabel="Save & refresh"
        busy={busy === 'refresh'}
        onConfirm={doRefresh}
        onCancel={() => setConfirmRefresh(false)}
        message={
          <>This saves the announcement and rebuilds the server map list for every server. You won’t be able to refresh again for 20 minutes.</>
        }
      />
    </>
  )
}

type DifficultySyncState =
  | { status: 'loading' }
  | { status: 'preview'; changes: DifficultySyncChange[] }
  | { status: 'applying' }
  | { status: 'done'; count: number }
  | { status: 'error'; message: string }

function DifficultySyncModal({ open, onClose, token, onApplied }: {
  open: boolean
  onClose: () => void
  token: string
  onApplied: () => void
}) {
  const [state, setState] = useState<DifficultySyncState>({ status: 'loading' })
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (!open) return
    setState({ status: 'loading' }); setSelected(new Set()); setReason('')
    const ctrl = new AbortController()
    fetchDifficultySyncPreview(token, ctrl.signal)
      .then((changes) => {
        setState({ status: 'preview', changes })
        setSelected(new Set(changes.map((c) => c.name)))
      })
      .catch((e) => { if (!ctrl.signal.aborted) setState({ status: 'error', message: errMessage(e) }) })
    return () => ctrl.abort()
  }, [open, token])

  const changes = state.status === 'preview' ? state.changes : []
  const allChecked = changes.length > 0 && selected.size === changes.length

  const toggle = (name: string) => setSelected((prev) => {
    const next = new Set(prev)
    if (next.has(name)) next.delete(name); else next.add(name)
    return next
  })
  const toggleAll = () => setSelected(allChecked ? new Set() : new Set(changes.map((c) => c.name)))

  const apply = async () => {
    const maps = [...selected]
    setState({ status: 'applying' })
    try {
      const res = await applyDifficultySync(token, { reason: reason.trim() || undefined, maps })
      setState({ status: 'done', count: res.count })
      onApplied()
    } catch (e) {
      setState({ status: 'error', message: errMessage(e) })
    }
  }

  const footer = state.status === 'preview' && changes.length > 0 ? (
    <div className="p-4 border-t border-border bg-muted/50 flex justify-end gap-2">
      <Button variant="outline" onClick={onClose}>Cancel</Button>
      <ActionButton tone="emerald" icon={Gauge} onClick={apply} disabled={selected.size === 0}>
        Apply {selected.size} {selected.size === 1 ? 'change' : 'changes'}
      </ActionButton>
    </div>
  ) : (
    <div className="p-4 border-t border-border bg-muted/50 flex justify-end gap-2">
      <Button variant="outline" onClick={onClose} disabled={state.status === 'applying'}>
        {state.status === 'done' || state.status === 'error' ? 'Close' : 'Cancel'}
      </Button>
    </div>
  )

  return (
    <Modal isOpen={open} onClose={state.status === 'applying' ? () => {} : onClose} title="Sync map difficulties" offsetSidebar maxWidth="44rem" footer={footer}>
      <div className="space-y-4">
        {state.status === 'loading' && (
          <div className="flex items-center justify-center gap-3 py-12 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
            <span className="text-sm">Computing review averages…</span>
          </div>
        )}

        {state.status === 'applying' && (
          <div className="flex items-center justify-center gap-3 py-12 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
            <span className="text-sm">Applying changes…</span>
          </div>
        )}

        {state.status === 'error' && (
          <div className="flex items-start gap-2.5 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-red-300">
            <AlertTriangle className="size-4 shrink-0 mt-0.5" />
            <p className="text-sm leading-relaxed">{state.message}</p>
          </div>
        )}

        {state.status === 'done' && (
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
            <CheckCircle2 className="size-10 text-emerald-400" />
            <p className="text-sm text-foreground">
              {state.count === 0
                ? 'No changes were applied.'
                : <>Updated {state.count} {state.count === 1 ? 'map' : 'maps'}.</>}
            </p>
            <p className="text-xs text-muted-foreground">Each change is recorded in the audit log and can be rolled back there.</p>
          </div>
        )}

        {state.status === 'preview' && changes.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
            <CheckCircle2 className="size-10 text-emerald-400" />
            <p className="text-sm text-foreground">All map difficulties already match their review averages.</p>
            <p className="text-xs text-muted-foreground">Nothing to sync.</p>
          </div>
        )}

        {state.status === 'preview' && changes.length > 0 && (
          <>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Each map&apos;s difficulty is set to the rounded average of its review difficulty ratings. Review the
              proposed changes, deselect any you want to skip, then apply. Every change is recorded in the audit log
              and can be rolled back.
            </p>

            <DataTableShell className="max-h-[22rem]">
              <DataTableHeaderRow>
                <DataTableHeaderCell width="3rem" align="center">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    ref={(el) => { if (el) el.indeterminate = selected.size > 0 && !allChecked }}
                    onChange={toggleAll}
                    style={{ colorScheme: 'dark' }}
                    className="size-4 accent-emerald-500 cursor-pointer align-middle"
                    aria-label="Select all"
                  />
                </DataTableHeaderCell>
                <DataTableHeaderCell align="left">Map</DataTableHeaderCell>
                <DataTableHeaderCell width="8rem" align="center">Difficulty</DataTableHeaderCell>
                <DataTableHeaderCell width="9rem" align="right">Avg (reviews)</DataTableHeaderCell>
              </DataTableHeaderRow>
              <tbody>
                {changes.map((c) => (
                  <DataTableRow key={c.name}>
                    <DataTableCell align="center">
                      <input
                        type="checkbox"
                        checked={selected.has(c.name)}
                        onChange={() => toggle(c.name)}
                        style={{ colorScheme: 'dark' }}
                        className="size-4 accent-emerald-500 cursor-pointer align-middle"
                        aria-label={`Sync ${c.name}`}
                      />
                    </DataTableCell>
                    <DataTableCell align="left">
                      <span className="font-medium text-sm text-foreground truncate">{c.name}</span>
                    </DataTableCell>
                    <DataTableCell align="center" className="tabular-nums">
                      <span className="text-muted-foreground">{c.current ?? '—'}</span>
                      <span className="text-muted-foreground/50 mx-1.5">→</span>
                      <span className="text-foreground font-medium">{c.proposed}</span>
                    </DataTableCell>
                    <DataTableCell align="right" className="tabular-nums text-muted-foreground">
                      {c.average} <span className="text-muted-foreground/50">({c.review_count})</span>
                    </DataTableCell>
                  </DataTableRow>
                ))}
              </tbody>
            </DataTableShell>

            <div className="space-y-1.5">
              {fieldLabel('Reason (optional)')}
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why are you running this sync?" className="h-9" />
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}

export function MapsManagementSection({ userProfile, onMapSelect }: AdminSectionProps) {
  const token = userProfile?.accessToken
  const PAGE = useAdminPageSize()
  const tbl = useAdminTable('utbt:admin:maps:cols:v2', MAP_COLUMNS)

  const [search, setSearch] = useNavState('admin.maps.search', '')
  const [author, setAuthor] = useNavState('admin.maps.author', '')
  const [tag, setTag] = useNavState('admin.maps.tag', '')
  const [difficulty, setDifficulty] = useNavState('admin.maps.difficulty', '')
  const [status, setStatus] = useNavState<MapStatus>('admin.maps.status', 'all')
  const [sort, setSort] = useNavState<AdminMapSort>('admin.maps.sort', 'name')
  const [order, setOrder] = useNavState<'asc' | 'desc'>('admin.maps.order', 'asc')
  const [offset, setOffset] = useNavState('admin.maps.offset', 0)
  const [expandedTags, setExpandedTags] = useNavState<string[]>('admin.maps.expandedTags', [])
  const [rows, setRows] = useState<AdminMapRow[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<AdminMapRow | null>(null)
  const [mapvoteOpen, setMapvoteOpen] = useState(false)
  const [diffSyncOpen, setDiffSyncOpen] = useState(false)
  const [allTags, setAllTags] = useState<string[]>([])
  const [mapvoteStale, setMapvoteStaleState] = useState<boolean>(() => {
    try { return localStorage.getItem(MAPVOTE_STALE_KEY) === '1' } catch { return false }
  })
  const setMapvoteStale = useCallback((v: boolean) => {
    setMapvoteStaleState(v)
    try { if (v) localStorage.setItem(MAPVOTE_STALE_KEY, '1'); else localStorage.removeItem(MAPVOTE_STALE_KEY) } catch { /* ignore */ }
  }, [])

  const loadTags = useCallback(() => {
    if (!token) return
    fetchAdminMapTags(token).then(setAllTags).catch(() => {})
  }, [token])

  useEffect(() => { loadTags() }, [loadTags])

  useResetOnChange(() => setOffset(0), [search, author, tag, difficulty, status, sort, order, PAGE])

  const load = useCallback((signal?: AbortSignal) => {
    if (!token) return
    setLoading(true); setError(null)
    const params = {
      search: search || undefined,
      author: author || undefined,
      tag: tag || undefined,
      difficulty: difficulty ? parseInt(difficulty, 10) : undefined,
      active: status === 'all' ? undefined : status === 'active',
      sort, order, limit: PAGE, offset,
    }
    fetchAdminMaps(token, params, signal)
      .then((items) => { setRows(items); setLoading(false) })
      .catch((e) => { if (!signal?.aborted) { setError(errMessage(e)); setLoading(false) } })
  }, [token, search, author, tag, difficulty, status, sort, order, offset, PAGE])

  const loadCount = useCallback((signal?: AbortSignal) => {
    if (!token) return
    const params = {
      search: search || undefined,
      author: author || undefined,
      tag: tag || undefined,
      difficulty: difficulty ? parseInt(difficulty, 10) : undefined,
      active: status === 'all' ? undefined : status === 'active',
    }
    fetchAdminMapsCount(token, params, signal)
      .then((count) => setTotal(count))
      .catch(() => { /* ignore */ })
  }, [token, search, author, tag, difficulty, status])

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

  const reload = useCallback(() => { load(); loadCount(); loadTags() }, [load, loadCount, loadTags])

  const toggleSort = (col: AdminMapSort) => {
    if (sort === col) setOrder(order === 'asc' ? 'desc' : 'asc')
    else { setSort(col); setOrder(col === 'name' ? 'asc' : 'desc') }
  }

  const toggleTags = (name: string) => {
    const set = new Set(expandedTags)
    if (set.has(name)) set.delete(name); else set.add(name)
    setExpandedTags([...set])
  }

  const filters: MapFilters = useMemo(
    () => ({ search, author, tag, difficulty, status }),
    [search, author, tag, difficulty, status],
  )
  const applyFilters = useCallback((f: MapFilters) => {
    setSearch(f.search); setAuthor(f.author); setTag(f.tag); setDifficulty(f.difficulty); setStatus(f.status)
  }, [setSearch, setAuthor, setTag, setDifficulty, setStatus])
  const resetFilters = useCallback(() => {
    setSearch(''); setAuthor(''); setTag(''); setDifficulty(''); setStatus('all')
  }, [setSearch, setAuthor, setTag, setDifficulty, setStatus])

  const presets = useAdminFilterPresets<MapFilters>({
    storageKey: 'utbt:admin:maps:filters:v1',
    current: filters,
    isDefault: (f) => !f.search && !f.author && !f.tag && !f.difficulty && f.status === 'all',
    onApply: applyFilters,
  })

  const statusLabel = STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status

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

  const renderCell = (id: string, m: AdminMapRow): ReactNode => {
    if (!isShown(id)) return null
    const align = LAYOUT[id].align
    switch (id) {
      case 'map':
        return (
          <DataTableCell key={id} align={align}>
            <div className="flex items-center gap-3 min-w-0">
              <MapThumbnail mapName={m.name} className="size-11" />
              <MapLink name={m.name} onSelect={onMapSelect} className="font-medium text-sm" />
            </div>
          </DataTableCell>
        )
      case 'author':
        return (
          <DataTableCell key={id} align={align}>
            {m.author_ref ? (
              <PlayerInfo userId={m.author_ref} alias={m.author_alias} title={null} size="sm" />
            ) : (
              <span className="text-sm text-muted-foreground truncate">{m.author_str || '—'}</span>
            )}
          </DataTableCell>
        )
      case 'difficulty':
        return <DataTableCell key={id} align={align} className="tabular-nums">{m.difficulty ?? '—'}</DataTableCell>
      case 'tags': {
        const tags = m.tags ? m.tags.split(',').map((x) => x.trim()).filter(Boolean) : []
        const expanded = expandedTags.includes(m.name)
        const shownTags = expanded ? tags : tags.slice(0, 2)
        return (
          <DataTableCell key={id} align={align}>
            {tags.length === 0 ? <span className="text-muted-foreground/40 text-xs">—</span> : (
              <div className="flex flex-wrap gap-1 items-center">
                {shownTags.map((t) => (
                  <span key={t} className="text-[11px] bg-hairline/10 border border-hairline/10 rounded px-1.5 py-0.5 text-muted-foreground">{t}</span>
                ))}
                {tags.length > 2 && (
                  <button type="button" onClick={() => toggleTags(m.name)} className="text-[11px] text-accent-300 hover:text-accent-200 cursor-pointer">
                    {expanded ? 'less' : `+${tags.length - 2}`}
                  </button>
                )}
              </div>
            )}
          </DataTableCell>
        )
      }
      case 'status':
        return (
          <DataTableCell key={id} align={align}>
            {m.active ? <span className="text-emerald-300 text-xs">Active</span> : <span className="text-muted-foreground text-xs">Inactive</span>}
          </DataTableCell>
        )
      case 'superseded':
        return (
          <DataTableCell key={id} align={align} className="truncate">
            {m.superseded_by
              ? <span className="text-xs text-muted-foreground" title={m.superseded_by}>→ {m.superseded_by}</span>
              : <span className="text-muted-foreground/40 text-xs">—</span>}
          </DataTableCell>
        )
      case 'edit':
        return (
          <DataTableCell key={id} align={align}>
            <div className="flex justify-center">
              <ActionButton tone="accent" icon={Pencil} onClick={() => setEditing(m)} title="Edit map" />
            </div>
          </DataTableCell>
        )
      default:
        return null
    }
  }

  return (
    <SectionShell
      title="Maps Management"
      icon={MapIcon}
      actions={
        <>
          <ActionButton tone="accent" icon={RefreshCw} onClick={reload} loading={loading} />
          <ActionButton tone="accent" icon={Gauge} onClick={() => setDiffSyncOpen(true)} disabled={!token}>Sync Difficulties</ActionButton>
          <ActionButton tone="accent" icon={Megaphone} onClick={() => setMapvoteOpen(true)} disabled={!token}>Mapvote</ActionButton>
          <ActionButton tone="accent" icon={Plus} disabled title="Adding maps is temporarily disabled — coming soon">Add Map</ActionButton>
        </>
      }
    >
      <Feedback message={error} tone="red" onDismiss={() => setError(null)} />

      {mapvoteStale && (
        <div className="flex items-center justify-between gap-3 flex-wrap rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          <span className="inline-flex items-center gap-2 min-w-0">
            <AlertTriangle className="size-4 shrink-0" />
            Map changes are saved to the database, but the in-game mapvote won&apos;t reflect them until it&apos;s regenerated.
          </span>
          <ActionButton tone="amber" icon={Megaphone} onClick={() => setMapvoteOpen(true)}>Regenerate mapvote</ActionButton>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search maps…" className="flex-1 min-w-48 max-w-sm" />
        <TableControls table={tbl} />
      </div>

      {presets.hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2">
          {search && <ActiveFilterChip label="Map" value={search} onClear={() => setSearch('')} />}
          {author && <ActiveFilterChip label="Author" value={author} onClear={() => setAuthor('')} />}
          {tag && <ActiveFilterChip label="Tag" value={tag} onClear={() => setTag('')} />}
          {difficulty && <ActiveFilterChip label="Difficulty" value={difficulty} onClear={() => setDifficulty('')} />}
          {status !== 'all' && <ActiveFilterChip label="Status" value={statusLabel} onClear={() => setStatus('all')} />}
        </div>
      )}

      {tbl.filtersOpen && (
        <div className="bg-card/30 border border-hairline/10 rounded-xl p-4 space-y-4">
          <FilterPanelRow label="Filters">
            <div className="flex flex-col gap-1 flex-1 min-w-40 max-w-xs">
              <span className={PANEL_LABEL}>Author</span>
              <SearchInput value={author} onChange={setAuthor} placeholder="Author…" />
            </div>
            <div className="flex flex-col gap-1">
              <span className={PANEL_LABEL}>Tag</span>
              <AdminSelect value={tag} onChange={setTag} ariaLabel="Filter by tag"
                options={[{ value: '', label: 'Any tag' }, ...allTags.map((t) => ({ value: t, label: t }))]} className="min-w-40" />
            </div>
            <div className="flex flex-col gap-1">
              <span className={PANEL_LABEL}>Difficulty</span>
              <AdminSelect value={difficulty} onChange={setDifficulty} ariaLabel="Filter by difficulty"
                options={[{ value: '', label: 'Any difficulty' }, ...DIFFICULTY_OPTIONS.map((d) => ({ value: d.value, label: `Difficulty ${d.label}` }))]} className="min-w-40" />
            </div>
            <div className="flex flex-col gap-1">
              <span className={PANEL_LABEL}>Status</span>
              <AdminSelect value={status} onChange={(v) => setStatus(v as MapStatus)} ariaLabel="Filter by status"
                options={STATUS_OPTIONS} className="min-w-32" />
            </div>
          </FilterPanelRow>
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-hairline/5">
            <FilterPresetsMenu<MapFilters>
              presets={presets.presets}
              activePreset={presets.activePreset}
              hasActiveFilters={presets.hasActiveFilters}
              onSave={presets.onSave}
              onLoad={presets.onLoad}
              onDelete={presets.onDelete}
              captureCurrentFilters={presets.captureCurrentFilters}
              onResetFilters={resetFilters}
              placeholderExample="e.g. Easy active maps"
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
            <DataTableEmpty colSpan={effectiveCount} message="No maps match these filters." />
          ) : rows.map((m) => (
            <DataTableRow key={m.name}>{tbl.columnOrder.map((id) => renderCell(id, m))}</DataTableRow>
          ))}
        </tbody>
      </DataTableShell>

      <Pager offset={offset} limit={PAGE} total={total} loading={loading}
        onPrev={() => setOffset(Math.max(0, offset - PAGE))}
        onNext={() => setOffset(offset + PAGE)} />

      {token && <MapFormModal open={adding} onClose={() => setAdding(false)} token={token} editing={null} allTags={allTags} onSaved={() => { reload(); setMapvoteStale(true) }} />}
      {token && <MapFormModal open={!!editing} onClose={() => setEditing(null)} token={token} editing={editing} allTags={allTags} onSaved={() => { reload(); setMapvoteStale(true) }} />}
      {token && <MapvoteModal open={mapvoteOpen} onClose={() => setMapvoteOpen(false)} token={token} onRegenerated={() => setMapvoteStale(false)} />}
      {token && <DifficultySyncModal open={diffSyncOpen} onClose={() => setDiffSyncOpen(false)} token={token} onApplied={() => { reload(); setMapvoteStale(true) }} />}
    </SectionShell>
  )
}
