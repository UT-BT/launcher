import { ReactNode, lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { FaDiscord } from 'react-icons/fa'
import { Home, Server, Map as MapIcon, Trophy, Settings, LogOut, Play, User, Users, Users2, Flag, Award, ShieldAlert, Newspaper, Menu, Swords } from 'lucide-react'
import { cn } from '@/lib/utils'
import logo from '@/app/assets/logo.png'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu'
import { Button } from '@/app/components/ui/button'
import { NavHistoryBar } from '@/app/components/navigation/NavHistoryBar'

const loadSettingsModal = () => IS_WEB
    ? import('@/app/components/modals/SettingsModalWeb').then(m => ({ default: m.SettingsModalWeb }))
    : import('@/app/components/modals/SettingsModalDesktop').then(m => ({ default: m.SettingsModalDesktop }))
const SettingsModal = lazy(loadSettingsModal)
const ChangeTitleModal = lazy(() => import('@/app/components/modals/ChangeTitleModal').then(m => ({ default: m.ChangeTitleModal })))
import { PageRefreshProvider } from '@/app/components/navigation/PageRefreshContext'

interface NavItem {
    id: string
    label: string
    icon: React.ElementType
}

interface NavSection {
    title: string
    items: NavItem[]
}

const BASE_NAV_SECTIONS: NavSection[] = [
    {
        title: 'Main',
        items: [
            { id: 'home', label: 'Home', icon: Home },
            { id: 'news', label: 'News', icon: Newspaper },
            { id: 'achievements', label: 'Achievements', icon: Award },
         ],
    },
    {
        title: 'UTBT.net',
        items: [
            { id: 'maps', label: 'Maps', icon: MapIcon },
            { id: 'players', label: 'Players', icon: Users },
            { id: 'teams', label: 'Teams', icon: Users2 },
            { id: 'events', label: 'Events', icon: Swords },
            { id: 'servers', label: 'Servers', icon: Server },
        ],
    },
    {
        title: 'Leaderboards',
        items: [
            { id: 'cap-it-all', label: 'Cap It All', icon: Flag },
            { id: 'world-records', label: 'World Records', icon: Trophy },
        ],
    },
]

import { UserProfile, getAvatarUrl } from '@/app/utils/api'
import { Tooltip } from '@/app/components/ui/tooltip'
import { usePatreonTier } from '@/app/utils/patreon'
import { PatreonBadge } from '@/app/components/shared/PatreonBadge'
import { isStaff } from '@/app/utils/roles'
import { IS_WEB, usePlatform } from '@/app/platform'

function buildNavSections(userProfile?: UserProfile): NavSection[] {
    if (!isStaff(userProfile)) return BASE_NAV_SECTIONS
    return [
        ...BASE_NAV_SECTIONS,
        { title: 'Staff', items: [{ id: 'admin', label: 'Admin', icon: ShieldAlert }] },
    ]
}

interface AppLayoutProps {
    children: ReactNode
    currentView: string
    onViewChange: (view: string) => void
    getNavBadge?: (view: string) => number | null
    userProfile?: UserProfile
    installationStatus?: 'valid' | 'no-install' | 'unsupported' | null
}

function getRarityStyles(title: { rarity: number, color_r: number, color_g: number, color_b: number } | undefined | null) {
    if (!title) return { containerStyle: {}, titleStyle: {}, containerClass: '', titleClass: '' }

    const { rarity, color_r, color_g, color_b } = title
    const rgb = `rgb(${color_r}, ${color_g}, ${color_b})`

    const containerStyle: React.CSSProperties = {}
    const titleStyle: React.CSSProperties = { color: rarity >= 2 ? rgb : undefined }
    let containerClass = ''
    let titleClass = ''

    if (rarity >= 3) {
        containerStyle.borderColor = rgb
    }

    if (rarity >= 4) {
        titleClass = 'animate-pulse-slow'
        titleStyle.textShadow = `0 0 10px ${rgb}`
    }

    if (rarity >= 5) {
        containerClass = 'animate-pulse-slow'
        containerStyle.boxShadow = `0 0 15px ${rgb}`
    }

    return { containerStyle, titleStyle, containerClass, titleClass }
}

export function AppLayout({ children, currentView, onViewChange, getNavBadge, userProfile, installationStatus }: AppLayoutProps) {
    const { capabilities, auth } = usePlatform()
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
    const [loginError, setLoginError] = useState<string | null>(() => auth.consumeLoginError())
    const [mobileNavOpen, setMobileNavOpen] = useState(false)
    const [isMobileViewport, setIsMobileViewport] = useState(
        () => window.matchMedia('(max-width: 1023px)').matches,
    )
    const mobileMenuButtonRef = useRef<HTMLButtonElement>(null)
    const sidebarRef = useRef<HTMLElement>(null)

    const changeView = (view: string) => {
        setMobileNavOpen(false)
        onViewChange(view)
    }
    const [isSettingsOpen, setIsSettingsOpen] = useState(false)
    const [isChangeTitleOpen, setIsChangeTitleOpen] = useState(false)
    const [settingsInitialSection, setSettingsInitialSection] = useState<string | undefined>(undefined)
    const { containerStyle, titleStyle, containerClass, titleClass } = getRarityStyles(userProfile?.active_title)
    const patreonTier = usePatreonTier(userProfile?.id ?? undefined)
    const navSections = useMemo(() => buildNavSections(userProfile), [userProfile])

    useEffect(() => {
        const saved = localStorage.getItem('ui-scale')
        window.uiScale?.set(saved ? parseInt(saved, 10) / 100 : 1)

        const handleOpenSettings = (e: Event) => {
            const customEvent = e as CustomEvent
            if (customEvent.detail?.section) {
                setSettingsInitialSection(customEvent.detail.section)
            } else {
                setSettingsInitialSection(undefined)

            }
            setIsSettingsOpen(true)
        }
        const handleOpenChangeTitle = () => setIsChangeTitleOpen(true)

        window.addEventListener('open-settings', handleOpenSettings)
        window.addEventListener('open-change-title', handleOpenChangeTitle)
        return () => {
            window.removeEventListener('open-settings', handleOpenSettings)
            window.removeEventListener('open-change-title', handleOpenChangeTitle)
        }
    }, [])

    useEffect(() => {
        const mobileQuery = window.matchMedia('(max-width: 1023px)')
        const handleViewportChange = (event: MediaQueryListEvent) => setIsMobileViewport(event.matches)

        setIsMobileViewport(mobileQuery.matches)
        mobileQuery.addEventListener('change', handleViewportChange)
        return () => mobileQuery.removeEventListener('change', handleViewportChange)
    }, [])

    useEffect(() => {
        const sidebar = sidebarRef.current
        if (!sidebar) return

        if (!isMobileViewport) {
            sidebar.removeAttribute('inert')
            return
        }
        if (!mobileNavOpen) {
            sidebar.setAttribute('inert', '')
            return
        }

        sidebar.removeAttribute('inert')
        const menuButton = mobileMenuButtonRef.current
        const focusable = () => Array.from(sidebar.querySelectorAll<HTMLElement>(
            'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ))
        focusable()[0]?.focus()

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault()
                setMobileNavOpen(false)
                return
            }
            if (event.key !== 'Tab') return
            const nodes = focusable()
            if (nodes.length === 0) {
                event.preventDefault()
                sidebar.focus()
                return
            }
            const first = nodes[0]
            const last = nodes[nodes.length - 1]
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault()
                last.focus()
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault()
                first.focus()
            }
        }
        document.addEventListener('keydown', handleKeyDown)
        return () => {
            document.removeEventListener('keydown', handleKeyDown)
            sidebar.setAttribute('inert', '')
            menuButton?.focus()
        }
    }, [isMobileViewport, mobileNavOpen])

    const isInstallValid = installationStatus === 'valid'

    return (
        <div className="flex h-full bg-background text-foreground overflow-hidden relative">
            <div className="nebula-bg absolute inset-0 opacity-30 pointer-events-none" />

            {/* Mobile top bar */}
            <div className="lg:hidden fixed top-0 inset-x-0 h-14 z-30 flex items-center gap-3 px-4 bg-card/80 backdrop-blur-xl border-b border-hairline/10">
                <button
                    ref={mobileMenuButtonRef}
                    type="button"
                    aria-label="Open navigation"
                    aria-controls="app-navigation"
                    aria-expanded={mobileNavOpen}
                    onClick={() => setMobileNavOpen(true)}
                    className="inline-flex items-center justify-center size-10 -ml-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-hairline/10 transition-colors cursor-pointer"
                >
                    <Menu className="size-5" />
                </button>
                <img src={logo} alt="UTBT Logo" className="size-8 object-contain" />
                <span className="font-bold tracking-tight">UTBT.net</span>
            </div>

            {/* Drawer backdrop */}
            {mobileNavOpen && (
                <button
                    type="button"
                    aria-label="Close navigation"
                    className="lg:hidden fixed inset-0 z-40 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
                    onClick={() => setMobileNavOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                ref={sidebarRef}
                id="app-navigation"
                aria-label="Primary navigation"
                tabIndex={-1}
                className={cn(
                "w-64 bg-card/50 backdrop-blur-xl border-r border-hairline/10 flex flex-col relative z-20",
                "max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-50 max-lg:w-72 max-lg:max-w-[85vw] max-lg:bg-card/95 max-lg:transition-transform max-lg:duration-200",
                mobileNavOpen ? "max-lg:translate-x-0" : "max-lg:-translate-x-full"
                )}
            >
                <div className="absolute inset-0 bg-gradient-to-b from-accent-900/10 to-transparent pointer-events-none" />

                <div className="p-6 [@media(max-height:800px)]:p-3 max-lg:hidden flex flex-col items-center relative z-10">
                    <img
                        src={logo}
                        alt="UTBT Logo"
                        className="w-24 h-24 [@media(max-height:800px)]:w-14 [@media(max-height:800px)]:h-14 object-contain drop-shadow-[0_0_15px_rgb(var(--accent-glow-rgb)/0.3)] mb-4 [@media(max-height:800px)]:mb-0 transition-all hover:scale-105 duration-300"
                    />
                </div>

                <div className={cn(
                    'px-4 mb-6 [@media(max-height:800px)]:mb-3 relative z-10 space-y-2',
                    !capabilities.game && 'max-lg:hidden max-lg:mb-0',
                )}>
                    <Button
                        variant="ghost"
                        className="w-full h-11 bg-accent-500/15 border border-accent-500/40 text-accent-200 hover:bg-accent-500/25 hover:text-foreground hover:border-accent-500/60 hover:shadow-[0_0_20px_rgba(59,130,246,0.25)] transition-all font-semibold rounded-lg"
                        onClick={() => changeView('servers')}
                    >
                        <Server className="size-4" />
                        Join Server
                    </Button>
                    {capabilities.game && (isInstallValid ? (
                        <Button
                            variant="ghost"
                            className="w-full h-9 bg-card/50 border border-hairline/10 text-muted-foreground hover:text-foreground hover:bg-card/80 hover:border-hairline/20 transition-colors rounded-lg font-medium"
                            onClick={() => window.conveyor.game.launchGameStandalone()}
                        >
                            <Play className="size-4 fill-current" />
                            Launch Game
                        </Button>
                    ) : (
                        <Tooltip content="No valid UT99 installation found" side="top" className="w-full">
                            <Button
                                variant="ghost"
                                disabled
                                className="w-full h-9 bg-card/30 border border-hairline/5 text-muted-foreground/60 cursor-not-allowed rounded-lg font-medium"
                            >
                                <Play className="size-4 fill-current" />
                                Launch Game
                            </Button>
                        </Tooltip>
                    ))}
                </div>

                <nav className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-4 max-lg:pt-6 space-y-6 [@media(max-height:800px)]:space-y-3 relative z-10">
                    {navSections.map((section) => (
                        <div key={section.title} className="space-y-2">
                            <h3 className="px-4 mb-1 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">
                                {section.title}
                            </h3>
                            {section.items.map((item) => {
                                const badgeCount = getNavBadge?.(item.id) ?? null
                                return (
                                <button
                                    key={item.id}
                                    onClick={() => changeView(item.id)}
                                    className={cn(
                                        "w-full flex items-center gap-3 px-4 py-3 [@media(max-height:800px)]:py-2 rounded-lg transition-all duration-200 cursor-pointer group relative overflow-hidden",
                                        currentView === item.id
                                            ? "text-foreground shadow-[0_0_20px_rgba(29,78,216,0.3)]"
                                            : "text-muted-foreground hover:text-foreground hover:bg-hairline/5"
                                    )}
                                >
                                    {currentView === item.id && (
                                        <div className="absolute inset-0 bg-gradient-to-r from-accent-600/20 to-red-600/20 border-l-2 border-accent-500" />
                                    )}

                                    <item.icon className={cn(
                                        "size-5 transition-colors duration-200 relative z-10",
                                        currentView === item.id ? "text-accent-400" : "group-hover:text-accent-400/80"
                                    )} />
                                    <span className="relative z-10 font-medium">{item.label}</span>
                                    {badgeCount != null && (
                                        <span
                                            className="relative z-10 ml-auto flex items-center"
                                            title={`${badgeCount} new since your last visit`}
                                        >
                                            <span className="absolute inline-flex h-full w-full rounded-full bg-accent-400 opacity-60 animate-ping" />
                                            <span className="relative inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-accent-500 text-white text-[10px] font-black tabular-nums shadow-[0_0_10px_rgb(var(--accent-glow-rgb)/0.5)]">
                                                {badgeCount}
                                            </span>
                                        </span>
                                    )}
                                </button>
                                )
                            })}
                        </div>
                    ))}
                </nav>

                <div className="p-4 border-t border-hairline/10 relative z-10">
                                        {!userProfile ? (
                        <div className="space-y-2">
                            {loginError && (
                                <p className="px-1 text-xs text-red-400 text-center">{loginError}</p>
                            )}
                            <button
                                onClick={() => { setLoginError(null); void auth.login() }}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-foreground bg-[#5865F2] hover:bg-[#4752C4] active:bg-[#3C45A5] rounded-lg transition-all duration-200 text-sm font-medium shadow-lg hover:shadow-[#5865F2]/25 cursor-pointer"
                            >
                                <FaDiscord className="size-4" />
                                <span>Login with Discord</span>
                            </button>

                        </div>
                    ) : (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <div className="relative group cursor-pointer outline-none">
                                <div
                                    className={cn(
                                        "absolute inset-0 rounded-lg bg-hairline/5 border border-hairline/5 transition-colors group-hover:bg-hairline/10",
                                        containerClass
                                    )}
                                    style={containerStyle}
                                />
                                <div className="relative flex items-center gap-3 px-4 py-2">
                                    <div className="size-8 rounded-full bg-gradient-to-br from-accent-500 to-red-500 p-[1px]">
                                        {userProfile?.id ? (
                                            <img
                                                src={getAvatarUrl(userProfile.id)}
                                                alt="Avatar"
                                                className="w-full h-full rounded-full object-cover"
                                                onError={e => {
                                                    const fallbackIdx = userProfile.discordId
                                                        ? Number(userProfile.discordId) % 5
                                                        : 0
                                                    ;(e.target as HTMLImageElement).src = `https://cdn.discordapp.com/embed/avatars/${fallbackIdx}.png`
                                                }}
                                            />
                                        ) : (
                                            <div className="w-full h-full rounded-full bg-black/50 backdrop-blur-sm" />
                                        )}
                                    </div>
                                    <div className="flex flex-col flex-1 min-w-0 text-left">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            <span className="text-sm font-medium truncate">{userProfile?.alias || userProfile?.username || 'Player'}</span>
                                            {patreonTier !== 0 && <PatreonBadge tier={patreonTier} size="sm" />}
                                        </div>
                                        {userProfile?.active_title ? (
                                            <span
                                                className={cn("text-xs font-medium truncate", titleClass)}
                                                style={titleStyle}
                                            >
                                                {userProfile.active_title.name}
                                            </span>
                                        ) : null}
                                    </div>
                                </div>
                            </div>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent side="top" align="center" className="w-56 bg-card/95 backdrop-blur-xl border-hairline/10">
                            <DropdownMenuLabel>{userProfile?.alias || userProfile?.username || 'Player'}</DropdownMenuLabel>
                            <DropdownMenuSeparator className="bg-hairline/10" />
                            {userProfile?.id != null && String(userProfile.id).length > 5 && (
                                <DropdownMenuItem
                                    onClick={() => window.dispatchEvent(new CustomEvent('open-player', { detail: { userId: userProfile.id } }))}
                                    className="text-muted-foreground focus:text-foreground focus:bg-hairline/10 cursor-pointer mb-1"
                                >
                                    <User className="mr-2 size-4" />
                                    <span>View Profile</span>
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                                onClick={() => setIsChangeTitleOpen(true)}
                                className="text-muted-foreground focus:text-foreground focus:bg-hairline/10 cursor-pointer mb-1"
                            >
                                <Trophy className="mr-2 size-4" />
                                <span>Change Title</span>
                            </DropdownMenuItem>
                            {capabilities.settingsModal && (
                                <DropdownMenuItem
                                    onPointerEnter={() => void loadSettingsModal()}
                                    onFocus={() => void loadSettingsModal()}
                                    onClick={() => setIsSettingsOpen(true)}
                                    className="text-muted-foreground focus:text-foreground focus:bg-hairline/10 cursor-pointer mb-1"
                                >
                                    <Settings className="mr-2 size-4" />
                                    <span>Settings</span>
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator className="bg-hairline/10" />
                            <DropdownMenuItem
                                onClick={() => setShowLogoutConfirm(true)}
                                className="text-red-500 focus:text-red-500 focus:bg-red-500/10 cursor-pointer"
                            >
                                <LogOut className="mr-2 size-4" />
                                <span>Sign out</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    )}
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto relative z-10 pr-1 max-lg:pt-14 [scrollbar-width:thin] [scrollbar-color:rgba(148,163,184,0.25)_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-hairline/20">
                <PageRefreshProvider>
                    <div className="p-4 sm:p-6 lg:p-8 min-h-full">
                        <NavHistoryBar />
                        {children}
                    </div>
                </PageRefreshProvider>

                {isChangeTitleOpen && (
                    <Suspense fallback={null}>
                        <ChangeTitleModal
                            isOpen={isChangeTitleOpen}
                            onClose={() => setIsChangeTitleOpen(false)}
                            accessToken={userProfile?.accessToken}
                            userId={userProfile?.id || undefined}
                            currentTitleId={userProfile?.active_title?.id || undefined}
                            onTitleChanged={() => window.dispatchEvent(new CustomEvent('refresh-user-profile'))}
                        />
                    </Suspense>
                )}
            </main>

            {/* Logout Confirmation Modal */}
            {
                showLogoutConfirm && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                        <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="p-6 space-y-4">
                                <div className="flex flex-col items-center text-center gap-2">
                                    <div className="p-3 rounded-full bg-red-500/10 text-red-500 mb-2">
                                        <LogOut className="size-8" />
                                    </div>
                                    <h3 className="text-xl font-bold">Sign Out</h3>
                                    <p className="text-muted-foreground">
                                        Are you sure you want to sign out?
                                        <br />
                                        <br />
                                        You will need to sign in again to access UTBT.
                                    </p>
                                </div>
                                <div className="flex gap-3 justify-center pt-4">
                                    <Button
                                        variant="outline"
                                        onClick={() => setShowLogoutConfirm(false)}
                                        className="min-w-[100px]"
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        onClick={() => auth.logout().then(() => window.location.reload())}
                                        className="min-w-[100px]"
                                    >
                                        Sign Out
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {capabilities.settingsModal && isSettingsOpen && (
                <Suspense fallback={
                    <div className="fixed top-[var(--window-titlebar-height)] right-0 bottom-0 left-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                        <div className="w-[95%] lg:w-[70%] max-w-7xl h-[90vh] rounded-xl border border-border bg-card shadow-2xl p-6 animate-pulse" aria-label="Loading settings">
                            <div className="h-7 w-32 rounded bg-hairline/10" />
                            <div className="mt-8 grid grid-cols-[14rem_1fr] gap-8">
                                <div className="h-64 rounded-xl bg-hairline/5" />
                                <div className="h-48 rounded-xl bg-hairline/5" />
                            </div>
                        </div>
                    </div>
                }>
                    <SettingsModal
                        isOpen={isSettingsOpen}
                        onClose={() => setIsSettingsOpen(false)}
                        initialSection={settingsInitialSection}
                        unlockExclusive={patreonTier > 0 || (userProfile?.utbt_role ?? 0) > 0}
                        installationStatus={installationStatus}
                    />
                </Suspense>
            )}

        </div>
    )
}
