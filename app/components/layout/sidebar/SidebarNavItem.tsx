import type { ElementType } from 'react'
import { cn } from '@/lib/utils'
import { NavLink } from '@/app/components/navigation/NavLink'
import type { NavBadge, NavDestination, NavItem } from '@/app/components/navigation/nav-items'
import { Tooltip } from '@/app/components/ui/tooltip'
import { LiveDot } from '@/app/components/shared/LiveDot'
import { CHIP_SHAPE, LIVE_CHIP_STYLE } from '@/app/components/shared/chipStyles'
import { prefetchPage } from '@/app/components/main/pageLoaders'

interface SidebarNavItemProps {
    item: NavItem
    destination: NavDestination
    active: boolean
    badge: NavBadge | null
    live: boolean
    onActivate: () => void
}

function NavItemIcon({ icon: Icon, active, badge }: { icon: ElementType; active: boolean; badge: NavBadge | null }) {
    const glyph = (
        <Icon className={cn(
            "size-5 transition-colors duration-200",
            active ? "text-accent-400" : "group-hover:text-accent-400/80"
        )} />
    )

    if (!badge) return <span className="relative z-10 flex shrink-0">{glyph}</span>

    return (
        <Tooltip
            side="top"
            className="z-10 shrink-0"
            content={
                <span className="flex flex-col gap-0.5">
                    {badge.details.map(line => <span key={line}>{line}</span>)}
                </span>
            }
        >
            {glyph}
            {badge.count != null && (
                <span aria-hidden className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-accent-500 text-white text-[10px] font-black leading-none tabular-nums ring-2 ring-card shadow-[0_0_8px_rgb(var(--accent-glow-rgb)/0.5)]">
                    {badge.count > 99 ? '99+' : badge.count}
                </span>
            )}
            {badge.live && <LiveDot className="absolute -bottom-1 -right-1 ring-2 ring-card" />}
        </Tooltip>
    )
}

export function SidebarNavItem({ item, destination, active, badge, live, onActivate }: SidebarNavItemProps) {
    return (
        <NavLink
            view={destination.view}
            params={destination.params}
            onPointerEnter={() => prefetchPage(destination.view)}
            onFocus={() => prefetchPage(destination.view)}
            onActivate={onActivate}
            className={cn(
                "w-full flex items-center gap-4 px-4 py-3 [@media(max-height:800px)]:py-2 rounded-lg transition-all duration-200 cursor-pointer group relative overflow-hidden",
                active
                    ? "text-foreground shadow-[0_0_20px_rgba(29,78,216,0.3)]"
                    : "text-muted-foreground hover:text-foreground hover:bg-hairline/5"
            )}
        >
            {active && (
                <span className="absolute inset-0 bg-gradient-to-r from-accent-600/20 to-red-600/20 border-l-2 border-accent-500" />
            )}

            <NavItemIcon icon={item.icon} active={active} badge={badge} />
            <span className="relative z-10 min-w-0 truncate font-medium">{item.label}</span>
            {item.eventLink && <span className="sr-only">{item.eventLink.fullName}</span>}
            {badge && <span className="sr-only">{badge.details.join('. ')}</span>}
            {live && (
                <span className={cn('relative z-10 ml-auto shrink-0', CHIP_SHAPE, LIVE_CHIP_STYLE)}>
                    Live
                </span>
            )}
        </NavLink>
    )
}
