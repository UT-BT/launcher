import { useState, useEffect, useRef, type ReactNode } from 'react'
import { Search, Loader2, X, ChevronLeft, ChevronRight, ChevronDown, Check, Copy, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/app/components/ui/input'
import { Button } from '@/app/components/ui/button'
import { Modal } from '@/app/components/ui/modal'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/app/components/ui/dropdown-menu'
import { parseApiDate } from '@/app/utils/format'
import type { Tone } from '../types'
import { TONE_BTN } from './tone'

export function ActionButton({ tone = 'accent', icon: Icon, children, onClick, disabled, loading, title }: {
  tone?: Tone
  icon?: LucideIcon
  children?: ReactNode
  onClick?: () => void
  disabled?: boolean
  loading?: boolean
  title?: string
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        'h-8 px-3 rounded-md text-xs font-medium border flex items-center gap-2 transition-all cursor-pointer',
        'hover:brightness-125 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:brightness-100',
        TONE_BTN[tone],
      )}
    >
      {loading ? <Loader2 className="size-3.5 animate-spin" /> : Icon ? <Icon className="size-3.5" /> : null}
      {children}
    </button>
  )
}

export function SearchInput({ value, onChange, placeholder, className }: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  className?: string
}) {
  return (
    <div className={cn('relative', className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/60 pointer-events-none" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 pl-9 bg-card/30 border-hairline/10"
      />
    </div>
  )
}

export function Pager({ offset, limit, total, loading, onPrev, onNext }: {
  offset: number
  limit: number
  total: number | null
  loading?: boolean
  onPrev: () => void
  onNext: () => void
}) {
  const start = total === 0 ? 0 : offset + 1
  const end = total != null ? Math.min(offset + limit, total) : offset + limit
  const atEnd = total != null ? end >= total : false
  const btn = 'h-8 px-2 rounded-md border border-hairline/10 text-muted-foreground hover:text-foreground hover:bg-hairline/5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1 text-xs'
  return (
    <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
      <span className="tabular-nums">{total != null ? `${start}–${end} of ${total}` : ''}</span>
      <div className="flex gap-2">
        <button className={btn} disabled={offset <= 0 || loading} onClick={onPrev}>
          <ChevronLeft className="size-3.5" /> Prev
        </button>
        <button className={btn} disabled={atEnd || loading} onClick={onNext}>
          Next <ChevronRight className="size-3.5" />
        </button>
      </div>
    </div>
  )
}

export function Feedback({ message, tone = 'accent', onDismiss }: {
  message: string | null
  tone?: Tone
  onDismiss?: () => void
}) {
  if (!message) return null
  return (
    <div className={cn('text-xs rounded-md border px-3 py-2 flex items-center justify-between gap-2', TONE_BTN[tone])}>
      <span className="min-w-0">{message}</span>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="shrink-0 cursor-pointer hover:opacity-70">
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
}

export function relTime(iso: string | null): string {
  const parsed = parseApiDate(iso)
  if (!parsed) return ''
  const then = parsed.getTime()
  const diff = Date.now() - then
  const future = diff < 0
  const s = Math.abs(diff) / 1000
  let text: string
  if (s < 60) text = `${Math.floor(s)}s`
  else if (s < 3600) text = `${Math.floor(s / 60)}m`
  else if (s < 86400) text = `${Math.floor(s / 3600)}h`
  else if (s < 2592000) text = `${Math.floor(s / 86400)}d`
  else return parsed.toLocaleDateString()
  return future ? `in ${text}` : `${text} ago`
}

export function formatDateTime(iso: string | null): string {
  const parsed = parseApiDate(iso)
  if (!parsed) return ''
  return parsed.toLocaleString()
}

export function relTimeLong(iso: string | null): string {
  const parsed = parseApiDate(iso)
  if (!parsed) return ''
  const then = parsed.getTime()
  const diff = Date.now() - then
  const future = diff < 0
  const s = Math.abs(diff) / 1000
  const units: [number, string][] = [
    [31536000, 'year'],
    [2592000, 'month'],
    [86400, 'day'],
    [3600, 'hour'],
    [60, 'minute'],
  ]
  for (const [secs, name] of units) {
    if (s >= secs) {
      const n = Math.floor(s / secs)
      const label = `${n} ${name}${n === 1 ? '' : 's'}`
      return future ? `in ${label}` : `${label} ago`
    }
  }
  return future ? 'in moments' : 'just now'
}

export function errMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  return String(e)
}

export interface SelectOption {
  value: string
  label: string
}

export function AdminSelect({ value, onChange, options, placeholder, className, ariaLabel }: {
  value: string
  onChange: (v: string) => void
  options: SelectOption[]
  placeholder?: string
  className?: string
  ariaLabel?: string
}) {
  const current = options.find((o) => o.value === value)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          className={cn(
            'h-9 px-3 rounded-md border border-hairline/10 bg-card/30 text-sm flex items-center justify-between gap-2',
            'hover:bg-card/50 hover:border-hairline/20 transition-colors cursor-pointer outline-none',
            className,
          )}
        >
          <span className={cn('truncate', current ? 'text-foreground' : 'text-muted-foreground')}>
            {current ? current.label : (placeholder || 'Select…')}
          </span>
          <ChevronDown className="size-4 text-muted-foreground/60 shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="bg-card/95 backdrop-blur-xl border-hairline/10 min-w-44 max-h-72 overflow-y-auto">
        {options.map((o) => (
          <DropdownMenuItem
            key={o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              'cursor-pointer text-sm flex items-center justify-between gap-2',
              o.value === value ? 'text-accent-300 focus:text-accent-200' : 'text-muted-foreground focus:text-foreground',
              'focus:bg-hairline/10',
            )}
          >
            <span className="truncate">{o.label}</span>
            {o.value === value && <Check className="size-3.5 shrink-0" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', tone = 'accent', busy, onConfirm, onCancel, withReason, reasonRequired, reasonPlaceholder }: {
  open: boolean
  title: string
  message: ReactNode
  confirmLabel?: string
  tone?: 'accent' | 'red'
  busy?: boolean
  onConfirm: (reason?: string) => void
  onCancel: () => void
  withReason?: boolean
  reasonRequired?: boolean
  reasonPlaceholder?: string
}) {
  const [reason, setReason] = useState('')
  useEffect(() => { if (open) setReason('') }, [open])

  const blocked = !!busy || (!!withReason && !!reasonRequired && !reason.trim())

  return (
    <Modal
      isOpen={open}
      onClose={onCancel}
      title={title}
      offsetSidebar
      maxWidth="30rem"
      footer={
        <div className="p-4 border-t border-border bg-muted/50 flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button variant={tone === 'red' ? 'destructive' : 'default'} onClick={() => onConfirm(withReason ? reason.trim() : undefined)} disabled={blocked}>
            {busy ? 'Working…' : confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="space-y-3 text-sm text-muted-foreground">
        <div>{message}</div>
        {withReason && (
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              Reason{reasonRequired ? '' : ' (optional)'}
            </label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={reasonPlaceholder || 'Reason'} autoFocus />
          </div>
        )}
      </div>
    </Modal>
  )
}

export function Copyable({ value, className, mono = true }: { value: string; className?: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false)
  if (!value) return <span className="text-muted-foreground">—</span>

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch { /* ignore */ }
  }

  return (
    <span className={cn('inline-flex items-center gap-1.5 max-w-full align-middle', className)}>
      <code className={cn('px-1.5 py-0.5 rounded bg-card/60 border border-hairline/10 text-xs truncate select-all', mono && 'font-mono')}>{value}</code>
      <button type="button" onClick={copy} title="Copy" className="shrink-0 text-muted-foreground/60 hover:text-foreground cursor-pointer">
        {copied ? <Check className="size-3.5 text-emerald-300" /> : <Copy className="size-3.5" />}
      </button>
    </span>
  )
}

export interface DateRangeSelection {
  presetId: string | null
  start: string
  end: string
}

export const DATE_COMMIT_DELAY_MS = 400

function DateField({ label, value, max, onChange }: {
  label: string
  value: string
  max: string
  onChange: (v: string) => void
}) {
  const [draft, setDraft] = useState(value)
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cancel = () => {
    if (pending.current === null) return
    clearTimeout(pending.current)
    pending.current = null
  }

  useEffect(() => {
    cancel()
    setDraft(value)
  }, [value])

  useEffect(() => cancel, [])

  const schedule = (next: string) => {
    setDraft(next)
    cancel()
    pending.current = setTimeout(() => {
      pending.current = null
      onChange(next)
    }, DATE_COMMIT_DELAY_MS)
  }

  const commitNow = () => {
    if (pending.current === null) return
    cancel()
    onChange(draft)
  }

  return (
    <label className="flex items-center gap-1.5 flex-1 min-w-[10.5rem]">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium shrink-0">{label}</span>
      <input
        type="date"
        value={draft}
        max={max}
        onChange={(e) => schedule(e.target.value)}
        onBlur={commitNow}
        onKeyDown={(e) => { if (e.key === 'Enter') commitNow() }}
        style={{ colorScheme: 'dark' }}
        className={cn(
          'h-8 w-full min-w-0 px-2 rounded-md border border-hairline/10 bg-card/30 text-xs text-foreground',
          'outline-none focus:border-accent-500/50 cursor-pointer',
        )}
      />
    </label>
  )
}

export function DateRangeControl({ value, presets, maxDate, error, onChange }: {
  value: DateRangeSelection
  presets: { id: string; label: string }[]
  maxDate: string
  error?: string | null
  onChange: (next: DateRangeSelection) => void
}) {
  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex flex-wrap items-center gap-1.5">
        {presets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => onChange({ presetId: preset.id, start: value.start, end: value.end })}
            className={cn(
              'h-7 px-2.5 rounded-md border text-xs cursor-pointer transition-colors',
              value.presetId === preset.id
                ? 'bg-accent-500/15 border-accent-500/40 text-accent-200'
                : 'border-hairline/10 bg-card/30 text-muted-foreground hover:text-foreground',
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <DateField
          label="From"
          value={value.start}
          max={maxDate}
          onChange={(start) => onChange({ presetId: null, start, end: value.end })}
        />
        <DateField
          label="To"
          value={value.end}
          max={maxDate}
          onChange={(end) => onChange({ presetId: null, start: value.start, end })}
        />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">UTC</span>
      </div>
      {error && <span className="text-xs text-red-300">{error}</span>}
    </div>
  )
}
