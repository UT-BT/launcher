import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDownWideNarrow, ArrowUpNarrowWide, BarChart3, ChevronLeft, ChevronRight, EyeOff, Medal, Minus, Plus, SlidersHorizontal, Target, Timer, Trophy } from 'lucide-react'
import { fetchBestCaps, fetchMapsMetadata, type BestCap, type MapMetadata } from '@/app/utils/api'
import { displayMapName, formatCapTime, formatDelta } from '@/app/utils/format'
import { getMedalIcon } from '@/app/utils/medals'
import { difficultyTextColor } from '@/app/utils/scoreColors'
import { MapThumbnail } from '@/app/components/shared/MapThumbnail'
import { FavoriteStar } from '@/app/components/shared/FavoriteStar'
import { Tooltip } from '@/app/components/ui/tooltip'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

interface MedalHuntCardProps {
    accessToken?: string
    userId?: string | number | null
    refreshKey?: number
    favoriteMapNames: Set<string>
    onToggleFavorite: (mapName: string) => void
    onMapSelect?: (mapName: string) => void
    limit?: number
}

type TargetMedal = 'Bronze Medal' | 'Silver Medal' | 'Gold Medal' | 'Champion Medal' | 'World Record'

interface Opportunity {
    mapName: string
    difficulty: number
    currentTime: number
    targetTime: number
    targetMedal: TargetMedal
    improvement: number
    improvementPct: number
}

const CERTIFIED_CAP_TYPE = 2
const WR_EPSILON_SECONDS = 0.0005
const HIDDEN_STORAGE_KEY_PREFIX = 'utbt:homeMedalHuntHidden:v1'
const ROW_HEIGHT_PX = 64

const TARGET_MEDALS: TargetMedal[] = ['Bronze Medal', 'Silver Medal', 'Gold Medal', 'Champion Medal', 'World Record']
const MEDAL_FILTER_ORDER: TargetMedal[] = ['World Record', 'Champion Medal', 'Gold Medal', 'Silver Medal', 'Bronze Medal']
const MEDAL_RANK: Record<TargetMedal, number> = {
    'Bronze Medal': 1,
    'Silver Medal': 2,
    'Gold Medal': 3,
    'Champion Medal': 4,
    'World Record': 5,
}

type ImproveWindow = 'all' | '1' | '3' | '5' | '10' | '30'
type SortField = 'improve' | 'medal' | 'rating'
type SortDir = 'asc' | 'desc'

const IMPROVE_WINDOW_LABELS: Record<ImproveWindow, string> = {
    all: 'Any improvement',
    '1': 'Within 1s',
    '3': 'Within 3s',
    '5': 'Within 5s',
    '10': 'Within 10s',
    '30': 'Within 30s',
}
const IMPROVE_FILTER_ORDER: ImproveWindow[] = ['all', '1', '5', '10', '30']
const IMPROVE_FILTER_SHORT_LABELS: Record<ImproveWindow, string> = {
    all: 'Any',
    '1': '1s',
    '3': '3s',
    '5': '5s',
    '10': '10s',
    '30': '30s',
}

function targetTone(target: TargetMedal): string {
    switch (target) {
        case 'World Record': return 'text-blue-300'
        case 'Champion Medal': return 'text-red-300'
        case 'Gold Medal': return 'text-yellow-300'
        case 'Silver Medal': return 'text-slate-200'
        case 'Bronze Medal': return 'text-amber-500'
    }
}

function nextTarget(cap: BestCap, map: MapMetadata): Pick<Opportunity, 'targetMedal' | 'targetTime'> | null {
    if (cap.cap_type !== CERTIFIED_CAP_TYPE || cap.cap_time_seconds <= 0) return null

    const time = cap.cap_time_seconds
    const thresholds: Array<{ medal: TargetMedal, time: number | undefined }> = [
        { medal: 'Bronze Medal', time: map.bronze_medal },
        { medal: 'Silver Medal', time: map.silver_medal },
        { medal: 'Gold Medal', time: map.gold_medal },
        { medal: 'Champion Medal', time: map.champion_medal },
        { medal: 'World Record', time: map.world_record },
    ]

    for (const threshold of thresholds) {
        if (threshold.time == null || threshold.time <= 0) continue
        if (time - threshold.time > WR_EPSILON_SECONDS) {
            return { targetMedal: threshold.medal, targetTime: threshold.time }
        }
    }

    return null
}

