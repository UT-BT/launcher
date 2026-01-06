import { DEFAULT_FILTERS, FilterState, ServerType } from '@/app/utils/server-utils'
import { cn } from '@/lib/utils'
import { Check, RotateCcw } from 'lucide-react'

interface ServerBrowserSidebarProps {
    filters: FilterState
    setFilters: (filters: FilterState) => void
    availableRegions: string[]
    loading?: boolean
    className?: string
}

export function ServerBrowserSidebar({
    filters,
    setFilters,
    availableRegions,
    loading,
    className
}: ServerBrowserSidebarProps) {

    const toggleType = (type: ServerType) => {
        setFilters({
            ...filters,
            types: { ...filters.types, [type]: !filters.types[type] }
        })
    }

    const setAllTypes = (value: boolean) => {
        const newTypes = { ...filters.types }
            ; (['Certified', 'Duel', 'Casual'] as ServerType[]).forEach(t => {
                newTypes[t] = value
            })
        setFilters({ ...filters, types: newTypes })
    }

    const toggleRegion = (region: string) => {
        const isVisible = filters.regions[region] !== false
        setFilters({
            ...filters,
            regions: { ...filters.regions, [region]: !isVisible }
        })
    }

    const setAllRegions = (value: boolean) => {
        const newRegions = { ...filters.regions }
        availableRegions.forEach(r => {
            newRegions[r] = value
        })
        setFilters({ ...filters, regions: newRegions })
    }

    const toggleHideEmpty = () => {
        setFilters({ ...filters, hideEmpty: !filters.hideEmpty })
    }

    const toggleHideFull = () => {
        setFilters({ ...filters, hideFull: !filters.hideFull })
    }

    const setAllAvailability = (value: boolean) => {
        setFilters({ ...filters, hideEmpty: value, hideFull: value })
    }

    const resetFilters = () => {
        setFilters(DEFAULT_FILTERS)
    }

    const CategoryHeader = ({ title, onSelectAll, onSelectNone, allSelected, noneSelected }: {
        title: string,
        onSelectAll?: () => void,
        onSelectNone?: () => void,
        allSelected?: boolean,
        noneSelected?: boolean
    }) => (
        <div className="px-2 flex items-center justify-between">
            <h3 className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.2em]">
                {title}
            </h3>
            {(onSelectAll || onSelectNone) && (
                <div className="flex items-center gap-2">
                    {onSelectAll && (
                        <button
                            onClick={onSelectAll}
                            className={cn(
                                "text-[9px] font-bold uppercase tracking-wider transition-colors",
                                allSelected ? "text-blue-500 hover:text-blue-400" : "text-muted-foreground hover:text-white"
                            )}
                        >
                            All
                        </button>
                    )}
                    {onSelectNone && (
                        <button
                            onClick={onSelectNone}
                            className={cn(
                                "text-[9px] font-bold uppercase tracking-wider transition-colors",
                                noneSelected ? "text-blue-500 hover:text-blue-400" : "text-muted-foreground hover:text-white"
                            )}
                        >
                            None
                        </button>
                    )}
                </div>
            )}
        </div>
    )

    const serverTypes: ServerType[] = ['Certified', 'Duel', 'Casual']
    const allTypesSelected = serverTypes.every(t => filters.types[t])
    const noneTypesSelected = serverTypes.every(t => !filters.types[t])

    const allAvailabilitySelected = filters.hideEmpty && filters.hideFull
    const noneAvailabilitySelected = !filters.hideEmpty && !filters.hideFull

    const allRegionsSelected = availableRegions.length > 0 && availableRegions.every(r => filters.regions[r] !== false)
    const noneRegionsSelected = availableRegions.length > 0 && availableRegions.every(r => filters.regions[r] === false)

    return (
        <div className={cn("w-full p-2 flex flex-col gap-8 h-full", className)}>
            <div className="flex-1 overflow-y-auto space-y-8 pr-2 custom-scrollbar">
                <div className="space-y-3">
                    <CategoryHeader
                        title="Server Type"
                        onSelectAll={() => setAllTypes(true)}
                        onSelectNone={() => setAllTypes(false)}
                        allSelected={allTypesSelected}
                        noneSelected={noneTypesSelected}
                    />
                    <div className="space-y-1">
                        {serverTypes.map(type => (
                            <label key={type} className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer group hover:bg-muted/50 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={filters.types[type]}
                                    onChange={() => toggleType(type)}
                                    className="sr-only"
                                />
                                <div className={cn(
                                    "size-4 rounded border flex items-center justify-center transition-all duration-200",
                                    filters.types[type]
                                        ? "bg-primary border-primary text-primary-foreground"
                                        : "border-muted-foreground/30 group-hover:border-primary/50 bg-transparent"
                                )}>
                                    {filters.types[type] && <Check className="size-3" />}
                                </div>
                                <span className={cn("text-sm font-medium transition-colors", filters.types[type] ? "text-foreground" : "text-muted-foreground group-hover:text-foreground")}>
                                    {type}
                                </span>
                            </label>
                        ))}
                    </div>
                </div>

                <div className="space-y-3">
                    <CategoryHeader
                        title="Availability"
                        onSelectAll={() => setAllAvailability(true)}
                        onSelectNone={() => setAllAvailability(false)}
                        allSelected={allAvailabilitySelected}
                        noneSelected={noneAvailabilitySelected}
                    />
                    <div className="space-y-1">
                        <label className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer group hover:bg-muted/50 transition-colors">
                            <input
                                type="checkbox"
                                checked={filters.hideEmpty}
                                onChange={toggleHideEmpty}
                                className="sr-only"
                            />
                            <div className={cn(
                                "size-4 rounded border flex items-center justify-center transition-all duration-200",
                                filters.hideEmpty
                                    ? "bg-primary border-primary text-primary-foreground"
                                    : "border-muted-foreground/30 group-hover:border-primary/50 bg-transparent"
                            )}>
                                {filters.hideEmpty && <Check className="size-3" />}
                            </div>
                            <span className={cn("text-sm font-medium transition-colors", filters.hideEmpty ? "text-foreground" : "text-muted-foreground group-hover:text-foreground")}>
                                Hide Empty
                            </span>
                        </label>

                        <label className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer group hover:bg-muted/50 transition-colors">
                            <input
                                type="checkbox"
                                checked={filters.hideFull}
                                onChange={toggleHideFull}
                                className="sr-only"
                            />
                            <div className={cn(
                                "size-4 rounded border flex items-center justify-center transition-all duration-200",
                                filters.hideFull
                                    ? "bg-primary border-primary text-primary-foreground"
                                    : "border-muted-foreground/30 group-hover:border-primary/50 bg-transparent"
                            )}>
                                {filters.hideFull && <Check className="size-3" />}
                            </div>
                            <span className={cn("text-sm font-medium transition-colors", filters.hideFull ? "text-foreground" : "text-muted-foreground group-hover:text-foreground")}>
                                Hide Full
                            </span>
                        </label>
                    </div>
                </div>

                <div className="space-y-3">
                    <CategoryHeader
                        title="Regions"
                        onSelectAll={() => setAllRegions(true)}
                        onSelectNone={() => setAllRegions(false)}
                        allSelected={allRegionsSelected}
                        noneSelected={noneRegionsSelected}
                    />
                    <div className="space-y-1">
                        {loading ? (
                            <div className="space-y-2 px-3">
                                <div className="h-8 bg-white/5 rounded-lg animate-pulse" />
                                <div className="h-8 bg-white/5 rounded-lg animate-pulse w-[80%]" />
                                <div className="h-8 bg-white/5 rounded-lg animate-pulse w-[90%]" />
                            </div>
                        ) : availableRegions.length === 0 ? (
                            <p className="px-3 text-xs text-muted-foreground italic">No regions found</p>
                        ) : (
                            availableRegions.map(region => (
                                <label key={region} className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer group hover:bg-muted/50 transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={filters.regions[region] !== false}
                                        onChange={() => toggleRegion(region)}
                                        className="sr-only"
                                    />
                                    <div className={cn(
                                        "size-4 rounded border flex items-center justify-center transition-all duration-200",
                                        filters.regions[region] !== false
                                            ? "bg-primary border-primary text-primary-foreground"
                                            : "border-muted-foreground/30 group-hover:border-primary/50 bg-transparent"
                                    )}>
                                        {filters.regions[region] !== false && <Check className="size-3" />}
                                    </div>
                                    <span className={cn("text-sm font-medium transition-colors", filters.regions[region] !== false ? "text-foreground" : "text-muted-foreground group-hover:text-foreground")}>
                                        {region}
                                    </span>
                                </label>
                            ))
                        )}
                    </div>
                </div>
            </div>

            <div className="pt-2 border-t border-white/5 mt-auto">
                <button
                    onClick={resetFilters}
                    className="w-full flex items-center justify-start gap-2 px-2 py-2 text-muted-foreground hover:text-white transition-all text-[10px] font-bold uppercase tracking-widest group/reset"
                >
                    <RotateCcw className="size-3 transition-transform group-hover/reset:-rotate-45" />
                    Reset All Filters
                </button>
            </div>
        </div>
    )
}
