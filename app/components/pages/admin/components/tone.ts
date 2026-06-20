import type { Tone } from '../types'

export const TONE_CHIP: Record<Tone, string> = {
  accent: 'bg-accent-500/15 text-accent-300 border-accent-500/30',
  emerald: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  red: 'bg-red-500/15 text-red-300 border-red-500/30',
  amber: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
}

export const TONE_BTN: Record<Tone, string> = {
  accent: 'bg-accent-500/15 border-accent-500/40 text-accent-200',
  emerald: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
  red: 'bg-red-500/10 border-red-500/30 text-red-300',
  amber: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
}
