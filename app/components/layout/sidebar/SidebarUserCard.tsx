import type { CSSProperties } from 'react'
import { FaDiscord } from 'react-icons/fa'
import { Trophy, Settings, LogOut, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu'
import { UserProfile, avatarSizeFor, getAvatarUrl } from '@/app/utils/api'
import type { PatreonTier } from '@/app/utils/patreon'
import { PatreonBadge } from '@/app/components/shared/PatreonBadge'
import { usePlatform } from '@/app/platform'

interface SidebarUserCardProps {
    userProfile?: UserProfile
    patreonTier: 0 | PatreonTier
    loginError: string | null
    onLogin: () => void
    onChangeTitle: () => void
    onSettingsIntent: () => void
    onOpenSettings: () => void
    onSignOut: () => void
}

function getRarityStyles(title: { rarity: number, color_r: number, color_g: number, color_b: number } | undefined | null) {
    if (!title) return { containerStyle: {}, titleStyle: {}, containerClass: '', titleClass: '' }

    const { rarity, color_r, color_g, color_b } = title
    const rgb = `rgb(${color_r}, ${color_g}, ${color_b})`

    const containerStyle: CSSProperties = {}
    const titleStyle: CSSProperties = { color: rarity >= 2 ? rgb : undefined }
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

export function SidebarUserCard({
    userProfile,
    patreonTier,
    loginError,
    onLogin,
    onChangeTitle,
    onSettingsIntent,
    onOpenSettings,
    onSignOut,
}: SidebarUserCardProps) {
    const { capabilities } = usePlatform()
    const { containerStyle, titleStyle, containerClass, titleClass } = getRarityStyles(userProfile?.active_title)

    return (
        <div className="p-4 border-t border-hairline/10 relative z-10">
            {!userProfile ? (
                <div className="space-y-2">
                    {loginError && (
                        <p className="px-1 text-xs text-red-400 text-center">{loginError}</p>
                    )}
                    <button
                        onClick={onLogin}
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
                                            src={getAvatarUrl(userProfile.id, avatarSizeFor(32))}
                                            alt="Avatar"
                                            width={32}
                                            height={32}
                                            loading="lazy"
                                            decoding="async"
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
                            onClick={onChangeTitle}
                            className="text-muted-foreground focus:text-foreground focus:bg-hairline/10 cursor-pointer mb-1"
                        >
                            <Trophy className="mr-2 size-4" />
                            <span>Change Title</span>
                        </DropdownMenuItem>
                        {capabilities.settingsModal && (
                            <DropdownMenuItem
                                onPointerEnter={onSettingsIntent}
                                onFocus={onSettingsIntent}
                                onClick={onOpenSettings}
                                className="text-muted-foreground focus:text-foreground focus:bg-hairline/10 cursor-pointer mb-1"
                            >
                                <Settings className="mr-2 size-4" />
                                <span>Settings</span>
                            </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator className="bg-hairline/10" />
                        <DropdownMenuItem
                            onClick={onSignOut}
                            className="text-red-500 focus:text-red-500 focus:bg-red-500/10 cursor-pointer"
                        >
                            <LogOut className="mr-2 size-4" />
                            <span>Sign out</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            )}
        </div>
    )
}
