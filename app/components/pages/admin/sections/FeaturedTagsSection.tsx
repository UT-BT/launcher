import { useEffect, useMemo, useRef, useState } from 'react'
import { GripVertical, Plus, RefreshCw, RotateCcw, Save, Star, TriangleAlert, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/app/components/ui/input'
import { fetchMapvoteFeatured, saveMapvoteFeatured } from '@/app/utils/api'
import { SectionShell } from '../components/SectionShell'
import { ActionButton, Feedback, errMessage } from '../components/controls'
import { PANEL_LABEL } from '../components/shared'
import { TONE_CHIP } from '../components/tone'
import type { AdminSectionProps, Tone } from '../types'
import {
  FEATURED_TAGS_MAX,
  addableTags,
  moveTag,
  pickTag,
  sameTags,
  tagSuggestions,
  tagsWithoutActiveMap,
} from './featuredTags'

const SAVED_MESSAGE = 'Saved. The in-game mapvote shows it within a minute.'
const TOUCH_HEIGHT = 'touch:h-11'

const ICON_BUTTON = cn(
  'inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground cursor-pointer touch:size-11',
  'hover:text-foreground hover:bg-hairline/5 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400/60'
)

function rowIndexAt(list: HTMLElement | null, clientY: number): number {
  const rows = Array.from(list?.children ?? []) as HTMLElement[]
  return rows.findIndex((row) => {
    const rect = row.getBoundingClientRect()
    return clientY >= rect.top && clientY <= rect.bottom
  })
}

function TagPicker({
  available,
  featured,
  disabled,
  onAdd,
}: {
  available: string[]
  featured: string[]
  disabled: boolean
  onAdd: (tag: string) => void
}) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const addable = addableTags(available, featured)
  const full = featured.length >= FEATURED_TAGS_MAX
  const blocked = disabled || full || addable.length === 0
  const typed = query.trim()
  const suggestions = tagSuggestions(available, featured, query)
  const picked = pickTag(available, featured, query)

  const add = (tag: string) => {
    onAdd(tag)
    setQuery('')
    inputRef.current?.focus()
  }

  const hint =
    available.length === 0
      ? 'No active map carries a tag yet, so there is nothing to feature.'
      : addable.length === 0
        ? 'Every tag is featured already.'
        : full
          ? `The list holds at most ${FEATURED_TAGS_MAX} tags.`
          : null

  return (
    <div className="rounded-lg border border-hairline/10 bg-card/30 p-4 space-y-2">
      <label htmlFor="featured-tag-search" className={cn(PANEL_LABEL, 'block')}>
        Add a tag
      </label>
      <div className="flex gap-2">
        <Input
          id="featured-tag-search"
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (picked) add(picked)
            } else if (e.key === 'Escape') {
              setQuery('')
            }
          }}
          placeholder="Search the tags maps carry…"
          autoComplete="off"
          disabled={blocked}
          className={cn('h-9 min-w-0 flex-1', TOUCH_HEIGHT)}
        />
        <ActionButton
          icon={Plus}
          className={TOUCH_HEIGHT}
          disabled={blocked || !picked}
          onClick={() => {
            if (picked) add(picked)
          }}
        >
          Add
        </ActionButton>
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {!blocked &&
        typed &&
        (suggestions.length > 0 ? (
          <ul
            aria-label="Matching tags"
            className="bg-card/30 border border-hairline/10 rounded-md divide-y divide-hairline/5"
          >
            {suggestions.map((tag) => (
              <li key={tag}>
                <button
                  type="button"
                  onClick={() => add(tag)}
                  className="w-full text-left px-3 py-2 text-sm text-foreground break-words hover:bg-hairline/5 cursor-pointer touch:min-h-11"
                >
                  {tag}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground break-words">No tag left to add matches “{typed}”.</p>
        ))}
    </div>
  )
}

function FeaturedRow({
  tag,
  position,
  dragging,
  missing,
  disabled,
  onDragStart,
  onStep,
  onRemove,
}: {
  tag: string
  position: number
  dragging: boolean
  missing: boolean
  disabled: boolean
  onDragStart: () => void
  onStep: (step: -1 | 1) => void
  onRemove: () => void
}) {
  return (
    <li
      aria-label={tag}
      className={cn(
        'flex items-center gap-2 rounded-md px-1.5 py-1 min-w-0 transition-colors',
        dragging ? 'bg-accent-500/10 ring-1 ring-accent-400/40' : 'hover:bg-hairline/5'
      )}
    >
      <button
        type="button"
        aria-label={`Reorder ${tag}`}
        title="Drag to reorder"
        disabled={disabled}
        onPointerDown={(event) => {
          event.preventDefault()
          onDragStart()
        }}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
          event.preventDefault()
          onStep(event.key === 'ArrowUp' ? -1 : 1)
        }}
        className={cn(ICON_BUTTON, 'cursor-grab touch-none select-none active:cursor-grabbing')}
      >
        <GripVertical className="size-4" />
      </button>
      <span className="w-7 shrink-0 text-center text-sm tabular-nums text-muted-foreground">{position}</span>
      <div className="min-w-0 flex-1 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="min-w-0 break-words text-sm text-foreground">{tag}</span>
        {missing && (
          <span
            className={cn(
              'inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium',
              TONE_CHIP.amber
            )}
          >
            <TriangleAlert className="size-3" />
            No active map
          </span>
        )}
      </div>
      <button
        type="button"
        aria-label={`Remove ${tag}`}
        title="Remove"
        disabled={disabled}
        onClick={onRemove}
        className={cn(ICON_BUTTON, 'hover:text-red-300')}
      >
        <X className="size-4" />
      </button>
    </li>
  )
}

