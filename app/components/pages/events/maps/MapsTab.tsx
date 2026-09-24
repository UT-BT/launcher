import { cn } from '@/lib/utils'
import { MapThumbnail } from '@/app/components/shared/MapThumbnail'
import { MapNavLink } from '@/app/components/shared/MapNavLink'
import { displayMapName } from '@/app/utils/format'
import type { PickBanPoolMap, PickBanStageConfig } from '@/app/utils/api'
import { tagBadgeVariant } from './mapsShared'

const TAG_BADGE_CLASS: Record<'warning' | 'default', string> = {
    warning: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
    default: 'bg-white/5 border-white/5 text-muted-foreground',
}

interface MapsTabProps {
    stages: PickBanStageConfig[]
    onMapSelect?: (mapName: string) => void
}

export function MapsTab({ stages, onMapSelect }: MapsTabProps) {
    return (
        <div className="flex flex-col gap-6">
            {stages.map(stage => (
                <section key={stage.key} className="rounded-xl border border-white/10 bg-card/30 p-4 space-y-3">
                    <h2 className="text-sm font-semibold text-foreground">{stage.name}</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 2xl:grid-cols-6 gap-3">
                        {stage.pool.map(poolMap => (
                            <MapPoolCard key={poolMap.map} poolMap={poolMap} onMapSelect={onMapSelect} />
                        ))}
                    </div>
                </section>
            ))}
        </div>
    )
}

function MapPoolCard({ poolMap, onMapSelect }: { poolMap: PickBanPoolMap; onMapSelect?: (mapName: string) => void }) {
    return (
        <div className="rounded-xl overflow-hidden border border-hairline/5 bg-card/30 hover:border-hairline/20 transition-colors">
            <MapNavLink
                mapName={poolMap.map}
                onMapSelect={onMapSelect}
                ariaLabel={displayMapName(poolMap.map)}
                className={cn('block w-full', onMapSelect && 'cursor-pointer')}
            >
                <MapThumbnail
                    mapName={poolMap.map}
                    version={poolMap.screenshot_version}
                    size="card"
                    className="w-full aspect-square rounded-none border-0"
                />
            </MapNavLink>
            <div className="p-2.5 space-y-1.5">
                <MapNavLink
                    mapName={poolMap.map}
                    onMapSelect={onMapSelect}
                    className={cn('block min-w-0', onMapSelect && 'cursor-pointer')}
                >
                    <span className="block truncate text-sm font-semibold text-foreground hover:underline underline-offset-2">
                        {displayMapName(poolMap.map)}
                    </span>
                </MapNavLink>
                {poolMap.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                        {poolMap.tags.map(tag => (
                            <span
                                key={tag}
                                className={cn(
                                    'text-[10px] font-medium px-1.5 py-0.5 rounded border leading-tight',
                                    TAG_BADGE_CLASS[tagBadgeVariant(tag)],
                                )}
                            >
                                {tag}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
