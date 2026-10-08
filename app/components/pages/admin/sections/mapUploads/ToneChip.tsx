import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { Tone } from '../../types'
import { TONE_CHIP } from '../../components/tone'

export function ToneChip({ tone, dot, pulse, children }: { tone: Tone; dot?: boolean; pulse?: boolean; children: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-medium whitespace-nowrap', TONE_CHIP[tone])}>
      {dot && <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full bg-current', pulse && 'animate-pulse')} />}
      {children}
    </span>
  )
}
