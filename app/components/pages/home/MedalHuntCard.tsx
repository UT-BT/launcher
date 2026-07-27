import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  BarChart3,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  EyeOff,
  Medal,
  Minus,
  Plus,
  SlidersHorizontal,
  Target,
  Timer,
  TvMinimalPlay,
} from 'lucide-react'
import { fetchMap, fetchMedalHunt, type MapMetadata, type MedalHuntOpportunity } from '@/app/utils/api'
import { getSynced, setSynced, subscribeSynced } from '@/app/utils/userState'
import { toOpportunities, type Opportunity, type TargetMedal } from '@/app/utils/medalHunt'
import { displayMapName, formatCapTime, formatDelta } from '@/app/utils/format'
import { getMedalIcon } from '@/app/utils/medals'
import { difficultyTextColor } from '@/app/utils/scoreColors'
import { MapThumbnail } from '@/app/components/shared/MapThumbnail'
import { FavoriteStar } from '@/app/components/shared/FavoriteStar'
import { ReplayVideoModal } from '@/app/components/shared/ReplayVideoModal'
import { ReplayPickerModal } from '@/app/components/modals/ReplayPickerModal'
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
  rows: MedalHuntOpportunity[] | null
  onRowsLoaded: (rows: MedalHuntOpportunity[]) => void
  favoriteMapNames: Set<string>
  onToggleFavorite: (mapName: string) => void
  onMapSelect?: (mapName: string) => void
}

const HIDDEN_STORAGE_KEY_PREFIX = 'utbt:homeMedalHuntHidden:v1'
const ROW_HEIGHT_PX = 64
const MEDAL_TIER_COLUMNS = [
  'name', 'required_players',
  'world_record', 'champion_medal', 'gold_medal', 'silver_medal', 'bronze_medal',
]

const TARGET_MEDALS: TargetMedal[] = ['Bronze Medal', 'Silver Medal', 'Gold Medal', 'Champion Medal', 'World Record']
const MEDAL_FILTER_ORDER: TargetMedal[] = [
  'World Record',
  'Champion Medal',
  'Gold Medal',
  'Silver Medal',
  'Bronze Medal',
]
const MEDAL_RANK: Record<TargetMedal, number> = {
  'Bronze Medal': 1,
  'Silver Medal': 2,
  'Gold Medal': 3,
  'Champion Medal': 4,
  'World Record': 5,
}
const MEDAL_TONE: Record<TargetMedal, string> = {
  'Bronze Medal': 'text-amber-500',
  'Silver Medal': 'text-slate-200',
  'Gold Medal': 'text-yellow-300',
  'Champion Medal': 'text-red-300',
  'World Record': 'text-blue-300',
}

type ImproveWindow = 'all' | '1' | '3' | '5' | '10' | '30'
type SortField = 'improve' | 'medal' | 'rating' | 'date'
type SortDir = 'asc' | 'desc'

const IMPROVE_WINDOW_LABELS: Record<ImproveWindow, string> = {
  all: 'Any improvement',
  '1': 'Within 1s',
  '3': 'Within 3s',
  '5': 'Within 5s',
  '10': 'Within 10s',
  '30': 'Within 30s',
}
const IMPROVE_FILTER_ORDER: ImproveWindow[] = ['all', '1', '3', '5', '10', '30']
const IMPROVE_FILTER_SHORT_LABELS: Record<ImproveWindow, string> = {
  all: 'Any',
  '1': '1s',
  '3': '3s',
  '5': '5s',
  '10': '10s',
  '30': '30s',
}

function hiddenStorageKey(userId?: string | number | null): string {
  return `${HIDDEN_STORAGE_KEY_PREFIX}:${userId ?? 'unknown'}`
}

function readHiddenMapNames(userId?: string | number | null): string[] {
  const parsed = getSynced<unknown>(hiddenStorageKey(userId), [])
  if (!Array.isArray(parsed)) return []
  return parsed.filter((item, index, arr) => typeof item === 'string' && arr.indexOf(item) === index)
}

