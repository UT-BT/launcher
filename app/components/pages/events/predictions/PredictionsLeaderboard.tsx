import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import {
    DataTableCell, DataTableEmpty, DataTableHeaderCell, DataTableHeaderRow, DataTableRow,
    DataTableShell, type ResponsiveColumn,
} from '@/app/components/shared/DataTable'
import { PaginationBar } from '@/app/components/ui/pagination'
import { openPlayer, PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { ErrorBanner } from '@/app/components/pages/teams/teamsShared'
import {
    eventErrorMessage, fetchEventPredictionLeaderboard,
    type PredictionLeaderboard, type PredictionLeaderboardRow,
} from '@/app/utils/api'
import { CHIP_SHAPE } from '@/app/components/shared/chipStyles'
import { CoinAmount, formatCoins } from './predictionsShared'
import { PROJECTED_NOTE, pendingChipLabel, pendingChipTitle, showsProjectedNote } from './leaderboardView'

type LeaderboardColumnId = 'rank' | 'player' | 'coins' | 'profit' | 'inplay' | 'record'

const CELL_LAYOUT: Record<LeaderboardColumnId, { align?: 'right'; className?: string }> = {
    rank: { align: 'right', className: 'tabular-nums text-muted-foreground' },
    player: {},
    coins: { align: 'right', className: 'tabular-nums font-semibold text-foreground' },
    profit: { align: 'right' },
    inplay: { align: 'right', className: 'tabular-nums text-muted-foreground' },
    record: { align: 'right', className: 'tabular-nums text-muted-foreground' },
}

const COLUMNS: (ResponsiveColumn<PredictionLeaderboardRow> & { id: LeaderboardColumnId })[] = ([
    { id: 'rank', width: '3rem', required: true, tier: 'essential', label: 'Rank' },
    { id: 'player', width: '14rem', required: true, tier: 'essential', label: 'Player' },
    { id: 'coins', width: '6rem', required: true, tier: 'essential', label: 'Coins' },
    { id: 'profit', width: '6rem', priority: 90, tier: 'essential', label: 'Profit' },
    { id: 'inplay', width: '6rem', priority: 70, tier: 'detail', label: 'In play' },
    { id: 'record', width: '7rem', priority: 60, tier: 'detail', label: 'W–L–R' },
] as const).map(column => ({ ...column, cell: (row: PredictionLeaderboardRow) => leaderboardCell(column.id, row) }))

function PendingChip({ row }: { row: PredictionLeaderboardRow }) {
    const label = pendingChipLabel(row)
    if (label === null) return null
    return (
        <span
            title={pendingChipTitle(row) ?? undefined}
            className={cn('shrink-0', CHIP_SHAPE, 'bg-amber-500/15 text-amber-300 border-amber-500/30')}
        >
            {label}
            <span className="sr-only"> ({pendingChipTitle(row)})</span>
        </span>
    )
}

function leaderboardCell(id: LeaderboardColumnId, row: PredictionLeaderboardRow): ReactNode {
    switch (id) {
        case 'rank': return row.rank
        case 'player': return (
            <div className="flex items-center gap-2 min-w-0">
                <PlayerInfo userId={row.user_id} alias={row.alias} size="sm" />
                <PendingChip row={row} />
            </div>
        )
        case 'coins': return formatCoins(row.net_worth)
        case 'profit': return <CoinAmount value={row.profit} signed />
        case 'inplay': return formatCoins(row.staked)
        case 'record': return <>{row.positions_won}–{row.positions_lost}–{row.positions_refunded}</>
    }
}

function LeaderboardFace({ row }: { row: PredictionLeaderboardRow }) {
    return (
        <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
                <span className="w-6 shrink-0 text-right tabular-nums text-muted-foreground">{row.rank}</span>
                {leaderboardCell('player', row)}
            </div>
            <div className="shrink-0 text-right">
                <div className="tabular-nums text-foreground font-semibold">{leaderboardCell('coins', row)}</div>
                <div className="text-[11px]">{leaderboardCell('profit', row)}</div>
            </div>
        </div>
    )
}

const EMPTY: PredictionLeaderboard = { total: 0, items: [], your_rank: null }

export function PredictionsLeaderboard({ slug, accessToken, viewerId }: {
    slug: string
    accessToken: string
    viewerId?: string
}) {
    const [board, setBoard] = useState<PredictionLeaderboard>(EMPTY)
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(50)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [visible, setVisible] = useState<Set<string>>(new Set(COLUMNS.map(column => column.id)))
    const onResolve = useCallback((ids: Set<string>) => setVisible(ids), [])
    const shows = (id: string) => visible.has(id)

    useEffect(() => {
        const controller = new AbortController()
        setLoading(true)
        fetchEventPredictionLeaderboard(
            accessToken, slug, { limit: pageSize, offset: (page - 1) * pageSize }, controller.signal,
        )
            .then(next => { setBoard(next); setError(null) })
            .catch(e => { if (!controller.signal.aborted) setError(eventErrorMessage(e)) })
            .finally(() => { if (!controller.signal.aborted) setLoading(false) })

        return () => controller.abort()
    }, [accessToken, slug, page, pageSize])

    const totalPages = Math.max(1, Math.ceil(board.total / pageSize))
    const columnCount = COLUMNS.filter(column => shows(column.id)).length

    const highlight = (row: PredictionLeaderboardRow) => viewerId && row.user_id === viewerId ? 'bg-accent-500/[0.06]' : undefined
    const emptyMessage = loading ? 'Loading…' : 'Nobody has claimed their coins yet.'

    return (
        <div className="flex flex-col gap-3">
            <ErrorBanner message={error} />

            {board.your_rank !== null && (
                <div className="text-xs text-muted-foreground">
                    You are ranked <span className="text-accent-300 font-semibold tabular-nums">#{board.your_rank}</span>
                    {' '}of {board.total.toLocaleString()}.
                </div>
            )}

            {showsProjectedNote(board) && (
                <div className="text-xs text-amber-300">{PROJECTED_NOTE}</div>
            )}

            <DataTableShell responsive={{
                columns: COLUMNS,
                nameFloorRem: 14,
                compactAriaLabel: 'Prediction leaderboard',
                onResolve,
                cards: {
                    rows: board.items,
                    rowKey: row => row.user_id,
                    face: row => <LeaderboardFace row={row} />,
                    onOpen: row => openPlayer(row.user_id),
                    rowClassName: highlight,
                    placeholder: board.items.length === 0 && (
                        <div className="px-4 py-16 text-center text-muted-foreground">{emptyMessage}</div>
                    ),
                },
            }}>
                <DataTableHeaderRow>
                    <DataTableHeaderCell width="3rem" align="right">#</DataTableHeaderCell>
                    <DataTableHeaderCell width="14rem">Player</DataTableHeaderCell>
                    <DataTableHeaderCell width="6rem" align="right">Coins</DataTableHeaderCell>
                    {shows('profit') && <DataTableHeaderCell width="6rem" align="right">Profit</DataTableHeaderCell>}
                    {shows('inplay') && <DataTableHeaderCell width="6rem" align="right">In play</DataTableHeaderCell>}
                    {shows('record') && <DataTableHeaderCell width="7rem" align="right">W–L–R</DataTableHeaderCell>}
                </DataTableHeaderRow>
                <tbody>
                    {board.items.length === 0 ? (
                        <DataTableEmpty colSpan={columnCount} message={emptyMessage} />
                    ) : board.items.map(row => (
                        <DataTableRow key={row.user_id} className={highlight(row)}>
                            {COLUMNS.filter(column => shows(column.id)).map(column => (
                                <DataTableCell key={column.id} align={CELL_LAYOUT[column.id].align} className={CELL_LAYOUT[column.id].className}>
                                    {column.cell?.(row)}
                                </DataTableCell>
                            ))}
                        </DataTableRow>
                    ))}
                </tbody>
            </DataTableShell>

            {board.total > pageSize && (
                <PaginationBar
                    page={page}
                    totalPages={totalPages}
                    pageSize={pageSize}
                    totalForCount={board.total}
                    pageSizePreference={pageSize}
                    autoPageSize={pageSize}
                    onPageChange={setPage}
                    onPageSizeChange={pref => {
                        setPageSize(typeof pref === 'number' ? pref : 50)
                        setPage(1)
                    }}
                />
            )}
        </div>
    )
}