function buildOpportunities(bestCaps: BestCap[], maps: MapMetadata[], limit: number): Opportunity[] {
    const mapsByName = new Map(maps.map(map => [map.name, map]))

    return bestCaps
        .map(cap => {
            const map = mapsByName.get(cap.map)
            if (!map) return null
            const target = nextTarget(cap, map)
            if (!target) return null
            const improvement = cap.cap_time_seconds - target.targetTime
            if (improvement <= WR_EPSILON_SECONDS) return null

            return {
                mapName: cap.map,
                difficulty: map.difficulty,
                currentTime: cap.cap_time_seconds,
                targetTime: target.targetTime,
                targetMedal: target.targetMedal,
                improvement,
                improvementPct: improvement / cap.cap_time_seconds,
            } satisfies Opportunity
        })
        .filter((item): item is Opportunity => item !== null)
        .sort((a, b) => {
            const pct = a.improvementPct - b.improvementPct
            return Math.abs(pct) > 0.0001 ? pct : a.improvement - b.improvement
        })
        .slice(0, Math.max(limit, bestCaps.length))
}

function hiddenStorageKey(userId?: string | number | null): string {
    return `${HIDDEN_STORAGE_KEY_PREFIX}:${userId ?? 'unknown'}`
}

function readHiddenMapNames(userId?: string | number | null): string[] {
    try {
        const raw = localStorage.getItem(hiddenStorageKey(userId))
        const parsed = raw ? JSON.parse(raw) : []
        if (!Array.isArray(parsed)) return []
        return parsed.filter((item, index, arr) => (
            typeof item === 'string' && arr.indexOf(item) === index
        ))
    } catch {
        return []
    }
}

function writeHiddenMapNames(userId: string | number | null | undefined, hidden: string[]) {
    localStorage.setItem(hiddenStorageKey(userId), JSON.stringify(hidden))
}

function getScrollParent(element: HTMLElement | null): HTMLElement | Window {
    let current = element?.parentElement ?? null
    while (current) {
        const style = window.getComputedStyle(current)
        const overflowY = style.overflowY
        if ((overflowY === 'auto' || overflowY === 'scroll') && current.scrollHeight > current.clientHeight) {
            return current
        }
        current = current.parentElement
    }
    return window
}

function scrollMenuIntoView(trigger: HTMLElement | null, content: HTMLElement | null) {
    if (!trigger || !content) return

    const viewportPadding = 12
    const rect = content.getBoundingClientRect()
    const overflow = rect.bottom - (window.innerHeight - viewportPadding)
    if (overflow <= 0) return

    const scrollParent = getScrollParent(trigger)
    if (scrollParent === window) {
        window.scrollBy({ top: overflow, behavior: 'smooth' })
    } else {
        scrollParent.scrollBy({ top: overflow, behavior: 'smooth' })
    }
}

