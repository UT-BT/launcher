import {
    createContext, forwardRef, useCallback, useContext, useLayoutEffect, useMemo, useRef,
} from 'react'
import { ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useElementWidth } from '@/app/hooks/useElementWidth'

/**
 * Shared visual primitives for tabular pages (Maps, Servers, etc).
 * Bake in the single source of truth for table styling so all pages stay
 * visually consistent. Pages still own their column definitions, sort state,
 * and cell content — these primitives only render the shell + base styles.
 */

export type SortDirection = 'asc' | 'desc' | null

export type ResponsiveColumn = {
    id: string
    width?: string
    priority?: number
    required?: boolean
}

const DEFAULT_PRIORITY = 50
const HYSTERESIS_REM = 1.5
const SCROLLBAR_GUTTER_REM = 1
const CONDENSE_BELOW_REM = 58

export function widthToRem(width: string | undefined, floorRem: number): number {
    if (!width) return floorRem
    if (width.endsWith('rem')) {
        const n = parseFloat(width)
        return Number.isFinite(n) ? n : floorRem
    }
    if (width.endsWith('px')) {
        const n = parseFloat(width)
        return Number.isFinite(n) ? n / 16 : floorRem
    }
    return floorRem
}

interface ResolveOpts {
    nameFloorRem?: number
    extraRem?: number
    prevVisible?: Set<string>
}

export function resolveResponsiveColumns(
    cols: ResponsiveColumn[],
    measuredRem: number,
    opts: ResolveOpts = {},
): { visibleIds: Set<string>; hiddenIds: Set<string>; minWidth: string; requiredFits: boolean } {
    const { nameFloorRem = 12, extraRem = 0, prevVisible } = opts
    const budget = measuredRem > 0 ? measuredRem - extraRem : Infinity

    const order = new Map(cols.map((c, i) => [c.id, i]))
    const visibleIds = new Set<string>()
    const hiddenIds = new Set<string>()
    let running = 0

    for (const c of cols) {
        if (!c.required) continue
        visibleIds.add(c.id)
        running += widthToRem(c.width, nameFloorRem)
    }
    const requiredFits = measuredRem <= 0 || running <= budget

    const optional = cols
        .filter(c => !c.required)
        .sort((a, b) => {
            const pa = a.priority ?? DEFAULT_PRIORITY
            const pb = b.priority ?? DEFAULT_PRIORITY
            if (pa !== pb) return pb - pa
            return (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)
        })

    for (const c of optional) {
        const w = widthToRem(c.width, nameFloorRem)
        const margin = prevVisible && !prevVisible.has(c.id) ? HYSTERESIS_REM : 0
        if (running + w + margin <= budget) {
            visibleIds.add(c.id)
            running += w
        } else {
            hiddenIds.add(c.id)
        }
    }

    const minWidthRem = cols
        .filter(c => visibleIds.has(c.id))
        .reduce((sum, c) => sum + widthToRem(c.width, nameFloorRem), 0)
    return { visibleIds, hiddenIds, minWidth: `${minWidthRem + extraRem}rem`, requiredFits }
}

type Density = 'comfortable' | 'condensed'

const DataTableDensityContext = createContext<Density>('comfortable')

export interface ResponsiveConfig {
    columns: ResponsiveColumn[]
    nameFloorRem?: number
    extraRem?: number
    onResolve?: (visibleIds: Set<string>) => void
    density?: boolean
    /** Mobile-first representation used when even the required columns cannot fit. */
    compactContent?: React.ReactNode
    compactAriaLabel?: string
    /** Fires when the shell switches between table and compact-card rendering.
     *  Use it to hide table-only controls (ColumnsMenu, sort headers) while cards show. */
    onCompactChange?: (compact: boolean) => void
}

