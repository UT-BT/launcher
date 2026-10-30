import { useCallback, useState } from 'react'
import { cn } from '@/lib/utils'
import {
    DataTableShell,
    DataTableHeaderRow,
    DataTableHeaderCell,
    DataTableRow,
    DataTableCell,
    type ResponsiveColumn,
} from '@/app/components/shared/DataTable'
import type { DeltaTone } from './deltaCurve'
import type { SectorRow } from './runDeltaCard'

type SectorColumnId = 'sector' | 'split' | 'deltaSplit' | 'deltaTotal'

const SECTOR_COLUMNS: ResponsiveColumn[] = [
    { id: 'sector', width: '4.5rem', required: true },
    { id: 'split', width: '7rem', priority: 10 },
    { id: 'deltaSplit', width: '6.5rem', priority: 30 },
    { id: 'deltaTotal', width: '7rem', priority: 40 },
]

const TONE_TEXT: Record<DeltaTone, string> = {
    ahead: 'text-emerald-300',
    behind: 'text-red-300',
    even: 'text-muted-foreground',
}

interface SectorTableProps {
    rows: SectorRow[]
}

export function SectorTable({ rows }: SectorTableProps) {
    const [resolved, setResolved] = useState<Set<SectorColumnId> | null>(null)
    const handleResolve = useCallback((ids: Set<string>) => {
        setResolved(ids as Set<SectorColumnId>)
    }, [])
    const isVisible = (id: SectorColumnId) => !resolved || resolved.has(id)

    return (
        <DataTableShell
            className="!bg-transparent !border-0 !rounded-none"
            responsive={{ columns: SECTOR_COLUMNS, onResolve: handleResolve }}
        >
            <DataTableHeaderRow>
                <DataTableHeaderCell width="4.5rem" align="center">Sector</DataTableHeaderCell>
                {isVisible('split') && <DataTableHeaderCell align="right">Split</DataTableHeaderCell>}
                {isVisible('deltaSplit') && <DataTableHeaderCell align="right">Δ Split</DataTableHeaderCell>}
                {isVisible('deltaTotal') && <DataTableHeaderCell align="right">Δ Total</DataTableHeaderCell>}
            </DataTableHeaderRow>
            <tbody>
                {rows.map(row => (
                    <DataTableRow key={row.index}>
                        <DataTableCell align="center">
                            <span className="text-xs font-mono text-muted-foreground tabular-nums">{row.label}</span>
                        </DataTableCell>
                        {isVisible('split') && (
                            <DataTableCell align="right">
                                <span className="text-xs font-mono tabular-nums text-muted-foreground">{row.split.label}</span>
                            </DataTableCell>
                        )}
                        {isVisible('deltaSplit') && (
                            <DataTableCell align="right">
                                <span className={cn('text-xs font-mono tabular-nums', TONE_TEXT[row.deltaSplit.tone])}>
                                    {row.deltaSplit.label}
                                </span>
                            </DataTableCell>
                        )}
                        {isVisible('deltaTotal') && (
                            <DataTableCell align="right">
                                <span className={cn('text-sm font-mono tabular-nums', TONE_TEXT[row.deltaTotal.tone])}>
                                    {row.deltaTotal.label}
                                </span>
                            </DataTableCell>
                        )}
                    </DataTableRow>
                ))}
            </tbody>
        </DataTableShell>
    )
}
