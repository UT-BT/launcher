import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Newspaper, Plus, Pencil, Trash2, RefreshCw, Power, PowerOff, Pin, Tags, ArrowLeft } from 'lucide-react'
import {
  fetchAdminNews, createNews, updateNews, setNewsActive, deleteNews,
  fetchAdminNewsCategories, createNewsCategory, updateNewsCategory, deleteNewsCategory,
  type AdminNews, type NewsArticle, type AdminNewsCategory, type CreateNewsInput,
} from '@/app/utils/api'
import { cn } from '@/lib/utils'
import type { AdminSectionProps } from '../types'
import { SectionShell } from '../components/SectionShell'
import { SearchInput, Feedback, ActionButton, AdminSelect, ConfirmDialog, relTime, errMessage } from '../components/controls'
import { PANEL_LABEL } from '../components/shared'
import { Modal } from '@/app/components/ui/modal'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { useNavState } from '@/app/components/navigation/useNavState'
import {
  DataTableShell, DataTableHeaderRow, DataTableHeaderCell, DataTableRow, DataTableCell,
  DataTableEmpty, DataTableSkeletonRow, type ResponsiveColumn,
} from '@/app/components/shared/DataTable'
import { ArticleCard, CategoryChip } from '@/app/components/pages/home/news/NewsCard'
import { MarkdownBody } from '@/app/components/shared/MarkdownBody'
import { NEWS_ICON_NAMES, getNewsIcon } from '@/app/components/pages/home/news/icons'

type StatusFilter = 'all' | 'live' | 'scheduled' | 'inactive'

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Any status' },
  { value: 'live', label: 'Live' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'inactive', label: 'Inactive' },
]

const NEWS_COLUMNS: ResponsiveColumn[] = [
  { id: 'category', width: '11rem', priority: 30 },
  { id: 'title', required: true },
  { id: 'status', width: '6rem', priority: 60 },
  { id: 'pinned', width: '5rem', priority: 30 },
  { id: 'published', width: '8rem', priority: 30 },
  { id: 'expires', width: '8rem', priority: 30 },
  { id: 'actions', width: '9rem', required: true },
]

const TEXTAREA_CLASS = 'flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'

function fieldLabel(text: string) {
  return <label className={PANEL_LABEL}>{text}</label>
}

function isoToLocalInput(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function localInputToIso(value: string): string | null {
  if (!value) return null
  const d = new Date(value)
  if (isNaN(d.getTime())) return null
  return d.toISOString()
}

function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim())
  if (!m) return { r: 148, g: 163, b: 184 }
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) }
}

function statusOf(item: AdminNews): { label: string; tone: string } {
  const now = Date.now()
  if (!item.active) return { label: 'Inactive', tone: 'text-muted-foreground' }
  if (item.publishedAt && Date.parse(item.publishedAt) > now) return { label: 'Scheduled', tone: 'text-blue-300' }
  if (item.expiresAt && Date.parse(item.expiresAt) <= now) return { label: 'Expired', tone: 'text-amber-300' }
  return { label: 'Live', tone: 'text-emerald-300' }
}

/* ── Category manager ─────────────────────────────────────────────────── */

type CatForm = { label: string; color: string; icon: string }
const EMPTY_CAT: CatForm = { label: '', color: '#94a3b8', icon: 'Newspaper' }

