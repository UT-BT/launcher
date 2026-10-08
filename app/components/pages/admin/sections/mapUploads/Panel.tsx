import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Tone } from '../../types'
import { TONE_CHIP } from '../../components/tone'

export function IconTile({ icon: Icon, tone = 'accent', size = 'md', spin, className }: {
  icon: LucideIcon
  tone?: Tone | 'muted'
  size?: 'sm' | 'md'
  spin?: boolean
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-lg border',
        size === 'sm' ? 'size-7' : 'size-8',
        tone === 'muted' ? 'border-hairline/10 bg-hairline/5 text-muted-foreground' : TONE_CHIP[tone],
        className,
      )}
    >
      <Icon className={cn(size === 'sm' ? 'size-3.5' : 'size-4', spin && 'animate-spin')} />
    </span>
  )
}

export function Panel({ title, icon, tone = 'accent', spin, meta, actions, children, className, id, label }: {
  title: string
  icon: LucideIcon
  tone?: Tone
  spin?: boolean
  meta?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  id?: string
  label?: string
}) {
  return (
    <section id={id} aria-label={label ?? title} className={cn('rounded-xl border border-hairline/5 bg-card/30 scroll-mt-4', className)}>
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-hairline/5 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <IconTile icon={icon} tone={tone} size="sm" spin={spin} />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground leading-tight">{title}</h3>
            {meta && <p className="text-xs text-muted-foreground leading-tight mt-0.5">{meta}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-1.5">{actions}</div>}
      </header>
      {children}
    </section>
  )
}

export function MonoChip({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <span title={title} className="inline-flex max-w-full items-center rounded-md border border-hairline/10 bg-hairline/5 px-1.5 py-0.5 font-mono text-[11px] text-foreground/90 break-all">
      {children}
    </span>
  )
}