export function FeaturedTagsSection({ userProfile }: AdminSectionProps) {
  const token = userProfile?.accessToken ?? ''

  const [saved, setSaved] = useState<string[]>([])
  const [draft, setDraft] = useState<string[]>([])
  const [available, setAvailable] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ message: string; tone: Tone } | null>(null)
  const [dragTag, setDragTag] = useState<string | null>(null)
  const listRef = useRef<HTMLOListElement>(null)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setLoadError(null)
    fetchMapvoteFeatured(token, controller.signal)
      .then((data) => {
        setSaved(data.tags)
        setDraft(data.tags)
        setAvailable(data.available)
      })
      .catch((e) => {
        if (!controller.signal.aborted) setLoadError(errMessage(e))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [token, attempt])

  useEffect(() => {
    if (!dragTag) return

    const onMove = (event: PointerEvent) => {
      const to = rowIndexAt(listRef.current, event.clientY)
      if (to >= 0) setDraft((current) => moveTag(current, current.indexOf(dragTag), to))
    }
    const stop = () => setDragTag(null)

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
    }
  }, [dragTag])

  const dirty = !sameTags(draft, saved)
  const missing = useMemo(() => tagsWithoutActiveMap(draft, available), [draft, available])
  const ready = !loading && !loadError

  const edit = (change: (current: string[]) => string[]) => {
    setDraft(change)
    setFeedback(null)
  }

  const save = async () => {
    setSaving(true)
    setFeedback(null)
    try {
      const { tags } = await saveMapvoteFeatured(token, draft)
      setSaved(tags)
      setDraft(tags)
      setFeedback({ message: SAVED_MESSAGE, tone: 'emerald' })
    } catch (e) {
      setFeedback({ message: errMessage(e), tone: 'red' })
    } finally {
      setSaving(false)
    }
  }

  const discard = () => {
    setDraft(saved)
    setFeedback(null)
  }

  return (
    <SectionShell
      title="Featured Tags"
      description="Pick the tags the in-game mapvote shows first, for events and seasons. Drag to reorder."
      icon={Star}
      actions={
        ready ? (
          <>
            <ActionButton icon={RotateCcw} className={TOUCH_HEIGHT} disabled={!dirty || saving} onClick={discard}>
              Discard
            </ActionButton>
            <ActionButton
              tone="emerald"
              icon={Save}
              className={TOUCH_HEIGHT}
              disabled={!dirty}
              loading={saving}
              onClick={() => {
                void save()
              }}
            >
              Save
            </ActionButton>
          </>
        ) : undefined
      }
    >
      {loadError ? (
        <div className="rounded-lg border border-hairline/10 bg-card/30 p-4 space-y-3">
          <Feedback message={`Couldn't load the featured tags: ${loadError}`} tone="red" />
          <ActionButton icon={RefreshCw} className={TOUCH_HEIGHT} onClick={() => setAttempt((n) => n + 1)}>
            Retry
          </ActionButton>
        </div>
      ) : loading ? (
        <p className="text-sm text-muted-foreground">Loading featured tags…</p>
      ) : (
        <div className="space-y-4">
          <Feedback message={feedback?.message ?? null} tone={feedback?.tone} onDismiss={() => setFeedback(null)} />

          <TagPicker
            available={available}
            featured={draft}
            disabled={saving}
            onAdd={(tag) => edit((current) => (current.includes(tag) ? current : [...current, tag]))}
          />

          <div className="space-y-2">
            <h3 className={PANEL_LABEL}>Featured, in mapvote order ({draft.length})</h3>
            {draft.length === 0 ? (
              <p className="text-sm text-muted-foreground">No featured tags yet.</p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  Drag a row by its handle, or focus the handle and press the arrow keys.
                </p>
                <ol
                  ref={listRef}
                  aria-label="Featured Tags"
                  className={cn(
                    'rounded-lg border border-hairline/10 bg-card/30 p-1.5 space-y-0.5',
                    dragTag && 'select-none cursor-grabbing'
                  )}
                >
                  {draft.map((tag, index) => (
                    <FeaturedRow
                      key={tag}
                      tag={tag}
                      position={index + 1}
                      dragging={dragTag === tag}
                      missing={missing.has(tag)}
                      disabled={saving}
                      onDragStart={() => {
                        setDragTag(tag)
                        setFeedback(null)
                      }}
                      onStep={(step) =>
                        edit((current) => {
                          const from = current.indexOf(tag)
                          return moveTag(current, from, from + step)
                        })
                      }
                      onRemove={() => edit((current) => current.filter((item) => item !== tag))}
                    />
                  ))}
                </ol>
              </>
            )}
          </div>
        </div>
      )}
    </SectionShell>
  )
}