function writeHiddenMapNames(userId: string | number | null | undefined, hidden: string[]) {
  setSynced(hiddenStorageKey(userId), hidden)
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
  accessToken,
  userId,
  refreshKey = 0,
  rows,
  onRowsLoaded,
  favoriteMapNames,
  onToggleFavorite,
  onMapSelect,
}: MedalHuntCardProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [loading, setLoading] = useState(rows === null)
  const [responsiveLimit, setResponsiveLimit] = useState(6)
  const [narrow, setNarrow] = useState(false)
  const [page, setPage] = useState(1)
  const [selectedMedals, setSelectedMedals] = useState<Set<TargetMedal>>(() => new Set(TARGET_MEDALS))
  const [improveWindow, setImproveWindow] = useState<ImproveWindow>('all')
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [hiddenMapNames, setHiddenMapNames] = useState<string[]>(() => readHiddenMapNames(userId))
  const [showHidden, setShowHidden] = useState(false)
  const [replayPickerMap, setReplayPickerMap] = useState<string | null>(null)
  const [replayPickerMapMetadata, setReplayPickerMapMetadata] = useState<MapMetadata | null>(null)
  const [videoModal, setVideoModal] = useState<{
    url: string
    mapName: string
    time?: number
    alias?: string
  } | null>(null)

  useEffect(() => {
    const updateLimit = () => {
      const containerWidth = containerRef.current?.getBoundingClientRect().width ?? window.innerWidth
      const height = window.innerHeight
      setNarrow(containerWidth < 480)
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

  const fetchedRef = useRef(false)
  useEffect(() => {
    fetchedRef.current = false
  }, [accessToken, userId, refreshKey])
  useEffect(() => {
    if (!accessToken || !userId) {
      setLoading(false)
      return
    }

    if (rows !== null) setLoading(false)
    if (fetchedRef.current) return
    fetchedRef.current = true

    const controller = new AbortController()
    if (rows === null) setLoading(true)
    fetchMedalHunt(accessToken, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return
        onRowsLoaded(data)
      })
      .catch((error) => {
        if (controller.signal.aborted) return
        console.error('Failed to load Medal Hunt', error)
        if (rows === null) onRowsLoaded([])
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => {
      controller.abort()
    }
  }, [accessToken, userId, refreshKey, rows, onRowsLoaded])

  useEffect(() => {
    setHiddenMapNames(readHiddenMapNames(userId))
    setPage(1)
    setShowHidden(false)
    return subscribeSynced(hiddenStorageKey(userId), () => setHiddenMapNames(readHiddenMapNames(userId)))
  }, [userId])

  const hiddenMaps = useMemo(() => new Set(hiddenMapNames), [hiddenMapNames])

  const allOpportunities = useMemo(() => toOpportunities(rows ?? []), [rows])

  useEffect(() => {
    if (!accessToken || !replayPickerMap) {
      setReplayPickerMapMetadata(null)
      return
    }

    let cancelled = false
    fetchMap(accessToken, replayPickerMap, MEDAL_TIER_COLUMNS)
      .then((data) => {
        if (!cancelled) setReplayPickerMapMetadata(data)
      })
      .catch(() => {
        if (!cancelled) setReplayPickerMapMetadata(null)
      })

    return () => {
      cancelled = true
    }
  }, [accessToken, replayPickerMap])

  const opportunities = useMemo(() => {
    const maxImprove = improveWindow === 'all' ? null : Number(improveWindow)
    return allOpportunities
      .filter((item) => !hiddenMaps.has(item.mapName))
      .filter((item) => selectedMedals.has(item.targetMedal))
      .filter((item) => maxImprove == null || item.improvement <= maxImprove)
      .sort((a, b) => {
        const sortValue =
          sortField === 'medal'
            ? MEDAL_RANK[a.targetMedal] - MEDAL_RANK[b.targetMedal]
            : sortField === 'rating'
              ? a.difficulty - b.difficulty
              : sortField === 'date'
                ? a.worldRecordAddedTime - b.worldRecordAddedTime
                : a.improvement - b.improvement
        const fallback = (a.mapName ?? '').localeCompare(b.mapName ?? '')
        const value = sortValue === 0 ? fallback : sortValue
        return sortDir === 'asc' ? value : -value
      })
  }, [allOpportunities, hiddenMaps, improveWindow, selectedMedals, sortDir, sortField])

  const hiddenOpportunities = useMemo(() => {
    const byName = new Map(allOpportunities.map((item) => [item.mapName, item]))
    return hiddenMapNames.map((name) => byName.get(name)).filter((item): item is Opportunity => item != null)
  }, [allOpportunities, hiddenMapNames])

  const activeItems = showHidden ? hiddenOpportunities : opportunities
  const totalPages = Math.max(1, Math.ceil(activeItems.length / responsiveLimit))
  const pageItems = activeItems.slice((page - 1) * responsiveLimit, page * responsiveLimit)

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages))
  }, [totalPages])

  const toggleMedal = (medal: TargetMedal) => {
    setSelectedMedals((prev) => {
      const next = new Set(prev)
      if (next.has(medal)) next.delete(medal)
      else next.add(medal)
      return next
    })
    setPage(1)
  }

  const hideMap = (mapName: string) => {
    const next = [mapName, ...hiddenMapNames.filter((name) => name !== mapName)]
    writeHiddenMapNames(userId, next)
    setHiddenMapNames(next)
  }

  const restoreMap = (mapName: string) => {
    const next = hiddenMapNames.filter((name) => name !== mapName)
    writeHiddenMapNames(userId, next)
    setHiddenMapNames(next)
    if (showHidden && next.length === 0) setShowHidden(false)
  }

  const resetHidden = () => {
    writeHiddenMapNames(userId, [])
    setHiddenMapNames([])
    setShowHidden(false)
    setPage(1)
  }

  const toggleHiddenView = () => {
    setShowHidden((value) => !value)
    setPage(1)
  }

  const updateImproveWindow = (value: ImproveWindow) => {
    setImproveWindow(value)
    setPage(1)
  }

  const updateSortField = (value: SortField) => {
    setSortField(value)
    if (value === 'date') setSortDir('desc')
    setPage(1)
  }

  const updateSortDir = (value: SortDir) => {
    setSortDir(value)
    setPage(1)
  }

  const goPrev = () => setPage((p) => Math.max(1, p - 1))
  const goNext = () => setPage((p) => Math.min(totalPages, p + 1))

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
          onToggleHidden={toggleHiddenView}
          onToggleMedal={toggleMedal}
          onImproveWindowChange={updateImproveWindow}
          onSortFieldChange={updateSortField}
          onSortDirChange={updateSortDir}
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
        onPrev={goPrev}
        onNext={goNext}
        onToggleHidden={toggleHiddenView}
        onToggleMedal={toggleMedal}
        onImproveWindowChange={updateImproveWindow}
        onSortFieldChange={updateSortField}
        onSortDirChange={updateSortDir}
        onResetHidden={resetHidden}
      />
      <div style={narrow ? undefined : { minHeight: responsiveLimit * ROW_HEIGHT_PX }}>
        {pageItems.map((item) => (
          <OpportunityRow
            key={item.mapName}
            item={item}
            narrow={narrow}
            isHiddenView={showHidden}
            isFavorited={favoriteMapNames.has(item.mapName)}
            onToggleFavorite={onToggleFavorite}
            onMapSelect={onMapSelect}
            onHideMap={hideMap}
            onRestoreMap={restoreMap}
            onOpenDemos={setReplayPickerMap}
          />
        ))}
        {!narrow && Array.from({ length: Math.max(0, responsiveLimit - pageItems.length) }).map((_, i) => (
          <div
            key={`pb-opportunity-filler-${i}`}
            className="h-16 border-b border-hairline/5 last:border-0"
            aria-hidden
          />
        ))}
      </div>
      <ReplayPickerModal
        open={replayPickerMap !== null}
        onClose={() => setReplayPickerMap(null)}
        accessToken={accessToken}
        userId={userId ?? undefined}
        mapName={replayPickerMap}
        mapMetadata={replayPickerMapMetadata ?? undefined}
        onSelect={(url, mapName, entry) => {
          setReplayPickerMap(null)
          setVideoModal({
            url,
            mapName,
            time: entry.cap_time_seconds,
            alias: entry.alias ?? undefined,
          })
        }}
      />
      <ReplayVideoModal state={videoModal} onClose={() => setVideoModal(null)} />
    </div>
  )
}

