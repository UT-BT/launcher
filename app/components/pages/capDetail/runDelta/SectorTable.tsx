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
import type { SectorRow } from './runDeltaCard'

type SectorColumnId = 'sector' | 'split' | 'deltaSplit' | 'deltaTotal'

const SECTOR_COLUMNS: ResponsiveColumn[] = [
    { id: 'sector', width: '4.5rem', required: true },
    { id: 'split', width: '7rem', priority: 10 },
    { id: 'deltaSplit', width: '6.5rem', priority: 30 },
    { id: 'deltaTotal', width: '7rem', priority: 40 },
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
                        <DataTableRow key={row.index} className={cn(row.flagged && 'bg-hairline/[0.025]')}>
                            <DataTableCell align="center">
                                <span className="inline-flex items-center gap-1 text-xs font-mono text-muted-foreground tabular-nums">
                                    {row.label}
                                    {row.flagged && (
                                        <Split className="size-3 shrink-0" strokeWidth={2} role="img" aria-label="different line in this sector" />
                                    )}
                                </span>
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
            {differentLineNote && (
                <div className="flex items-center gap-1.5 px-3.5 py-2.5 text-[11px] text-muted-foreground shrink-0">
                    <Split className="size-3 shrink-0" strokeWidth={2} aria-hidden="true" />
                    <span>{differentLineNote}</span>
                </div>
            )}
        </>
    )
}
