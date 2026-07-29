import { Calendar, ExternalLink, ShieldAlert, Trophy, Activity, MapIcon, Clock, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatAddedDate } from '@/app/utils/format'
import { getAvatarBorderStyle, getTitleTextStyle } from '@/app/utils/titleStyles'
import { avatarSizeFor, getAvatarUrl, type UserSummary } from '@/app/utils/api'
import { MetaPill } from '@/app/components/shared/MetaPill'
import { PatreonBadge } from '@/app/components/shared/PatreonBadge'
import { ROLE_LABELS } from '@/app/utils/roles'
import { usePatreonTier } from '@/app/utils/patreon'

const AVATAR_PX = 128

interface HeroSectionProps {
    userId: string | number
    summary: UserSummary | null
    loading: boolean
    isSelf: boolean
    chart?: React.ReactNode
    onChangeTitle?: () => void
}

function formatHoursShort(seconds: number): string {
    const hours = seconds / 3600
    if (hours >= 1000) return `${(hours / 1000).toFixed(1)}k h`
    if (hours >= 10) return `${Math.round(hours)} h`
    if (hours >= 1) return `${hours.toFixed(1)} h`
    const minutes = Math.round(seconds / 60)
    return `${minutes} m`
}

function banUntilLabel(end: string | null | undefined): string | null {
    if (!end) return null
    const d = new Date(end)
    if (isNaN(d.getTime())) return null
    const yearsOut = (d.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 365)
    if (yearsOut >= 50) return 'Permanent'
    return formatAddedDate(end)
}

const POINTS_EXPLAINER = (
    <div className="space-y-2 max-w-[260px]">
        <div className="text-[10px] uppercase tracking-wider font-bold text-blue-200">
            How points are calculated
        </div>
        <p className="text-xs text-foreground/85 leading-relaxed">
            Points are awarded per map for your best verified cap. Higher medal tiers earn more.
        </p>
        <div className="space-y-1 mt-2 text-xs">
            <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-blue-300">World Record</span>
                <span className="font-mono text-foreground/70">10 pts</span>
            </div>
            <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-red-300">Champion</span>
                <span className="font-mono text-foreground/70">8 pts</span>
            </div>
            <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-yellow-300">Gold</span>
                <span className="font-mono text-foreground/70">6 pts</span>
            </div>
            <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-slate-200">Silver</span>
                <span className="font-mono text-foreground/70">4 pts</span>
            </div>
            <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-amber-500">Bronze</span>
                <span className="font-mono text-foreground/70">2 pts</span>
            </div>
            <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-emerald-300">Certified</span>
                <span className="font-mono text-foreground/70">1 pt</span>
            </div>
        </div>
        <p className="text-[10px] text-muted-foreground leading-relaxed pt-1 border-t border-hairline/5">
            Rank is global, sorted by total points.
        </p>
    </div>
)

