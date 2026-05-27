import { CSSProperties, useMemo } from 'react'
import { Clock, Zap, TrendingUp, Trophy, Map as MapIcon, Flag, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/app/components/ui/tooltip'
import { getAvatarUrl } from '@/app/utils/api'
import type { ActiveTitle } from '@/app/utils/api'
import { hasTitle, getReadableTitleColor, getAvatarBorderStyle } from '@/app/utils/titleStyles'

interface ProfileHeroProps {
    userId?: string | number
    username: string
    alias?: string | null
    title?: ActiveTitle | null
    lastLoginIso?: string | null
    weekly: number
    weeklyTop: number | null
    monthly: number
    monthlyTop: number | null
    yearly: number
    yearlyTop: number | null
    newMaps: number
    newRecords: number
    livePlayers: number
    refreshing?: boolean
    refreshDisabled?: boolean
    refreshTooltip?: string
    onChangeTitle?: () => void
    onBrowseServers?: () => void
    onRefresh?: () => void
}

const formatHours = (seconds: number) => `${(seconds / 3600).toFixed(1)}h`

function titleStyle(title?: ActiveTitle | null): CSSProperties {
    if (!hasTitle(title)) return { color: 'rgba(255,255,255,0.4)' }
    return { color: getReadableTitleColor(title.color_r, title.color_g, title.color_b) }
}

interface PlaytimeCellProps {
    label: string
    value: number
    top: number | null
    icon: React.ComponentType<{ className?: string }>
    accent: { text: string; bar: string; glow: string }
}

function PlaytimeCell({ label, value, top, icon: Icon, accent }: PlaytimeCellProps) {
    const fillPct = top == null ? 0 : Math.max(2, Math.min(100, 100 - top))

    return (
        <div className="flex-1 min-w-0 px-4 py-2.5">
            <div className="flex items-center gap-2">
                <Icon className={cn('size-3.5 shrink-0', accent.text)} />
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/70 shrink-0">
                    {label}
                </span>
                <span className="text-lg font-black text-white/95 tracking-tight leading-none font-mono ml-auto">
                    {formatHours(value)}
                </span>
                {top != null && (
                    <Tooltip content={`Top ${top}% of players in this period`} side="bottom">
                        <span className={cn('text-[9px] font-black uppercase tracking-widest cursor-help shrink-0', accent.text)}>
                            T{top}%
                        </span>
                    </Tooltip>
                )}
            </div>
            <div className="mt-1.5 h-0.5 bg-white/5 rounded-full overflow-hidden">
                <div
                    className={cn('h-full rounded-full transition-all duration-500', accent.bar, top != null && accent.glow)}
                    style={{ width: `${fillPct}%` }}
                />
            </div>
        </div>
    )
}

interface SinceStatProps {
    label: string
    value: number
    icon: React.ComponentType<{ className?: string }>
    accent: string
}

function SinceStat({ label, value, icon: Icon, accent }: SinceStatProps) {
    return (
        <div className="flex items-center gap-1.5">
            <Icon className={cn('size-3', accent)} />
            <span className={cn('text-[10px] font-black tracking-tight font-mono', accent)}>
                +{value}
            </span>
            <span className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest">
                {label}
            </span>
        </div>
    )
}

export function ProfileHero({
    userId, username, alias, title, lastLoginIso,
    weekly, weeklyTop, monthly, monthlyTop, yearly, yearlyTop,
    newMaps, newRecords, livePlayers, refreshing, refreshDisabled, refreshTooltip,
    onChangeTitle, onBrowseServers, onRefresh,
}: ProfileHeroProps) {
    const lastLoginLabel = useMemo(() => {
        if (!lastLoginIso) return 'First visit'
        try {
            const d = new Date(lastLoginIso)
            return new Intl.DateTimeFormat('en-US', {
                month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
            }).format(d)
        } catch {
            return '—'
        }
    }, [lastLoginIso])

    const avatarSrc = userId != null && String(userId).length > 5 ? getAvatarUrl(userId) : null
    const displayName = alias || username

    return (
        <div className="relative overflow-hidden bg-card/30 border border-white/5 rounded-2xl backdrop-blur-xl">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/[0.04] via-transparent to-purple-500/[0.04] pointer-events-none" />

            {onRefresh && (
                <Tooltip content={refreshTooltip ?? 'Refresh'} side="bottom" className="absolute top-3 right-3 z-10">
                    <button
                        type="button"
                        onClick={onRefresh}
                        disabled={refreshing || refreshDisabled}
                        aria-label="Refresh homepage"
                        className="p-2 rounded-md text-muted-foreground hover:text-white hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <RefreshCw className={cn('size-4', refreshing && 'animate-spin')} />
                    </button>
                </Tooltip>
            )}

            <div className="relative flex items-center gap-4 p-5">
                <div
                    className="rounded-full overflow-hidden bg-card flex items-center justify-center shrink-0"
                    style={{ width: 64, height: 64, ...getAvatarBorderStyle(title) }}
                >
                    {avatarSrc ? (
                        <img
                            src={avatarSrc}
                            alt={displayName}
                            className="w-full h-full object-cover"
                            onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden' }}
                        />
                    ) : (
                        <span className="text-xl font-black text-white/30">
                            {displayName.charAt(0).toUpperCase()}
                        </span>
                    )}
                </div>

                <div className="flex flex-col min-w-0 gap-1 flex-1">
                    {userId != null && String(userId).length > 5 ? (
                        <Tooltip content="View your profile" side="bottom" className="self-start max-w-full">
                            <button
                                type="button"
                                onClick={() => window.dispatchEvent(new CustomEvent('open-player', { detail: { userId } }))}
                                className="text-2xl font-black tracking-tight text-white/95 truncate cursor-pointer hover:opacity-80 hover:underline underline-offset-4 transition-opacity text-left"
                            >
                                {displayName}
                            </button>
                        </Tooltip>
                    ) : (
                        <h1 className="text-2xl font-black tracking-tight text-white/95 truncate">
                            {displayName}
                        </h1>
                    )}
                    <Tooltip content={hasTitle(title) ? 'Change title' : 'Pick a title'} side="bottom" className="self-start max-w-full">
                        <button
                            type="button"
                            onClick={onChangeTitle}
                            style={titleStyle(title)}
                            className={cn(
                                'text-sm font-bold leading-none tracking-wide cursor-pointer hover:opacity-80 transition-opacity whitespace-nowrap truncate max-w-full',
                                !hasTitle(title) && 'underline decoration-dashed underline-offset-4 decoration-white/30',
                            )}
                        >
                            {hasTitle(title) ? title.name : '—'}
                        </button>
                    </Tooltip>
                </div>

            </div>

            <div className="relative flex items-stretch border-t border-white/5 divide-x divide-white/5">
                <PlaytimeCell
                    label="7d"
                    value={weekly}
                    top={weeklyTop}
                    icon={Zap}
                    accent={{
                        text: 'text-emerald-400',
                        bar: 'bg-gradient-to-r from-emerald-500/40 to-emerald-400',
                        glow: 'shadow-[0_0_6px_rgba(52,211,153,0.5)]',
                    }}
                />
                <PlaytimeCell
                    label="30d"
                    value={monthly}
                    top={monthlyTop}
                    icon={TrendingUp}
                    accent={{
                        text: 'text-blue-400',
                        bar: 'bg-gradient-to-r from-blue-500/40 to-blue-400',
                        glow: 'shadow-[0_0_6px_rgba(96,165,250,0.5)]',
                    }}
                />
                <PlaytimeCell
                    label="1y"
                    value={yearly}
                    top={yearlyTop}
                    icon={Trophy}
                    accent={{
                        text: 'text-purple-400',
                        bar: 'bg-gradient-to-r from-purple-500/40 to-purple-400',
                        glow: 'shadow-[0_0_6px_rgba(192,132,252,0.5)]',
                    }}
                />
            </div>

            <div className="relative flex items-center flex-wrap gap-x-4 gap-y-1 px-5 py-1.5 border-t border-white/5 bg-black/20">
                <div className="flex items-center gap-1.5">
                    <Clock className="size-3 text-muted-foreground/40" />
                    <span className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest">
                        Last login: {lastLoginLabel}
                    </span>
                </div>
                <div className="flex items-center gap-3 ml-auto">
                    <button
                        type="button"
                        onClick={onBrowseServers}
                        disabled={!onBrowseServers}
                        className="flex items-center gap-1.5 cursor-pointer disabled:cursor-default hover:opacity-80 transition-opacity"
                    >
                        <span className="relative flex size-2">
                            {livePlayers > 0 && (
                                <span className="absolute inline-flex size-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                            )}
                            <span className={cn(
                                'relative inline-flex size-2 rounded-full',
                                livePlayers > 0 ? 'bg-emerald-400' : 'bg-muted-foreground/40',
                            )} />
                        </span>
                        <span className={cn(
                            'text-[10px] font-black tracking-tight font-mono',
                            livePlayers > 0 ? 'text-emerald-400' : 'text-muted-foreground/60',
                        )}>
                            {livePlayers}
                        </span>
                        <span className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest">
                            Currently Playing
                        </span>
                    </button>
                    <span className="h-3 w-px bg-white/10" aria-hidden />
                    <SinceStat
                        label="New Maps"
                        value={newMaps}
                        icon={MapIcon}
                        accent="text-blue-400"
                    />
                    <SinceStat
                        label="New WRs"
                        value={newRecords}
                        icon={Flag}
                        accent="text-orange-400"
                    />
                </div>
            </div>
        </div>
    )
}
