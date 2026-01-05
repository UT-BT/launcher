import { FilterState, ServerType } from '@/app/utils/server-utils'
import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'

interface ServerBrowserSidebarProps {
    filters: FilterState
    setFilters: (filters: FilterState) => void
    availableRegions: string[]
    className?: string
}

export function ServerBrowserSidebar({
    filters,
    setFilters,
    availableRegions,
    className
}: ServerBrowserSidebarProps) {

    const toggleType = (type: ServerType) => {
        setFilters({
            ...filters,
            types: { ...filters.types, [type]: !filters.types[type] }
        })
    }

    const toggleRegion = (region: string) => {
        const isVisible = filters.regions[region] !== false
        setFilters({
            ...filters,
            regions: { ...filters.regions, [region]: !isVisible }
        })
    }

    const toggleHideEmpty = () => {
        setFilters({ ...filters, hideEmpty: !filters.hideEmpty })
    }

    const toggleHideFull = () => {
        setFilters({ ...filters, hideFull: !filters.hideFull })
    }

    return (
        <div className={cn("w-full p-2 flex flex-col gap-8 overflow-y-auto", className)}>
            {/* Server Type */}
            <div className="space-y-3">
                <h3 className="px-2 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.2em] flex items-center gap-2">
                    Server Type
                </h3>
                <div className="space-y-1">
                    {(['Certified', 'Duel', 'Casual'] as ServerType[]).map(type => (
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

            {/* Availability */}
            <div className="space-y-3">
                <h3 className="px-2 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.2em] flex items-center gap-2">
                    Availability
                </h3>
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

            {/* Regions */}
            <div className="space-y-3">
                <h3 className="px-2 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.2em] flex items-center gap-2">
                    Regions
                </h3>
                <div className="space-y-1">
                    {availableRegions.length === 0 && (
                        <p className="px-3 text-xs text-muted-foreground italic">No regions found</p>
                    )}
                    {availableRegions.map(region => (
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
                    ))}
                </div>
            </div>
        </div>
    )
}
