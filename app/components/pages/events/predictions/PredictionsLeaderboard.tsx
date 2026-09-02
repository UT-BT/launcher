import { useCallback, useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import {
    DataTableCell, DataTableEmpty, DataTableHeaderCell, DataTableHeaderRow, DataTableRow,
    DataTableShell, type ResponsiveColumn,
} from '@/app/components/shared/DataTable'
import { PaginationBar } from '@/app/components/ui/pagination'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { ErrorBanner } from '@/app/components/pages/teams/teamsShared'
import {
    eventErrorMessage, fetchEventPredictionLeaderboard,
    type PredictionLeaderboard,
} from '@/app/utils/api'
import { CoinAmount, formatCoins } from './predictionsShared'

const COLUMNS: ResponsiveColumn[] = [
    { id: 'rank', width: '3rem', required: true },
    { id: 'player', width: '14rem', required: true },
    { id: 'coins', width: '6rem', required: true },
    { id: 'profit', width: '6rem', priority: 90 },
    { id: 'inplay', width: '6rem', priority: 70 },
    { id: 'record', width: '7rem', priority: 60 },
]

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

    const compact = (
        <div className="divide-y divide-hairline/5">
            {board.items.map(row => (
                <div
                    key={row.user_id}
                    role="listitem"
                    className={cn(
                        'flex items-center justify-between gap-2 min-w-0 px-4 py-2',
                        viewerId && row.user_id === viewerId && 'bg-accent-500/[0.06]',
                    )}
                >
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="w-6 shrink-0 text-right tabular-nums text-muted-foreground">{row.rank}</span>
                        <PlayerInfo userId={row.user_id} alias={row.alias} size="sm" />
                    </div>
                    <div className="shrink-0 text-right">
                        <div className="tabular-nums text-foreground font-semibold">{formatCoins(row.net_worth)}</div>
                        <div className="text-[11px]"><CoinAmount value={row.profit} signed /></div>
                    </div>
                </div>
            ))}
        </div>
    )

    return (
        <div className="flex flex-col gap-3">
            <ErrorBanner message={error} />

            {board.your_rank !== null && (
                <div className="text-xs text-muted-foreground">
                    You are ranked <span className="text-accent-300 font-semibold tabular-nums">#{board.your_rank}</span>
                    {' '}of {board.total.toLocaleString()}.
                </div>
            )}

            <DataTableShell responsive={{
                columns: COLUMNS,
                nameFloorRem: 14,
                compactContent: compact,
                compactAriaLabel: 'Prediction leaderboard',
                onResolve,
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
                        <DataTableEmpty
                            colSpan={columnCount}
                            message={loading ? 'Loading…' : 'Nobody has claimed their coins yet.'}
                        />
                    ) : board.items.map(row => (
                        <DataTableRow
                            key={row.user_id}
                            className={cn(viewerId && row.user_id === viewerId && 'bg-accent-500/[0.06]')}
                        >
                            <DataTableCell align="right" className="tabular-nums text-muted-foreground">
                                {row.rank}
                            </DataTableCell>
                            <DataTableCell>
                                <PlayerInfo userId={row.user_id} alias={row.alias} size="sm" />
                            </DataTableCell>
                            <DataTableCell align="right" className="tabular-nums font-semibold text-foreground">
                                {formatCoins(row.net_worth)}
                            </DataTableCell>
                            {shows('profit') && (
                                <DataTableCell align="right">
                                    <CoinAmount value={row.profit} signed />
                                </DataTableCell>
                            )}
                            {shows('inplay') && (
                                <DataTableCell align="right" className="tabular-nums text-muted-foreground">
                                    {formatCoins(row.staked)}
                                </DataTableCell>
                            )}
                            {shows('record') && (
                                <DataTableCell align="right" className="tabular-nums text-muted-foreground">
                                    {row.positions_won}–{row.positions_lost}–{row.positions_refunded}
                                </DataTableCell>
                            )}
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