function CategoriesModal({ open, onClose, token, categories, onChanged }: {
  open: boolean
  onClose: () => void
  token: string
  categories: AdminNewsCategory[]
  onChanged: () => void
}) {
  const [mode, setMode] = useState<'list' | 'form'>('list')
  const [editing, setEditing] = useState<AdminNewsCategory | null>(null)
  const [form, setForm] = useState<CatForm>(EMPTY_CAT)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AdminNewsCategory | null>(null)

  useEffect(() => {
    if (!open) { setMode('list'); setEditing(null); setError(null) }
  }, [open])

  const startAdd = () => { setEditing(null); setForm(EMPTY_CAT); setError(null); setMode('form') }
  const startEdit = (c: AdminNewsCategory) => {
    setEditing(c); setForm({ label: c.label, color: rgbToHex(c.colorR, c.colorG, c.colorB), icon: c.icon }); setError(null); setMode('form')
  }

  const save = async () => {
    setBusy(true); setError(null)
    try {
      const { r, g, b } = hexToRgb(form.color)
      if (editing) {
        await updateNewsCategory(token, editing.id, { label: form.label.trim(), color_r: r, color_g: g, color_b: b, icon: form.icon })
      } else {
        await createNewsCategory(token, { label: form.label.trim(), color_r: r, color_g: g, color_b: b, icon: form.icon })
      }
      onChanged(); setMode('list')
    } catch (e) { setError(errMessage(e)) } finally { setBusy(false) }
  }

  const doDelete = async () => {
    if (!deleteTarget) return
    setBusy(true); setError(null)
    try {
      await deleteNewsCategory(token, deleteTarget.id)
      setDeleteTarget(null); onChanged()
    } catch (e) { setError(errMessage(e)); setDeleteTarget(null) } finally { setBusy(false) }
  }

  const rgb = hexToRgb(form.color)
  const previewCat: AdminNewsCategory = {
    id: 0, key: '', label: form.label.trim() || 'Category', colorR: rgb.r, colorG: rgb.g, colorB: rgb.b, icon: form.icon, sortOrder: 0, inUse: 0,
  }

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={mode === 'form' ? (editing ? `Edit category — ${editing.label}` : 'New category') : 'News categories'}
      offsetSidebar
      maxWidth="34rem"
      footer={
        <div className="p-4 border-t border-border bg-muted/50 flex justify-between gap-2">
          {mode === 'form'
            ? <Button variant="outline" onClick={() => setMode('list')} disabled={busy}><ArrowLeft className="size-4" /> Back</Button>
            : <span />}
          {mode === 'form'
            ? <Button onClick={save} disabled={busy || !form.label.trim()}>{busy ? 'Saving…' : editing ? 'Save' : 'Create'}</Button>
            : <Button onClick={startAdd}><Plus className="size-4" /> New category</Button>}
        </div>
      }
    >
      <Feedback message={error} tone="red" onDismiss={() => setError(null)} />

      {mode === 'list' ? (
        <div className="space-y-2">
          {categories.length === 0 && <p className="text-sm text-muted-foreground">No categories yet.</p>}
          {categories.map(c => (
            <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg border border-hairline/5 bg-card/30 px-3 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <CategoryChip category={c} />
                <span className="text-xs text-muted-foreground tabular-nums">{c.inUse} item{c.inUse === 1 ? '' : 's'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <ActionButton tone="accent" icon={Pencil} onClick={() => startEdit(c)} title="Edit" />
                <ActionButton tone="red" icon={Trash2} onClick={() => setDeleteTarget(c)} title="Delete" disabled={c.inUse > 0} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-1.5">
            {fieldLabel('Name')}
            <Input value={form.label} onChange={(e) => setForm(f => ({ ...f, label: e.target.value }))} placeholder="Tournament" className="h-9" />
          </div>

          <div className="flex items-end gap-4">
            <div className="space-y-1.5">
              {fieldLabel('Colour')}
              <input type="color" value={form.color} onChange={(e) => setForm(f => ({ ...f, color: e.target.value }))} style={{ colorScheme: 'dark' }} className="h-9 w-16 rounded-md border border-input bg-background cursor-pointer" />
            </div>
            <div className="space-y-1.5">
              {fieldLabel('Preview')}
              <CategoryChip category={previewCat} />
            </div>
          </div>

          <div className="space-y-1.5">
            {fieldLabel('Icon')}
            <div className="grid grid-cols-8 gap-1.5">
              {NEWS_ICON_NAMES.map(name => {
                const Icon = getNewsIcon(name)
                const selected = form.icon === name
                return (
                  <button
                    key={name}
                    type="button"
                    title={name}
                    onClick={() => setForm(f => ({ ...f, icon: name }))}
                    className={cn(
                      'flex items-center justify-center h-8 rounded-md border transition-colors cursor-pointer',
                      selected ? 'bg-accent-500/20 border-accent-500/50 text-accent-200' : 'bg-card/30 border-hairline/5 text-muted-foreground hover:text-foreground hover:border-hairline/15',
                    )}
                  >
                    <Icon className="size-4" />
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete this category?"
        tone="red"
        confirmLabel="Delete"
        busy={busy}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={doDelete}
        message={deleteTarget && <span>Delete category <span className="font-medium text-foreground">{deleteTarget.label}</span>. This cannot be undone.</span>}
      />
    </Modal>
  )
}

/* ── News form ────────────────────────────────────────────────────────── */

type NewsForm = {
  category: string
  title: string
  excerpt: string
  body: string
  linkUrl: string
  linkText: string
  pinned: boolean
  active: boolean
  publishedAt: string
  expiresAt: string
}

function emptyForm(defaultCategory: string): NewsForm {
  return {
    category: defaultCategory, title: '', excerpt: '', body: '', linkUrl: '', linkText: '',
    pinned: false, active: true, publishedAt: '', expiresAt: '',
  }
}

function NewsFormModal({ open, onClose, token, editing, categories, onSaved }: {
  open: boolean
  onClose: () => void
  token: string
  editing: AdminNews | null
  categories: AdminNewsCategory[]
  onSaved: () => void
}) {
  const isEdit = !!editing
  const defaultCategory = categories[0]?.key ?? ''
  const [form, setForm] = useState<NewsForm>(emptyForm(defaultCategory))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null); setBusy(false)
    if (editing) {
      setForm({
        category: editing.category,
        title: editing.title,
        excerpt: editing.excerpt,
        body: editing.body,
        linkUrl: editing.linkUrl ?? '',
        linkText: editing.linkText ?? '',
        pinned: editing.pinned,
        active: editing.active,
        publishedAt: isoToLocalInput(editing.publishedAt),
        expiresAt: isoToLocalInput(editing.expiresAt),
      })
    } else {
      setForm(emptyForm(defaultCategory))
    }
  }, [open, editing, defaultCategory])

  const set = <K extends keyof NewsForm>(key: K, value: NewsForm[K]) => setForm((f) => ({ ...f, [key]: value }))

  const blocked = busy || !form.category || !form.title.trim() || !form.excerpt.trim() || !form.body.trim()

  const submit = async () => {
    setBusy(true); setError(null)
    try {
      const payload: CreateNewsInput = {
        category: form.category,
        title: form.title.trim(),
        excerpt: form.excerpt.trim(),
        body: form.body.trim(),
        link_url: form.linkUrl.trim() || null,
        link_text: form.linkText.trim() || null,
        pinned: form.pinned,
        active: form.active,
        published_at: localInputToIso(form.publishedAt),
        expires_at: localInputToIso(form.expiresAt),
      }
      if (isEdit && editing) await updateNews(token, editing.id, payload)
      else await createNews(token, payload)
      onSaved(); onClose()
    } catch (e) {
      setError(errMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const categoryDef = categories.find(c => c.key === form.category) ?? null

  const previewArticle: NewsArticle = {
    id: editing?.id ?? 0,
    category: form.category,
    title: form.title.trim() || 'Untitled news',
    excerpt: form.excerpt.trim() || 'Excerpt preview…',
    body: form.body,
    linkUrl: form.linkUrl.trim() || null,
    linkText: form.linkText.trim() || null,
    pinned: form.pinned,
    publishedAt: localInputToIso(form.publishedAt) || new Date().toISOString(),
    expiresAt: localInputToIso(form.expiresAt),
    authorAlias: editing?.authorAlias ?? null,
  }

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={isEdit ? `Edit news — ${editing?.title}` : 'Post news'}
      offsetSidebar
      maxWidth="60rem"
      footer={
        <div className="p-4 border-t border-border bg-muted/50 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={blocked}>{busy ? 'Saving…' : isEdit ? 'Save changes' : 'Publish news'}</Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="space-y-4">
          <Feedback message={error} tone="red" onDismiss={() => setError(null)} />

          <div className="space-y-1.5">
            {fieldLabel('Category')}
            {categories.length === 0
              ? <p className="text-xs text-amber-300">No categories yet — create one first via “Categories”.</p>
              : <AdminSelect value={form.category} onChange={(v) => set('category', v)} options={categories.map(c => ({ value: c.key, label: c.label }))} ariaLabel="Category" className="w-full" />}
          </div>

          <div className="space-y-1.5">
            {fieldLabel('Title')}
            <Input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="World Cup 2026 sign-ups are open" className="h-9" />
          </div>

          <div className="space-y-1.5">
            {fieldLabel('Excerpt (card teaser)')}
            <textarea value={form.excerpt} onChange={(e) => set('excerpt', e.target.value)} rows={2} placeholder="One or two sentences shown on the card." className={TEXTAREA_CLASS} />
          </div>

          <div className="space-y-1.5">
            {fieldLabel('Body (markdown)')}
            <textarea value={form.body} onChange={(e) => set('body', e.target.value)} rows={10} placeholder={'Full article. **Markdown** supported:\n\n- bullet points\n- [links](https://utbt.net)'} className={cn(TEXTAREA_CLASS, 'font-mono text-xs')} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              {fieldLabel('External link URL (optional)')}
              <Input value={form.linkUrl} onChange={(e) => set('linkUrl', e.target.value)} placeholder="https://discord.gg/…" className="h-9 font-mono text-xs" />
            </div>
            <div className="space-y-1.5">
              {fieldLabel('Link button text')}
              <Input value={form.linkText} onChange={(e) => set('linkText', e.target.value)} placeholder="Sign up" className="h-9" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              {fieldLabel('Publish at (blank = now)')}
              <Input type="datetime-local" value={form.publishedAt} onChange={(e) => set('publishedAt', e.target.value)} style={{ colorScheme: 'dark' }} className="h-9" />
            </div>
            <div className="space-y-1.5">
              {fieldLabel('Expires at (optional)')}
              <Input type="datetime-local" value={form.expiresAt} onChange={(e) => set('expiresAt', e.target.value)} style={{ colorScheme: 'dark' }} className="h-9" />
            </div>
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={form.pinned} onChange={(e) => set('pinned', e.target.checked)} style={{ colorScheme: 'dark' }} className="size-4 accent-accent-500 cursor-pointer" />
              <span className="text-sm text-foreground">Pinned</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={form.active} onChange={(e) => set('active', e.target.checked)} style={{ colorScheme: 'dark' }} className="size-4 accent-emerald-500 cursor-pointer" />
              <span className="text-sm text-foreground">{form.active ? 'Active' : 'Inactive'}</span>
            </label>
          </div>
        </div>

        <div className="space-y-4 lg:border-l lg:border-hairline/10 lg:pl-5">
          <div className="space-y-2">
            <span className={PANEL_LABEL}>Homepage card — exactly what users see</span>
            <div onClickCapture={(e) => { e.stopPropagation(); e.preventDefault() }}>
              <ArticleCard article={previewArticle} category={categoryDef} />
            </div>
          </div>
          <div className="space-y-2">
            <span className={PANEL_LABEL}>Article page</span>
            <div className="rounded-xl border border-hairline/5 bg-card/30 p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <CategoryChip category={categoryDef} />
              </div>
              <p className="text-lg font-black text-foreground leading-tight">{previewArticle.title}</p>
              {form.body.trim()
                ? <MarkdownBody className="text-sm">{form.body}</MarkdownBody>
                : <p className="text-sm text-muted-foreground italic">Body preview appears here.</p>}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}

/* ── Section ──────────────────────────────────────────────────────────── */

export function NewsManagementSection({ userProfile }: AdminSectionProps) {
  const token = userProfile?.accessToken

  const [rows, setRows] = useState<AdminNews[]>([])
  const [categories, setCategories] = useState<AdminNewsCategory[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useNavState('admin.news.search', '')
  const [category, setCategory] = useNavState('admin.news.category', '')
  const [status, setStatus] = useNavState<StatusFilter>('admin.news.status', 'all')

  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<AdminNews | null>(null)
  const [catsOpen, setCatsOpen] = useState(false)
  const [toggleTarget, setToggleTarget] = useState<AdminNews | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AdminNews | null>(null)
  const [actionBusy, setActionBusy] = useState(false)
  const [resolved, setResolved] = useState<Set<string> | null>(null)
  const handleResolve = useCallback((ids: Set<string>) => { setResolved(ids) }, [])
  const isShown = useCallback((id: string) => !resolved || resolved.has(id), [resolved])
  const effectiveCount = NEWS_COLUMNS.filter((c) => isShown(c.id)).length

  const loadCategories = useCallback((signal?: AbortSignal) => {
    if (!token) return
    fetchAdminNewsCategories(token, signal)
      .then(setCategories)
      .catch((e) => { if (!signal?.aborted) setError(errMessage(e)) })
  }, [token])

  const load = useCallback((signal?: AbortSignal) => {
    if (!token) return
    setLoading(true); setError(null)
    fetchAdminNews(token, signal)
      .then((items) => { setRows(items); setLoading(false) })
      .catch((e) => { if (!signal?.aborted) { setError(errMessage(e)); setLoading(false) } })
  }, [token])

  useEffect(() => {
    const ctrl = new AbortController()
    load(ctrl.signal)
    loadCategories(ctrl.signal)
    return () => ctrl.abort()
  }, [load, loadCategories])

  const categoryMap = useMemo(() => new Map(categories.map(c => [c.key, c])), [categories])

  const filtered = useMemo(() => rows.filter((n) => {
    if (category && n.category !== category) return false
    if (status !== 'all' && statusOf(n).label.toLowerCase() !== status) return false
    if (search && !n.title.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [rows, category, status, search])

  const doToggle = useCallback(async () => {
    if (!token || !toggleTarget) return
    setActionBusy(true); setError(null)
    try {
      await setNewsActive(token, toggleTarget.id, !toggleTarget.active)
      setToggleTarget(null)
      load()
    } catch (e) { setError(errMessage(e)) } finally { setActionBusy(false) }
  }, [token, toggleTarget, load])

  const doDelete = useCallback(async () => {
    if (!token || !deleteTarget) return
    setActionBusy(true); setError(null)
    try {
      await deleteNews(token, deleteTarget.id)
      setDeleteTarget(null)
      load()
    } catch (e) { setError(errMessage(e)) } finally { setActionBusy(false) }
  }, [token, deleteTarget, load])

  const renderRow = (n: AdminNews): ReactNode => {
    const st = statusOf(n)
    return (
      <DataTableRow key={n.id}>
        {isShown('category') && <DataTableCell key="category"><CategoryChip category={categoryMap.get(n.category) ?? null} /></DataTableCell>}
        {isShown('title') && (
          <DataTableCell key="title" className="font-medium text-sm">
            <div className="truncate" title={n.title}>{n.title}</div>
          </DataTableCell>
        )}
        {isShown('status') && <DataTableCell key="status" align="center"><span className={cn('text-xs', st.tone)}>{st.label}</span></DataTableCell>}
        {isShown('pinned') && (
          <DataTableCell key="pinned" align="center">
            {n.pinned ? <Pin className="size-3.5 text-accent-300 inline" /> : <span className="text-muted-foreground/40">—</span>}
          </DataTableCell>
        )}
        {isShown('published') && <DataTableCell key="published" className="text-xs text-muted-foreground whitespace-nowrap" title={n.publishedAt}>{relTime(n.publishedAt)}</DataTableCell>}
        {isShown('expires') && <DataTableCell key="expires" className="text-xs text-muted-foreground whitespace-nowrap" title={n.expiresAt ?? ''}>{n.expiresAt ? relTime(n.expiresAt) : '—'}</DataTableCell>}
        {isShown('actions') && (
          <DataTableCell key="actions" align="center">
            <div className="flex justify-center gap-1.5">
              <ActionButton tone="accent" icon={Pencil} onClick={() => setEditing(n)} title="Edit" />
              <ActionButton tone={n.active ? 'amber' : 'emerald'} icon={n.active ? PowerOff : Power} onClick={() => setToggleTarget(n)} title={n.active ? 'Deactivate' : 'Activate'} />
              <ActionButton tone="red" icon={Trash2} onClick={() => setDeleteTarget(n)} title="Delete" />
            </div>
          </DataTableCell>
        )}
      </DataTableRow>
    )
  }

  return (
    <SectionShell
      title="News"
      icon={Newspaper}
      actions={
        <>
          <ActionButton tone="accent" icon={RefreshCw} onClick={() => { load(); loadCategories() }} loading={loading} />
          <ActionButton tone="accent" icon={Plus} onClick={() => setAdding(true)} disabled={!token}>Post News</ActionButton>
          <ActionButton tone="accent" icon={Tags} onClick={() => setCatsOpen(true)} disabled={!token}>Categories</ActionButton>
        </>
      }
    >
      <Feedback message={error} tone="red" onDismiss={() => setError(null)} />

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by title…" className="flex-1 min-w-48 max-w-sm" />
        <AdminSelect value={category} onChange={setCategory} ariaLabel="Filter by category"
          options={[{ value: '', label: 'Any category' }, ...categories.map(c => ({ value: c.key, label: c.label }))]} className="min-w-44" />
        <AdminSelect value={status} onChange={(v) => setStatus(v as StatusFilter)} ariaLabel="Filter by status"
          options={STATUS_OPTIONS} className="min-w-36" />
      </div>

      <DataTableShell className="flex-none" responsive={{ columns: NEWS_COLUMNS, onResolve: handleResolve }}>
        <DataTableHeaderRow>
          {isShown('category') && <DataTableHeaderCell key="category" width="11rem">Category</DataTableHeaderCell>}
          {isShown('title') && <DataTableHeaderCell key="title">Title</DataTableHeaderCell>}
          {isShown('status') && <DataTableHeaderCell key="status" width="6rem" align="center">Status</DataTableHeaderCell>}
          {isShown('pinned') && <DataTableHeaderCell key="pinned" width="5rem" align="center">Pinned</DataTableHeaderCell>}
          {isShown('published') && <DataTableHeaderCell key="published" width="8rem">Published</DataTableHeaderCell>}
          {isShown('expires') && <DataTableHeaderCell key="expires" width="8rem">Expires</DataTableHeaderCell>}
          {isShown('actions') && <DataTableHeaderCell key="actions" width="9rem" align="center">Actions</DataTableHeaderCell>}
        </DataTableHeaderRow>
        <tbody>
          {loading && rows.length === 0 ? (
            Array.from({ length: 6 }).map((_, i) => <DataTableSkeletonRow key={i} columnCount={effectiveCount} />)
          ) : filtered.length === 0 ? (
            <DataTableEmpty colSpan={effectiveCount} message="No news matches these filters." />
          ) : filtered.map(renderRow)}
        </tbody>
      </DataTableShell>

      <div className="text-xs text-muted-foreground pt-2 tabular-nums">
        {loading ? '' : `${filtered.length} item${filtered.length === 1 ? '' : 's'}`}
      </div>

      {token && <NewsFormModal open={adding} onClose={() => setAdding(false)} token={token} editing={null} categories={categories} onSaved={() => load()} />}
      {token && <NewsFormModal open={!!editing} onClose={() => setEditing(null)} token={token} editing={editing} categories={categories} onSaved={() => load()} />}
      {token && <CategoriesModal open={catsOpen} onClose={() => setCatsOpen(false)} token={token} categories={categories} onChanged={loadCategories} />}

      <ConfirmDialog
        open={!!toggleTarget}
        title={toggleTarget?.active ? 'Hide this news item?' : 'Show this news item?'}
        tone="accent"
        confirmLabel={toggleTarget?.active ? 'Deactivate' : 'Activate'}
        busy={actionBusy}
        onCancel={() => setToggleTarget(null)}
        onConfirm={doToggle}
        message={toggleTarget && (
          <span>
            {toggleTarget.active
              ? <>Hide <span className="font-medium text-foreground">{toggleTarget.title}</span> from the launcher.</>
              : <>Show <span className="font-medium text-foreground">{toggleTarget.title}</span> on the launcher (respecting its publish/expiry dates).</>}
          </span>
        )}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete this news item?"
        tone="red"
        confirmLabel="Delete"
        busy={actionBusy}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={doDelete}
        message={deleteTarget && (
          <span>
            Permanently delete <span className="font-medium text-foreground">{deleteTarget.title}</span>. This
            cannot be undone. To temporarily pull it, deactivate it instead.
          </span>
        )}
      />
    </SectionShell>
  )
}
