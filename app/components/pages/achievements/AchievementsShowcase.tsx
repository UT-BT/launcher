import { Fragment, useMemo, useState } from 'react'
import {
    Lock, Sparkles, Award, Crown, Check, ChevronDown,
    Clock, Map as MapIcon, Trophy, Medal, Star, Swords, Tags, Globe, Shield, Wind, Flame, Snowflake,
    Users, Handshake, ShieldCheck, Zap, Gem,
    Hammer, Hourglass, Heart, PenTool, Blocks, Repeat,
    type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/app/components/ui/tooltip'
import { getTitleTextStyle } from '@/app/utils/titleStyles'
import {
    type AchievementCategory,
    type AchievementDefinition,
    type AchievementProgress,
    type AchievementTier,
    type AchievementTitle,
    type ActiveTitle,
} from '@/app/utils/api'

export type AchievementStatusFilter = 'all' | 'unlocked' | 'locked' | 'maxed'

export const STATUS_FILTERS: { id: AchievementStatusFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'unlocked', label: 'Unlocked' },
    { id: 'locked', label: 'Locked' },
    { id: 'maxed', label: 'Maxed' },
]

const ICON_MAP: Record<string, LucideIcon> = {
    Clock, Map: MapIcon, Crown, Medal, Award, Trophy, Swords, Star, Tags, Globe, Shield, Wind, Flame, Sparkles,
    Users, Handshake, ShieldCheck, Zap, Gem,
    Hammer, Hourglass, Heart, PenTool, Blocks, Repeat,
}

function goalTextFor(def: AchievementDefinition, tier: AchievementTier): string {
    return tier.is_all
        ? (def.goal_all ?? 'Complete it')
        : (def.goal ?? 'Reach {n}').replace('{n}', (tier.threshold ?? 0).toLocaleString())
}

function remainingTextFor(
    def: AchievementDefinition,
    tier: AchievementTier,
    progress: AchievementProgress,
): string {
    const toGo = Math.max(0, tier.threshold - progress.current_value)
    return `${toGo.toLocaleString()}${def.unit ? ` ${def.unit}` : ''} to go`
}

interface RarityStyle {
    text: string
    solid: string
    border: string
    base: string   // opaque accent colour (left strip, bar, gem fill)
    rgba: string   // translucent tint
    glow: string   // box-shadow glow colour
}

// Index 0 = Level 1.
const RARITY: RarityStyle[] = [
    { text: 'text-amber-500',  solid: 'bg-amber-500/15',  border: 'border-amber-500/40',  base: 'rgb(245,158,11)',  rgba: 'rgba(245,158,11,0.22)',  glow: 'rgba(245,158,11,0.45)' },   // Bronze
    { text: 'text-slate-200',  solid: 'bg-slate-300/15',  border: 'border-slate-300/40',  base: 'rgb(203,213,225)', rgba: 'rgba(203,213,225,0.20)', glow: 'rgba(203,213,225,0.42)' },   // Silver
    { text: 'text-yellow-300', solid: 'bg-yellow-400/15', border: 'border-yellow-400/40', base: 'rgb(250,204,21)',  rgba: 'rgba(250,204,21,0.22)',  glow: 'rgba(250,204,21,0.48)' },    // Gold
    { text: 'text-red-400',    solid: 'bg-red-500/20',    border: 'border-red-500/55',    base: 'rgb(239,68,68)',  rgba: 'rgba(239,68,68,0.28)',  glow: 'rgba(239,68,68,0.7)' },     // Champion
    { text: 'text-blue-400',   solid: 'bg-blue-500/20',   border: 'border-blue-500/60',   base: 'rgb(59,130,246)', rgba: 'rgba(59,130,246,0.30)', glow: 'rgba(59,130,246,0.75)' },    // World Record
]

const rarityOf = (idx: number): RarityStyle => RARITY[Math.min(Math.max(idx, 0), RARITY.length - 1)]

export function defaultProgress(def: AchievementDefinition): AchievementProgress {
    return {
        code: def.code,
        current_value: 0,
        current_tier: -1,
        current_level: 0,
        next_threshold: def.tiers[0]?.threshold ?? null,
        max_threshold: def.tiers[def.tiers.length - 1]?.threshold ?? 0,
        percent_to_next: 0,
        unlocked: false,
        maxed: false,
        unlocked_tiers: [],
    }
}

function titleStyle(title?: AchievementTitle | null) {
    if (!title) return undefined
    return getTitleTextStyle({
        name: title.name,
        rarity: title.rarity,
        color_r: title.color_r,
        color_g: title.color_g,
        color_b: title.color_b,
    } as ActiveTitle)
}

