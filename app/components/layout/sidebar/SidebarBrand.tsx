import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { fireSeasonalBurst } from '@/app/seasonal/lazyDecor'
import type { EntryId } from '@/app/seasonal/seasons'

interface SidebarBrandProps {
    logo: string
    seasonal: EntryId | null
    collapsed: boolean
    toggle: ReactNode
}

export function SidebarBrand({ logo, seasonal, collapsed, toggle }: SidebarBrandProps) {
    return (
        <div className={cn(
            "max-lg:hidden flex flex-col items-center relative z-10",
            collapsed ? "px-4 pb-4 pt-14 [@media(max-height:800px)]:px-2 [@media(max-height:800px)]:pb-2 [@media(max-height:800px)]:pt-12" : "p-6 [@media(max-height:800px)]:p-3"
        )}>
            {toggle && (
                <div className="absolute left-[22px] top-3 [@media(max-height:800px)]:top-2 flex">
                    {toggle}
                </div>
            )}
            <img
                src={logo}
                alt="UTBT Logo"
                data-diagnostic-trigger
                style={{ WebkitTouchCallout: 'none' }}
                onClick={seasonal ? event => {
                    const rect = event.currentTarget.getBoundingClientRect()
                    fireSeasonalBurst(seasonal, rect.left + rect.width / 2, rect.top + rect.height / 2)
                } : undefined}
                className={cn(
                    "object-contain select-none drop-shadow-[0_0_15px_rgb(var(--accent-glow-rgb)/0.3)] transition hover:scale-105 duration-300",
                    collapsed
                        ? "size-10"
                        : "w-24 h-24 [@media(max-height:800px)]:w-14 [@media(max-height:800px)]:h-14 mb-4 [@media(max-height:800px)]:mb-0"
                )}
            />
        </div>
    )
}