export function MedalHuntCard({
    accessToken, userId, refreshKey = 0, favoriteMapNames, onToggleFavorite, onMapSelect, limit = 6,
}: MedalHuntCardProps) {
    const containerRef = useRef<HTMLDivElement | null>(null)
    const [bestCaps, setBestCaps] = useState<BestCap[]>([])
    const [maps, setMaps] = useState<MapMetadata[]>([])
    const [loading, setLoading] = useState(true)
    const [responsiveLimit, setResponsiveLimit] = useState(limit)
    const [page, setPage] = useState(1)
    const [selectedMedals, setSelectedMedals] = useState<Set<TargetMedal>>(() => new Set(TARGET_MEDALS))
    const [improveWindow, setImproveWindow] = useState<ImproveWindow>('all')
    const [sortField, setSortField] = useState<SortField>('improve')
    const [sortDir, setSortDir] = useState<SortDir>('asc')
    const [hiddenMapNames, setHiddenMapNames] = useState<string[]>(() => readHiddenMapNames(userId))
    const [showHidden, setShowHidden] = useState(false)

    useEffect(() => {
        const updateLimit = () => {
            const containerWidth = containerRef.current?.getBoundingClientRect().width ?? window.innerWidth
            const height = window.innerHeight
            if (containerWidth < 560 || height < 760) setResponsiveLimit(4)
            else if (height > 1080) setResponsiveLimit(8)
            else setResponsiveLimit(6)
        }

        updateLimit()
        const resizeObserver = new ResizeObserver(updateLimit)
        if (containerRef.current) resizeObserver.observe(containerRef.current)
        window.addEventListener('resize', updateLimit)
        return () => {
            resizeObserver.disconnect()
            window.removeEventListener('resize', updateLimit)
        }
    }, [])

    useEffect(() => {
        if (!accessToken || !userId) {
            setLoading(false)
            return
        }

        let cancelled = false
        setLoading(true)
        Promise.all([
            fetchBestCaps(accessToken, userId),
            fetchMapsMetadata(accessToken),
        ])
            .then(([capsData, mapsData]) => {
                if (cancelled) return
                setBestCaps(capsData)
                setMaps(mapsData)
            })
            .catch(error => {
                console.error('Failed to load Medal Hunt', error)
                if (!cancelled) {
                    setBestCaps([])
                    setMaps([])
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false)
            })

        return () => { cancelled = true }
    }, [accessToken, userId, refreshKey])

    useEffect(() => {
        setHiddenMapNames(readHiddenMapNames(userId))
        setPage(1)
        setShowHidden(false)
    }, [userId])

    const hiddenMaps = useMemo(() => new Set(hiddenMapNames), [hiddenMapNames])
    const allOpportunities = useMemo(() => buildOpportunities(bestCaps, maps, bestCaps.length), [bestCaps, maps])

    const opportunities = useMemo(() => {
        const maxImprove = improveWindow === 'all' ? null : Number(improveWindow)
        return allOpportunities
            .filter(item => !hiddenMaps.has(item.mapName))
            .filter(item => selectedMedals.has(item.targetMedal))
            .filter(item => maxImprove == null || item.improvement <= maxImprove)
            .sort((a, b) => {
                const sortValue = sortField === 'medal'
                    ? MEDAL_RANK[a.targetMedal] - MEDAL_RANK[b.targetMedal]
                    : sortField === 'rating'
                        ? a.difficulty - b.difficulty
                        : a.improvement - b.improvement
                const fallback = a.mapName.localeCompare(b.mapName)
                const value = sortValue === 0 ? fallback : sortValue
                return sortDir === 'asc' ? value : -value
            })
    }, [allOpportunities, hiddenMaps, improveWindow, selectedMedals, sortDir, sortField])

    const hiddenOpportunities = useMemo(() => {
        const byName = new Map(allOpportunities.map(item => [item.mapName, item]))
        return hiddenMapNames.map(name => byName.get(name)).filter((item): item is Opportunity => item != null)
    }, [allOpportunities, hiddenMapNames])

    const activeItems = showHidden ? hiddenOpportunities : opportunities
    const totalPages = Math.max(1, Math.ceil(activeItems.length / responsiveLimit))
    const pageItems = activeItems.slice((page - 1) * responsiveLimit, page * responsiveLimit)

    useEffect(() => {
        setPage(current => Math.min(current, totalPages))
    }, [totalPages])

    const toggleMedal = (medal: TargetMedal) => {
        setSelectedMedals(prev => {
            const next = new Set(prev)
            if (next.has(medal)) next.delete(medal)
            else next.add(medal)
            return next
        })
        setPage(1)
    }

    const hideMap = (mapName: string) => {
        setHiddenMapNames(prev => {
            const next = [mapName, ...prev.filter(name => name !== mapName)]
            writeHiddenMapNames(userId, next)
            return next
        })
    }

    const restoreMap = (mapName: string) => {
        setHiddenMapNames(prev => {
            const next = prev.filter(name => name !== mapName)
            writeHiddenMapNames(userId, next)
            if (showHidden && next.length === 0) setShowHidden(false)
            return next
        })
    }

    const resetHidden = () => {
        writeHiddenMapNames(userId, [])
        setHiddenMapNames([])
        setShowHidden(false)
        setPage(1)
    }

    if (loading) {
        return (
            <div ref={containerRef} className="bg-card/30 border border-hairline/5 rounded-xl overflow-hidden">
                {Array.from({ length: responsiveLimit }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 px-3 py-2.5 h-16 border-b border-hairline/5 last:border-0">
                        <div className="size-10 rounded-md bg-hairline/5 animate-pulse shrink-0" />
                        <div className="flex-1 space-y-1.5">
                            <div className="h-3.5 w-1/2 bg-hairline/5 rounded animate-pulse" />
                            <div className="h-3 w-2/3 bg-hairline/5 rounded animate-pulse" />
                        </div>
                    </div>
                ))}
            </div>
        )
    }

    if (activeItems.length === 0) {
        return (
            <div ref={containerRef} className="bg-card/30 border border-hairline/5 rounded-xl overflow-hidden">
                <OpportunityHeader
                    page={page}
                    totalPages={totalPages}
                    canPrev={false}
                    canNext={false}
                    selectedMedals={selectedMedals}
                    improveWindow={improveWindow}
                    sortField={sortField}
                    sortDir={sortDir}
                    hiddenCount={hiddenMapNames.length}
                    showHidden={showHidden}
                    onPrev={() => {}}
                    onNext={() => {}}
                    onToggleHidden={() => { setShowHidden(value => !value); setPage(1) }}
                    onToggleMedal={toggleMedal}
                    onImproveWindowChange={value => { setImproveWindow(value); setPage(1) }}
                    onSortFieldChange={value => { setSortField(value); setPage(1) }}
                    onSortDirChange={value => { setSortDir(value); setPage(1) }}
                    onResetHidden={resetHidden}
                />
                <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                    <Target className="size-6 text-emerald-300/70" />
                    <p className="text-xs text-muted-foreground">
                        {showHidden ? 'No hidden Medal Hunt maps.' : 'No close medal targets found yet.'}
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div ref={containerRef} className="bg-card/30 border border-hairline/5 rounded-xl overflow-hidden">
            <OpportunityHeader
                page={page}
                totalPages={totalPages}
                canPrev={page > 1}
                canNext={page < totalPages}
                selectedMedals={selectedMedals}
                improveWindow={improveWindow}
                sortField={sortField}
                sortDir={sortDir}
                hiddenCount={hiddenMapNames.length}
                showHidden={showHidden}
                onPrev={() => setPage(p => Math.max(1, p - 1))}
                onNext={() => setPage(p => Math.min(totalPages, p + 1))}
                onToggleHidden={() => { setShowHidden(value => !value); setPage(1) }}
                onToggleMedal={toggleMedal}
                onImproveWindowChange={value => { setImproveWindow(value); setPage(1) }}
                onSortFieldChange={value => { setSortField(value); setPage(1) }}
                onSortDirChange={value => { setSortDir(value); setPage(1) }}
                onResetHidden={resetHidden}
            />
            <div style={{ minHeight: responsiveLimit * ROW_HEIGHT_PX }}>
            {pageItems.map(item => {
                const icon = getMedalIcon(item.targetMedal)
                const isWr = item.targetMedal === 'World Record'
                return (
                    <div
                        key={item.mapName}
                        className={cn(
                            'flex h-16 items-center gap-3 px-3 py-2.5 border-b border-hairline/5 transition-colors',
                            !showHidden && onMapSelect && 'hover:bg-hairline/[0.03]',
                        )}
                    >
                        <button
                            type="button"
                            onClick={!showHidden && onMapSelect ? () => onMapSelect(item.mapName) : undefined}
                            disabled={showHidden || !onMapSelect}
                            aria-label={displayMapName(item.mapName)}
                            className="shrink-0 enabled:cursor-pointer"
                        >
                            <MapThumbnail mapName={item.mapName} className="size-10 rounded-md" />
                        </button>
                        <FavoriteStar
                            name={item.mapName}
                            isFavorited={favoriteMapNames.has(item.mapName)}
                            onToggle={onToggleFavorite}
                            size="sm"
                        />
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 min-w-0">
                                <button
                                    type="button"
                                    onClick={!showHidden && onMapSelect ? () => onMapSelect(item.mapName) : undefined}
                                    disabled={showHidden || !onMapSelect}
                                    className="min-w-0 truncate text-left text-sm font-semibold text-foreground leading-tight enabled:cursor-pointer enabled:hover:underline underline-offset-2"
                                >
                                    {displayMapName(item.mapName)}
                                </button>
                                {item.difficulty > 0 && (
                                    <span className={cn('shrink-0 text-[11px] font-black tabular-nums', difficultyTextColor(item.difficulty))}>
                                        R{item.difficulty}
                                    </span>
                                )}
                            </div>
                            <div className="mt-0.5 text-[11px] text-muted-foreground truncate">
                                <span className="truncate">
                                    Improve by <span className="font-mono tabular-nums text-foreground">{formatDelta(item.improvement)}</span>
                                    {' '}for <span className={cn('font-semibold', targetTone(item.targetMedal))}>{item.targetMedal}</span>
                                </span>
                            </div>
                        </div>
                        <div className="shrink-0 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                                {isWr ? (
                                    <Trophy className="size-3.5 text-blue-300" />
                                ) : icon ? (
                                    <img src={icon} alt={item.targetMedal} className="size-4 object-contain" />
                                ) : null}
                                <span className={cn('text-xs font-bold font-mono tabular-nums', targetTone(item.targetMedal))}>
                                    {formatCapTime(item.targetTime)}
                                </span>
                            </div>
                            <div className="mt-0.5 text-[10px] text-muted-foreground font-mono tabular-nums">
                                PB {formatCapTime(item.currentTime)}
                            </div>
                        </div>
                        <Tooltip content={showHidden ? 'Restore Map' : 'Hide Map'} side="top">
                            <span className="inline-flex shrink-0">
                                <button
                                    type="button"
                                    aria-label={showHidden ? 'Restore Map' : 'Hide Map'}
                                    onClick={() => showHidden ? restoreMap(item.mapName) : hideMap(item.mapName)}
                                    className={cn(
                                        'inline-flex items-center justify-center size-5 rounded-md border transition-colors cursor-pointer',
                                        showHidden
                                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/25 hover:text-emerald-100 hover:border-emerald-500/50'
                                            : 'border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/25 hover:text-red-100 hover:border-red-500/50',
                                    )}
                                >
                                    {showHidden ? <Plus className="size-2.5" /> : <Minus className="size-2.5" />}
                                </button>
                            </span>
                        </Tooltip>
                    </div>
                )
            })}
            {Array.from({ length: Math.max(0, responsiveLimit - pageItems.length) }).map((_, i) => (
                <div
                    key={`pb-opportunity-filler-${i}`}
                    className="h-16 border-b border-hairline/5 last:border-0"
                    aria-hidden
                />
            ))}
            </div>
        </div>
    )
}

