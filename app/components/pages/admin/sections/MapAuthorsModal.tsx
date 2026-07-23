import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Link2, Loader2, Search, Unlink,
} from 'lucide-react'
import {
  fetchAdminUsers, fetchLinkedMapAuthors, fetchMapAuthorCandidates, fetchMapAuthorPreview,
  fetchMapAuthorStrings, fetchMapAuthorStringsCount, linkMapAuthor, toActiveTitle, unlinkMapAuthor,
  type AdminUserRow, type LinkedMapAuthorRow, type MapAuthorCandidate, type MapAuthorPreview,
  type MapAuthorRow,
} from '@/app/utils/api'
import { cn } from '@/lib/utils'
import { Modal } from '@/app/components/ui/modal'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { MapLink } from '../components/MapLink'
import { Checkbox } from '@/app/components/ui/checkbox'
import { ActionButton, Feedback, Pager, SearchInput, errMessage } from '../components/controls'
import { useAdminPageSize } from '../components/shared'
import {
  DataTableShell, DataTableHeaderRow, DataTableHeaderCell, DataTableRow, DataTableCell, DataTableEmpty,
  DataTableSkeletonRow, type ResponsiveColumn,
} from '@/app/components/shared/DataTable'

const UNLINKED_COLUMNS: ResponsiveColumn[] = [
  { id: 'author', required: true },
  { id: 'maps', width: '5rem', required: true },
  { id: 'notes', width: '12rem', priority: 30 },
  { id: 'action', width: '7.5rem', required: true },
]

const LINKED_COLUMNS: ResponsiveColumn[] = [
  { id: 'player', required: true },
  { id: 'maps', width: '5rem', required: true },
  { id: 'was', width: '12rem', priority: 30 },
  { id: 'action', width: '6rem', required: true },
]

type Step =
  | { status: 'browse' }
  | { status: 'review'; author: MapAuthorRow }
  | { status: 'pick'; author: MapAuthorRow }
  | { status: 'preview'; author: MapAuthorRow; target: MapAuthorCandidate | AdminUserRow; preview: MapAuthorPreview }
  | { status: 'applying' }
  | { status: 'done'; count: number; alias: string | null; warnings: string[]; leftover: number }
  | { status: 'error'; message: string }

function FlagChip({ tone, children }: { tone: 'amber' | 'red'; children: ReactNode }) {
  return (
    <span className={cn(
      'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium',
      tone === 'amber' ? 'bg-amber-500/15 text-amber-300' : 'bg-red-500/15 text-red-300',
    )}>
      {children}
    </span>
  )
}

function Banner({ tone, children }: { tone: 'amber' | 'red' | 'accent'; children: ReactNode }) {
  const tones = {
    amber: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
    red: 'border-red-500/40 bg-red-500/10 text-red-300',
    accent: 'border-accent-500/40 bg-accent-500/10 text-accent-200',
  }
  return (
    <div className={cn('flex items-start gap-2.5 rounded-xl border p-3', tones[tone])}>
      <AlertTriangle className="size-4 shrink-0 mt-0.5" />
      <div className="text-xs leading-relaxed min-w-0">{children}</div>
    </div>
  )
}

