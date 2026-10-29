import { ReactNode, lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { LogOut, Menu } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/app/components/ui/button'
import { NavHistoryBar } from '@/app/components/navigation/NavHistoryBar'
import { buildNavSections, isEventLinkLive, isNavItemActive, navItemDestination, type NavBadge } from '@/app/components/navigation/nav-items'
import type { NavParams } from '@/app/components/navigation/NavigationContext'
import { useNavigation } from '@/app/components/navigation/NavigationContext'

const loadSettingsModal = () => IS_WEB
    ? import('@/app/components/modals/SettingsModalWeb').then(m => ({ default: m.SettingsModalWeb }))
    : import('@/app/components/modals/SettingsModalDesktop').then(m => ({ default: m.SettingsModalDesktop }))
const SettingsModal = lazy(loadSettingsModal)
const ChangeTitleModal = lazy(() => import('@/app/components/modals/ChangeTitleModal').then(m => ({ default: m.ChangeTitleModal })))
import { PageRefreshProvider } from '@/app/components/navigation/PageRefreshContext'

import { UserProfile } from '@/app/utils/api'
import { usePatreonTier } from '@/app/utils/patreon'
import { IS_WEB, usePlatform } from '@/app/platform'
import { SeasonalAmbient } from '@/app/seasonal/lazyDecor'
import { useSeason } from '@/app/seasonal/SeasonProvider'
import { logoFor } from '@/app/seasonal/logos'
import { SidebarActions } from '@/app/components/layout/sidebar/SidebarActions'
import { SidebarBrand } from '@/app/components/layout/sidebar/SidebarBrand'
import { SidebarNavItem } from '@/app/components/layout/sidebar/SidebarNavItem'
import { SidebarUserCard } from '@/app/components/layout/sidebar/SidebarUserCard'

const SIDEBAR_WIDTH_EXPANDED = '16rem'

interface AppLayoutProps {
    children: ReactNode
    currentView: string
    onViewChange: (view: string, params?: NavParams) => void
    getNavBadge?: (view: string, params: NavParams) => NavBadge | null
    userProfile?: UserProfile
    installationStatus?: 'valid' | 'no-install' | 'unsupported' | null
}

export function AppLayout({ children, currentView, onViewChange, getNavBadge, userProfile, installationStatus }: AppLayoutProps) {
    const { capabilities, auth } = usePlatform()
    const season = useSeason()
    const logo = logoFor(season)
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
    const [loginError, setLoginError] = useState<string | null>(() => auth.consumeLoginError())
    const [mobileNavOpen, setMobileNavOpen] = useState(false)
    const [isMobileViewport, setIsMobileViewport] = useState(
        () => window.matchMedia('(max-width: 1023px)').matches,
    )
    const mobileMenuButtonRef = useRef<HTMLButtonElement>(null)
    const sidebarRef = useRef<HTMLElement>(null)

    const changeView = (view: string, params?: NavParams) => {
        setMobileNavOpen(false)
        onViewChange(view, params)
    }
    const { entry } = useNavigation()
    const currentParams = entry.params
    const [isSettingsOpen, setIsSettingsOpen] = useState(false)
    const [isChangeTitleOpen, setIsChangeTitleOpen] = useState(false)
    const [settingsInitialSection, setSettingsInitialSection] = useState<string | undefined>(undefined)
    const patreonTier = usePatreonTier(userProfile?.id ?? undefined)
    const navSections = useMemo(() => buildNavSections(userProfile), [userProfile])
    const now = new Date()

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

    useLayoutEffect(() => {
        const root = document.documentElement
        root.style.setProperty('--sidebar-width', isMobileViewport ? '0px' : SIDEBAR_WIDTH_EXPANDED)
        return () => {
            root.style.removeProperty('--sidebar-width')
        }
    }, [isMobileViewport])

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
            {currentView === 'home' && <SeasonalAmbient />}

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
                "w-[var(--sidebar-width,0px)] bg-card/50 backdrop-blur-xl border-r border-hairline/10 flex flex-col relative z-20",
                "max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-50 max-lg:w-72 max-lg:max-w-[85vw] max-lg:bg-card/95 max-lg:transition-transform max-lg:duration-200",
                mobileNavOpen ? "max-lg:translate-x-0" : "max-lg:-translate-x-full"
                )}
            >
                <div className="absolute inset-0 bg-gradient-to-b from-accent-900/10 to-transparent pointer-events-none" />

                <SidebarBrand logo={logo} season={season} />

                <SidebarActions
                    installValid={isInstallValid}
                    onJoinServer={() => changeView('servers')}
                />

                <nav className="flex-1 min-h-0 overflow-y-auto px-4 max-lg:pt-6 space-y-6 [@media(max-height:800px)]:space-y-3 relative z-10">
                    {navSections.map((section) => (
                        <div key={section.title} className="space-y-2">
                            <h3 className="px-4 mb-1 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">
                                {section.title}
                            </h3>
                            {section.items.map((item) => {
                                const destination = navItemDestination(item)
                                return (
                                    <SidebarNavItem
                                        key={item.id}
                                        item={item}
                                        destination={destination}
                                        active={isNavItemActive(item, currentView, currentParams)}
                                        badge={getNavBadge?.(destination.view, destination.params) ?? null}
                                        live={!!item.eventLink && isEventLinkLive(item.eventLink, now)}
                                        onActivate={() => changeView(destination.view, destination.params)}
                                    />
                                )
                            })}
                        </div>
                    ))}
                </nav>

                <SidebarUserCard
                    userProfile={userProfile}
                    patreonTier={patreonTier}
                    loginError={loginError}
                    onLogin={() => { setLoginError(null); void auth.login() }}
                    onChangeTitle={() => setIsChangeTitleOpen(true)}
                    onSettingsIntent={() => void loadSettingsModal()}
                    onOpenSettings={() => setIsSettingsOpen(true)}
                    onSignOut={() => setShowLogoutConfirm(true)}
                />
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto relative z-10 pr-1 max-lg:pt-14">
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
