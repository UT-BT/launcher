import { useId, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { createPortal } from 'react-dom'
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
    collapsed: boolean
    patreonTier: 0 | PatreonTier
    loginError: string | null
    onLogin: () => void
    onChangeTitle: () => void
    onSettingsIntent: () => void
    onOpenSettings: () => void
    onSignOut: () => void
}

type ActiveTitle = UserProfile['active_title']

const POPOVER_GAP = 8
const POPOVER_EDGE_PAD = 8
const COLLAPSED_MENU_OFFSET = 28

function getRarityStyles(title: { rarity: number, color_r: number, color_g: number, color_b: number } | undefined | null) {
    if (!title) return { containerStyle: {}, titleStyle: {}, ringStyle: {}, containerClass: '', titleClass: '' }

    const { rarity, color_r, color_g, color_b } = title
    const rgb = `rgb(${color_r}, ${color_g}, ${color_b})`

    const containerStyle: CSSProperties = {}
    const titleStyle: CSSProperties = { color: rarity >= 2 ? rgb : undefined }
    const ringStyle: CSSProperties = {}
    let containerClass = ''
    let titleClass = ''

    if (rarity >= 3) {
        containerStyle.borderColor = rgb
        ringStyle.boxShadow = `0 0 0 2px ${rgb}`
    }

    if (rarity >= 4) {
        titleClass = 'animate-pulse-slow'
        titleStyle.textShadow = `0 0 10px ${rgb}`
    }

    if (rarity >= 5) {
        containerClass = 'animate-pulse-slow'
        containerStyle.boxShadow = `0 0 15px ${rgb}`
        ringStyle.boxShadow = `0 0 0 2px ${rgb}, 0 0 15px ${rgb}`
    }

    return { containerStyle, titleStyle, ringStyle, containerClass, titleClass }
}

function displayName(userProfile: UserProfile) {
    return userProfile.alias || userProfile.username || 'Player'
}

function MenuHeaderPatreonBadge({ tier }: { tier: PatreonTier }) {
    return (
        <>
            <span inert className="inline-flex shrink-0">
                <PatreonBadge tier={tier} size="sm" />
            </span>
            <span className="sr-only">Tier {tier} Patreon Supporter</span>
        </>
    )
}

function UserIdentity({ name, patreonTier, title, titleStyle, titleClass, inMenu = false, className }: {
    name: string
    patreonTier: 0 | PatreonTier
    title: ActiveTitle
    titleStyle: CSSProperties
    titleClass?: string
    inMenu?: boolean
    className?: string
}) {
    return (
        <div className={cn("flex flex-col min-w-0 text-left", className)}>
            <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-sm font-medium truncate">{name}</span>
                {patreonTier !== 0 && (inMenu
                    ? <MenuHeaderPatreonBadge tier={patreonTier} />
                    : <PatreonBadge tier={patreonTier} size="sm" />)}
            </div>
            {title ? (
                <span className={cn("text-xs font-medium truncate", titleClass)} style={titleStyle}>
                    {title.name}
                </span>
            ) : null}
        </div>
    )
}

