import { Fragment, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ScrollText, RefreshCw, ChevronRight, ChevronDown, ArrowRight, Undo2 } from 'lucide-react'
import { fetchAuditLog, fetchAuditLogCount, rollbackAudit, type AuditEntry, type AuditParams } from '@/app/utils/api'
import { toActiveTitle } from '@/app/utils/api'
import type { AdminSectionProps } from '../types'
import { SectionShell } from '../components/SectionShell'
import { SearchInput, Pager, Feedback, ActionButton, AdminSelect, ConfirmDialog, Copyable, relTime, formatDateTime, errMessage } from '../components/controls'
import { useAdminTable, type AdminColumn } from '../components/useAdminTable'
import { useAdminFilterPresets } from '../components/useAdminFilterPresets'
import { TableControls } from '../components/TableControls'
import { PANEL_LABEL, useResetOnChange, useAdminPageSize } from '../components/shared'
import { MapLink } from '../components/MapLink'
import { ROLE_LABELS } from '@/app/utils/roles'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { FilterPanelRow } from '@/app/components/ui/filter-panel-row'
import { FilterPresetsMenu } from '@/app/components/shared/FilterPresetsMenu'
import { ActiveFilterChip } from '@/app/components/shared/ActiveFilterChip'
import { useNavState } from '@/app/components/navigation/useNavState'
import { NavLink } from '@/app/components/navigation/NavLink'
import { cn } from '@/lib/utils'
import {
  DataTableShell, DataTableHeaderRow, DataTableHeaderCell, DataTableRow, DataTableCell,
  DataTableEmpty, DataTableSkeletonRow, type ResponsiveColumn,
} from '@/app/components/shared/DataTable'

const ACTIONS = [
  '', 'user.ban', 'user.unban', 'user.warn', 'user.alias_change', 'user.title_assign', 'user.title_unassign',
  'title.create', 'title.update', 'title.delete', 'cap.disallow', 'cap.reallow', 'cap.verify', 'cap.unverify', 'cap.verify_demo',
  'map.create', 'map.update', 'map.difficulty_sync', 'map.author_link', 'map.author_unlink',
  'patch.create', 'patch.update', 'patch.activate', 'patch.deactivate', 'patch.delete',
  'mapvote.regenerate', 'mapvote.announcement',
  'host.create', 'host.update', 'host.servers',
  'host.token.issue', 'host.token.replace', 'host.token.revoke',
  'server.update',
  'alert.ack', 'alert.unack', 'alert.resolve',
]
const ACTION_OPTIONS = ACTIONS.map((a) => ({ value: a, label: a || 'All actions' }))

const TARGET_TYPES = ['', 'user', 'cap', 'title', 'map', 'map_author', 'patch', 'mapvote', 'game_host', 'service_token', 'public_server', 'server_alert']
const TARGET_OPTIONS = TARGET_TYPES.map((t) => ({ value: t, label: t || 'All targets' }))

const ACTORS_OPTIONS = [
  { value: 'staff', label: 'Staff actions' },
  { value: 'players', label: 'Player actions' },
  { value: 'all', label: 'Everyone' },
]

const COLUMNS: AdminColumn[] = [
  { id: 'time', label: 'Time' },
  { id: 'actor', label: 'Actor' },
  { id: 'action', label: 'Action' },
  { id: 'summary', label: 'Summary', required: true },
]

const LAYOUT: Record<string, { width?: string; align?: 'left' | 'center' | 'right' }> = {
  time: { width: '9rem', align: 'left' },
  actor: { width: '13rem', align: 'left' },
  action: { width: '11rem', align: 'left' },
  summary: { align: 'left' },
}

const CHEVRON_WIDTH = '2.75rem'
const CHEVRON_WIDTH_REM = 2.75
const SUMMARY_MIN_WIDTH_REM = 16

const PRIORITY: Record<string, number> = {
  action: 70, time: 40, actor: 40,
}

interface AuditFilters {
  search: string
  action: string
  targetType: string
  actors: string
}

