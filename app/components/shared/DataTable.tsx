import {
    createContext, forwardRef, Fragment, useCallback, useContext, useId, useLayoutEffect, useMemo, useRef,
    useState,
} from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useElementWidth } from '@/app/hooks/useElementWidth'
import { useDeviceEnvironment } from '@/app/device/useDeviceEnvironment'

/**
 * Shared visual primitives for tabular pages (Maps, Servers, etc).
 * Bake in the single source of truth for table styling so all pages stay
 * visually consistent. Pages still own their column definitions, sort state,
 * and cell content — these primitives only render the shell + base styles.
 */

export type SortDirection = 'asc' | 'desc' | null

export type ColumnTier = 'essential' | 'detail' | 'decorative'

export type ResponsiveColumn<Row = never> = {
    id: string
    width?: string
    priority?: number
    required?: boolean
    tier?: ColumnTier
    label?: string
    sortKey?: string
    cell?: (row: Row) => React.ReactNode
}

const DEFAULT_PRIORITY = 50
const HYSTERESIS_REM = 1.5
const SCROLLBAR_GUTTER_REM = 1
const CONDENSE_BELOW_REM = 58
const TWO_CARDS_PER_ROW_PX = 600

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

interface TableLayoutOpts extends ResolveOpts {
    touch: boolean
    tiered: boolean
}

export function resolveTableLayout(
    cols: ResponsiveColumn[],
    measuredRem: number,
    { touch, tiered, ...opts }: TableLayoutOpts,
): { visibleIds: Set<string>; hiddenIds: Set<string>; minWidth: string; table: boolean } {
    const ruled = touch && tiered
        ? cols.map(c => c.tier === 'decorative' ? c : { ...c, required: true })
        : cols
    const { requiredFits, ...res } = resolveResponsiveColumns(ruled, measuredRem, opts)
    return { ...res, table: requiredFits }
}

export function cardsPerRow(containerPx: number): 1 | 2 {
    return containerPx >= TWO_CARDS_PER_ROW_PX ? 2 : 1
}

export function cardPanelColumns<Row>(cols: readonly ResponsiveColumn<Row>[]): ResponsiveColumn<Row>[] {
    return cols.filter(c => (c.tier ?? 'detail') === 'detail')
}

export interface CardSortField {
    key: string
    label: string
}

export function cardSortFields<Row>(cols: readonly ResponsiveColumn<Row>[]): CardSortField[] {
    return cols.flatMap(c => c.sortKey ? [{ key: c.sortKey, label: c.label ?? c.id }] : [])
}

type Density = 'comfortable' | 'condensed'

const DataTableDensityContext = createContext<Density>('comfortable')

export interface DataTableCardSort {
    key: string | null
    direction: 'asc' | 'desc'
    onSort: (key: string) => void
}

export interface DataTableCards<Row> {
    rows: readonly Row[]
    rowKey: (row: Row) => string
    face: (row: Row) => React.ReactNode
    onOpen?: (row: Row) => void
    rowClassName?: (row: Row) => string | undefined
    placeholder?: React.ReactNode
    sort?: DataTableCardSort
    panel?: (row: Row) => React.ReactNode
}

export interface ResponsiveConfig<Row = never> {
    columns: ResponsiveColumn<Row>[]
    nameFloorRem?: number
    extraRem?: number
    onResolve?: (visibleIds: Set<string>) => void
    density?: boolean
    /** Mobile-first representation used when even the required columns cannot fit. */
    compactContent?: React.ReactNode
    compactAriaLabel?: string
    cards?: DataTableCards<Row>
    /** Fires when the shell switches between table and compact-card rendering.
     *  Use it to hide table-only controls (ColumnsMenu, sort headers) while cards show. */
    onCompactChange?: (compact: boolean) => void
}