export function Segmented({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer',
                active
                    ? 'bg-accent-500/20 border-accent-500/50 text-accent-300'
                    : 'bg-card/50 border-hairline/10 text-muted-foreground hover:text-foreground hover:border-hairline/20',
            )}
        >
            {label}
        </button>
    )
}

const CATEGORIES = [
    { id: 'general', label: 'General' },
    { id: 'solo', label: 'Solo' },
    { id: 'team', label: 'Team' },
    { id: 'mapper', label: 'Mapper' },
    { id: 'mastery', label: 'Mastery' },
] as const

function categoryOf(def: AchievementDefinition): AchievementCategory {
    return def.category ?? (def.team ? 'team' : 'solo')
}

function SectionHeading({ label, maxed, total }: { label: string; maxed: number; total: number }) {
    return (
        <div className="flex items-baseline gap-3 pt-2 first:pt-0">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground shrink-0">{label}</h2>
            <span className="flex-1 h-px bg-hairline/10" />
            <span className="text-[11px] tabular-nums text-muted-foreground/70 shrink-0">{maxed}/{total} maxed</span>
        </div>
    )
}

/**
 * Presentational list of achievement "showcase rows". Pure — it merges the
 * given definitions with the given progress (by code), applies the status
 * filter, and renders rows / skeletons / an empty message. The caller owns the
 * scroll container and any state. Used by both the self Achievements page and a
 * player's profile (read-only).
 */
export function AchievementsShowcase({
    definitions,
    progress,
    statusFilter = 'all',
    loading = false,
    skeletonCount = 8,
    emptyText = 'No achievements match these filters.',
    anonymous = false,
}: {
    definitions: AchievementDefinition[]
    progress: AchievementProgress[]
    statusFilter?: AchievementStatusFilter
    loading?: boolean
    skeletonCount?: number
    emptyText?: string
    anonymous?: boolean
}) {
    const progressByCode = useMemo(() => {
        const m: Record<string, AchievementProgress> = {}
        for (const p of progress) m[p.code] = p
        return m
    }, [progress])

    const filtered = useMemo(() => definitions
        .map(def => ({ def, progress: progressByCode[def.code] ?? defaultProgress(def) }))
        .filter(({ progress }) => {
            if (statusFilter === 'unlocked' && !progress.unlocked) return false
            if (statusFilter === 'locked' && progress.unlocked) return false
            if (statusFilter === 'maxed' && !progress.maxed) return false
            return true
        }), [definitions, progressByCode, statusFilter])

    const sections = useMemo(() => CATEGORIES
        .map(c => ({ ...c, rows: filtered.filter(({ def }) => categoryOf(def) === c.id) }))
        .filter(s => s.rows.length > 0), [filtered])

    const totals = useMemo(() => {
        const tally: Record<string, { total: number; maxed: number }> = {}
        for (const c of CATEGORIES) {
            const defs = definitions.filter(d => categoryOf(d) === c.id)
            tally[c.id] = {
                total: defs.length,
                maxed: defs.filter(d => (progressByCode[d.code] ?? defaultProgress(d)).maxed).length,
            }
        }
        return tally
    }, [definitions, progressByCode])

    if (loading) {
        return (
            <>
                {Array.from({ length: skeletonCount }).map((_, i) => (
                    <div key={i} className="h-[88px] bg-card/30 border border-hairline/5 rounded-xl animate-pulse" />
                ))}
            </>
        )
    }

    if (filtered.length === 0) {
        return <div className="py-10 text-center text-muted-foreground text-sm">{emptyText}</div>
    }

    const showHeadings = sections.length > 1

    return (
        <>
            {sections.map(section => (
                <Fragment key={section.id}>
                    {showHeadings && <SectionHeading label={section.label} {...totals[section.id]} />}
                    {section.rows.map(({ def, progress }) => (
                        <AchievementRow key={def.code} def={def} progress={progress} anonymous={anonymous} />
                    ))}
                </Fragment>
            ))}
        </>
    )
}