export function HeroSection({ userId, summary, loading, isSelf, chart, onChangeTitle }: HeroSectionProps) {
    const profile = summary?.profile
    const title = profile?.active_title ?? null
    const alias = profile?.alias || (loading ? null : String(userId))
    const fallback = `https://cdn.discordapp.com/embed/avatars/${Number(userId) % 5}.png`
    const role = profile?.utbt_role ? ROLE_LABELS[profile.utbt_role] : null
    const patreonTier = usePatreonTier(userId)
    const ban = profile?.active_ban ?? null
    const banReason = ban?.reason ?? null
    const banStart = ban?.start ?? null
    const banUntil = banUntilLabel(ban?.end)

    const counts = summary?.counts
    const medals = summary?.medals
    const rank = medals?.rank ?? 0
    const points = medals?.points ?? 0

    return (
        <div className="bg-card/30 border border-hairline/5 rounded-xl p-5 space-y-4 shrink-0">
            <div className="flex items-center gap-5 min-w-0">
                <img
                    src={getAvatarUrl(userId, avatarSizeFor(AVATAR_PX))}
                    alt={alias ?? String(userId)}
                    width={AVATAR_PX}
                    height={AVATAR_PX}
                    loading="eager"
                    fetchPriority="high"
                    decoding="async"
                    style={{
                        width: AVATAR_PX,
                        height: AVATAR_PX,
                        objectFit: 'cover',
                        ...getAvatarBorderStyle(title),
                    }}
                    className="rounded-full shrink-0"
                    onError={e => { (e.target as HTMLImageElement).src = fallback }}
                />

                <div className="flex-1 min-w-0 flex flex-col gap-2">
                    <div className="flex flex-col leading-tight min-w-0">
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                            <h1 className="text-3xl font-bold text-foreground truncate">
                                {alias ?? '…'}
                            </h1>
                            {patreonTier !== 0 && (
                                <span className="translate-y-[2px]">
                                    <PatreonBadge tier={patreonTier} size="lg" />
                                </span>
                            )}
                            {role && (
                                <span className={cn(
                                    'inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wider translate-y-[3px]',
                                    role.className,
                                )}>
                                    {role.label}
                                </span>
                            )}
                            {isSelf && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold uppercase tracking-wider translate-y-[3px]">
                                    You
                                </span>
                            )}
                        </div>
                        {title ? (
                            isSelf && onChangeTitle ? (
                                <button
                                    type="button"
                                    onClick={onChangeTitle}
                                    style={getTitleTextStyle(title)}
                                    className="text-sm truncate mt-0.5 text-left self-start max-w-full cursor-pointer hover:opacity-80 transition-opacity"
                                    title="Change title"
                                >
                                    {title.name}
                                </button>
                            ) : (
                                <span className="text-sm truncate mt-0.5" style={getTitleTextStyle(title)}>
                                    {title.name}
                                </span>
                            )
                        ) : isSelf && onChangeTitle ? (
                            <button
                                type="button"
                                onClick={onChangeTitle}
                                className="text-sm truncate mt-0.5 text-left self-start max-w-full text-muted-foreground cursor-pointer hover:text-foreground underline decoration-dashed underline-offset-4 decoration-hairline/30 transition-colors"
                            >
                                Pick a title
                            </button>
                        ) : null}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        {profile?.registered_at && (
                            <MetaPill
                                icon={Calendar}
                                label="Joined"
                                value={formatAddedDate(profile.registered_at)}
                            />
                        )}
                        {(rank > 0 || points > 0) && (
                            <MetaPill
                                icon={Trophy}
                                tone="blue"
                                tooltip={POINTS_EXPLAINER}
                            >
                                {rank > 0 && (
                                    <>
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300">Rank</span>
                                        <span className="font-mono tabular-nums font-semibold">#{rank.toLocaleString()}</span>
                                    </>
                                )}
                                {rank > 0 && points > 0 && (
                                    <span className="text-blue-300/40">·</span>
                                )}
                                {points > 0 && (
                                    <>
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300">Points</span>
                                        <span className="font-mono tabular-nums font-semibold">{points.toLocaleString()}</span>
                                    </>
                                )}
                            </MetaPill>
                        )}
                        {profile?.twitch_url && (
                            <MetaPill
                                icon={ExternalLink}
                                value="Twitch"
                                tone="purple"
                                href={profile.twitch_url}
                            />
                        )}
                    </div>
                </div>
            </div>

            {ban && (
                <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300">
                    <ShieldAlert className="size-5 shrink-0 mt-0.5" />
                    <div className="space-y-2 min-w-0">
                        <div className="font-bold uppercase tracking-wider text-xs">Banned</div>
                        {banReason && <p className="text-sm text-red-200/90 leading-relaxed">{banReason}</p>}
                        {(banStart || banUntil) && (
                            <div className="flex flex-wrap gap-x-6 gap-y-1.5">
                                {banStart && (
                                    <div className="flex flex-col leading-tight">
                                        <span className="text-[10px] uppercase tracking-wider text-red-300/60">Banned</span>
                                        <span className="text-xs font-medium text-red-200/90">{formatAddedDate(banStart)}</span>
                                    </div>
                                )}
                                {banUntil && (
                                    <div className="flex flex-col leading-tight">
                                        <span className="text-[10px] uppercase tracking-wider text-red-300/60">Until</span>
                                        <span className="text-xs font-medium text-red-200/90">{banUntil}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2">
                <HeroStat
                    icon={Activity}
                    label="Total Caps"
                    value={loading ? null : counts ? (counts.total_caps ?? 0).toLocaleString() : '—'}
                    subtext={counts ? `${(counts.verified_caps ?? 0).toLocaleString()} verified · ${(counts.certified_caps ?? 0).toLocaleString()} certified` : undefined}
                    accent="text-blue-300"
                />
                <HeroStat
                    icon={MapIcon}
                    label="Maps Capped"
                    value={loading ? null : counts ? (counts.unique_maps ?? 0).toLocaleString() : '—'}
                    subtext={counts ? `${(counts.uncapped_maps ?? 0).toLocaleString()} left` : undefined}
                    accent="text-foreground"
                />
                <HeroStat
                    icon={Trophy}
                    label="World Records"
                    value={loading ? null : counts ? (counts.wr_count ?? 0).toLocaleString() : '—'}
                    accent="text-yellow-300"
                />
                <HeroStat
                    icon={Clock}
                    label="Total Playtime"
                    value={loading ? null : counts ? `${Math.round((counts.total_playtime_seconds ?? 0) / 3600).toLocaleString()} h` : '—'}
                    subtext={counts && (counts.spectator_playtime_seconds ?? 0) > 0
                        ? `${formatHoursShort(counts.spectator_playtime_seconds)} spec`
                        : undefined}
                    accent="text-amber-300"
                />
                <HeroStat
                    icon={MessageSquare}
                    label="Reviews"
                    value={loading ? null : counts ? (counts.map_review_count ?? 0).toLocaleString() : '—'}
                    accent="text-purple-300"
                />
            </div>

            {chart && <div className="h-[180px]">{chart}</div>}
        </div>
    )
}

function HeroStat({ icon: Icon, label, value, subtext, accent }: {
    icon: typeof Activity
    label: string
    value: string | null
    subtext?: string
    accent: string
}) {
    return (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-hairline/[0.02] border border-hairline/5">
            <Icon className={cn('size-4 shrink-0', accent)} />
            <div className="min-w-0 flex flex-col leading-tight">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground leading-tight">{label}</span>
                {value === null ? (
                    <span className="h-4 w-14 bg-hairline/5 rounded animate-pulse mt-0.5" />
                ) : (
                    <span className={cn('font-mono tabular-nums font-bold text-base leading-none mt-0.5', accent)}>{value}</span>
                )}
                {subtext && (
                    <span className="text-[9px] text-muted-foreground/70 leading-tight mt-0.5">{subtext}</span>
                )}
            </div>
        </div>
    )
}
