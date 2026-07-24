import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/app/components/ui/button'
import { Tooltip } from '@/app/components/ui/tooltip'

export const PAGE_SIZE_OPTIONS: (number | 'auto')[] = ['auto', 10, 25, 50, 100, 200]

export function buildPageList(current: number, total: number): (number | 'ellipsis')[] {
    if (total <= 7) {
        return Array.from({ length: total }, (_, i) => i + 1)
    }
    const pages: (number | 'ellipsis')[] = [1]
    const start = Math.max(2, current - 1)
    const end = Math.min(total - 1, current + 1)
    if (start > 2) pages.push('ellipsis')
    for (let i = start; i <= end; i++) pages.push(i)
    if (end < total - 1) pages.push('ellipsis')
    pages.push(total)
    return pages
}

interface PaginationBarProps {
    page: number
    totalPages: number
    pageSize: number
    totalForCount: number
    pageSizePreference: number | 'auto'
    autoPageSize: number
    onPageChange: (p: number) => void
    onPageSizeChange: (pref: number | 'auto') => void
    /** Optional badge shown next to the count summary (e.g. "(search)", "(filtered)"). */
    meta?: string
}

export function PaginationBar({
    page, totalPages, pageSize, totalForCount,
    pageSizePreference, autoPageSize,
    onPageChange, onPageSizeChange, meta,
}: PaginationBarProps) {
    const [jumpInput, setJumpInput] = useState('')
    const [mobilePageInput, setMobilePageInput] = useState(String(page))
    useEffect(() => { setMobilePageInput(String(page)) }, [page])
    const pageList = buildPageList(page, totalPages)

    const handleJump = () => {
        const n = parseInt(jumpInput, 10)
        if (!isNaN(n) && n >= 1 && n <= totalPages) {
            onPageChange(n)
            setJumpInput('')
        }
    }

    const commitMobilePage = () => {
        const n = parseInt(mobilePageInput, 10)
        if (!isNaN(n) && n >= 1 && n <= totalPages && n !== page) {
            onPageChange(n)
        } else {
            setMobilePageInput(String(page))
        }
    }

    return (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground shrink-0">
            <div className="flex items-center gap-3 max-sm:w-full max-sm:justify-between">
                <span className="max-sm:text-xs">
                    Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalForCount)} of {totalForCount}
                    {meta && <span className="ml-2 opacity-50">({meta})</span>}
                </span>
                <div className="flex items-center gap-2">
                    <label className="text-xs uppercase tracking-wider max-sm:hidden">Per page</label>
                    <select
                        value={String(pageSizePreference)}
                        onChange={e => {
                            const v = e.target.value
                            onPageSizeChange(v === 'auto' ? 'auto' : parseInt(v, 10))
                        }}
                        style={{ colorScheme: 'dark' }}
                        aria-label="Rows per page"
                        className="px-2 py-1 bg-card/50 border border-hairline/10 rounded text-xs text-foreground focus:outline-none focus:border-accent-500/50 cursor-pointer"
                    >
                        {PAGE_SIZE_OPTIONS.map(opt => (
                            <option key={String(opt)} value={String(opt)} className="bg-[#0f1115] text-foreground">
                                {opt === 'auto' ? `Auto (${autoPageSize})` : opt}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {totalPages > 1 && (
                <>
                    <div className="hidden sm:flex items-center gap-1.5">
                        <Tooltip content="First page" side="top">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onPageChange(1)}
                                disabled={page <= 1}
                                className="text-muted-foreground hover:text-foreground px-2"
                            >
                                «
                            </Button>
                        </Tooltip>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onPageChange(Math.max(1, page - 1))}
                            disabled={page <= 1}
                            className="text-muted-foreground hover:text-foreground px-2"
                        >
                            ‹ Prev
                        </Button>

                        <div className="flex items-center gap-1">
                            {pageList.map((p, i) =>
                                p === 'ellipsis' ? (
                                    <span key={`e${i}`} className="px-1 text-muted-foreground/50 select-none">…</span>
                                ) : (
                                    <button
                                        key={p}
                                        onClick={() => onPageChange(p)}
                                        className={cn(
                                            "min-w-7 h-7 px-2 rounded border text-xs transition-colors cursor-pointer",
                                            p === page
                                                ? "bg-accent-500/20 border-accent-500/50 text-accent-200 font-bold"
                                                : "bg-card/50 border-hairline/10 text-muted-foreground hover:text-foreground hover:border-hairline/20"
                                        )}
                                    >
                                        {p}
                                    </button>
                                )
                            )}
                        </div>

                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
                            disabled={page >= totalPages}
                            className="text-muted-foreground hover:text-foreground px-2"
                        >
                            Next ›
                        </Button>
                        <Tooltip content="Last page" side="top">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onPageChange(totalPages)}
                                disabled={page >= totalPages}
                                className="text-muted-foreground hover:text-foreground px-2"
                            >
                                »
                            </Button>
                        </Tooltip>

                        <div className="flex items-center gap-1 ml-2">
                            <input
                                type="number"
                                min={1}
                                max={totalPages}
                                value={jumpInput}
                                onChange={e => setJumpInput(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') handleJump() }}
                                placeholder="Go to"
                                className="w-16 px-2 py-1 bg-card/50 border border-hairline/10 rounded text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-accent-500/50"
                            />
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleJump}
                                disabled={!jumpInput}
                                className="text-muted-foreground hover:text-foreground px-2"
                            >
                                Go
                            </Button>
                        </div>
                    </div>

                    <div className="flex sm:hidden items-center justify-between w-full gap-2">
                        <button
                            type="button"
                            onClick={() => onPageChange(Math.max(1, page - 1))}
                            disabled={page <= 1}
                            className="flex-1 h-10 rounded-lg border border-hairline/10 bg-card/50 text-sm font-medium text-muted-foreground active:bg-hairline/10 disabled:opacity-40 cursor-pointer"
                        >
                            ‹ Prev
                        </button>
                        <div className="flex items-center gap-1.5 px-2 text-xs whitespace-nowrap">
                            <input
                                type="number"
                                inputMode="numeric"
                                min={1}
                                max={totalPages}
                                value={mobilePageInput}
                                onChange={e => setMobilePageInput(e.target.value)}
                                onBlur={commitMobilePage}
                                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                                aria-label="Current page"
                                className="w-14 h-10 px-1 text-center bg-card/50 border border-hairline/10 rounded-lg text-sm font-bold tabular-nums text-foreground focus:outline-none focus:border-accent-500/50"
                            />
                            <span className="text-muted-foreground">/ {totalPages.toLocaleString()}</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
                            disabled={page >= totalPages}
                            className="flex-1 h-10 rounded-lg border border-hairline/10 bg-card/50 text-sm font-medium text-muted-foreground active:bg-hairline/10 disabled:opacity-40 cursor-pointer"
                        >
                            Next ›
                        </button>
                    </div>
                </>
            )}
        </div>
    )
}
