import { Fragment } from 'react'
import { Loader2, MoreHorizontal } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu'
import type { Tone } from '../types'

const TONE_ITEM: Record<Tone, string> = {
  accent: 'text-foreground focus:text-foreground',
  emerald: 'text-emerald-300 focus:text-emerald-200',
  red: 'text-red-300 focus:text-red-200',
  amber: 'text-amber-300 focus:text-amber-200',
}

export interface ActionMenuItem {
  key: string
  label: string
  icon?: LucideIcon
  tone?: Tone
  onSelect: () => void
  disabled?: boolean
  title?: string
  hint?: string
  separatorBefore?: boolean
}

export function ActionMenu({ items, busy, ariaLabel = 'Actions', heading, align = 'end' }: {
  items: ActionMenuItem[]
  busy?: boolean
  ariaLabel?: string
  heading?: string
  align?: 'start' | 'center' | 'end'
}) {
  const usable = items.filter(Boolean)
  if (usable.length === 0) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          title={ariaLabel}
          disabled={busy}
          className={cn(
            'size-8 rounded-md border border-hairline/10 bg-card/30 inline-flex items-center justify-center shrink-0',
            'text-muted-foreground hover:text-foreground hover:bg-card/60 hover:border-hairline/25',
            'data-[state=open]:bg-card/70 data-[state=open]:border-hairline/30 data-[state=open]:text-foreground',
            'transition-colors cursor-pointer outline-none disabled:opacity-40 disabled:cursor-not-allowed',
          )}
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <MoreHorizontal className="size-4" />}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align={align} className="bg-card/95 backdrop-blur-xl border-hairline/10 min-w-52">
        {heading && (
          <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
            {heading}
          </DropdownMenuLabel>
        )}
        {usable.map((item) => {
          const Icon = item.icon
          return (
            <Fragment key={item.key}>
              {item.separatorBefore && <DropdownMenuSeparator className="bg-hairline/10" />}
              <DropdownMenuItem
                onClick={item.onSelect}
                disabled={item.disabled}
                title={item.title}
                className={cn(
                  'cursor-pointer text-sm gap-2 focus:bg-hairline/10',
                  TONE_ITEM[item.tone ?? 'accent'],
                  item.disabled && 'opacity-40 cursor-not-allowed',
                )}
              >
                {Icon && <Icon className="size-3.5 shrink-0" />}
                <span className="min-w-0">
                  <span className="block truncate">{item.label}</span>
                  {item.hint && <span className="block text-[11px] text-muted-foreground truncate">{item.hint}</span>}
                </span>
              </DropdownMenuItem>
            </Fragment>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