function CandidateList({ candidates, onPick }: {
  candidates: MapAuthorCandidate[]
  onPick: (c: MapAuthorCandidate) => void
}) {
  if (candidates.length === 0) {
    return <p className="text-xs text-muted-foreground py-2">No similar aliases found. Search for a player instead.</p>
  }
  return (
    <ul className="bg-card/30 border border-hairline/10 rounded-md divide-y divide-hairline/5 max-h-56 overflow-y-auto">
      {candidates.map((c) => (
        <li key={c.id}>
          <button type="button" onClick={() => onPick(c)}
            className="w-full text-left px-3 py-2 hover:bg-hairline/5 cursor-pointer flex items-center justify-between gap-2">
            <PlayerInfo userId={c.id} alias={c.alias} title={toActiveTitle(c.active_title)} size="sm" interactive={false} />
            <span className="flex items-center gap-2 shrink-0">
              {c.existing_map_count > 0 && (
                <span className="text-[10px] text-muted-foreground/60">{c.existing_map_count} linked</span>
              )}
              <span className={cn(
                'text-[10px] rounded px-1.5 py-0.5',
                c.match_type === 'exact' ? 'bg-emerald-500/15 text-emerald-300'
                  : c.match_type === 'normalized' ? 'bg-accent-500/15 text-accent-200'
                    : 'bg-white/5 text-muted-foreground',
              )}>
                {c.match_type === 'fuzzy' ? `similar · ${Math.round(c.score * 100)}%` : c.match_type}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}

export function MapAuthorsModal({ open, onClose, token, onApplied }: {
  open: boolean
  onClose: () => void
  token: string
  onApplied: () => void
}) {
  const [step, setStep] = useState<Step>({ status: 'browse' })
  const [reason, setReason] = useState('')
  const [notice, setNotice] = useState<string | null>(null)

  const [rows, setRows] = useState<MapAuthorRow[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const limit = useAdminPageSize()

  const [reviewPreview, setReviewPreview] = useState<MapAuthorPreview | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [selectedFor, setSelectedFor] = useState<string | null>(null)

  const [candidates, setCandidates] = useState<MapAuthorCandidate[] | null>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<AdminUserRow[]>([])

  const [linked, setLinked] = useState<LinkedMapAuthorRow[]>([])
  const [tab, setTab] = useState<'unlinked' | 'linked'>('unlinked')

  const [unlinkedResolved, setUnlinkedResolved] = useState<Set<string> | null>(null)
  const handleUnlinkedResolve = useCallback((ids: Set<string>) => setUnlinkedResolved(ids), [])
  const showNotes = !unlinkedResolved || unlinkedResolved.has('notes')
  const [linkedResolved, setLinkedResolved] = useState<Set<string> | null>(null)
  const handleLinkedResolve = useCallback((ids: Set<string>) => setLinkedResolved(ids), [])
  const showWas = !linkedResolved || linkedResolved.has('was')

  useEffect(() => {
    if (!open) return
    setStep({ status: 'browse' }); setReason(''); setNotice(null)
    setSearch(''); setOffset(0); setTab('unlinked')
    setReviewPreview(null); setSelected(new Set()); setSelectedFor(null)
  }, [open])

  const loadBrowse = useCallback((signal?: AbortSignal) => {
    setLoading(true)
    Promise.all([
      fetchMapAuthorStrings(token, { search: search || undefined, sort: 'maps', order: 'desc', limit, offset }, signal),
      fetchMapAuthorStringsCount(token, { search: search || undefined }, signal),
    ])
      .then(([items, count]) => { setRows(items); setTotal(count) })
      .catch((e) => { if (!signal?.aborted) setNotice(errMessage(e)) })
      .finally(() => { if (!signal?.aborted) setLoading(false) })
  }, [token, search, limit, offset])

  const browsing = step.status === 'browse'

  useEffect(() => {
    if (!open || !browsing || tab !== 'unlinked') return
    const ctrl = new AbortController()
    const t = setTimeout(() => loadBrowse(ctrl.signal), search ? 300 : 0)
    return () => { clearTimeout(t); ctrl.abort() }
  }, [open, browsing, tab, loadBrowse, search])

  useEffect(() => {
    if (!open || !browsing || tab !== 'linked') return
    const ctrl = new AbortController()
    setLoading(true)
    fetchLinkedMapAuthors(token, ctrl.signal)
      .then(setLinked)
      .catch((e) => { if (!ctrl.signal.aborted) setNotice(errMessage(e)) })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })
    return () => ctrl.abort()
  }, [open, browsing, tab, token])

  const reviewing = step.status === 'review' ? step.author.author_str : null

  useEffect(() => {
    if (!reviewing) return
    const ctrl = new AbortController()
    setReviewPreview(null)
    fetchMapAuthorPreview(token, { authorStr: reviewing, match: 'exact' }, ctrl.signal)
      .then((p) => {
        setReviewPreview(p)
        if (selectedFor !== reviewing) {
          setSelected(new Set(p.maps.map((m) => m.name)))
          setSelectedFor(reviewing)
        }
      })
      .catch((e) => { if (!ctrl.signal.aborted) setStep({ status: 'error', message: errMessage(e) }) })
    return () => ctrl.abort()
  }, [reviewing, token, selectedFor])

  const picking = step.status === 'pick' ? step.author.author_str : null

  useEffect(() => {
    if (!picking) return
    const ctrl = new AbortController()
    setCandidates(null); setQuery(''); setResults([])
    fetchMapAuthorCandidates(token, picking, ctrl.signal)
      .then(setCandidates)
      .catch(() => setCandidates([]))
    return () => ctrl.abort()
  }, [picking, token])

  useEffect(() => {
    if (!picking || !query.trim()) { setResults([]); return }
    const ctrl = new AbortController()
    const t = setTimeout(() => {
      fetchAdminUsers(token, { search: query, limit: 8 }, ctrl.signal).then(setResults).catch(() => {})
    }, 300)
    return () => { clearTimeout(t); ctrl.abort() }
  }, [picking, query, token])

  const goPreview = async (author: MapAuthorRow, target: MapAuthorCandidate | AdminUserRow) => {
    try {
      const preview = await fetchMapAuthorPreview(token, { authorStr: author.author_str, userId: target.id })
      setStep({ status: 'preview', author, target, preview })
    } catch (e) {
      setStep({ status: 'error', message: errMessage(e) })
    }
  }

  const apply = async () => {
    if (step.status !== 'preview') return
    const { author, target, preview } = step
    const selectedMaps = preview.maps.filter((m) => selected.has(m.name)).map((m) => m.name)
    setStep({ status: 'applying' })
    try {
      const res = await linkMapAuthor(token, {
        authorStr: author.author_str,
        userId: target.id,
        match: 'exact',
        maps: selectedMaps,
        expectedMaps: preview.maps.map((m) => m.name),
        reason: reason.trim() || undefined,
        allowPlaceholder: author.placeholder,
      })
      setStep({
        status: 'done',
        count: res.linked_count,
        alias: res.user.alias,
        warnings: res.warnings,
        leftover: preview.maps.length - res.linked_count,
      })
      onApplied()
    } catch (e) {
      setStep({ status: 'error', message: errMessage(e) })
    }
  }

  const unlink = async (row: LinkedMapAuthorRow) => {
    if (!row.original_str) return
    setStep({ status: 'applying' })
    try {
      const res = await unlinkMapAuthor(token, { authorStr: row.original_str, userId: row.author_ref })
      setNotice(`Unlinked ${res.unlinked_count} map(s) back to "${row.original_str}".`)
      setStep({ status: 'browse' })
      onApplied()
    } catch (e) {
      setStep({ status: 'error', message: errMessage(e) })
    }
  }

  const title = useMemo(() => {
    if (step.status === 'review') return `Review "${step.author.author_str}"`
    if (step.status === 'pick' || step.status === 'preview') return `Link "${step.author.author_str}"`
    return 'Map authors'
  }, [step])

  const previewSelectedCount = step.status === 'preview'
    ? step.preview.maps.filter((m) => selected.has(m.name)).length
    : 0

  const footer = step.status === 'review' ? (
    <div className="p-4 border-t border-border bg-muted/50 flex justify-end gap-2">
      <Button variant="outline" onClick={() => setStep({ status: 'browse' })}>Back</Button>
      <ActionButton tone="accent" icon={ArrowRight} onClick={() => setStep({ status: 'pick', author: step.author })}
        disabled={selected.size === 0 || reviewPreview === null}>
        Continue with {selected.size} {selected.size === 1 ? 'map' : 'maps'}
      </ActionButton>
    </div>
  ) : step.status === 'preview' ? (
    <div className="p-4 border-t border-border bg-muted/50 flex justify-end gap-2">
      <Button variant="outline" onClick={() => setStep({ status: 'pick', author: step.author })}>Back</Button>
      <ActionButton tone="emerald" icon={Link2} onClick={apply} disabled={previewSelectedCount === 0}>
        Link {previewSelectedCount} {previewSelectedCount === 1 ? 'map' : 'maps'}
      </ActionButton>
    </div>
  ) : (
    <div className="p-4 border-t border-border bg-muted/50 flex justify-end gap-2">
      <Button variant="outline" onClick={onClose} disabled={step.status === 'applying'}>
        {step.status === 'done' || step.status === 'error' ? 'Close' : 'Cancel'}
      </Button>
    </div>
  )

  return (
    <Modal
      isOpen={open}
      onClose={step.status === 'applying' ? () => {} : onClose}
      title={title}
      offsetSidebar
      maxWidth="52rem"
      footer={footer}
    >
      <div className="space-y-4">
        {step.status === 'applying' && (
          <div className="flex items-center justify-center gap-3 py-12 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
            <span className="text-sm">Applying…</span>
          </div>
        )}

        {step.status === 'error' && (
          <>
            <Banner tone="red">{step.message}</Banner>
            <Button variant="outline" onClick={() => setStep({ status: 'browse' })}>
              <ArrowLeft className="size-4 mr-1.5" /> Back to authors
            </Button>
          </>
        )}

        {step.status === 'done' && (
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
            <CheckCircle2 className="size-10 text-emerald-400" />
            <p className="text-sm text-foreground">
              Linked {step.count} {step.count === 1 ? 'map' : 'maps'} to {step.alias}.
            </p>
            {step.warnings.includes('co_authored') && (
              <p className="text-xs text-amber-300">That name lists more than one author — only this player was linked.</p>
            )}
            {step.leftover > 0 && (
              <p className="text-xs text-muted-foreground">
                {step.leftover} {step.leftover === 1 ? 'map' : 'maps'} left unlinked under that name.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Recorded in the audit log and reversible from there. Their mapper achievements update the next time they
              open their achievements page.
            </p>
            <Button variant="outline" onClick={() => setStep({ status: 'browse' })}>Link another</Button>
          </div>
        )}

        {step.status === 'browse' && (
          <>
            <Feedback message={notice} onDismiss={() => setNotice(null)} />

            <div className="inline-flex rounded-md border border-hairline/10 overflow-hidden text-xs">
              {(['unlinked', 'linked'] as const).map((t) => (
                <button key={t} type="button" onClick={() => setTab(t)}
                  className={cn('px-3 py-1.5 cursor-pointer transition-colors',
                    tab === t ? 'bg-accent-500/15 text-accent-200' : 'text-muted-foreground hover:text-foreground')}>
                  {t === 'unlinked' ? 'Unlinked names' : 'Linked players'}
                </button>
              ))}
            </div>

            {tab === 'unlinked' ? (
              <>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Maps credited to a plain name score for nobody. Link a name to the player who made those maps and their
                  mapper achievements start counting. One name at a time — nothing is matched automatically.
                </p>

                <SearchInput value={search} onChange={(v) => { setSearch(v); setOffset(0) }} placeholder="Search author names…" />

                <DataTableShell
                  className="max-h-[22rem]"
                  responsive={{ columns: UNLINKED_COLUMNS, nameFloorRem: 8, onResolve: handleUnlinkedResolve }}
                >
                  <DataTableHeaderRow>
                    <DataTableHeaderCell align="left">Author</DataTableHeaderCell>
                    <DataTableHeaderCell width="5rem" align="right">Maps</DataTableHeaderCell>
                    {showNotes && <DataTableHeaderCell width="12rem" align="left">Notes</DataTableHeaderCell>}
                    <DataTableHeaderCell width="7.5rem" align="right" />
                  </DataTableHeaderRow>
                  <tbody>
                    {loading && rows.length === 0 && Array.from({ length: 6 }, (_, i) => (
                      <DataTableSkeletonRow key={i} columnCount={showNotes ? 4 : 3} />
                    ))}
                    {!loading && rows.length === 0 && <DataTableEmpty colSpan={showNotes ? 4 : 3} message="No author names found." />}
                    {rows.map((r) => (
                      <DataTableRow key={r.author_str}>
                        <DataTableCell align="left">
                          <span className="font-mono text-xs text-foreground truncate">{r.author_str}</span>
                        </DataTableCell>
                        <DataTableCell align="right" className="tabular-nums text-muted-foreground">
                          {r.map_count}
                        </DataTableCell>
                        {showNotes && (
                          <DataTableCell align="left">
                            <span className="flex flex-wrap gap-1">
                              {r.placeholder && <FlagChip tone="red">placeholder</FlagChip>}
                              {r.co_authored && <FlagChip tone="amber">co-authored</FlagChip>}
                              {r.exact_alias_match && <FlagChip tone="amber">alias match</FlagChip>}
                            </span>
                          </DataTableCell>
                        )}
                        <DataTableCell align="right">
                          <ActionButton tone="accent" icon={ArrowRight} onClick={() => setStep({ status: 'review', author: r })}>
                            Review
                          </ActionButton>
                        </DataTableCell>
                      </DataTableRow>
                    ))}
                  </tbody>
                </DataTableShell>

                <Pager
                  offset={offset} limit={limit} total={total} loading={loading}
                  onPrev={() => setOffset(Math.max(0, offset - limit))}
                  onNext={() => setOffset(offset + limit)}
                />
              </>
            ) : (
              <>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Players whose maps are linked to their account. Unlinking restores the original author name.
                </p>
                <DataTableShell
                  className="max-h-[22rem]"
                  responsive={{ columns: LINKED_COLUMNS, nameFloorRem: 8, onResolve: handleLinkedResolve }}
                >
                  <DataTableHeaderRow>
                    <DataTableHeaderCell align="left">Player</DataTableHeaderCell>
                    <DataTableHeaderCell width="5rem" align="right">Maps</DataTableHeaderCell>
                    {showWas && <DataTableHeaderCell width="12rem" align="left">Was</DataTableHeaderCell>}
                    <DataTableHeaderCell width="6rem" align="right" />
                  </DataTableHeaderRow>
                  <tbody>
                    {loading && linked.length === 0 && Array.from({ length: 4 }, (_, i) => (
                      <DataTableSkeletonRow key={i} columnCount={showWas ? 4 : 3} />
                    ))}
                    {!loading && linked.length === 0 && <DataTableEmpty colSpan={showWas ? 4 : 3} message="No linked authors yet." />}
                    {linked.map((r) => (
                      <DataTableRow key={r.author_ref}>
                        <DataTableCell align="left">
                          <PlayerInfo userId={r.author_ref} alias={r.alias} title={null} size="sm" interactive={false} />
                        </DataTableCell>
                        <DataTableCell align="right" className="tabular-nums text-muted-foreground">
                          {r.map_count}
                        </DataTableCell>
                        {showWas && (
                          <DataTableCell align="left">
                            <span className="font-mono text-[11px] text-muted-foreground truncate">{r.original_str ?? '—'}</span>
                          </DataTableCell>
                        )}
                        <DataTableCell align="right">
                          {r.original_str && (
                            <ActionButton tone="red" icon={Unlink} onClick={() => unlink(r)}>Unlink</ActionButton>
                          )}
                        </DataTableCell>
                      </DataTableRow>
                    ))}
                  </tbody>
                </DataTableShell>
              </>
            )}
          </>
        )}

        {step.status === 'review' && (
          <>
            <Button variant="outline" onClick={() => setStep({ status: 'browse' })}>
              <ArrowLeft className="size-4 mr-1.5" /> Back
            </Button>

            <p className="text-xs leading-relaxed text-muted-foreground">
              These are the maps credited to <span className="font-mono text-foreground">{step.author.author_str}</span>.
              Tick only the ones that belong to the player you'll link next — unticked maps stay unlinked under this name.
            </p>

            {reviewPreview === null ? (
              <div className="flex items-center gap-2 py-8 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /><span className="text-xs">Loading maps…</span>
              </div>
            ) : (
              <>
                {reviewPreview.placeholder && (
                  <Banner tone="red">
                    This is a placeholder name, not a real author. Only link maps you're sure belong to one player.
                  </Banner>
                )}
                {reviewPreview.co_authored && (
                  <Banner tone="amber">
                    This name lists more than one author — a map credits one player, so untick maps that aren't theirs.
                  </Banner>
                )}
                {reviewPreview.variants.length > 0 && (
                  <Banner tone="amber">
                    {reviewPreview.variants.map((v) => (
                      <div key={v.author_str}>
                        <span className="font-mono">{v.author_str}</span> ({v.map_count} maps) is spelled differently and
                        is not shown here. Link it separately.
                      </div>
                    ))}
                  </Banner>
                )}

                <DataTableShell className="max-h-80">
                  <DataTableHeaderRow>
                    <DataTableHeaderCell width="2.5rem" align="left">
                      <Checkbox
                        checked={selected.size === 0 ? false : selected.size === reviewPreview.maps.length ? true : 'indeterminate'}
                        onCheckedChange={(v) => setSelected(v === true
                          ? new Set(reviewPreview.maps.map((m) => m.name))
                          : new Set())}
                        aria-label="Select all maps"
                      />
                    </DataTableHeaderCell>
                    <DataTableHeaderCell align="left">Map</DataTableHeaderCell>
                    <DataTableHeaderCell width="6rem" align="right">Status</DataTableHeaderCell>
                  </DataTableHeaderRow>
                  <tbody>
                    {reviewPreview.maps.length === 0 && (
                      <DataTableEmpty colSpan={3} message="No maps use this name anymore." />
                    )}
                    {reviewPreview.maps.map((m) => (
                      <DataTableRow key={m.name}>
                        <DataTableCell align="left">
                          <Checkbox
                            checked={selected.has(m.name)}
                            onCheckedChange={() => setSelected((prev) => {
                              const next = new Set(prev)
                              if (next.has(m.name)) next.delete(m.name)
                              else next.add(m.name)
                              return next
                            })}
                            aria-label={`Include ${m.name}`}
                          />
                        </DataTableCell>
                        <DataTableCell align="left"><MapLink name={m.name} /></DataTableCell>
                        <DataTableCell align="right">
                          <span className={cn('text-[11px]', m.active ? 'text-emerald-300' : 'text-muted-foreground/60')}>
                            {m.active ? 'Active' : 'Inactive'}
                          </span>
                        </DataTableCell>
                      </DataTableRow>
                    ))}
                  </tbody>
                </DataTableShell>

                <p className="text-xs text-muted-foreground">
                  {selected.size} of {reviewPreview.maps.length} selected.
                </p>
              </>
            )}
          </>
        )}

        {step.status === 'pick' && (
          <>
            <Button variant="outline" onClick={() => setStep({ status: 'review', author: step.author })}>
              <ArrowLeft className="size-4 mr-1.5" /> Back
            </Button>

            {step.author.placeholder && (
              <Banner tone="red">
                <strong>{step.author.author_str}</strong> is a placeholder covering {step.author.map_count} maps, not a
                real author. Linking it would credit every one of them to a single player.
              </Banner>
            )}
            {step.author.co_authored && (
              <Banner tone="amber">
                <strong>{step.author.author_str}</strong> names more than one author. A map credits one player, so only
                the one you pick gets the maps.
              </Banner>
            )}

            <div>
              <p className="text-xs text-muted-foreground mb-2">Suggested players</p>
              {candidates === null ? (
                <div className="flex items-center gap-2 py-3 text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /><span className="text-xs">Finding matches…</span>
                </div>
              ) : (
                <CandidateList candidates={candidates} onPick={(c) => goPreview(step.author, c)} />
              )}
            </div>

            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Or search for any player</p>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/60 pointer-events-none" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search players…" className="h-9 pl-9" />
              </div>
              {results.length > 0 && (
                <ul className="bg-card/30 border border-hairline/10 rounded-md divide-y divide-hairline/5 max-h-44 overflow-y-auto">
                  {results.map((u) => (
                    <li key={u.id}>
                      <button type="button" onClick={() => goPreview(step.author, u)}
                        className="w-full text-left px-3 py-2 hover:bg-hairline/5 cursor-pointer">
                        <PlayerInfo userId={u.id} alias={u.alias} title={toActiveTitle(u.active_title)} size="sm" interactive={false} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}

        {step.status === 'preview' && (
          <>
            {step.preview.placeholder && (
              <Banner tone="red">
                This is a placeholder name, not a real author. Linking credits {previewSelectedCount} maps to one player.
              </Banner>
            )}
            {step.preview.co_authored && (
              <Banner tone="amber">
                This name lists more than one author — only the player below will be credited.
              </Banner>
            )}
            {step.preview.variants.length > 0 && (
              <Banner tone="amber">
                {step.preview.variants.map((v) => (
                  <div key={v.author_str}>
                    <span className="font-mono">{v.author_str}</span> ({v.map_count} maps) is spelled differently and
                    will not be linked. Link it separately.
                  </div>
                ))}
              </Banner>
            )}

            <div className="flex items-center gap-3 rounded-xl border border-hairline/10 bg-card/30 p-3">
              <span className="font-mono text-xs text-muted-foreground shrink-0">{step.preview.author_str}</span>
              <ArrowLeft className="size-4 rotate-180 text-muted-foreground/50 shrink-0" />
              <PlayerInfo userId={step.target.id} alias={step.target.alias} title={null} size="sm" interactive={false} />
            </div>

            {step.preview.target && step.preview.target.existing_map_count > 0 && (
              <Banner tone="accent">
                {step.target.alias} already has {step.preview.target.existing_map_count} linked{' '}
                {step.preview.target.existing_map_count === 1 ? 'map' : 'maps'} — these {previewSelectedCount} will be
                merged in.
              </Banner>
            )}

            <div>
              <p className="text-xs text-muted-foreground mb-2">
                {previewSelectedCount} {previewSelectedCount === 1 ? 'map' : 'maps'} will be re-credited
              </p>
              <DataTableShell className="max-h-64">
                <DataTableHeaderRow>
                  <DataTableHeaderCell align="left">Map</DataTableHeaderCell>
                  <DataTableHeaderCell width="6rem" align="right">Status</DataTableHeaderCell>
                </DataTableHeaderRow>
                <tbody>
                  {step.preview.maps.filter((m) => selected.has(m.name)).map((m) => (
                    <DataTableRow key={m.name}>
                      <DataTableCell align="left"><MapLink name={m.name} /></DataTableCell>
                      <DataTableCell align="right">
                        <span className={cn('text-[11px]', m.active ? 'text-emerald-300' : 'text-muted-foreground/60')}>
                          {m.active ? 'Active' : 'Inactive'}
                        </span>
                      </DataTableCell>
                    </DataTableRow>
                  ))}
                </tbody>
              </DataTableShell>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Reason (optional)</label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. confirmed on Discord" className="h-9" />
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
