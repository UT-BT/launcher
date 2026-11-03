import { useMemo, useState, type ReactNode } from 'react'
import { MapThumbnail } from '@/app/components/shared/MapThumbnail'
import {
    DataTableShell, DataTableHeaderRow, DataTableHeaderCell, DataTableRow, DataTableCell,
    type ResponsiveColumn,
} from '@/app/components/shared/DataTable'

export interface TeamTableHeader<K extends string = string> {
    align: 'left' | 'center' | 'right'
    required?: boolean
    hiddenLabel?: boolean
    sort?: K
}

interface TeamTableProps<T, K extends string> {
    id: string
    title: string
    caption?: ReactNode
    emptyText: string
    columns: readonly ResponsiveColumn[]
    headers: Record<string, TeamTableHeader<K>>
    rows: readonly T[]
    rowKey: (row: T) => string
    cell: (id: string, row: T) => ReactNode
    face: (row: T) => ReactNode
    onOpen?: (row: T) => void
    cardRows?: readonly T[]
    compactBottom?: ReactNode
    sort?: { key: K; dir: 'asc' | 'desc' }
    onSort?: (key: K) => void
}

export function MapName({ row }: { row: { map: string; displayName: string } }) {
    return (
        <span className="flex min-w-0 items-center gap-2">
            <MapThumbnail mapName={row.map} alt="" className="size-10 shrink-0 rounded-md" />
            <span className="truncate text-sm font-semibold text-foreground">{row.displayName}</span>
        </span>
    )
}

export function TeamTable<T, K extends string = string>({
    id, title, caption, emptyText, columns, headers, rows, rowKey, cell, face, onOpen, cardRows = rows, compactBottom, sort, onSort,
}: TeamTableProps<T, K>) {
    const [shown, setShown] = useState<Set<string> | null>(null)
    const [compact, setCompact] = useState(false)
    const responsiveColumns = useMemo(
        (): ResponsiveColumn<T>[] => columns.map(column => ({
            ...column,
            width: column.id === 'map' ? undefined : column.width,
            required: column.required || headers[column.id].required,
            sortKey: onSort ? headers[column.id].sort : undefined,
            cell: row => cell(column.id, row),
        })),
        [columns, headers, cell, onSort],
    )
    const visible = responsiveColumns.filter(column => !shown || shown.has(column.id))

    return (
        <section aria-labelledby={`${id}-heading`} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id={`${id}-heading`} className="text-lg font-bold text-foreground">{title}</h2>
                {caption && <span className="text-xs text-muted-foreground">{caption}</span>}
            </div>
            {rows.length === 0 ? (
                <div className="rounded-xl border border-hairline/10 bg-card/30 px-4 py-8 text-center text-sm text-muted-foreground">
                    {emptyText}
                </div>
            ) : (
                <>
                    <DataTableShell
                        responsive={{
                            columns: responsiveColumns,
                            onResolve: setShown,
                            compactAriaLabel: title,
                            onCompactChange: setCompact,
                            cards: {
                                rows: cardRows,
                                rowKey,
                                face,
                                onOpen,
                                sort: sort && onSort && { key: sort.key, direction: sort.dir, onSort: key => onSort(key as K) },
                            },
                        }}
                    >
                        <DataTableHeaderRow>
                            {visible.map(column => {
                                const header = headers[column.id]
                                const sortKey = onSort && header.sort
                                return (
                                    <DataTableHeaderCell
                                        key={column.id}
                                        align={header.align}
                                        width={column.width}
                                        sortable={!!sortKey}
                                        sortDirection={sortKey && sort?.key === sortKey ? sort.dir : null}
                                        onSort={sortKey ? () => onSort(sortKey) : undefined}
                                    >
                                        {header.hiddenLabel ? <span className="sr-only">{column.label}</span> : column.label}
                                    </DataTableHeaderCell>
                                )
                            })}
                        </DataTableHeaderRow>
                        <tbody>
                            {rows.map(row => (
                                <DataTableRow key={rowKey(row)}>
                                    {visible.map(column => (
                                        <DataTableCell key={column.id} align={headers[column.id].align}>
                                            {column.cell?.(row)}
                                        </DataTableCell>
                                    ))}
                                </DataTableRow>
                            ))}
                        </tbody>
                    </DataTableShell>
                    {compact && compactBottom}
                </>
            )}
        </section>
    )
}
