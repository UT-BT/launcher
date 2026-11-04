import { cn } from '@/lib/utils'
import { BASELINE } from '../analysis/analysisLabels'
import { OLDER_VIDEO } from '../drawer/rosterRows'

const SIDE_TONES = ['bg-pickban-a/15 text-pickban-a', 'bg-pickban-b/15 text-pickban-b'] as const

export function BaselineTag({ className }: { className?: string }) {
    return <span className={cn('run-compare-baseline', className)}>{BASELINE}</span>
}

export function SideTag({ side, label }: { side: number | null; label: string | null }) {
    if (label === null || (side !== 0 && side !== 1)) return null
    return <span className={cn('run-compare-side', SIDE_TONES[side])}>{label}</span>
}

export function NoteTags({ notes }: { notes: readonly string[] }) {
    return notes.map(note => <span key={note} className="run-compare-note">{note}</span>)
}

export function OlderVideoTag({ shown }: { shown: boolean }) {
    if (!shown) return null
    return <span className="run-compare-note is-older">{OLDER_VIDEO}</span>
}
