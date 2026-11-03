import { Menu } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NavLink } from '@/app/components/navigation/NavLink'
import { activeBottomTab, BOTTOM_TABS } from '@/app/components/navigation/bottomTabs'
import { navItemCaption } from '@/app/components/navigation/nav-items'
import { prefetchPage } from '@/app/components/main/pageLoaders'

interface BottomTabBarProps {
    currentView: string
    visible: boolean
    menuOpen: boolean
    onNavigate: (view: string) => void
    onOpenMenu: (opener: HTMLElement) => void
}

const TAB_CLASS = 'flex min-w-0 flex-col items-center justify-center gap-1 px-1 text-[10px] font-medium leading-tight transition-colors cursor-pointer'

export function BottomTabBar({ currentView, visible, menuOpen, onNavigate, onOpenMenu }: BottomTabBarProps) {
    const active = activeBottomTab(currentView)

    return (
        <nav
            aria-label="Tab bar"
            inert={visible ? undefined : true}
            className={cn(
                'shell-tab-bar fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 bg-card border-t border-hairline/10 transition-transform duration-200',
                visible ? undefined : 'translate-y-full',
            )}
        >
            {BOTTOM_TABS.map(tab => {
                const current = tab.id === active
                const caption = navItemCaption(tab)
                const Icon = tab.icon
                return (
                    <NavLink
                        key={tab.id}
                        view={tab.id}
                        onActivate={() => onNavigate(tab.id)}
                        onPointerEnter={() => prefetchPage(tab.id)}
                        onFocus={() => prefetchPage(tab.id)}
                        ariaCurrent={current ? 'page' : undefined}
                        className={cn(TAB_CLASS, current ? 'text-foreground font-semibold' : 'text-muted-foreground')}
                    >
                        <Icon aria-hidden className={cn('size-5', current && 'text-accent-400')} />
                        <span className="max-w-full truncate">{caption}</span>
                        {caption !== tab.label && <span className="sr-only">{tab.label}</span>}
                    </NavLink>
                )
            })}
            <button
                type="button"
                aria-controls="app-navigation"
                aria-expanded={menuOpen}
                onClick={event => onOpenMenu(event.currentTarget)}
                className={cn(TAB_CLASS, 'text-muted-foreground')}
            >
                <Menu aria-hidden className="size-5" />
                <span>Menu</span>
            </button>
        </nav>
    )
}