// Segmented bar: one segment per level (rarity-coloured). Completed levels fill
// fully; the active level fills to its within-level %; future levels stay empty.
function TierBar({ def, progress }: { def: AchievementDefinition; progress: AchievementProgress }) {
    return (
        <div className="flex items-center gap-1 w-full">
            {def.tiers.map((tier, i) => {
                const reached = i <= progress.current_tier
                const isActive = !progress.maxed && i === progress.current_tier + 1
                const r = rarityOf(tier.level - 1)
                const fillPct = reached ? 100 : isActive ? Math.max(0, Math.min(100, progress.percent_to_next)) : 0
                const tStyle = titleStyle(tier.title)
                const reqText = goalTextFor(def, tier)
                return (
                    <Tooltip
                        key={tier.level}
                        side="top"
                        className="flex-1"
                        content={
                            <div className="min-w-[190px] py-1 space-y-1.5">
                                <div className="flex items-baseline justify-between gap-4">
                                    <span className={cn('text-sm font-bold', r.text)}>Level {tier.level}</span>
                                    <span className="text-[10px] uppercase tracking-wider text-foreground/40">Rarity {tier.level}</span>
                                </div>
                                <div className="text-xs text-foreground/75 font-medium">{reqText}</div>
                                <div className="pt-1.5 border-t border-hairline/10">
                                    <div className="text-[10px] uppercase tracking-wider text-foreground/40 mb-0.5">Reward</div>
                                    {tier.title
                                        ? <span className="text-sm font-semibold" style={tStyle}>{tier.title.name}</span>
                                        : <span className="text-sm text-foreground/70">Rarity {tier.level} title</span>}
                                </div>
                            </div>
                        }
                    >
                        <div className="relative h-2.5 w-full rounded-full bg-hairline/[0.06] overflow-hidden ring-1 ring-inset ring-hairline/5 cursor-help">
                            <div
                                className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                                style={{
                                    width: `${fillPct}%`,
                                    background: `linear-gradient(180deg, rgba(255,255,255,0.28), rgba(255,255,255,0) 55%), ${r.base}`,
                                    boxShadow: reached ? `0 0 6px -1px ${r.glow}` : undefined,
                                }}
                            />
                        </div>
                    </Tooltip>
                )
            })}
        </div>
    )
}

