import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Tone } from '../types'
import { TONE_CHIP } from './tone'

interface SectionShellProps {
  title: string
  description?: string
  icon: LucideIcon
  tone?: Tone
  actions?: ReactNode
  children?: ReactNode
}

export function SectionShell({ title, description, icon: Icon, tone = 'accent', actions, children }: SectionShellProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className={cn('p-2.5 rounded-xl border shrink-0', TONE_CHIP[tone])}>
            <Icon className="size-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-foreground leading-tight">{title}</h1>
            {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  )
}
