import { forwardRef } from 'react'
import { ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Shared visual primitives for tabular pages (Maps, Servers, etc).
 * Bake in the single source of truth for table styling so all pages stay
 * visually consistent. Pages still own their column definitions, sort state,
 * and cell content — these primitives only render the shell + base styles.
 */

export type SortDirection = 'asc' | 'desc' | null

interface DataTableShellProps {
    scrollRef?: React.RefObject<HTMLDivElement | null>
    onScroll?: () => void
    children: React.ReactNode
    className?: string
    theadDataAttr?: string
}

/**
 * Outer scroll container + table + sticky thead structure. Children are the
 * <thead>/<tbody> elements rendered by the page.
 *
 * Usage:
 *   <DataTableShell scrollRef={ref} onScroll={onScroll}>
 *     <DataTableHeaderRow>...</DataTableHeaderRow>
 *     <tbody>...</tbody>
 *   </DataTableShell>
 */
export function DataTableShell({
    scrollRef, onScroll, children, className, theadDataAttr,
}: DataTableShellProps) {
    return (
        <div
            ref={scrollRef}
            onScroll={onScroll}
            className={cn(
                'flex-1 min-h-0 bg-card/30 border border-white/5 rounded-xl overflow-auto',
                className,
            )}
            data-utbt-table-thead={theadDataAttr}
        >
            <table className="w-full text-sm">
                {children}
            </table>
        </div>
    )
}

interface DataTableHeaderRowProps {
    children: React.ReactNode
    theadDataAttr?: string
}

/**
 * Sticky thead + bordered tr wrapper. Use one per table.
 *
 * `theadDataAttr` writes a `data-*` attribute on the <thead> so the tutorial
 * can lift its z-index during a sort step (sticky elements with z-index
 * establish stacking contexts that trap inline z-index lifts on children).
 */
export function DataTableHeaderRow({ children, theadDataAttr }: DataTableHeaderRowProps) {
    const dataProps = theadDataAttr ? { [theadDataAttr]: true } : {}
    return (
        <thead className="sticky top-0 z-[2] bg-card/95 backdrop-blur" {...dataProps}>
            <tr className="border-b border-white/10">{children}</tr>
        </thead>
    )
}

interface DataTableHeaderCellProps {
    children?: React.ReactNode
    align?: 'left' | 'center' | 'right'
    width?: string
    className?: string
    sortable?: boolean
    sortDirection?: SortDirection
    onSort?: () => void
    buttonRef?: React.RefObject<HTMLButtonElement | null>
}

/**
 * Standardized <th>. Padding, font size, weight, color all locked here.
 *
 * For sortable columns: pass `sortable`, `sortDirection`, and `onSort`. The
 * cell renders a button with a sort-direction icon. Non-sortable columns
 * render plain text.
 */
export function DataTableHeaderCell({
    children, align = 'left', width, className,
    sortable, sortDirection = null, onSort, buttonRef,
}: DataTableHeaderCellProps) {
    const alignClass = align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'
    const thClass = cn(
        'px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wider',
        alignClass,
        className,
    )
    const style = width ? { width } : undefined

    if (!sortable) {
        return <th className={thClass} style={style}>{children}</th>
    }

    const justify = align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : ''
    return (
        <th className={thClass} style={style}>
            <button
                ref={buttonRef}
                type="button"
                onClick={onSort}
                className={cn(
                    'inline-flex items-center gap-1 hover:text-white transition-colors cursor-pointer',
                    justify,
                )}
            >
                {children}
                <SortIcon direction={sortDirection} />
            </button>
        </th>
    )
}

interface SortIconProps {
    direction: SortDirection
}

export function SortIcon({ direction }: SortIconProps) {
    if (direction === null) return <ArrowUpDown className="size-3 opacity-30" />
    return direction === 'asc'
        ? <ChevronUp className="size-3 text-blue-400" />
        : <ChevronDown className="size-3 text-blue-400" />
}

interface DataTableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
    children: React.ReactNode
}

/**
 * Standardized body <tr>. Lock hover + border styling here. Pass through any
 * other tr props (onClick, etc) via spread.
 */
export function DataTableRow({ children, className, ...rest }: DataTableRowProps) {
    return (
        <tr
            className={cn(
                'border-b border-white/5 hover:bg-white/[0.03] transition-colors group',
                className,
            )}
            {...rest}
        >
            {children}
        </tr>
    )
}

interface DataTableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
    children?: React.ReactNode
    align?: 'left' | 'center' | 'right'
    width?: string
}

/**
 * Standardized <td>. Padding locked here. Forwards ref so tutorial / scroll
 * helpers can measure specific cells.
 */
export const DataTableCell = forwardRef<HTMLTableCellElement, DataTableCellProps>(
    function DataTableCell({ children, align = 'left', width, className, ...rest }, ref) {
        const alignClass = align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : ''
        const style = width ? { width, ...(rest.style ?? {}) } : rest.style
        return (
            <td
                ref={ref}
                className={cn('px-4 py-3', alignClass, className)}
                style={style}
                {...rest}
            >
                {children}
            </td>
        )
    },
)

interface DataTableEmptyProps {
    colSpan: number
    message?: string
}

/**
 * Empty-state row. Text only, centered, generous vertical padding.
 */
export function DataTableEmpty({ colSpan, message = 'No items match your filters.' }: DataTableEmptyProps) {
    return (
        <tr>
            <td colSpan={colSpan} className="px-4 py-16 text-center text-muted-foreground">
                {message}
            </td>
        </tr>
    )
}

interface DataTableSkeletonRowProps {
    columnCount: number
}

/**
 * Uniform skeleton row — one shimmer bar per visible column. Pages with rich
 * per-column skeletons (different widths per cell shape) can render their own
 * row instead of using this.
 */
export function DataTableSkeletonRow({ columnCount }: DataTableSkeletonRowProps) {
    return (
        <tr className="border-b border-white/5 animate-pulse">
            {Array.from({ length: columnCount }).map((_, i) => (
                <td key={i} className="px-4 py-3">
                    <div className="h-6 w-full bg-white/5 rounded" />
                </td>
            ))}
        </tr>
    )
}