interface OpportunityHeaderProps {
    page: number
    totalPages: number
    canPrev: boolean
    canNext: boolean
    selectedMedals: Set<TargetMedal>
    improveWindow: ImproveWindow
    sortField: SortField
    sortDir: SortDir
    hiddenCount: number
    showHidden: boolean
    onPrev: () => void
    onNext: () => void
    onToggleHidden: () => void
    onToggleMedal: (medal: TargetMedal) => void
    onImproveWindowChange: (value: ImproveWindow) => void
    onSortFieldChange: (value: SortField) => void
    onSortDirChange: (value: SortDir) => void
    onResetHidden: () => void
}

function OpportunityHeader({
    page, totalPages, canPrev, canNext, selectedMedals, improveWindow, sortField, sortDir, hiddenCount, showHidden,
    onPrev, onNext, onToggleHidden, onToggleMedal, onImproveWindowChange, onSortFieldChange, onSortDirChange, onResetHidden,
}: OpportunityHeaderProps) {
    const [filterOpen, setFilterOpen] = useState(false)
    const filterTriggerRef = useRef<HTMLButtonElement | null>(null)
    const filterContentRef = useRef<HTMLDivElement | null>(null)

    return (
        <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-hairline/5 bg-black/20 backdrop-blur-sm">
            <span className="ml-[5.375rem] text-xs font-medium uppercase tracking-wider text-muted-foreground">Map</span>
            <div className="flex items-center gap-1.5">
                <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 tabular-nums">
                    {page}/{totalPages}
                </span>
                {!showHidden && (
                <DropdownMenu
                    open={filterOpen}
                    onOpenChange={open => {
                        setFilterOpen(open)
                        if (open) {
                            requestAnimationFrame(() => {
                                scrollMenuIntoView(filterTriggerRef.current, filterContentRef.current)
                            })
                        }
                    }}
                >
                    <DropdownMenuTrigger asChild>
                        <button
                            ref={filterTriggerRef}
                            type="button"
                            aria-label="Medal Hunt filters"
                            className="inline-flex items-center justify-center size-7 rounded-md bg-hairline/5 border border-hairline/5 text-muted-foreground hover:bg-hairline/10 hover:text-foreground transition-colors cursor-pointer"
                        >
                            <SlidersHorizontal className="size-3.5" />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        ref={filterContentRef}
                        side="bottom"
                        align="end"
                        avoidCollisions={false}
                        className="w-64 max-h-[calc(100vh-4rem)] overflow-y-auto bg-popover/95 backdrop-blur-xl border-hairline/10 [scrollbar-width:thin] [scrollbar-color:rgba(148,163,184,0.25)_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-hairline/20"
                    >
                        <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
                            Sort
                        </DropdownMenuLabel>
                        <div className="flex w-full items-center gap-1.5 px-2 pb-2">
                            <div className="flex items-center gap-1.5">
                                <Tooltip content="Improve Time" side="top">
                                    <button
                                        type="button"
                                        onClick={event => {
                                            event.stopPropagation()
                                            onSortFieldChange('improve')
                                        }}
                                        aria-pressed={sortField === 'improve'}
                                        className={cn(
                                            'inline-flex items-center justify-center size-8 rounded-md border transition-colors cursor-pointer',
                                            sortField === 'improve'
                                                ? 'bg-accent-500/15 border-accent-500/40 text-accent-200'
                                                : 'bg-card/70 border-hairline/10 text-muted-foreground hover:text-foreground hover:border-hairline/20',
                                        )}
                                    >
                                        <Timer className="size-4" />
                                    </button>
                                </Tooltip>
                                <Tooltip content="Medal" side="top">
                                    <button
                                        type="button"
                                        onClick={event => {
                                            event.stopPropagation()
                                            onSortFieldChange('medal')
                                        }}
                                        aria-pressed={sortField === 'medal'}
                                        className={cn(
                                            'inline-flex items-center justify-center size-8 rounded-md border transition-colors cursor-pointer',
                                            sortField === 'medal'
                                                ? 'bg-yellow-500/15 border-yellow-500/40 text-yellow-300'
                                                : 'bg-card/70 border-hairline/10 text-muted-foreground hover:text-foreground hover:border-hairline/20',
                                        )}
                                    >
                                        <Medal className="size-4" />
                                    </button>
                                </Tooltip>
                                <Tooltip content="Rating" side="top">
                                    <button
                                        type="button"
                                        onClick={event => {
                                            event.stopPropagation()
                                            onSortFieldChange('rating')
                                        }}
                                        aria-pressed={sortField === 'rating'}
                                        className={cn(
                                            'inline-flex items-center justify-center size-8 rounded-md border transition-colors cursor-pointer',
                                            sortField === 'rating'
                                                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                                                : 'bg-card/70 border-hairline/10 text-muted-foreground hover:text-foreground hover:border-hairline/20',
                                        )}
                                    >
                                        <BarChart3 className="size-4" />
                                    </button>
                                </Tooltip>
                            </div>
                            <div className="ml-auto flex items-center gap-1">
                                <Tooltip content="Ascending" side="top">
                                    <button
                                        type="button"
                                        onClick={event => {
                                            event.stopPropagation()
                                            onSortDirChange('asc')
                                        }}
                                        aria-label="Ascending"
                                        aria-pressed={sortDir === 'asc'}
                                        className={cn(
                                            'inline-flex h-8 items-center justify-center gap-1.5 rounded px-1.5 transition-colors cursor-pointer',
                                            sortDir === 'asc' ? 'text-accent-200' : 'text-muted-foreground',
                                        )}
                                    >
                                        <span className={cn(
                                            'size-2 rounded-full border',
                                            sortDir === 'asc' ? 'bg-teal-400 border-teal-200 shadow-[0_0_8px_rgba(45,212,191,0.55)]' : 'border-muted-foreground/50',
                                        )} />
                                        <ArrowUpNarrowWide className="size-4" />
                                    </button>
                                </Tooltip>
                                <Tooltip content="Descending" side="top">
                                    <button
                                        type="button"
                                        onClick={event => {
                                            event.stopPropagation()
                                            onSortDirChange('desc')
                                        }}
                                        aria-label="Descending"
                                        aria-pressed={sortDir === 'desc'}
                                        className={cn(
                                            'inline-flex h-8 items-center justify-center gap-1.5 rounded px-1.5 transition-colors cursor-pointer',
                                            sortDir === 'desc' ? 'text-accent-200' : 'text-muted-foreground',
                                        )}
                                    >
                                        <span className={cn(
                                            'size-2 rounded-full border',
                                            sortDir === 'desc' ? 'bg-teal-400 border-teal-200 shadow-[0_0_8px_rgba(45,212,191,0.55)]' : 'border-muted-foreground/50',
                                        )} />
                                        <ArrowDownWideNarrow className="size-4" />
                                    </button>
                                </Tooltip>
                            </div>
                        </div>

                        <DropdownMenuSeparator />
                        <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
                            Improve Time
                        </DropdownMenuLabel>
                        <div className="flex items-center justify-between px-2 pb-2">
                            {IMPROVE_FILTER_ORDER.map(value => {
                                const selected = improveWindow === value
                                return (
                                    <Tooltip key={value} content={IMPROVE_WINDOW_LABELS[value]} side="top">
                                        <button
                                            type="button"
                                            aria-label={IMPROVE_WINDOW_LABELS[value]}
                                            aria-pressed={selected}
                                            onClick={event => {
                                                event.stopPropagation()
                                                onImproveWindowChange(value)
                                            }}
                                            className={cn(
                                                'inline-flex items-center justify-center size-8 rounded-md border text-xs font-bold tabular-nums transition-all cursor-pointer',
                                                selected
                                                    ? 'bg-hairline/10 border-hairline/20 text-foreground'
                                                    : 'bg-card/70 border-hairline/10 text-muted-foreground hover:text-foreground hover:border-hairline/20',
                                            )}
                                        >
                                            {IMPROVE_FILTER_SHORT_LABELS[value]}
                                        </button>
                                    </Tooltip>
                                )
                            })}
                        </div>

                        <DropdownMenuSeparator />
                        <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
                            Medals
                        </DropdownMenuLabel>
                        <div className="flex items-center justify-between px-2 pb-2">
                            {MEDAL_FILTER_ORDER.map(medal => {
                                const selected = selectedMedals.has(medal)
                                const icon = getMedalIcon(medal)
                                return (
                                    <Tooltip key={medal} content={medal} side="top">
                                        <button
                                            type="button"
                                            aria-label={selected ? `Hide ${medal}` : `Show ${medal}`}
                                            aria-pressed={selected}
                                            onClick={event => {
                                                event.stopPropagation()
                                                onToggleMedal(medal)
                                            }}
                                            className={cn(
                                                'inline-flex items-center justify-center size-9 rounded-md border transition-all cursor-pointer',
                                                selected
                                                    ? 'bg-card/70 border-hairline/10 hover:border-hairline/20'
                                                    : 'bg-black/20 border-hairline/5 opacity-35 grayscale hover:opacity-55',
                                            )}
                                        >
                                            {icon && (
                                                <img
                                                    src={icon}
                                                    alt=""
                                                    aria-hidden
                                                    className="size-5 object-contain"
                                                />
                                            )}
                                        </button>
                                    </Tooltip>
                                )
                            })}
                        </div>
                        {hiddenCount > 0 && (
                            <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    onSelect={onResetHidden}
                                    className="text-xs cursor-pointer text-red-300 focus:text-red-100"
                                >
                                    Restore all hidden maps ({hiddenCount})
                                </DropdownMenuItem>
                            </>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
                )}
                {hiddenCount > 0 && (
                    <Tooltip content={showHidden ? 'Show all maps' : 'Show hidden maps'} side="top">
                        <button
                            type="button"
                            aria-label={showHidden ? 'Show all maps' : 'Show hidden maps'}
                            aria-pressed={showHidden}
                            onClick={onToggleHidden}
                            className={cn(
                                'inline-flex items-center justify-center size-7 rounded-md border transition-colors cursor-pointer',
                                showHidden
                                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
                                    : 'bg-hairline/5 border-hairline/5 text-muted-foreground hover:bg-hairline/10 hover:text-foreground',
                            )}
                        >
                            <EyeOff className="size-3.5" />
                        </button>
                    </Tooltip>
                )}
                <button
                    type="button"
                    aria-label="Previous Medal Hunt page"
                    disabled={!canPrev}
                    onClick={onPrev}
                    className="inline-flex items-center justify-center size-7 rounded-md bg-hairline/5 border border-hairline/5 text-muted-foreground hover:bg-hairline/10 hover:text-foreground transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                >
                    <ChevronLeft className="size-3.5" />
                </button>
                <button
                    type="button"
                    aria-label="Next Medal Hunt page"
                    disabled={!canNext}
                    onClick={onNext}
                    className="inline-flex items-center justify-center size-7 rounded-md bg-hairline/5 border border-hairline/5 text-muted-foreground hover:bg-hairline/10 hover:text-foreground transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                >
                    <ChevronRight className="size-3.5" />
                </button>
            </div>
        </div>
    )
}