interface OpportunityRowProps {
  item: Opportunity
  narrow: boolean
  isHiddenView: boolean
  isFavorited: boolean
  onToggleFavorite: (mapName: string) => void
  onMapSelect?: (mapName: string) => void
  onHideMap: (mapName: string) => void
  onRestoreMap: (mapName: string) => void
  onOpenDemos: (mapName: string) => void
}

function OpportunityRow({
  item,
  narrow,
  isHiddenView,
  isFavorited,
  onToggleFavorite,
  onMapSelect,
  onHideMap,
  onRestoreMap,
  onOpenDemos,
}: OpportunityRowProps) {
  const icon = getMedalIcon(item.targetMedal)
  const canSelectMap = !isHiddenView && onMapSelect != null
  const handleMapSelect = canSelectMap ? () => onMapSelect(item.mapName) : undefined
  const handleVisibilityChange = () => {
    if (isHiddenView) onRestoreMap(item.mapName)
    else onHideMap(item.mapName)
  }

  if (narrow) {
    return (
      <div
        className={cn(
          'p-3 space-y-2 border-b border-hairline/5 transition-colors',
          canSelectMap && 'hover:bg-hairline/[0.03]'
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <FavoriteStar name={item.mapName} isFavorited={isFavorited} onToggle={onToggleFavorite} size="sm" />
          <button
            type="button"
            onClick={handleMapSelect}
            disabled={!canSelectMap}
            className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-foreground leading-tight enabled:cursor-pointer enabled:hover:underline underline-offset-2"
          >
            {displayMapName(item.mapName)}
          </button>
          {item.difficulty > 0 && (
            <span className={cn('shrink-0 text-[11px] font-black tabular-nums', difficultyTextColor(item.difficulty))}>
              R{item.difficulty}
            </span>
          )}
          <button
            type="button"
            aria-label="Demos"
            onClick={() => onOpenDemos(item.mapName)}
            className="inline-flex shrink-0 items-center justify-center size-7 rounded-md border border-accent-500/30 bg-accent-500/10 text-accent-300 hover:bg-accent-500/25 hover:text-accent-100 hover:border-accent-500/50 transition-colors cursor-pointer"
          >
            <TvMinimalPlay className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label={isHiddenView ? 'Restore Map' : 'Hide Map'}
            onClick={handleVisibilityChange}
            className={cn(
              'inline-flex items-center justify-center size-7 rounded-md border transition-colors cursor-pointer',
              isHiddenView
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : 'border-red-500/30 bg-red-500/10 text-red-300'
            )}
          >
            {isHiddenView ? <Plus className="size-3" /> : <Minus className="size-3" />}
          </button>
        </div>
        <div className="text-[11px] text-muted-foreground leading-snug">
          Improve by <span className="font-mono tabular-nums text-foreground">{formatDelta(item.improvement)}</span>{' '}
          for <span className={cn('font-semibold', MEDAL_TONE[item.targetMedal])}>{item.targetMedal}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-muted-foreground font-mono tabular-nums">
            PB {formatCapTime(item.currentTime)}
          </span>
          <span className="flex shrink-0 items-center gap-1.5">
            {icon && <img src={icon} alt={item.targetMedal} className="size-4 object-contain" />}
            <span className={cn('text-xs font-bold font-mono tabular-nums', MEDAL_TONE[item.targetMedal])}>
              {formatCapTime(item.targetTime)}
            </span>
          </span>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex h-16 items-center gap-3 px-3 py-2.5 border-b border-hairline/5 transition-colors',
        canSelectMap && 'hover:bg-hairline/[0.03]'
      )}
    >
      <button
        type="button"
        onClick={handleMapSelect}
        disabled={!canSelectMap}
        aria-label={displayMapName(item.mapName)}
        className="shrink-0 enabled:cursor-pointer"
      >
        <MapThumbnail mapName={item.mapName} className="size-10 rounded-md" />
      </button>
      <FavoriteStar name={item.mapName} isFavorited={isFavorited} onToggle={onToggleFavorite} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            type="button"
            onClick={handleMapSelect}
            disabled={!canSelectMap}
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
            Improve by <span className="font-mono tabular-nums text-foreground">{formatDelta(item.improvement)}</span>{' '}
            for <span className={cn('font-semibold', MEDAL_TONE[item.targetMedal])}>{item.targetMedal}</span>
          </span>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="flex items-center justify-end gap-1.5">
          {icon && <img src={icon} alt={item.targetMedal} className="size-4 object-contain" />}
          <span className={cn('text-xs font-bold font-mono tabular-nums', MEDAL_TONE[item.targetMedal])}>
            {formatCapTime(item.targetTime)}
          </span>
        </div>
        <div className="mt-0.5 text-[10px] text-muted-foreground font-mono tabular-nums">
          PB {formatCapTime(item.currentTime)}
        </div>
      </div>
      <button
        type="button"
        aria-label="Demos"
        onClick={() => onOpenDemos(item.mapName)}
        className="inline-flex shrink-0 items-center justify-center size-7 rounded-md border border-accent-500/30 bg-accent-500/10 text-accent-300 hover:bg-accent-500/25 hover:text-accent-100 hover:border-accent-500/50 transition-colors cursor-pointer"
      >
        <TvMinimalPlay className="size-3.5" />
      </button>
      <Tooltip content={isHiddenView ? 'Restore Map' : 'Hide Map'} side="top">
        <span className="inline-flex shrink-0">
          <button
            type="button"
            aria-label={isHiddenView ? 'Restore Map' : 'Hide Map'}
            onClick={handleVisibilityChange}
            className={cn(
              'inline-flex items-center justify-center size-5 rounded-md border transition-colors cursor-pointer',
              isHiddenView
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/25 hover:text-emerald-100 hover:border-emerald-500/50'
                : 'border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/25 hover:text-red-100 hover:border-red-500/50'
            )}
          >
            {isHiddenView ? <Plus className="size-2.5" /> : <Minus className="size-2.5" />}
          </button>
        </span>
      </Tooltip>
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
  page,
  totalPages,
  canPrev,
  canNext,
  selectedMedals,
  improveWindow,
  sortField,
  sortDir,
  hiddenCount,
  showHidden,
  onPrev,
  onNext,
  onToggleHidden,
  onToggleMedal,
  onImproveWindowChange,
  onSortFieldChange,
  onSortDirChange,
  onResetHidden,
}: OpportunityHeaderProps) {
  const [filterOpen, setFilterOpen] = useState(false)
  const filterTriggerRef = useRef<HTMLButtonElement | null>(null)
  const filterContentRef = useRef<HTMLDivElement | null>(null)

  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-hairline/5 bg-black/20 backdrop-blur-sm">
      <span className="ml-1 sm:ml-[5.375rem] text-xs font-medium uppercase tracking-wider text-muted-foreground">Map</span>
      <div className="flex items-center gap-1.5">
        <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 tabular-nums">
          {page}/{totalPages}
        </span>
        {!showHidden && (
          <DropdownMenu
            open={filterOpen}
            onOpenChange={(open) => {
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
                  <Tooltip content="Recently Lost" side="top">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        onSortFieldChange('date')
                      }}
                      aria-pressed={sortField === 'date'}
                      className={cn(
                        'inline-flex items-center justify-center size-8 rounded-md border transition-colors cursor-pointer',
                        sortField === 'date'
                          ? 'bg-red-500/15 border-red-500/40 text-red-300'
                          : 'bg-card/70 border-hairline/10 text-muted-foreground hover:text-foreground hover:border-hairline/20'
                      )}
                    >
                      <CalendarClock className="size-4" />
                    </button>
                  </Tooltip>
                  <Tooltip content="Improve Time" side="top">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        onSortFieldChange('improve')
                      }}
                      aria-pressed={sortField === 'improve'}
                      className={cn(
                        'inline-flex items-center justify-center size-8 rounded-md border transition-colors cursor-pointer',
                        sortField === 'improve'
                          ? 'bg-accent-500/15 border-accent-500/40 text-accent-200'
                          : 'bg-card/70 border-hairline/10 text-muted-foreground hover:text-foreground hover:border-hairline/20'
                      )}
                    >
                      <Timer className="size-4" />
                    </button>
                  </Tooltip>
                  <Tooltip content="Medal" side="top">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        onSortFieldChange('medal')
                      }}
                      aria-pressed={sortField === 'medal'}
                      className={cn(
                        'inline-flex items-center justify-center size-8 rounded-md border transition-colors cursor-pointer',
                        sortField === 'medal'
                          ? 'bg-yellow-500/15 border-yellow-500/40 text-yellow-300'
                          : 'bg-card/70 border-hairline/10 text-muted-foreground hover:text-foreground hover:border-hairline/20'
                      )}
                    >
                      <Medal className="size-4" />
                    </button>
                  </Tooltip>
                  <Tooltip content="Rating" side="top">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        onSortFieldChange('rating')
                      }}
                      aria-pressed={sortField === 'rating'}
                      className={cn(
                        'inline-flex items-center justify-center size-8 rounded-md border transition-colors cursor-pointer',
                        sortField === 'rating'
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                          : 'bg-card/70 border-hairline/10 text-muted-foreground hover:text-foreground hover:border-hairline/20'
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
                      onClick={(event) => {
                        event.stopPropagation()
                        onSortDirChange('asc')
                      }}
                      aria-label="Ascending"
                      aria-pressed={sortDir === 'asc'}
                      className={cn(
                        'inline-flex h-8 items-center justify-center gap-1.5 rounded px-1.5 transition-colors cursor-pointer',
                        sortDir === 'asc' ? 'text-accent-200' : 'text-muted-foreground'
                      )}
                    >
                      <span
                        className={cn(
                          'size-2 rounded-full border',
                          sortDir === 'asc'
                            ? 'bg-red-700 border-red-600 shadow-[0_0_8px_rgba(248,113,113,0.55)]'
                            : 'border-muted-foreground/50'
                        )}
                      />
                      <ArrowUpNarrowWide className="size-4" />
                    </button>
                  </Tooltip>
                  <Tooltip content="Descending" side="top">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        onSortDirChange('desc')
                      }}
                      aria-label="Descending"
                      aria-pressed={sortDir === 'desc'}
                      className={cn(
                        'inline-flex h-8 items-center justify-center gap-1.5 rounded px-1.5 transition-colors cursor-pointer',
                        sortDir === 'desc' ? 'text-accent-200' : 'text-muted-foreground'
                      )}
                    >
                      <span
                        className={cn(
                          'size-2 rounded-full border',
                          sortDir === 'desc'
                            ? 'bg-red-700 border-red-600 shadow-[0_0_8px_rgba(248,113,113,0.55)]'
                            : 'border-muted-foreground/50'
                        )}
                      />
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
                {IMPROVE_FILTER_ORDER.map((value) => {
                  const selected = improveWindow === value
                  return (
                    <Tooltip key={value} content={IMPROVE_WINDOW_LABELS[value]} side="top">
                      <button
                        type="button"
                        aria-label={IMPROVE_WINDOW_LABELS[value]}
                        aria-pressed={selected}
                        onClick={(event) => {
                          event.stopPropagation()
                          onImproveWindowChange(value)
                        }}
                        className={cn(
                          'inline-flex items-center justify-center size-8 rounded-md border text-xs font-bold tabular-nums transition-all cursor-pointer',
                          selected
                            ? 'bg-hairline/10 border-hairline/20 text-foreground'
                            : 'bg-card/70 border-hairline/10 text-muted-foreground hover:text-foreground hover:border-hairline/20'
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
                {MEDAL_FILTER_ORDER.map((medal) => {
                  const selected = selectedMedals.has(medal)
                  const icon = getMedalIcon(medal)
                  return (
                    <Tooltip key={medal} content={medal} side="top">
                      <button
                        type="button"
                        aria-label={selected ? `Hide ${medal}` : `Show ${medal}`}
                        aria-pressed={selected}
                        onClick={(event) => {
                          event.stopPropagation()
                          onToggleMedal(medal)
                        }}
                        className={cn(
                          'inline-flex items-center justify-center size-9 rounded-md border transition-all cursor-pointer',
                          selected
                            ? 'bg-card/70 border-hairline/10 hover:border-hairline/20'
                            : 'bg-black/20 border-hairline/5 opacity-35 grayscale hover:opacity-55'
                        )}
                      >
                        {icon && <img src={icon} alt="" aria-hidden className="size-5 object-contain" />}
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
                  : 'bg-hairline/5 border-hairline/5 text-muted-foreground hover:bg-hairline/10 hover:text-foreground'
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