interface DataTableShellProps {
    scrollRef?: React.RefObject<HTMLDivElement | null>
    onScroll?: () => void
    children: React.ReactNode
    className?: string
    theadDataAttr?: string
    minWidth?: string
    responsive?: ResponsiveConfig
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
export function DataTableShell(props: DataTableShellProps) {
    if (props.responsive) return <ResponsiveDataTableShell {...props} responsive={props.responsive} />

    const { scrollRef, onScroll, children, className, theadDataAttr, minWidth } = props
    return (
        <div
            ref={scrollRef}
            onScroll={onScroll}
            className={cn(
                'flex-1 min-h-0 bg-card/30 border border-hairline/5 rounded-xl overflow-auto',
                className,
            )}
            data-utbt-table-thead={theadDataAttr}
        >
            <table className="w-full table-fixed text-sm" style={minWidth ? { minWidth } : undefined}>
                {children}
            </table>
        </div>
    )
}

function ResponsiveDataTableShell({
    scrollRef, onScroll, children, className, theadDataAttr,
    responsive,
}: DataTableShellProps & { responsive: ResponsiveConfig }) {
    const {
        columns, nameFloorRem = 12, extraRem = 0, onResolve,
        density: densityEnabled = true, compactContent, compactAriaLabel,
        onCompactChange,
    } = responsive

    const internalRef = useRef<HTMLDivElement | null>(null)
    const setRef = useCallback((node: HTMLDivElement | null) => {
        internalRef.current = node
        if (scrollRef) scrollRef.current = node
    }, [scrollRef])

    const widthPx = useElementWidth(internalRef)
    const prevVisibleRef = useRef<Set<string> | undefined>(undefined)
    const lastKeyRef = useRef<string>('')

    const { visibleIds, minWidth, requiredFits, density, key } = useMemo(() => {
        const measuredRem = widthPx > 0 ? widthPx / 16 - SCROLLBAR_GUTTER_REM : 0
        const res = resolveResponsiveColumns(columns, measuredRem, {
            nameFloorRem, extraRem, prevVisible: prevVisibleRef.current,
        })
        const k = [...res.visibleIds].sort().join('|')
        const d: Density = densityEnabled && measuredRem > 0 && measuredRem < CONDENSE_BELOW_REM
            ? 'condensed' : 'comfortable'
        return {
            visibleIds: res.visibleIds, minWidth: res.minWidth,
            requiredFits: res.requiredFits, density: d, key: k,
        }
    }, [columns, widthPx, nameFloorRem, extraRem, densityEnabled])

    useLayoutEffect(() => {
        if (key === lastKeyRef.current) return
        lastKeyRef.current = key
        prevVisibleRef.current = visibleIds
        onResolve?.(visibleIds)
    }, [key, visibleIds, onResolve])

    const compactActive = !requiredFits && !!compactContent
    const lastCompactRef = useRef<boolean | null>(null)
    useLayoutEffect(() => {
        if (widthPx <= 0 || lastCompactRef.current === compactActive) return
        lastCompactRef.current = compactActive
        onCompactChange?.(compactActive)
    }, [widthPx, compactActive, onCompactChange])

    return (
        <DataTableDensityContext.Provider value={density}>
            <div
                ref={setRef}
                onScroll={onScroll}
                className={cn(
                    'flex-1 min-h-0 bg-card/30 border border-hairline/5 rounded-xl',
                    requiredFits || !compactContent ? 'overflow-auto' : 'overflow-y-auto overflow-x-hidden',
                    className,
                )}
                data-utbt-table-thead={theadDataAttr}
            >
                {!requiredFits && compactContent ? (
                    <div role="list" aria-label={compactAriaLabel}>{compactContent}</div>
                ) : (
                    <table className="w-full table-fixed text-sm" style={{ minWidth }}>
                        {children}
                    </table>
                )}
            </div>
        </DataTableDensityContext.Provider>
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
            <tr className="border-b border-hairline/10">{children}</tr>
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
    const density = useContext(DataTableDensityContext)
    const pad = density === 'condensed' ? 'px-3 py-2' : 'px-4 py-3'
    const alignClass = align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'
    const thClass = cn(
        pad,
        'text-muted-foreground font-medium text-xs uppercase tracking-wider',
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
                    'inline-flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer',
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
        ? <ChevronUp className="size-3 text-accent-400" />
        : <ChevronDown className="size-3 text-accent-400" />
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
                'border-b border-hairline/5 hover:bg-hairline/[0.03] transition-colors group',
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
        const density = useContext(DataTableDensityContext)
        const pad = density === 'condensed' ? 'px-3 py-2' : 'px-4 py-3'
        const alignClass = align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : ''
        const style = width ? { width, ...(rest.style ?? {}) } : rest.style
        return (
            <td
                ref={ref}
                className={cn(pad, alignClass, className)}
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
    const density = useContext(DataTableDensityContext)
    const pad = density === 'condensed' ? 'px-3 py-2' : 'px-4 py-3'
    return (
        <tr className="border-b border-hairline/5 animate-pulse">
            {Array.from({ length: columnCount }).map((_, i) => (
                <td key={i} className={pad}>
                    <div className="h-6 w-full bg-hairline/5 rounded" />
                </td>
            ))}
        </tr>
    )
}