function AchievementRow({ def, progress, anonymous }: { def: AchievementDefinition; progress: AchievementProgress; anonymous: boolean }) {
    const [showTitles, setShowTitles] = useState(false)
    const Icon = ICON_MAP[def.icon] ?? Award
    const maxed = progress.maxed
    const isBadge = (def.tiers ?? []).length === 1    // single-tier "earn it" achievement
    const rIdx = progress.current_level - 1           // rarity index of current tier (-1 when locked)
    const rarity = progress.current_level >= 1 ? rarityOf(rIdx) : null
    const goal = progress.next_threshold ?? progress.max_threshold

    return (
        <div
            className={cn(
                'group relative overflow-hidden rounded-xl border bg-card/30 transition-colors',
                maxed ? 'border-hairline/10' : 'border-hairline/5 hover:border-hairline/10 hover:bg-card/40',
            )}
            style={maxed && rarity ? { boxShadow: `inset 0 0 0 1px ${rarity.rgba}, 0 0 16px -4px ${rarity.rgba}` } : undefined}
        >
            {rarity && (
                <div
                    className="absolute inset-y-0 left-0 w-[3px]"
                    style={{ background: rarity.base, opacity: maxed ? 1 : 0.6 }}
                />
            )}
            {rarity && (
                <div
                    className="absolute inset-0 pointer-events-none"
                    style={{ background: `linear-gradient(90deg, ${rarity.rgba}, transparent 26%)`, opacity: maxed ? 0.5 : 0.14 + rIdx * 0.04 }}
                />
            )}

            <div className="relative flex flex-wrap items-center gap-x-6 gap-y-3 p-3.5 pl-5">
                <div className="flex items-center gap-3 min-w-[200px] flex-1">
                    <div
                        className={cn(
                            'size-11 rounded-xl border flex items-center justify-center shrink-0 bg-hairline/5 transition-colors',
                            maxed && rarity ? rarity.border : 'border-hairline/5 group-hover:border-hairline/10',
                        )}
                    >
                        <Icon className={cn('size-5', rarity ? rarity.text : 'text-muted-foreground')} />
                    </div>
                    <div className="min-w-0">
                        <div className="text-sm font-semibold text-foreground truncate">{def.name}</div>
                        <p className="text-xs text-muted-foreground leading-snug truncate">{def.description}</p>
                    </div>
                </div>

                <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex flex-col gap-1.5 w-60">
                        <div className="flex items-center justify-between text-[11px]">
                            <span className="font-mono tabular-nums text-foreground/90">
                                {anonymous ? 'Sign in to track progress' : (progress.current_value ?? 0).toLocaleString()}
                                {!anonymous && <span className="text-muted-foreground"> / {(goal ?? 0).toLocaleString()}</span>}
                            </span>
                            <span className={cn('font-semibold', maxed ? 'text-emerald-300' : 'text-muted-foreground')}>
                                {maxed ? (isBadge ? 'Earned' : 'Complete') : `${progress.percent_to_next}%`}
                            </span>
                        </div>
                        {!anonymous && <TierBar def={def} progress={progress} />}
                        {!anonymous && progress.current && (
                            <div className="text-[10px] text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                <span>
                                    {progress.current.label}:{' '}
                                    <span className="text-foreground/80 font-medium tabular-nums">{(progress.current?.value ?? 0).toLocaleString()}</span>
                                </span>
                                {progress.current.extra && (
                                    <span className="flex items-center gap-1">
                                        <Snowflake className="size-2.5 text-sky-300/80" />
                                        {progress.current.extra.label}:{' '}
                                        <span className="text-foreground/80 font-medium tabular-nums">{(progress.current?.extra?.value ?? 0).toLocaleString()}</span>
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={() => setShowTitles(v => !v)}
                        aria-label="Show unlockable titles"
                        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-hairline/5 transition-colors cursor-pointer shrink-0"
                    >
                        <Award className="size-4" />
                        <ChevronDown className={cn('size-3 inline ml-0.5 transition-transform', showTitles && 'rotate-180')} />
                    </button>
                </div>
            </div>

            {showTitles && (
                <div className="relative border-t border-hairline/5 px-5 py-3">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Title rewards</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2">
                        {(def.tiers ?? []).map((tier, s) => {
                            const earned = s <= progress.current_tier
                            const isNext = !progress.maxed && s === progress.current_tier + 1
                            const r = rarityOf(tier.level - 1)
                            const name = tier.title?.name ?? `Rarity ${tier.level} title`
                            const goalText = goalTextFor(def, tier)
                            const remainingText = remainingTextFor(def, tier, progress)
                            return (
                                <Tooltip
                                    key={tier.level}
                                    side="top"
                                    className="flex w-full"
                                    content={
                                        <div className="min-w-[190px] py-1 space-y-1.5">
                                            <div className="text-base font-bold leading-tight" style={titleStyle(tier.title)}>{name}</div>
                                            <div className="text-[10px] uppercase tracking-wider text-foreground/40">Rarity {tier.level} title</div>
                                            <div className="text-xs text-foreground/75 font-medium pt-1.5 border-t border-hairline/10">{goalText}</div>
                                            <div className="text-xs">
                                                {earned
                                                    ? <span className="text-emerald-400 font-semibold">Unlocked</span>
                                                    : isNext
                                                        ? <span className="font-semibold" style={{ color: r.base }}>{remainingText}</span>
                                                        : <span className="text-foreground/45">Locked</span>}
                                            </div>
                                        </div>
                                    }
                                >
                                    <div
                                        className={cn(
                                            'w-full rounded-lg border px-2.5 py-2 flex flex-col gap-1 min-w-0 cursor-help transition-all',
                                            earned && 'border-transparent',
                                            isNext && 'bg-card/40 border-transparent',
                                            !earned && !isNext && 'bg-hairline/[0.02] border-hairline/5 opacity-55 hover:opacity-90',
                                        )}
                                        style={
                                            earned
                                                ? { background: r.rgba, boxShadow: `inset 0 0 0 1px ${r.rgba}` }
                                                : isNext
                                                    ? { border: `1px dashed ${r.base}` }
                                                    : undefined
                                        }
                                    >
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            <span
                                                className={cn(
                                                    'size-4 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0',
                                                    earned ? 'text-foreground' : !isNext && 'text-muted-foreground border border-hairline/15',
                                                )}
                                                style={
                                                    earned ? { background: r.base }
                                                        : isNext ? { border: `1px dashed ${r.base}`, color: r.base }
                                                            : undefined
                                                }
                                            >
                                                {tier.level}
                                            </span>
                                            <span
                                                className={cn('truncate text-xs font-medium', !earned && !isNext && 'text-muted-foreground')}
                                                style={earned ? titleStyle(tier.title) : isNext ? { color: r.base } : undefined}
                                            >
                                                {name}
                                            </span>
                                            <span className="ml-auto shrink-0">
                                                {earned ? <Check className="size-3 text-emerald-400" />
                                                    : isNext ? null
                                                        : <Lock className="size-3 text-muted-foreground/50" />}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between gap-1 text-[10px] pl-[22px]">
                                            {earned ? (
                                                <span className="text-emerald-400/80 font-medium">Unlocked</span>
                                            ) : isNext ? (
                                                <span className="font-semibold truncate" style={{ color: r.base }}>{remainingText}</span>
                                            ) : (
                                                <span className="text-muted-foreground truncate">{goalText}</span>
                                            )}
                                            {isNext && (
                                                <span
                                                    className="uppercase tracking-wider font-bold text-[9px] px-1 py-0.5 rounded shrink-0"
                                                    style={{ color: r.base, background: r.rgba }}
                                                >
                                                    Next
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </Tooltip>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}
