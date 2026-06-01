import { ReactNode, useEffect, useState } from 'react'
import { Home, Server, Map as MapIcon, Trophy, Settings, LogOut, Play, User, Users, Flag } from 'lucide-react'
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
import { SettingsModal } from '@/app/components/modals/SettingsModal'
import { ChangeTitleModal } from '@/app/components/modals/ChangeTitleModal'

interface NavItem {
    id: string
    label: string
    icon: React.ElementType
}

interface NavSection {
    title: string
    items: NavItem[]
}

const navSections: NavSection[] = [
    {
        title: 'Navigation',
        items: [
            { id: 'home', label: 'Home', icon: Home },
            { id: 'maps', label: 'Maps', icon: MapIcon },
            { id: 'players', label: 'Players', icon: Users },
        ],
    },
    {
        title: 'Leaderboards',
        items: [
            { id: 'cap-it-all', label: 'Cap It All', icon: Flag },
        ],
    },
]

import { UserProfile, getAvatarUrl } from '@/app/utils/api'
import { Tooltip } from '@/app/components/ui/tooltip'
import { usePatreonTier } from '@/app/utils/patreon'
import { PatreonBadge } from '@/app/components/shared/PatreonBadge'

interface AppLayoutProps {
    children: ReactNode
    currentView: string
    onViewChange: (view: string) => void
    userProfile?: UserProfile
    installationStatus?: 'valid' | 'no-install' | 'unsupported' | null
}

