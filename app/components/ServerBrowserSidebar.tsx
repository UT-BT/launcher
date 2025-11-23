import { FilterState, ServerType } from '@/app/utils/server-utils'
import { cn } from '@/lib/utils'
import { Check, Filter, Globe, Server as ServerIcon, Users } from 'lucide-react'

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
        <div className={cn("w-64 bg-card/30 border-r border-white/5 p-4 flex flex-col gap-6 overflow-y-auto", className)}>
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Filter className="size-4" />
                <span className="font-semibold text-sm uppercase tracking-wider">Filters</span>
            </div>

            {/* Server Type */}
            <div className="space-y-3">
                <h3 className="text-sm font-medium text-white flex items-center gap-2">
                    <ServerIcon className="size-4 text-blue-400" />
                    Server Type
                </h3>
                <div className="space-y-2">
                    {(['Certified', 'Duel', 'Casual'] as ServerType[]).map(type => (
                        <label key={type} className="flex items-center gap-3 cursor-pointer group" onClick={() => toggleType(type)}>
                            <div className={cn(
                                "size-4 rounded border flex items-center justify-center transition-colors",
                                filters.types[type]
                                    ? "bg-blue-600 border-blue-600"
                                    : "border-white/20 group-hover:border-white/40 bg-transparent"
                            )}>
                                {filters.types[type] && <Check className="size-3 text-white" />}
                            </div>
                            <span className={cn("text-sm transition-colors", filters.types[type] ? "text-white" : "text-muted-foreground group-hover:text-white/80")}>
                                {type}
                            </span>
                        </label>
                    ))}
                </div>
            </div>

            <div className="h-px bg-white/5" />

            {/* Availability */}
            <div className="space-y-3">
                <h3 className="text-sm font-medium text-white flex items-center gap-2">
                    <Users className="size-4 text-green-400" />
                    Availability
                </h3>
                <div className="space-y-2">
                    <label className="flex items-center gap-3 cursor-pointer group" onClick={toggleHideEmpty}>
                        <div className={cn(
                            "size-4 rounded border flex items-center justify-center transition-colors",
                            filters.hideEmpty
                                ? "bg-blue-600 border-blue-600"
                                : "border-white/20 group-hover:border-white/40 bg-transparent"
                        )}>
                            {filters.hideEmpty && <Check className="size-3 text-white" />}
                        </div>
                        <span className={cn("text-sm transition-colors", filters.hideEmpty ? "text-white" : "text-muted-foreground group-hover:text-white/80")}>
                            Hide Empty
                        </span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer group" onClick={toggleHideFull}>
                        <div className={cn(
                            "size-4 rounded border flex items-center justify-center transition-colors",
                            filters.hideFull
                                ? "bg-blue-600 border-blue-600"
                                : "border-white/20 group-hover:border-white/40 bg-transparent"
                        )}>
                            {filters.hideFull && <Check className="size-3 text-white" />}
                        </div>
                        <span className={cn("text-sm transition-colors", filters.hideFull ? "text-white" : "text-muted-foreground group-hover:text-white/80")}>
                            Hide Full
                        </span>
                    </label>
                </div>
            </div>

            <div className="h-px bg-white/5" />

            {/* Regions */}
            <div className="space-y-3">
                <h3 className="text-sm font-medium text-white flex items-center gap-2">
                    <Globe className="size-4 text-purple-400" />
                    Regions
                </h3>
                <div className="space-y-2">
                    {availableRegions.length === 0 && (
                        <p className="text-xs text-muted-foreground italic">No regions found</p>
                    )}
                    {availableRegions.map(region => (
                        <label key={region} className="flex items-center gap-3 cursor-pointer group" onClick={() => toggleRegion(region)}>
                            <div className={cn(
                                "size-4 rounded border flex items-center justify-center transition-colors",
                                filters.regions[region] !== false
                                    ? "bg-blue-600 border-blue-600"
                                    : "border-white/20 group-hover:border-white/40 bg-transparent"
                            )}>
                                {filters.regions[region] !== false && <Check className="size-3 text-white" />}
                            </div>
                            <span className={cn("text-sm transition-colors", filters.regions[region] !== false ? "text-white" : "text-muted-foreground group-hover:text-white/80")}>
                                {region}
                            </span>
                        </label>
                    ))}
                </div>
            </div>
        </div>
    )
}
