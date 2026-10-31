import { useCallback, useState } from 'react'
import { Split } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
    DataTableShell,
    DataTableHeaderRow,
    DataTableHeaderCell,
    DataTableRow,
    DataTableCell,
    type ResponsiveColumn,
} from '@/app/components/shared/DataTable'
import { TONE_TEXT } from './deltaStyles'
import type { SignedGap } from './deltaCurve'
import { SPEED_SPLIT_NOTE } from './runDeltaCopy'
import type { RunSpeed, SpeedGap } from './runSpeed'

type SpeedColumnId = 'sector' | 'speed' | 'fromSpeed' | 'fromLine'

const SPEED_COLUMNS: ResponsiveColumn[] = [
    { id: 'sector', width: '4.5rem', required: true },
    { id: 'speed', width: '7rem', priority: 10 },
    { id: 'fromSpeed', width: '6.5rem', priority: 30 },
    { id: 'fromLine', width: '6.5rem', priority: 40 },
]

interface SpeedTableProps {
    speed: RunSpeed
    differentLineNote: string | null
    selectedSector: number | null
    onSelectSector: (index: number) => void
}

function distanceChange(runner: number, reference: number): string {
    if (reference <= 0) return ''
    const percent = ((runner - reference) / reference) * 100
    const rounded = Math.abs(percent).toFixed(1)
    if (rounded === '0.0') return ' (same)'
    return ` (${percent > 0 ? '+' : '−'}${rounded}%)`
}

function SpeedCell({ value, gap, strong }: { value: number; gap: SpeedGap; strong?: boolean }) {
    return (
        <span className="inline-flex items-baseline justify-end gap-1.5 font-mono tabular-nums">
            <span className={cn(strong ? 'text-sm text-foreground' : 'text-xs text-muted-foreground')}>{value}</span>
            <span className={cn('text-[10px]', TONE_TEXT[gap.tone])}>{gap.label}</span>
        </span>
    )
}

function GapCell({ gap, strong }: { gap: SignedGap; strong?: boolean }) {
    return (
        <span className={cn('font-mono tabular-nums', strong ? 'text-sm' : 'text-xs', TONE_TEXT[gap.tone])}>
            {gap.label}
        </span>
    )
}

export function SpeedTable({ speed, differentLineNote, selectedSector, onSelectSector }: SpeedTableProps) {
    const [resolved, setResolved] = useState<Set<SpeedColumnId> | null>(null)
    const handleResolve = useCallback((ids: Set<string>) => {
        setResolved(ids as Set<SpeedColumnId>)
    }, [])
    const isVisible = (id: SpeedColumnId) => !resolved || resolved.has(id)
    const { rows, totals } = speed

    return (
        <>
            <DataTableShell
                className="!bg-transparent !border-0 !rounded-none"
                responsive={{ columns: SPEED_COLUMNS, onResolve: handleResolve }}
            >
                <DataTableHeaderRow>
                    <DataTableHeaderCell width="4.5rem" align="center">Sector</DataTableHeaderCell>
                    {isVisible('speed') && <DataTableHeaderCell align="right">Avg speed</DataTableHeaderCell>}
                    {isVisible('fromSpeed') && <DataTableHeaderCell align="right">Δ Speed</DataTableHeaderCell>}
                    {isVisible('fromLine') && <DataTableHeaderCell align="right">Δ Line</DataTableHeaderCell>}
                </DataTableHeaderRow>
                <tbody>
                    {rows.map(row => (
                        <DataTableRow
                            key={row.index}
                            className={cn(
                                row.flagged && 'bg-hairline/[0.025]',
                                selectedSector === row.index && 'bg-accent-500/10 hover:bg-accent-500/15',
                            )}
                        >
                            <DataTableCell align="center">
                                <button
                                    type="button"
                                    aria-pressed={selectedSector === row.index}
                                    aria-label={`Zoom the speed chart to ${row.label}`}
                                    onClick={() => onSelectSector(row.index)}
                                    className="inline-flex w-full items-center justify-center gap-1 rounded text-xs font-mono text-muted-foreground tabular-nums cursor-pointer hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/60"
                                >
                                    {row.label}
                                    {row.flagged && (
                                        <Split className="size-3 shrink-0" strokeWidth={2} role="img" aria-label="different line in this sector" />
                                    )}
                                </button>
                            </DataTableCell>
                            {isVisible('speed') && (
                                <DataTableCell align="right">
                                    <SpeedCell value={row.runnerSpeed} gap={row.speedGap} />
                                </DataTableCell>
                            )}
                            {isVisible('fromSpeed') && (
                                <DataTableCell align="right">
                                    <GapCell gap={row.fromSpeed} />
                                </DataTableCell>
                            )}
                            {isVisible('fromLine') && (
                                <DataTableCell align="right">
                                    <GapCell gap={row.fromLine} />
                                </DataTableCell>
                            )}
                        </DataTableRow>
                    ))}
                </tbody>
            </DataTableShell>
            <div className="flex flex-col gap-1 px-3.5 py-2.5 text-[11px] text-muted-foreground shrink-0">
                <span className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                    <span>Whole run</span>
                    <span className="inline-flex items-baseline gap-1.5">
                        <SpeedCell value={totals.runnerSpeed} gap={totals.speedGap} strong /> UU/s
                    </span>
                    <span className="inline-flex items-baseline gap-1.5">Δ Speed <GapCell gap={totals.fromSpeed} strong /></span>
                    <span className="inline-flex items-baseline gap-1.5">Δ Line <GapCell gap={totals.fromLine} strong /></span>
                    <span className="font-mono tabular-nums">
                        {totals.runnerDistance.toLocaleString('en-US')} UU
                        {distanceChange(totals.runnerDistance, totals.referenceDistance)}
                    </span>
                </span>
                <span className="xl:hidden">{SPEED_SPLIT_NOTE}</span>
                {differentLineNote && (
                    <span className="flex items-center gap-1.5">
                        <Split className="size-3 shrink-0" strokeWidth={2} aria-hidden="true" />
                        <span>{differentLineNote}</span>
                    </span>
                )}
            </div>
        </>
    )
}
