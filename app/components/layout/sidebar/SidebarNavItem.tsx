import type { ElementType } from 'react'
import { cn } from '@/lib/utils'
import { NavLink } from '@/app/components/navigation/NavLink'
import { navItemCaption, type NavBadge, type NavDestination, type NavItem } from '@/app/components/navigation/nav-items'
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
    collapsed: boolean
    onActivate: () => void
}

function NavItemIcon({ icon: Icon, active, badge, badgeTooltip }: { icon: ElementType; active: boolean; badge: NavBadge | null; badgeTooltip: boolean }) {
    const glyph = (
        <Icon className={cn(
            "size-5 transition-colors duration-200",
            active ? "text-accent-400" : "group-hover:text-accent-400/80"
        )} />
    )

    if (!badge) return <span className="relative z-10 flex shrink-0">{glyph}</span>

    const marks = (
        <>
            {glyph}
            {badge.count != null && (
                <span aria-hidden className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-accent-500 text-white text-[10px] font-black leading-none tabular-nums ring-2 ring-card shadow-[0_0_8px_rgb(var(--accent-glow-rgb)/0.5)]">
                    {badge.count > 99 ? '99+' : badge.count}
                </span>
            )}
            {badge.live && <LiveDot className="absolute -bottom-1 -right-1 ring-2 ring-card" />}
        </>
    )

    if (!badgeTooltip) return <span className="relative z-10 inline-flex shrink-0 items-center">{marks}</span>

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
            {marks}
        </Tooltip>
    )
}

function RailTooltipContent({ item, live, badge }: { item: NavItem; live: boolean; badge: NavBadge | null }) {
    return (
        <span className="flex flex-col gap-0.5">
            <span className="font-bold text-foreground">{item.label}</span>
            {item.eventLink && <span className="font-medium">{item.eventLink.fullName}</span>}
            {live && <span className="font-medium text-red-300">Live</span>}
            {badge?.details.map(line => <span key={line} className="font-medium">{line}</span>)}
        </span>
    )
}

export function SidebarNavItem({ item, destination, active, badge, live, collapsed, onActivate }: SidebarNavItemProps) {
    const caption = navItemCaption(item)

    const link = (
        <NavLink
            view={destination.view}
            params={destination.params}
            onPointerEnter={() => prefetchPage(destination.view)}
            onFocus={() => prefetchPage(destination.view)}
            onActivate={onActivate}
            className={cn(
                "w-full flex rounded-lg transition duration-200 cursor-pointer group relative overflow-hidden",
                collapsed
                    ? "flex-col items-center justify-center gap-1 min-h-11 px-1 py-1.5 [@media(max-height:800px)]:py-1"
                    : "items-center gap-4 px-4 py-3 [@media(max-height:800px)]:py-2",
                active
                    ? "text-foreground shadow-[0_0_20px_rgba(29,78,216,0.3)]"
                    : "text-muted-foreground hover:text-foreground hover:bg-hairline/5"
            )}
        >
            {active && (
                <span className="absolute inset-0 bg-gradient-to-r from-accent-600/20 to-red-600/20 border-l-2 border-accent-500" />
            )}

            <NavItemIcon icon={item.icon} active={active} badge={badge} badgeTooltip={!collapsed} />
            {collapsed ? (
                <span className="relative z-10 flex max-w-full items-center gap-1">
                    {live && <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-red-500" />}
                    <span className="min-w-0 truncate text-[10px] leading-tight font-medium">{caption}</span>
                </span>
            ) : (
                <span className="relative z-10 min-w-0 truncate font-medium">{item.label}</span>
            )}
            {collapsed && caption !== item.label && <span className="sr-only">{item.label}</span>}
            {item.eventLink && <span className="sr-only">{item.eventLink.fullName}</span>}
            {badge && <span className="sr-only">{badge.details.join('. ')}</span>}
            {live && collapsed && <span className="sr-only">Live</span>}
            {live && !collapsed && (
                <span className={cn('relative z-10 ml-auto shrink-0', CHIP_SHAPE, LIVE_CHIP_STYLE)}>
                    Live
                </span>
            )}
        </NavLink>
    )

    if (!collapsed) return link

    return (
        <Tooltip side="right" className="flex w-full" content={<RailTooltipContent item={item} live={live} badge={badge} />}>
            {link}
        </Tooltip>
    )
}
