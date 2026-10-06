import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { Tone } from '../../types'
import { TONE_CHIP } from '../../components/tone'

export function ToneChip({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-medium whitespace-nowrap', TONE_CHIP[tone])}>
      {children}
    </span>
  )
}