function UserAvatar({ userProfile }: { userProfile: UserProfile }) {
    return (
        <div className="relative size-8 rounded-full bg-gradient-to-br from-accent-500 to-red-500 p-[1px]">
            {userProfile.id ? (
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
    )
}

function LoginErrorPopover({ id, anchorRef, edgeRef, message }: {
    id: string
    anchorRef: RefObject<HTMLElement | null>
    edgeRef: RefObject<HTMLElement | null>
    message: string
}) {
    const popoverRef = useRef<HTMLDivElement>(null)
    const [position, setPosition] = useState<{ top: number, left: number, arrowTop: number } | null>(null)

    useLayoutEffect(() => {
        const place = () => {
            const anchor = anchorRef.current?.getBoundingClientRect()
            const edge = edgeRef.current?.getBoundingClientRect()
            const popover = popoverRef.current?.getBoundingClientRect()
            if (!anchor || !edge || !popover) return
            const titlebar = document.querySelector('.window-titlebar')
            const topBound = (titlebar ? titlebar.getBoundingClientRect().bottom : 0) + POPOVER_EDGE_PAD
            const top = Math.max(topBound, anchor.bottom - popover.height)
            const anchorMiddle = anchor.top + anchor.height / 2
            setPosition({
                top,
                left: edge.right + POPOVER_GAP,
                arrowTop: Math.min(Math.max(anchorMiddle - top, 12), popover.height - 12),
            })
        }
        place()
        const observer = new ResizeObserver(place)
        for (const element of [anchorRef.current, edgeRef.current, popoverRef.current]) {
            if (element) observer.observe(element)
        }
        window.addEventListener('resize', place)
        return () => {
            observer.disconnect()
            window.removeEventListener('resize', place)
        }
    }, [anchorRef, edgeRef, message])

    return createPortal(
        <div
            ref={popoverRef}
            id={id}
            role="alert"
            className={cn(
                "fixed z-40 w-max max-w-60 px-3 py-2 rounded-md bg-popover/95 border border-red-500/30 text-red-400 text-xs font-medium shadow-2xl",
                !position && "opacity-0"
            )}
            style={{ top: position?.top ?? 0, left: position?.left ?? 0 }}
        >
            {message}
            <div
                aria-hidden
                className="absolute right-full -translate-y-1/2 -mr-[1px] border-[6px] border-transparent border-r-red-500/30"
                style={{ top: position?.arrowTop ?? 0 }}
            />
        </div>,
        document.body
    )
}

function SignedOutCard({ collapsed, loginError, onLogin }: Pick<SidebarUserCardProps, 'collapsed' | 'loginError' | 'onLogin'>) {
    const cardRef = useRef<HTMLDivElement>(null)
    const buttonRef = useRef<HTMLButtonElement>(null)
    const errorId = useId()
    const showPopover = collapsed && !!loginError

    return (
        <>
            <div ref={cardRef} className={cn("border-t border-hairline/10 relative z-10 space-y-2", collapsed ? "px-2 py-4" : "p-4")}>
                {loginError && !collapsed && (
                    <p className="px-1 text-red-400 text-xs text-center">{loginError}</p>
                )}
                <button
                    ref={buttonRef}
                    type="button"
                    onClick={onLogin}
                    aria-describedby={showPopover ? errorId : undefined}
                    className={cn(
                        "flex items-center justify-center gap-2 text-foreground bg-[#5865F2] hover:bg-[#4752C4] active:bg-[#3C45A5] rounded-lg transition duration-200 text-sm font-medium shadow-lg hover:shadow-[#5865F2]/25 cursor-pointer",
                        collapsed ? "mx-auto size-10" : "w-full py-2.5 px-4"
                    )}
                >
                    <FaDiscord className={collapsed ? "size-5" : "size-4"} />
                    <span className={collapsed ? "sr-only" : undefined}>Login with Discord</span>
                </button>
            </div>
            {showPopover && <LoginErrorPopover id={errorId} anchorRef={buttonRef} edgeRef={cardRef} message={loginError} />}
        </>
    )
}

export function SidebarUserCard({
    userProfile,
    collapsed,
    patreonTier,
    loginError,
    onLogin,
    onChangeTitle,
    onSettingsIntent,
    onOpenSettings,
    onSignOut,
}: SidebarUserCardProps) {
    const { capabilities } = usePlatform()
    const { containerStyle, titleStyle, ringStyle, containerClass, titleClass } = getRarityStyles(userProfile?.active_title)

    if (!userProfile) {
        return <SignedOutCard collapsed={collapsed} loginError={loginError} onLogin={onLogin} />
    }

    const name = displayName(userProfile)

    return (
        <div className={cn("border-t border-hairline/10 relative z-10", collapsed ? "px-2 py-4" : "p-4")}>
            <DropdownMenu>
                {collapsed ? (
                    <div className="relative flex items-center justify-center py-2">
                        <DropdownMenuTrigger asChild>
                            <button
                                type="button"
                                aria-label={`${name}, profile menu`}
                                className="relative -m-1 p-1 rounded-full transition-colors hover:bg-hairline/10 data-[state=open]:bg-hairline/10 cursor-pointer"
                            >
                                <span aria-hidden className={cn("absolute inset-1 rounded-full", containerClass)} style={ringStyle} />
                                <UserAvatar userProfile={userProfile} />
                            </button>
                        </DropdownMenuTrigger>
                    </div>
                ) : (
                    <DropdownMenuTrigger asChild>
                        <div className="relative group cursor-pointer outline-none">
                            <div
                                className={cn(
                                    "absolute inset-0 rounded-lg bg-hairline/5 border border-hairline/5 transition-colors group-hover:bg-hairline/10",
                                    containerClass
                                )}
                                style={containerStyle}
                            />
                            <div className="relative flex items-center py-2 gap-3 px-4">
                                <UserAvatar userProfile={userProfile} />
                                <UserIdentity
                                    name={name}
                                    patreonTier={patreonTier}
                                    title={userProfile.active_title}
                                    titleStyle={titleStyle}
                                    titleClass={titleClass}
                                    className="flex-1"
                                />
                            </div>
                        </div>
                    </DropdownMenuTrigger>
                )}
                <DropdownMenuContent
                    side={collapsed ? "right" : "top"}
                    align={collapsed ? "end" : "center"}
                    sideOffset={collapsed ? COLLAPSED_MENU_OFFSET : undefined}
                    className="w-56 bg-card/95 backdrop-blur-xl border-hairline/10"
                >
                    <DropdownMenuLabel>
                        <UserIdentity
                            name={name}
                            patreonTier={patreonTier}
                            title={userProfile.active_title}
                            titleStyle={titleStyle}
                            inMenu
                        />
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-hairline/10" />
                    {userProfile.id != null && String(userProfile.id).length > 5 && (
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
        </div>
    )
}
