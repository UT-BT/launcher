import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Tone } from '../types'
import { TONE_CHIP } from './tone'

interface StatCardProps {
  label: string
  value: number | string
  icon: LucideIcon
  tone?: Tone
  hint?: string
}

export function StatCard({ label, value, icon: Icon, tone = 'accent', hint }: StatCardProps) {
  return (
    <div className="bg-card/30 border border-hairline/5 rounded-xl p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</span>
        <div className={cn('p-1.5 rounded-lg border', TONE_CHIP[tone])}>
          <Icon className="size-3.5" />
        </div>
      </div>
      <div className="mt-2 text-2xl font-bold text-foreground tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
    </div>
  )
}
