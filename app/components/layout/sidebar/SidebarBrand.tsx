import { fireSeasonalBurst } from '@/app/seasonal/lazyDecor'
import type { SeasonId } from '@/app/seasonal/seasons'

interface SidebarBrandProps {
    logo: string
    season: SeasonId | null
}

export function SidebarBrand({ logo, season }: SidebarBrandProps) {
    return (
        <div className="p-6 [@media(max-height:800px)]:p-3 max-lg:hidden flex flex-col items-center relative z-10">
            <img
                src={logo}
                alt="UTBT Logo"
                onClick={season ? event => {
                    const rect = event.currentTarget.getBoundingClientRect()
                    fireSeasonalBurst(season, rect.left + rect.width / 2, rect.top + rect.height / 2)
                } : undefined}
                className="w-24 h-24 [@media(max-height:800px)]:w-14 [@media(max-height:800px)]:h-14 object-contain drop-shadow-[0_0_15px_rgb(var(--accent-glow-rgb)/0.3)] mb-4 [@media(max-height:800px)]:mb-0 transition-all hover:scale-105 duration-300"
            />
        </div>
    )
}
