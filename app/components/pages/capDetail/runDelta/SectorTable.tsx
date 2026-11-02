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
import { NUMERIC_CELL, NUMERIC_STRONG_TEXT, NUMERIC_TABLE, NUMERIC_TEXT } from '../numericTable'
import { TONE_TEXT } from './deltaStyles'
import type { SectorRow } from './runDeltaCard'

type SectorColumnId = 'sector' | 'split' | 'deltaSplit' | 'deltaTotal'

const SECTOR_COLUMNS: ResponsiveColumn[] = [
    { id: 'sector', width: '4.5rem', required: true },
    { id: 'split', width: '4rem', priority: 10 },
    { id: 'deltaSplit', width: '4.25rem', priority: 30 },
    { id: 'deltaTotal', width: '4.5rem', priority: 40 },
]

interface SectorTableProps {
    rows: SectorRow[]
    differentLineNote: string | null
}

export function SectorTable({ rows, differentLineNote }: SectorTableProps) {
    const [resolved, setResolved] = useState<Set<SectorColumnId> | null>(null)
    const handleResolve = useCallback((ids: Set<string>) => {
        setResolved(ids as Set<SectorColumnId>)
    }, [])
    const isVisible = (id: SectorColumnId) => !resolved || resolved.has(id)

    return (
        <>
            <DataTableShell
                className={cn('!bg-transparent !border-0 !rounded-none', NUMERIC_TABLE)}
                responsive={{ columns: SECTOR_COLUMNS, onResolve: handleResolve }}
            >
                <DataTableHeaderRow>
                    <DataTableHeaderCell width="4.5rem" align="center" className={NUMERIC_CELL}>Sector</DataTableHeaderCell>
                    {isVisible('split') && <DataTableHeaderCell align="right" className={NUMERIC_CELL}>Split</DataTableHeaderCell>}
                    {isVisible('deltaSplit') && <DataTableHeaderCell align="right" className={NUMERIC_CELL}>Δ Split</DataTableHeaderCell>}
                    {isVisible('deltaTotal') && <DataTableHeaderCell align="right" className={NUMERIC_CELL}>Δ Total</DataTableHeaderCell>}
                </DataTableHeaderRow>
                <tbody>
                    {rows.map(row => (
                        <DataTableRow key={row.index} className={cn(row.flagged && 'bg-hairline/[0.025]')}>
                            <DataTableCell align="center" className={NUMERIC_CELL}>
                                <span className={cn('inline-flex items-center gap-1 text-xs font-mono text-muted-foreground tabular-nums', NUMERIC_TEXT)}>
                                    {row.label}
                                    {row.flagged && (
                                        <Split className="size-3 shrink-0" strokeWidth={2} role="img" aria-label="different line in this sector" />
                                    )}
                                </span>
                            </DataTableCell>
                            {isVisible('split') && (
                                <DataTableCell align="right" className={NUMERIC_CELL}>
                                    <span className={cn('text-xs font-mono tabular-nums text-muted-foreground', NUMERIC_TEXT)}>{row.split.label}</span>
                                </DataTableCell>
                            )}
                            {isVisible('deltaSplit') && (
                                <DataTableCell align="right" className={NUMERIC_CELL}>
                                    <span className={cn('text-xs font-mono tabular-nums', NUMERIC_TEXT, TONE_TEXT[row.deltaSplit.tone])}>
                                        {row.deltaSplit.label}
                                    </span>
                                </DataTableCell>
                            )}
                            {isVisible('deltaTotal') && (
                                <DataTableCell align="right" className={NUMERIC_CELL}>
                                    <span className={cn('text-sm font-mono tabular-nums', NUMERIC_STRONG_TEXT, TONE_TEXT[row.deltaTotal.tone])}>
                                        {row.deltaTotal.label}
                                    </span>
                                </DataTableCell>
                            )}
                        </DataTableRow>
                    ))}
                </tbody>
            </DataTableShell>
            {differentLineNote && (
                <div className="flex items-center gap-1.5 px-3.5 py-2.5 text-[11px] text-muted-foreground shrink-0">
                    <Split className="size-3 shrink-0" strokeWidth={2} aria-hidden="true" />
                    <span>{differentLineNote}</span>
                </div>
            )}
        </>
    )
}