function getRarityStyles(title: { rarity: number, color: string } | undefined | null) {
    if (!title) return { containerStyle: {}, titleStyle: {}, containerClass: '', titleClass: '' }

    const { rarity, color } = title
    const rgb = `rgb(${color})`

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

export function AppLayout({ children, currentView, onViewChange, userProfile, installationStatus }: AppLayoutProps) {
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
    const [isSettingsOpen, setIsSettingsOpen] = useState(false)
    const [isChangeTitleOpen, setIsChangeTitleOpen] = useState(false)
    const [settingsInitialSection, setSettingsInitialSection] = useState<string | undefined>(undefined)
    const { containerStyle, titleStyle, containerClass, titleClass } = getRarityStyles(userProfile?.active_title)
    const patreonTier = usePatreonTier(userProfile?.id ?? undefined)

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
        window.addEventListener('open-settings', handleOpenSettings)
        return () => window.removeEventListener('open-settings', handleOpenSettings)
    }, [])

    const isInstallValid = installationStatus === 'valid'

    return (
        <div className="flex h-full bg-background text-foreground overflow-hidden relative">
            <div className="nebula-bg absolute inset-0 opacity-30 pointer-events-none" />

            {/* Sidebar */}
            <aside className="w-64 bg-card/50 backdrop-blur-xl border-r border-white/10 flex flex-col z-20 relative">
                <div className="absolute inset-0 bg-gradient-to-b from-blue-900/10 to-transparent pointer-events-none" />

                <div className="p-6 flex flex-col items-center relative z-10">
                    <img
                        src={logo}
                        alt="UTBT Logo"
                        className="w-24 h-24 object-contain drop-shadow-[0_0_15px_rgba(56,189,248,0.3)] mb-4 transition-transform hover:scale-105 duration-300"
                    />
                </div>

                <div className="px-4 mb-6 relative z-10 space-y-2">
                    <Button
                        variant="ghost"
                        className="w-full h-11 bg-blue-500/15 border border-blue-500/40 text-blue-200 hover:bg-blue-500/25 hover:text-white hover:border-blue-500/60 hover:shadow-[0_0_20px_rgba(59,130,246,0.25)] transition-all font-semibold rounded-lg"
                        onClick={() => onViewChange('servers')}
                    >
                        <Server className="size-4" />
                        Join UTBT Server
                    </Button>
                    {isInstallValid ? (
                        <Button
                            variant="ghost"
                            className="w-full h-9 bg-card/50 border border-white/10 text-muted-foreground hover:text-white hover:bg-card/80 hover:border-white/20 transition-colors rounded-lg font-medium"
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
                                className="w-full h-9 bg-card/30 border border-white/5 text-muted-foreground/60 cursor-not-allowed rounded-lg font-medium"
                            >
                                <Play className="size-4 fill-current" />
                                Launch Game
                            </Button>
                        </Tooltip>
                    )}
                </div>

                <nav className="flex-1 px-4 space-y-6 relative z-10">
                    {navSections.map((section) => (
                        <div key={section.title} className="space-y-2">
                            <h3 className="px-4 mb-1 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">
                                {section.title}
                            </h3>
                            {section.items.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => onViewChange(item.id)}
                                    className={cn(
                                        "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 cursor-pointer group relative overflow-hidden",
                                        currentView === item.id
                                            ? "text-white shadow-[0_0_20px_rgba(29,78,216,0.3)]"
                                            : "text-muted-foreground hover:text-white hover:bg-white/5"
                                    )}
                                >
                                    {currentView === item.id && (
                                        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-red-600/20 border-l-2 border-blue-500" />
                                    )}

                                    <item.icon className={cn(
                                        "size-5 transition-colors duration-200 relative z-10",
                                        currentView === item.id ? "text-blue-400" : "group-hover:text-blue-400/80"
                                    )} />
                                    <span className="relative z-10 font-medium">{item.label}</span>
                                </button>
                            ))}
                        </div>
                    ))}
                </nav>

                <div className="p-4 border-t border-white/10 relative z-10">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <div className="relative group cursor-pointer outline-none">
                                <div
                                    className={cn(
                                        "absolute inset-0 rounded-lg bg-white/5 border border-white/5 transition-colors group-hover:bg-white/10",
                                        containerClass
                                    )}
                                    style={containerStyle}
                                />
                                <div className="relative flex items-center gap-3 px-4 py-2">
                                    <div className="size-8 rounded-full bg-gradient-to-br from-blue-500 to-red-500 p-[1px]">
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
                        <DropdownMenuContent side="top" align="center" className="w-56 bg-card/95 backdrop-blur-xl border-white/10">
                            <DropdownMenuLabel>{userProfile?.alias || userProfile?.username || 'Player'}</DropdownMenuLabel>
                            <DropdownMenuSeparator className="bg-white/10" />
                            {userProfile?.id != null && String(userProfile.id).length > 5 && (
                                <DropdownMenuItem
                                    onClick={() => window.dispatchEvent(new CustomEvent('open-player', { detail: { userId: userProfile.id } }))}
                                    className="text-muted-foreground focus:text-white focus:bg-white/10 cursor-pointer mb-1"
                                >
                                    <User className="mr-2 size-4" />
                                    <span>View Profile</span>
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                                onClick={() => setIsChangeTitleOpen(true)}
                                className="text-muted-foreground focus:text-white focus:bg-white/10 cursor-pointer mb-1"
                            >
                                <Trophy className="mr-2 size-4" />
                                <span>Change Title</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => setIsSettingsOpen(true)}
                                className="text-muted-foreground focus:text-white focus:bg-white/10 cursor-pointer mb-1"
                            >
                                <Settings className="mr-2 size-4" />
                                <span>Settings</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-white/10" />
                            <DropdownMenuItem
                                onClick={() => setShowLogoutConfirm(true)}
                                className="text-red-500 focus:text-red-500 focus:bg-red-500/10 cursor-pointer"
                            >
                                <LogOut className="mr-2 size-4" />
                                <span>Sign out</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto relative z-10">
                <div className="p-8 min-h-full">
                    {children}
                </div>

                <ChangeTitleModal
                    isOpen={isChangeTitleOpen}
                    onClose={() => setIsChangeTitleOpen(false)}
                    accessToken={userProfile?.accessToken}
                    userId={userProfile?.id || undefined}
                    currentTitleId={userProfile?.active_title?.id || undefined}
                    onTitleChanged={() => window.dispatchEvent(new CustomEvent('refresh-user-profile'))}
                />
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
                                        onClick={() => window.auth.logout().then(() => window.location.reload())}
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

            <SettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                initialSection={settingsInitialSection}
            />

        </div>
    )
}