interface DataTableShellProps<Row = never> {
    scrollRef?: React.RefObject<HTMLDivElement | null>
    onScroll?: () => void
    children: React.ReactNode
    className?: string
    theadDataAttr?: string
    minWidth?: string
    responsive?: ResponsiveConfig<Row>
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
export function DataTableShell<Row = never>(props: DataTableShellProps<Row>) {
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

function ResponsiveDataTableShell<Row>({
    scrollRef, onScroll, children, className, theadDataAttr,
    responsive,
}: DataTableShellProps<Row> & { responsive: ResponsiveConfig<Row> }) {
    const {
        columns, nameFloorRem = 12, extraRem = 0, onResolve,
        density: densityEnabled = true, compactContent, compactAriaLabel,
        cards, onCompactChange,
    } = responsive

    const internalRef = useRef<HTMLDivElement | null>(null)
    const setRef = useCallback((node: HTMLDivElement | null) => {
        internalRef.current = node
        if (scrollRef) scrollRef.current = node
    }, [scrollRef])

    const widthPx = useElementWidth(internalRef)
    const touch = useDeviceEnvironment(env => env.touch)
    const tiered = !!cards
    const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set())
    const prevVisibleRef = useRef<Set<string> | undefined>(undefined)
    const lastKeyRef = useRef<string>('')

    const { visibleIds, minWidth, table, density, key } = useMemo(() => {
        const measuredRem = widthPx > 0 ? widthPx / 16 - SCROLLBAR_GUTTER_REM : 0
        const res = resolveTableLayout(columns, measuredRem, {
            nameFloorRem, extraRem, prevVisible: prevVisibleRef.current, touch, tiered,
        })
        const k = [...res.visibleIds].sort().join('|')
        const d: Density = densityEnabled && measuredRem > 0 && measuredRem < CONDENSE_BELOW_REM
            ? 'condensed' : 'comfortable'
        return {
            visibleIds: res.visibleIds, minWidth: res.minWidth,
            table: res.table, density: d, key: k,
        }
    }, [columns, widthPx, nameFloorRem, extraRem, densityEnabled, touch, tiered])

    useLayoutEffect(() => {
        if (key === lastKeyRef.current) return
        lastKeyRef.current = key
        prevVisibleRef.current = visibleIds
        onResolve?.(visibleIds)
    }, [key, visibleIds, onResolve])

    const compactActive = !table && (tiered || !!compactContent)
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
                    compactActive ? 'overflow-y-auto overflow-x-hidden' : 'overflow-auto',
                    className,
                )}
                data-utbt-table-thead={theadDataAttr}
            >
                {compactActive && cards ? (
                    <DataTableCardList
                        cards={cards}
                        columns={columns}
                        ariaLabel={compactAriaLabel}
                        perRow={cardsPerRow(widthPx)}
                        expanded={expanded}
                        onExpandedChange={setExpanded}
                    />
                ) : compactActive ? (
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

const CARD_CONTROLS = 'a, button, input, select, textarea, label, summary, [role="button"], [role="link"]'

function fromControl(event: React.MouseEvent<HTMLElement>): boolean {
    const control = (event.target as Element).closest(CARD_CONTROLS)
    return !!control && event.currentTarget.contains(control)
}

interface DataTableCardListProps<Row> {
    cards: DataTableCards<Row>
    columns: readonly ResponsiveColumn<Row>[]
    ariaLabel?: string
    perRow: 1 | 2
    expanded: ReadonlySet<string>
    onExpandedChange: React.Dispatch<React.SetStateAction<ReadonlySet<string>>>
}

function DataTableCardList<Row>({
    cards, columns, ariaLabel, perRow, expanded, onExpandedChange,
}: DataTableCardListProps<Row>) {
    const panelIdBase = useId()
    const panel = cardPanelColumns(columns)
    const sortFields = cardSortFields(columns)
    const { rows, rowKey, face, onOpen, rowClassName, placeholder, sort, panel: extra } = cards
    const expandable = panel.length > 0 || !!extra

    const toggle = (key: string) => onExpandedChange(prev => {
        const next = new Set(prev)
        if (!next.delete(key)) next.add(key)
        return next
    })

    return (
        <>
            {sort && sortFields.length > 0 && <DataTableCardSortControl fields={sortFields} sort={sort} />}
            <div role="list" aria-label={ariaLabel} className={cn('grid', perRow === 2 && 'grid-cols-2')}>
                {placeholder ? (
                    <div role="listitem" className="col-span-full">{placeholder}</div>
                ) : rows.map((row, index) => {
                    const key = rowKey(row)
                    const open = expanded.has(key)
                    const panelId = `${panelIdBase}-${index}`
                    return (
                        <div
                            key={key}
                            role="listitem"
                            className={cn(
                                'min-w-0 border-b border-hairline/5 last:border-b-0',
                                perRow === 2 && 'odd:border-r',
                                rowClassName?.(row),
                            )}
                        >
                            <div className="flex items-center">
                                <div
                                    className={cn('min-w-0 flex-1 p-3', onOpen && 'cursor-pointer')}
                                    onClick={onOpen ? event => { if (!fromControl(event)) onOpen(row) } : undefined}
                                >
                                    {face(row)}
                                </div>
                                {expandable && (
                                    <button
                                        type="button"
                                        aria-label="Details"
                                        aria-expanded={open}
                                        aria-controls={open ? panelId : undefined}
                                        onClick={() => toggle(key)}
                                        className="mr-1 flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-hairline/5 hover:text-foreground transition-colors cursor-pointer"
                                    >
                                        <ChevronDown className={cn('size-5 transition-transform', open && 'rotate-180')} />
                                    </button>
                                )}
                            </div>
                            {open && (extra ? (
                                <div id={panelId} className="space-y-3 px-3 pb-3">
                                    {panel.length > 0 && <CardPanelGrid columns={panel} row={row} />}
                                    {extra(row)}
                                </div>
                            ) : (
                                <CardPanelGrid id={panelId} columns={panel} row={row} className="px-3 pb-3" />
                            ))}
                        </div>
                    )
                })}
            </div>
        </>
    )
}

function CardPanelGrid<Row>({ id, columns, row, className }: {
    id?: string
    columns: readonly ResponsiveColumn<Row>[]
    row: Row
    className?: string
}) {
    return (
        <dl id={id} className={cn('grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-2', className)}>
            {columns.map(column => (
                <Fragment key={column.id}>
                    <dt className="text-xs text-muted-foreground">{column.label ?? column.id}</dt>
                    <dd className="flex min-w-0 items-center text-sm">{column.cell?.(row)}</dd>
                </Fragment>
            ))}
        </dl>
    )
}

function DataTableCardSortControl({ fields, sort }: { fields: CardSortField[]; sort: DataTableCardSort }) {
    const selectId = useId()
    const active = fields.some(field => field.key === sort.key) ? sort.key : null
    const ascending = sort.direction === 'asc'
    const Arrow = ascending ? ArrowUp : ArrowDown
    return (
        <div className="flex items-center gap-2 border-b border-hairline/10 p-3">
            <label htmlFor={selectId} className="shrink-0 text-xs text-muted-foreground">Sort by</label>
            <select
                id={selectId}
                value={active ?? ''}
                onChange={e => sort.onSort(e.target.value)}
                style={{ colorScheme: 'dark' }}
                className="h-11 min-w-0 flex-1 px-3 bg-card/50 border border-hairline/10 rounded-lg text-sm text-foreground hover:border-hairline/20 focus:outline-none focus:border-accent-500/50 cursor-pointer"
            >
                {!active && <option value="" disabled className="bg-popover text-foreground">Choose a field</option>}
                {fields.map(field => (
                    <option key={field.key} value={field.key} className="bg-popover text-foreground">{field.label}</option>
                ))}
            </select>
            <button
                type="button"
                disabled={!active}
                onClick={() => { if (active) sort.onSort(active) }}
                className="inline-flex h-11 shrink-0 items-center gap-1.5 px-3 rounded-lg text-sm font-medium border bg-card/50 border-hairline/10 text-muted-foreground hover:text-foreground hover:border-hairline/20 transition-colors cursor-pointer disabled:cursor-default disabled:opacity-50"
            >
                <Arrow className="size-4" aria-hidden />
                {ascending ? 'Ascending' : 'Descending'}
            </button>
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
    const ariaSort = sortDirection === 'asc' ? 'ascending' : sortDirection === 'desc' ? 'descending' : undefined
    return (
        <th className={thClass} style={style} aria-sort={ariaSort}>
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

interface DataTableExpandRowProps {
    colSpan: number
    id?: string
    children: React.ReactNode
}

export function DataTableExpandRow({ colSpan, id, children }: DataTableExpandRowProps) {
    return (
        <tr id={id} className="border-b border-hairline/5 bg-hairline/[0.02]">
            <td colSpan={colSpan} className="px-4 py-4">{children}</td>
        </tr>
    )
}

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