interface DetailDiff { before?: unknown; after?: unknown }

function isDiffShape(d: unknown): d is DetailDiff {
  return typeof d === 'object' && d !== null && ('before' in d || 'after' in d)
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function formatValue(v: unknown): string {
  if (v === undefined) return '—'
  if (v === null) return 'null'
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return JSON.stringify(v)
}

function RawJson({ value }: { value: unknown }) {
  return (
    <pre className="bg-card/30 border border-hairline/5 rounded p-3 text-xs font-mono text-muted-foreground whitespace-pre-wrap break-words overflow-x-auto">
      {JSON.stringify(value, null, 2)}
    </pre>
  )
}

function DetailDiffView({ details }: { details: unknown }) {
  if (details == null) {
    return <p className="text-xs text-muted-foreground italic">No field changes recorded.</p>
  }

  if (isDiffShape(details)) {
    const before = details.before
    const after = details.after
    const beforeObj = isPlainObject(before) ? before : null
    const afterObj = isPlainObject(after) ? after : null

    if (beforeObj || afterObj) {
      const keys = Array.from(new Set([
        ...(beforeObj ? Object.keys(beforeObj) : []),
        ...(afterObj ? Object.keys(afterObj) : []),
      ]))
      if (keys.length === 0) {
        return <p className="text-xs text-muted-foreground italic">No field changes recorded.</p>
      }
      return (
        <div className="rounded-lg border border-hairline/5 overflow-hidden">
          {keys.map((k, i) => {
            const b = beforeObj?.[k]
            const a = afterObj?.[k]
            const changed = formatValue(b) !== formatValue(a)
            return (
              <div
                key={k}
                className={cn(
                  'grid grid-cols-[8rem_1fr] gap-x-4 gap-y-1 px-3 py-2 text-xs',
                  i > 0 && 'border-t border-hairline/5',
                  changed ? 'bg-amber-500/[0.04]' : '',
                )}
              >
                <span className="font-mono text-muted-foreground truncate" title={k}>{k}</span>
                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                  <span className={cn('font-mono truncate', changed ? 'text-red-300/80 line-through decoration-red-400/40' : 'text-muted-foreground')}>
                    {formatValue(b)}
                  </span>
                  {changed && (
                    <>
                      <ArrowRight className="size-3 text-muted-foreground/50 shrink-0" />
                      <span className="font-mono text-emerald-300 truncate">{formatValue(a)}</span>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )
    }

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <div className={PANEL_LABEL}>Before</div>
          {before === undefined ? <p className="text-xs text-muted-foreground italic">—</p> : <RawJson value={before} />}
        </div>
        <div className="space-y-1">
          <div className={PANEL_LABEL}>After</div>
          {after === undefined ? <p className="text-xs text-muted-foreground italic">—</p> : <RawJson value={after} />}
        </div>
      </div>
    )
  }

  return <RawJson value={details} />
}

function asObj(v: unknown): Record<string, unknown> | null {
  return isPlainObject(v) ? v : null
}

function detailPart(e: AuditEntry, part: 'before' | 'after'): Record<string, unknown> | null {
  const d = asObj(e.details)
  return d ? asObj(d[part]) : null
}

function openCap(id: string) { window.dispatchEvent(new CustomEvent('open-cap', { detail: { capId: id } })) }

function PlayerRef({ id, alias }: { id?: string | null; alias?: string | null }) {
  if (!id) return <span className="font-medium text-foreground">{alias || 'unknown user'}</span>
  return (
    <span className="inline-flex align-middle" onClick={(ev) => ev.stopPropagation()}>
      <PlayerInfo userId={id} alias={alias ?? undefined} size="sm" />
    </span>
  )
}

function CapRef({ id }: { id?: string | null }) {
  if (!id) return <span className="text-muted-foreground">a cap</span>
  return (
    <span>cap <NavLink view="cap-detail" params={{ capId: String(id) }} onActivate={() => openCap(id)}
      className="font-mono text-xs text-accent-300 cursor-pointer hover:underline decoration-dotted underline-offset-2">{String(id).slice(0, 8)}</NavLink></span>
  )
}

function MapRef({ name, onMapSelect }: { name?: string | null; onMapSelect?: (mapName: string) => void }) {
  if (!name) return <span className="text-muted-foreground">a map</span>
  return <MapLink name={name} onSelect={onMapSelect} className="font-medium text-accent-300 hover:underline decoration-dotted underline-offset-2 inline" />
}

function TitleRef({ id, name }: { id?: string | null; name?: string | null }) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="font-medium text-foreground">{name || (id != null ? `#${id}` : 'title')}</span>
      {name && id != null && <span className="text-muted-foreground/60 text-xs">({id})</span>}
    </span>
  )
}

function minutesLabel(min: unknown): string {
  const m = Number(min)
  if (!Number.isFinite(m) || m <= 0) return ''
  if (m >= 52560000) return 'permanently'
  if (m / 1440 >= 365) { const y = Math.round(m / 525600); return `for ${y} year${y === 1 ? '' : 's'}` }
  const days = Math.round(m / 1440)
  if (days >= 1) return `for ${days} day${days === 1 ? '' : 's'}`
  const hours = Math.round(m / 60)
  if (hours >= 1) return `for ${hours} hour${hours === 1 ? '' : 's'}`
  const mins = Math.round(m)
  return `for ${mins} minute${mins === 1 ? '' : 's'}`
}

function targetRef(e: AuditEntry, onMapSelect?: (mapName: string) => void): ReactNode {
  switch (e.target_type) {
    case 'user': return <PlayerRef id={e.target_id} alias={e.target_alias} />
    case 'cap': return <CapRef id={e.target_id} />
    case 'map': return <MapRef name={e.target_id} onMapSelect={onMapSelect} />
    case 'title': {
      const name = (detailPart(e, 'after')?.name ?? detailPart(e, 'before')?.name) as string | undefined
      return <TitleRef id={e.target_id} name={name} />
    }
    default: return <span className="text-muted-foreground">{e.target_id || '—'}</span>
  }
}

function AuditDescription({ e, onMapSelect }: { e: AuditEntry; onMapSelect?: (mapName: string) => void }) {
  const after = detailPart(e, 'after')
  const before = detailPart(e, 'before')
  switch (e.action) {
    case 'user.ban': {
      const len = minutesLabel(after?.length_minutes)
      const targets = Array.isArray(after?.targets) ? (after!.targets as unknown[]).join('/') : null
      return <span>Banned <PlayerRef id={e.target_id} alias={e.target_alias} /> {len}{targets ? <span className="text-muted-foreground/60"> · {targets}</span> : null}</span>
    }
    case 'user.unban': return <span>Removed ban on <PlayerRef id={e.target_id} alias={e.target_alias} /></span>
    case 'user.warn': return <span>Warned <PlayerRef id={e.target_id} alias={e.target_alias} /></span>
    case 'user.alias_change': return <span>Renamed <PlayerRef id={e.target_id} alias={e.target_alias} /> <span className="text-muted-foreground/70 font-mono text-xs">{String(before?.alias ?? '?')} → {String(after?.alias ?? '?')}</span></span>
    case 'user.title_assign': return <span>Assigned title <TitleRef id={after?.title_id as string} name={after?.title_name as string} /> to <PlayerRef id={e.target_id} alias={e.target_alias} /></span>
    case 'user.title_unassign': return <span>Removed title <TitleRef id={before?.title_id as string} name={before?.title_name as string} /> from <PlayerRef id={e.target_id} alias={e.target_alias} /></span>
    case 'title.create': return <span>Created title {targetRef(e, onMapSelect)}</span>
    case 'title.delete': return <span>Deleted title {targetRef(e, onMapSelect)}</span>
    case 'title.update': return <span>Updated title {targetRef(e, onMapSelect)}</span>
    case 'cap.disallow': return <span>Disallowed {targetRef(e, onMapSelect)}</span>
    case 'cap.reallow': return <span>Reallowed {targetRef(e, onMapSelect)}</span>
    case 'cap.verify': return <span>Verified {targetRef(e, onMapSelect)} <span className="text-muted-foreground/60">(manual)</span></span>
    case 'cap.unverify': return <span>Unverified {targetRef(e, onMapSelect)}</span>
    case 'cap.verify_demo': return <span>Verified {targetRef(e, onMapSelect)} <span className="text-muted-foreground/60">via demo</span></span>
    case 'map.create': return <span>Created map {targetRef(e, onMapSelect)}</span>
    case 'map.update': return <span>Updated map {targetRef(e, onMapSelect)}</span>
    case 'map.difficulty_sync':
      return <span>Synced difficulty of {targetRef(e, onMapSelect)} <span className="text-muted-foreground/70 font-mono text-xs">{String(before?.difficulty ?? '—')} → {String(after?.difficulty ?? '—')}</span></span>
    case 'map.author_link': {
      const maps = Array.isArray(after?.maps) ? (after!.maps as unknown[]).length : 0
      return <span>Linked author <span className="font-mono text-xs">{String(before?.author_str ?? e.target_id)}</span> to <PlayerRef id={after?.author_ref as string} alias={after?.alias as string} /> <span className="text-muted-foreground/60">· {maps} {maps === 1 ? 'map' : 'maps'}</span></span>
    }
    case 'map.author_unlink': {
      const maps = Array.isArray(after?.maps) ? (after!.maps as unknown[]).length : 0
      return <span>Unlinked <PlayerRef id={before?.author_ref as string} alias={before?.alias as string} /> from <span className="font-mono text-xs">{String(after?.author_str ?? e.target_id)}</span> <span className="text-muted-foreground/60">· {maps} {maps === 1 ? 'map' : 'maps'}</span></span>
    }
    default: return <span>{e.summary || e.action}</span>
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1 min-w-0">
      <div className={PANEL_LABEL}>{label}</div>
      <div className="text-sm text-foreground break-words">{children}</div>
    </div>
  )
}

function ExpandedDetail({ e, onRollback, busy, onMapSelect }: { e: AuditEntry; onRollback: (e: AuditEntry) => void; busy: boolean; onMapSelect?: (mapName: string) => void }) {
  const role = ROLE_LABELS[e.actor_role]
  return (
    <div className="bg-card/30 border border-hairline/5 rounded-xl p-5 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="text-sm text-foreground"><AuditDescription e={e} onMapSelect={onMapSelect} /></div>
        {e.can_rollback && (
          <div className="shrink-0">
            <ActionButton tone="amber" icon={Undo2} loading={busy} onClick={() => onRollback(e)}>
              Roll back
            </ActionButton>
          </div>
        )}
      </div>
      {e.reverts && (
        <p className="flex items-center gap-2 text-xs text-amber-300/90 bg-amber-500/[0.06] border border-amber-500/15 rounded-lg px-3 py-2">
          <Undo2 className="size-3.5 shrink-0" /> This entry is itself a rollback — it can&apos;t be undone.
        </p>
      )}
      {e.reverted && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground bg-card/40 border border-hairline/10 rounded-lg px-3 py-2">
          <Undo2 className="size-3.5 shrink-0" /> This action was rolled back by a later audit entry.
        </p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
        <Field label="Timestamp">
          <span className="tabular-nums">{formatDateTime(e.created_at) || '—'}</span>
        </Field>
        <Field label="Actor">
          <div className="flex items-center gap-2">
            {e.actor_id ? (
              <PlayerInfo userId={e.actor_id} alias={e.actor_alias ?? undefined} title={toActiveTitle(e.actor_title)} size="sm" />
            ) : (
              <span className="text-muted-foreground">{e.actor_alias || e.actor_id || 'System'}</span>
            )}
            {role && (
              <span className={cn('shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide', role.className)}>
                {role.label}
              </span>
            )}
          </div>
        </Field>
        <Field label="Action">
          <span className="font-mono text-xs text-muted-foreground">{e.action}</span>
        </Field>
        <Field label="Target">
          {e.target_type || e.target_id ? (
            <div className="flex items-center gap-2 flex-wrap">
              {e.target_type && <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">{e.target_type}</span>}
              {targetRef(e, onMapSelect)}
              {e.target_id != null && <Copyable value={String(e.target_id)} />}
            </div>
          ) : <span className="text-muted-foreground">—</span>}
        </Field>
        <Field label="IP Address">
          {e.ip ? <Copyable value={e.ip} /> : <span className="text-muted-foreground">—</span>}
        </Field>
        <Field label="Reason">
          {e.reason ? <Copyable value={e.reason} mono={false} className="w-full" /> : <span className="text-muted-foreground italic">None given</span>}
        </Field>
      </div>

      <div className="space-y-2">
        <div className={PANEL_LABEL}>Changes</div>
        <DetailDiffView details={e.details} />
      </div>
    </div>
  )
}

export function AuditLogsSection({ userProfile, onMapSelect, onNavigate }: AdminSectionProps) {
  void onNavigate
  const token = userProfile?.accessToken
  const PAGE = useAdminPageSize()
  const tbl = useAdminTable('utbt:admin:audit:cols:v2', COLUMNS)
  const [search, setSearch] = useNavState('admin.audit.search', '')
  const [action, setAction] = useNavState('admin.audit.action', '')
  const [targetType, setTargetType] = useNavState('admin.audit.targetType', '')
  const [actors, setActors] = useNavState('admin.audit.actors', 'staff')
  const [offset, setOffset] = useNavState('admin.audit.offset', 0)
  const [expanded, setExpanded] = useNavState<string | null>('admin.audit.expanded', null)
  const [rows, setRows] = useState<AuditEntry[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rollbackTarget, setRollbackTarget] = useState<AuditEntry | null>(null)
  const [rollbackBusy, setRollbackBusy] = useState(false)

  useResetOnChange(() => setOffset(0), [search, action, targetType, actors, PAGE])

  useEffect(() => { setExpanded(null) }, [search, action, targetType, actors, offset, setExpanded])

  const load = useCallback((signal?: AbortSignal) => {
    if (!token) return
    setLoading(true)
    setError(null)
    const params = { search: search || undefined, action: action || undefined, targetType: targetType || undefined, actors: actors as AuditParams['actors'], limit: PAGE, offset }
    fetchAuditLog(token, params, signal)
      .then((items) => { setRows(items); setLoading(false) })
      .catch((e) => { if (!signal?.aborted) { setError(errMessage(e)); setLoading(false) } })
  }, [token, search, action, targetType, actors, offset, PAGE])

  const loadCount = useCallback((signal?: AbortSignal) => {
    if (!token) return
    const params = { search: search || undefined, action: action || undefined, targetType: targetType || undefined, actors: actors as AuditParams['actors'] }
    fetchAuditLogCount(token, params, signal)
      .then((count) => setTotal(count))
      .catch(() => { /* ignore */ })
  }, [token, search, action, targetType, actors])

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

  const toggle = (id: string) => setExpanded(expanded === id ? null : id)

  const filters: AuditFilters = useMemo(
    () => ({ search, action, targetType, actors }),
    [search, action, targetType, actors],
  )
  const applyFilters = useCallback((f: AuditFilters) => {
    setSearch(f.search); setAction(f.action); setTargetType(f.targetType); setActors(f.actors || 'staff')
  }, [setSearch, setAction, setTargetType, setActors])
  const resetFilters = useCallback(() => {
    setSearch(''); setAction(''); setTargetType(''); setActors('staff')
  }, [setSearch, setAction, setTargetType, setActors])

  const presets = useAdminFilterPresets<AuditFilters>({
    storageKey: 'utbt:admin:audit:filters:v1',
    current: filters,
    isDefault: (f) => !f.search && !f.action && !f.targetType && (!f.actors || f.actors === 'staff'),
    onApply: applyFilters,
  })

  const actionLabel = ACTION_OPTIONS.find((o) => o.value === action)?.label ?? action
  const targetLabel = TARGET_OPTIONS.find((o) => o.value === targetType)?.label ?? targetType
  const actorsLabel = ACTORS_OPTIONS.find((o) => o.value === actors)?.label ?? actors

  const doRollback = useCallback(async () => {
    if (!token || !rollbackTarget) return
    setRollbackBusy(true)
    setError(null)
    try {
      await rollbackAudit(token, rollbackTarget.id)
      setRollbackTarget(null)
      reload()
    } catch (e) {
      setError(errMessage(e))
    } finally {
      setRollbackBusy(false)
    }
  }, [token, rollbackTarget, reload])

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
    return <DataTableHeaderCell key={id} width={layout?.width} align={layout?.align}>{tbl.columnLabels[id]}</DataTableHeaderCell>
  }

  const renderCell = (id: string, e: AuditEntry): ReactNode => {
    if (!isShown(id)) return null
    const align = LAYOUT[id]?.align
    switch (id) {
      case 'time':
        return (
          <DataTableCell key={id} align={align} className="text-muted-foreground text-xs whitespace-nowrap" title={e.created_at ?? ''}>
            {relTime(e.created_at)}
          </DataTableCell>
        )
      case 'actor':
        return (
          <DataTableCell key={id} align={align} className="truncate">
            {e.actor_id ? (
              <PlayerInfo userId={e.actor_id} alias={e.actor_alias ?? undefined} title={toActiveTitle(e.actor_title)} size="sm" />
            ) : (
              <span className="font-medium text-muted-foreground">{e.actor_alias || e.actor_id || 'System'}</span>
            )}
          </DataTableCell>
        )
      case 'action':
        return <DataTableCell key={id} align={align}><span className="font-mono text-xs text-muted-foreground">{e.action}</span></DataTableCell>
      case 'summary':
        return (
          <DataTableCell key={id} align={align} className="text-sm" title={e.summary || ''}>
            <span className="inline-flex items-center gap-2 flex-wrap">
              <AuditDescription e={e} onMapSelect={onMapSelect} />
              {e.reverts && (
                <span className="inline-flex items-center gap-1 rounded border border-amber-500/20 bg-amber-500/[0.08] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-300">
                  <Undo2 className="size-3" /> Rollback
                </span>
              )}
              {e.reverted && (
                <span className="rounded border border-hairline/15 bg-card/40 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Rolled back
                </span>
              )}
            </span>
          </DataTableCell>
        )
      default:
        return null
    }
  }

  return (
    <SectionShell
      title="Audit Logs"
      icon={ScrollText}
      actions={<ActionButton tone="accent" icon={RefreshCw} onClick={() => reload()} loading={loading}>Refresh</ActionButton>}
    >
      <Feedback message={error} tone="red" onDismiss={() => setError(null)} />

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search summary…" className="flex-1 min-w-48 max-w-sm" />
        <TableControls table={tbl} />
      </div>

      {presets.hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2">
          {search && <ActiveFilterChip label="Search" value={search} onClear={() => setSearch('')} />}
          {action && <ActiveFilterChip label="Action" value={actionLabel} onClear={() => setAction('')} />}
          {targetType && <ActiveFilterChip label="Target" value={targetLabel} onClear={() => setTargetType('')} />}
          {actors !== 'staff' && <ActiveFilterChip label="Actors" value={actorsLabel} onClear={() => setActors('staff')} />}
        </div>
      )}

      {tbl.filtersOpen && (
        <div className="bg-card/30 border border-hairline/10 rounded-xl p-4 space-y-4">
          <FilterPanelRow label="Filters">
            <div className="flex flex-col gap-1">
              <span className={PANEL_LABEL}>Action</span>
              <AdminSelect value={action} onChange={setAction} options={ACTION_OPTIONS} ariaLabel="Filter by action" className="min-w-44" />
            </div>
            <div className="flex flex-col gap-1">
              <span className={PANEL_LABEL}>Target</span>
              <AdminSelect value={targetType} onChange={setTargetType} options={TARGET_OPTIONS} ariaLabel="Filter by target type" className="min-w-36" />
            </div>
            <div className="flex flex-col gap-1">
              <span className={PANEL_LABEL}>Actors</span>
              <AdminSelect value={actors} onChange={setActors} options={ACTORS_OPTIONS} ariaLabel="Filter by actor kind" className="min-w-36" />
            </div>
          </FilterPanelRow>
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-hairline/5">
            <FilterPresetsMenu<AuditFilters>
              presets={presets.presets}
              activePreset={presets.activePreset}
              hasActiveFilters={presets.hasActiveFilters}
              onSave={presets.onSave}
              onLoad={presets.onLoad}
              onDelete={presets.onDelete}
              captureCurrentFilters={presets.captureCurrentFilters}
              onResetFilters={resetFilters}
              placeholderExample="e.g. Bans this month"
            />
          </div>
        </div>
      )}

      <DataTableShell className="flex-none" responsive={{ columns: responsiveColumns, nameFloorRem: SUMMARY_MIN_WIDTH_REM, extraRem: CHEVRON_WIDTH_REM, onResolve: handleResolve }}>
        <DataTableHeaderRow>
          <DataTableHeaderCell width={CHEVRON_WIDTH}> </DataTableHeaderCell>
          {tbl.columnOrder.map((id) => renderHeader(id))}
        </DataTableHeaderRow>
        <tbody>
          {loading && rows.length === 0 ? (
            Array.from({ length: 8 }).map((_, i) => <DataTableSkeletonRow key={i} columnCount={effectiveCount + 1} />)
          ) : rows.length === 0 ? (
            <DataTableEmpty colSpan={effectiveCount + 1} message="No audit entries match these filters." />
          ) : rows.map((e) => {
            const open = expanded === e.id
            return (
              <Fragment key={e.id}>
                <DataTableRow
                  onClick={() => toggle(e.id)}
                  className={cn('cursor-pointer', open && 'bg-hairline/[0.04]')}
                >
                  <DataTableCell align="center" className="text-muted-foreground">
                    {open ? <ChevronDown className="size-4 inline" /> : <ChevronRight className="size-4 inline" />}
                  </DataTableCell>
                  {tbl.columnOrder.map((id) => renderCell(id, e))}
                </DataTableRow>
                {open && (
                  <tr className="border-b border-hairline/5 bg-hairline/[0.02]">
                    <td colSpan={effectiveCount + 1} className="px-4 py-4">
                      <ExpandedDetail e={e} onRollback={setRollbackTarget} busy={rollbackBusy && rollbackTarget?.id === e.id} onMapSelect={onMapSelect} />
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </DataTableShell>

      <Pager offset={offset} limit={PAGE} total={total} loading={loading}
        onPrev={() => setOffset(Math.max(0, offset - PAGE))}
        onNext={() => setOffset(offset + PAGE)} />

      <ConfirmDialog
        open={!!rollbackTarget}
        title="Roll back this action?"
        tone="accent"
        confirmLabel="Roll back"
        busy={rollbackBusy}
        onCancel={() => setRollbackTarget(null)}
        onConfirm={doRollback}
        message={rollbackTarget ? (
          <div className="space-y-2">
            <p>This reverses the action and records a new, non-reversible audit entry:</p>
            <div className="rounded-lg border border-hairline/10 bg-card/40 px-3 py-2 text-sm">
              <AuditDescription e={rollbackTarget} onMapSelect={onMapSelect} />
            </div>
            <p className="text-xs text-muted-foreground">The original entry will be marked as rolled back. This rollback itself can&apos;t be undone.</p>
          </div>
        ) : ''}
      />
    </SectionShell>
  )
}
