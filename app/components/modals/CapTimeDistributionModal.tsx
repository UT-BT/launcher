import { useMemo } from 'react'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip,
    ReferenceLine, ReferenceArea, ResponsiveContainer, Cell,
} from 'recharts'
import { Trophy, Target } from 'lucide-react'
import { Modal } from '@/app/components/ui/modal'
import { cn } from '@/lib/utils'
import { formatCapTime, displayMapName } from '@/app/utils/format'
import { getMedalIcon } from '@/app/utils/medals'
import type { LeaderboardEntry, MapMetadata } from '@/app/utils/api'

interface CapTimeDistributionModalProps {
    open: boolean
    onClose: () => void
    mapName: string
    leaderboard: LeaderboardEntry[]
    map: MapMetadata | null
    currentUserId?: string | number
}

interface Bucket {
    binStart: number
    binEnd: number
    binMid: number
    count: number
    tierKey: TierKey
    tierColor: string
    tierLabel: string
    containsUser: boolean
}

type TierKey = 'wr' | 'champion' | 'gold' | 'silver' | 'bronze' | 'beyond' | 'unknown'

const TIER_DEFS: { key: TierKey; label: string; color: string; bandColor: string; medalIconKey: string }[] = [
    { key: 'wr', label: 'World Record', color: '#60a5fa', bandColor: '#3b82f6', medalIconKey: 'world record' },
    { key: 'champion', label: 'Champion', color: '#ff0000', bandColor: '#ff0000', medalIconKey: 'champion medal' },
    { key: 'gold', label: 'Gold', color: '#fde047', bandColor: '#facc15', medalIconKey: 'gold medal' },
    { key: 'silver', label: 'Silver', color: '#e2e8f0', bandColor: '#94a3b8', medalIconKey: 'silver medal' },
    { key: 'bronze', label: 'Bronze', color: '#fbbf24', bandColor: '#c2410c', medalIconKey: 'bronze medal' },
    { key: 'beyond', label: 'Certified', color: '#555555', bandColor: '#475569', medalIconKey: 'certified' },
]

const BUCKET_COUNT = 30
const WR_EPSILON = 0.0005

function tierFor(time: number, map: MapMetadata | null): { key: TierKey; color: string; label: string } {
    if (!map) return { key: 'unknown', color: '#60a5fa', label: 'Cap' }
    if (map.world_record != null && map.world_record > 0 && time - map.world_record <= WR_EPSILON)
        return TIER_DEFS[0]
    if (map.champion_medal != null && map.champion_medal > 0 && time <= map.champion_medal)
        return TIER_DEFS[1]
    if (map.gold_medal != null && map.gold_medal > 0 && time <= map.gold_medal)
        return TIER_DEFS[2]
    if (map.silver_medal != null && map.silver_medal > 0 && time <= map.silver_medal)
        return TIER_DEFS[3]
    if (map.bronze_medal != null && map.bronze_medal > 0 && time <= map.bronze_medal)
        return TIER_DEFS[4]
    return TIER_DEFS[5]
}

function percentile(rank: number, total: number): number {
    if (total <= 1) return 100
    return Math.max(0, Math.min(100, 100 - ((rank - 1) / (total - 1)) * 100))
}

function ordinalTopPct(pct: number): string {
    if (pct >= 99) return 'Top 1%'
    if (pct >= 95) return `Top ${Math.max(1, Math.round(100 - pct))}%`
    if (pct >= 75) return `Top ${Math.round(100 - pct)}%`
    return `${Math.round(pct)}th percentile`
}

function formatTimeAxis(seconds: number, useShortFormat: boolean): string {
    if (useShortFormat) return `${seconds.toFixed(1)}s`
    return formatCapTime(seconds)
}

export function CapTimeDistributionModal({
    open, onClose, mapName, leaderboard, map, currentUserId,
}: CapTimeDistributionModalProps) {
    const certified = useMemo(
        () => leaderboard.filter(e => e.cap_type === 2),
        [leaderboard],
    )

    const sortedTimes = useMemo(
        () => [...certified].map(e => e.cap_time_seconds).sort((a, b) => a - b),
        [certified],
    )

    const userIdStr = currentUserId != null ? String(currentUserId) : null
    const userBest = useMemo(() => {
        if (!userIdStr) return null
        const own = certified.filter(e => String(e.user) === userIdStr)
        if (own.length === 0) return null
        return Math.min(...own.map(e => e.cap_time_seconds))
    }, [certified, userIdStr])

    const stats = useMemo(() => {
        if (sortedTimes.length === 0) return null
        const min = sortedTimes[0]
        const max = sortedTimes[sortedTimes.length - 1]
        const mid = Math.floor(sortedTimes.length / 2)
        const median = sortedTimes.length % 2
            ? sortedTimes[mid]
            : (sortedTimes[mid - 1] + sortedTimes[mid]) / 2
        const mean = sortedTimes.reduce((s, v) => s + v, 0) / sortedTimes.length
        const p98Idx = Math.min(sortedTimes.length - 1, Math.floor(sortedTimes.length * 0.98))
        const p98 = sortedTimes[p98Idx]
        return { min, max, median, mean, count: sortedTimes.length, p98 }
    }, [sortedTimes])

    const xRange = useMemo(() => {
        if (!stats) return null
        const xMin = stats.min * 0.995

        // Smart right bound: pick the tightest tier boundary that still
        // contains ~95% of caps. If data is concentrated in Champion/Gold,
        // chart zooms in tight (e.g. ends at Gold + padding). If it spreads
        // to Bronze and beyond, chart extends accordingly.
        const p95Idx = Math.min(sortedTimes.length - 1, Math.floor(sortedTimes.length * 0.95))
        const p95 = sortedTimes[p95Idx]

        const tierBoundaries = [
            map?.champion_medal,
            map?.gold_medal,
            map?.silver_medal,
            map?.bronze_medal,
        ].filter((v): v is number => v != null && v > 0).sort((a, b) => a - b)

        // Smallest tier boundary that covers p95.
        const snapBoundary = tierBoundaries.find(b => b >= p95)
        const niceMax = snapBoundary != null ? snapBoundary * 1.05 : p95 * 1.10

        // Always include user PB in the visible range.
        let xMax = userBest != null ? Math.max(niceMax, userBest * 1.02) : niceMax

        // Never extend past actual data max.
        xMax = Math.min(xMax, stats.max * 1.02)

        // Guarantee a meaningful span so single-cap maps still render.
        if (xMax - xMin < 0.1) xMax = xMin + 0.5

        return { xMin, xMax }
    }, [stats, map, sortedTimes, userBest])

    const buckets: Bucket[] = useMemo(() => {
        if (!stats || !xRange || stats.count === 0) return []
        const { xMin, xMax } = xRange

        // Build tier segments clipped to visible range. Bucket boundaries
        // will never cross a tier boundary — each bar lives entirely in one
        // medal tier.
        type Seg = { tierKey: TierKey; tierColor: string; tierLabel: string; start: number; end: number }
        const wr = map?.world_record
        const champ = map?.champion_medal
        const gold = map?.gold_medal
        const silver = map?.silver_medal
        const bronze = map?.bronze_medal

        const segs: Seg[] = []
        const addSeg = (key: TierKey, start: number, end: number) => {
            const s = Math.max(start, xMin)
            const e = Math.min(end, xMax)
            if (s >= e) return
            const def = TIER_DEFS.find(d => d.key === key)!
            segs.push({ tierKey: key, tierColor: def.color, tierLabel: def.label, start: s, end: e })
        }

        if (champ != null && champ > 0) addSeg('champion', wr ?? xMin, champ)
        else addSeg('champion', wr ?? xMin, xMax)
        if (champ != null && gold != null && gold > champ) addSeg('gold', champ, gold)
        if (gold != null && silver != null && silver > gold) addSeg('silver', gold, silver)
        if (silver != null && bronze != null && bronze > silver) addSeg('bronze', silver, bronze)
        if (bronze != null && bronze > 0) addSeg('beyond', bronze, xMax)

        if (segs.length === 0) {
            const tier = tierFor(xMin, map)
            return [{
                binStart: xMin, binEnd: xMax, binMid: (xMin + xMax) / 2,
                count: sortedTimes.length,
                tierKey: tier.key, tierColor: tier.color, tierLabel: tier.label,
                containsUser: userBest != null,
            }]
        }

        // Per-segment data counts → allocate sub-buckets weighted by density.
        const segCounts = segs.map(s => sortedTimes.filter(t => tierFor(t, map).key === s.tierKey && t >= s.start && t <= s.end).length)
        const totalCount = segCounts.reduce((a, b) => a + b, 0) || 1

        const subBucketsPerSeg = segs.map((_s, i) => {
            if (segCounts[i] === 0) return 1
            const target = Math.round((segCounts[i] / totalCount) * BUCKET_COUNT)
            return Math.max(2, Math.min(12, target))
        })

        const out: Bucket[] = []
        for (let i = 0; i < segs.length; i++) {
            const seg = segs[i]
            const n = subBucketsPerSeg[i]
            const subWidth = (seg.end - seg.start) / n
            for (let j = 0; j < n; j++) {
                const binStart = seg.start + j * subWidth
                const binEnd = j === n - 1 ? seg.end : seg.start + (j + 1) * subWidth
                const binMid = (binStart + binEnd) / 2
                const isLastInSeg = j === n - 1
                const count = sortedTimes.filter(t => {
                    if (tierFor(t, map).key !== seg.tierKey) return false
                    if (isLastInSeg) return t >= binStart && t <= binEnd
                    return t >= binStart && t < binEnd
                }).length
                const containsUser = userBest != null
                    && tierFor(userBest, map).key === seg.tierKey
                    && userBest >= binStart
                    && (isLastInSeg ? userBest <= binEnd : userBest < binEnd)
                out.push({
                    binStart, binEnd, binMid, count,
                    tierKey: seg.tierKey, tierColor: seg.tierColor, tierLabel: seg.tierLabel,
                    containsUser,
                })
            }
        }
        return out
    }, [stats, xRange, sortedTimes, userBest, map])

    const overflowCount = useMemo(() => {
        if (!xRange) return 0
        return sortedTimes.filter(t => t > xRange.xMax).length
    }, [xRange, sortedTimes])

    // Per-tier counts across the FULL dataset (not just visible range).
    const tierCounts = useMemo(() => {
        const counts = new Map<TierKey, number>()
        for (const t of sortedTimes) {
            const key = tierFor(t, map).key
            counts.set(key, (counts.get(key) ?? 0) + 1)
        }
        return counts
    }, [sortedTimes, map])

    const userRank = useMemo(() => {
        if (userBest == null || sortedTimes.length === 0) return null
        const r = sortedTimes.findIndex(t => t >= userBest)
        return r >= 0 ? r + 1 : sortedTimes.length
    }, [userBest, sortedTimes])

    const userPercentile = userRank != null && stats ? percentile(userRank, stats.count) : null
    const userTier = userBest != null ? tierFor(userBest, map) : null

    // "Your Position" counts compare against OTHER players' certified caps,
    // not the user's own. Otherwise a single user with one cap would always
    // show "Tied with you: 1" (themselves).
    const otherCertifiedTimes = useMemo(() => {
        if (!userIdStr) return sortedTimes
        return certified.filter(e => String(e.user) !== userIdStr).map(e => e.cap_time_seconds)
    }, [certified, sortedTimes, userIdStr])

    const fasterThanUser = userBest != null ? otherCertifiedTimes.filter(t => t < userBest).length : 0
    const sameAsUser = userBest != null ? otherCertifiedTimes.filter(t => t === userBest).length : 0
    const slowerThanUser = userBest != null ? otherCertifiedTimes.filter(t => t > userBest).length : 0
    const otherTotal = otherCertifiedTimes.length

    const useShortFormat = (stats?.max ?? 0) < 60
    const yMax = useMemo(() => {
        const peak = Math.max(0, ...buckets.map(b => b.count))
        return Math.max(1, Math.ceil(peak * 1.15))
    }, [buckets])

    // Tier shading bands — drawn as chart background. Each band spans the
    // exact x-range that qualifies for that tier, so the visual tier shown
    // under the "You" line always matches the real tier classification.
    const tierBands = useMemo(() => {
        if (!xRange || !map) return []
        const wr = (map.world_record != null && map.world_record > 0) ? map.world_record : null
        const champ = (map.champion_medal != null && map.champion_medal > 0) ? map.champion_medal : null
        const gold = (map.gold_medal != null && map.gold_medal > 0) ? map.gold_medal : null
        const silver = (map.silver_medal != null && map.silver_medal > 0) ? map.silver_medal : null
        const bronze = (map.bronze_medal != null && map.bronze_medal > 0) ? map.bronze_medal : null

        const bands: { key: TierKey; x1: number; x2: number; color: string }[] = []
        const champStart = wr ?? xRange.xMin
        if (champ != null && champ > champStart) bands.push({ key: 'champion', x1: champStart, x2: champ, color: TIER_DEFS[1].bandColor })
        if (champ != null && gold != null && gold > champ) bands.push({ key: 'gold', x1: champ, x2: gold, color: TIER_DEFS[2].bandColor })
        if (gold != null && silver != null && silver > gold) bands.push({ key: 'silver', x1: gold, x2: silver, color: TIER_DEFS[3].bandColor })
        if (silver != null && bronze != null && bronze > silver) bands.push({ key: 'bronze', x1: silver, x2: bronze, color: TIER_DEFS[4].bandColor })
        if (bronze != null && bronze < xRange.xMax) bands.push({ key: 'beyond', x1: bronze, x2: xRange.xMax, color: TIER_DEFS[5].bandColor })
        return bands
    }, [xRange, map])

    return (
        <Modal
            isOpen={open}
            onClose={onClose}
            title={`Certified Cap Distribution — ${displayMapName(mapName)}`}
            offsetSidebar
            maxWidth="min(92vw, 880px)"
            className="bg-[#0a0a0b]/98 border-white/5"
            footer={null}
        >
            <div className="space-y-4">
                {!stats || stats.count === 0 ? (
                    <div className="py-12 text-center text-sm text-muted-foreground">
                        No certified caps recorded yet.
                    </div>
                ) : (
                    <>
                        <div className={cn(
                            'grid gap-2',
                            userBest != null ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2 md:grid-cols-3',
                        )}>
                            <StatTile label="Certified Caps" value={stats.count.toLocaleString()} accent="text-blue-300" />
                            <StatTile label="Median" value={formatCapTime(stats.median)} accent="text-yellow-300" />
                            <StatTile label="Mean" value={formatCapTime(stats.mean)} accent="text-white" />
                            {userBest != null && userPercentile != null && (
                                <StatTile
                                    label="Your Standing"
                                    value={ordinalTopPct(userPercentile)}
                                    subtext={`#${userRank} of ${stats.count} · ${userTier?.label}`}
                                    accent="text-emerald-300"
                                    highlight
                                />
                            )}
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-baseline justify-between px-1">
                                <div className="text-[11px] uppercase tracking-wider text-white/85 font-semibold">
                                    Distribution of Cap Times
                                </div>
                            </div>

                            <div className="bg-white/[0.02] border border-white/5 rounded-lg pt-5 pb-2 pl-2 pr-3 h-72 select-none [&_.recharts-surface]:outline-none [&_.recharts-wrapper]:outline-none">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={buckets}
                                        margin={{ top: 40, right: 8, bottom: 28, left: 28 }}
                                    >
                                        <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                                        <XAxis
                                            dataKey="binMid"
                                            type="number"
                                            domain={xRange ? [xRange.xMin, xRange.xMax] : ['dataMin', 'dataMax']}
                                            tickFormatter={(v) => formatTimeAxis(v as number, useShortFormat)}
                                            tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.6)' }}
                                            stroke="rgba(255,255,255,0.15)"
                                            minTickGap={48}
                                            tickCount={6}
                                            label={{
                                                value: 'Cap Time',
                                                position: 'insideBottom',
                                                offset: -16,
                                                fill: 'rgba(255,255,255,0.55)',
                                                fontSize: 10,
                                            }}
                                        />
                                        <YAxis
                                            allowDecimals={false}
                                            domain={[0, yMax]}
                                            tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.5)' }}
                                            stroke="rgba(255,255,255,0.15)"
                                            width={32}
                                            label={{
                                                value: 'Number of Caps',
                                                angle: -90,
                                                position: 'insideLeft',
                                                offset: 4,
                                                fill: 'rgba(255,255,255,0.55)',
                                                fontSize: 10,
                                                style: { textAnchor: 'middle' },
                                            }}
                                        />
                                        <ChartTooltip
                                            cursor={false}
                                            contentStyle={{
                                                backgroundColor: 'rgba(10,10,11,0.95)',
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                borderRadius: 8,
                                                fontSize: 11,
                                                color: 'white',
                                            }}
                                            labelStyle={{
                                                color: 'rgba(255,255,255,0.6)',
                                                fontSize: 10,
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.05em',
                                                marginBottom: 4,
                                            }}
                                            itemStyle={{ color: 'white' }}
                                            labelFormatter={(_v, payload) => {
                                                const b = (payload?.[0]?.payload as Bucket | undefined)
                                                if (!b) return ''
                                                return `${formatCapTime(b.binStart)} – ${formatCapTime(b.binEnd)}`
                                            }}
                                            formatter={(v, _n, item) => {
                                                const b = (item?.payload as Bucket | undefined)
                                                const n = Number(v)
                                                return [`${n} cap${n === 1 ? '' : 's'} · ${b?.tierLabel ?? ''}`, '']
                                            }}
                                        />
                                        {tierBands.map(band => (
                                            <ReferenceArea
                                                key={band.key}
                                                x1={band.x1}
                                                x2={band.x2}
                                                fill={band.color}
                                                fillOpacity={0.22}
                                                strokeOpacity={0}
                                                ifOverflow="visible"
                                            />
                                        ))}

                                        <Bar dataKey="count" radius={[3, 3, 0, 0]} isAnimationActive={false} style={{ cursor: 'default' }}>
                                            {buckets.map((b, i) => (
                                                <Cell
                                                    key={i}
                                                    fill={b.containsUser ? '#34d399' : '#cbd5e1'}
                                                    fillOpacity={b.containsUser ? 0.95 : 0.6}
                                                    stroke={b.containsUser ? '#6ee7b7' : 'transparent'}
                                                    strokeWidth={b.containsUser ? 1.5 : 0}
                                                />
                                            ))}
                                        </Bar>

                                        {map?.world_record != null && map.world_record > 0 && xRange != null && map.world_record >= xRange.xMin && map.world_record <= xRange.xMax && (
                                            <ReferenceLine
                                                x={map.world_record}
                                                stroke="#60a5fa"
                                                strokeWidth={2}
                                                ifOverflow="visible"
                                                label={({ viewBox }: any) => (
                                                    <g>
                                                        <text
                                                            x={viewBox.x}
                                                            y={viewBox.y - 26}
                                                            textAnchor="middle"
                                                            fill="#60a5fa"
                                                            fontSize={11}
                                                            fontWeight={700}
                                                        >
                                                            {`WR ${formatCapTime(map.world_record!)}`}
                                                        </text>
                                                    </g>
                                                )}
                                            />
                                        )}

                                        {userBest != null && xRange != null && userBest >= xRange.xMin && userBest <= xRange.xMax && (
                                            <ReferenceLine
                                                x={userBest}
                                                stroke="#34d399"
                                                strokeWidth={2}
                                                ifOverflow="visible"
                                                label={({ viewBox }: any) => (
                                                    <g>
                                                        <text
                                                            x={viewBox.x}
                                                            y={viewBox.y - 12}
                                                            textAnchor="middle"
                                                            fill="#34d399"
                                                            fontSize={11}
                                                            fontWeight={700}
                                                        >
                                                            {`You ${formatCapTime(userBest)}`}
                                                        </text>
                                                    </g>
                                                )}
                                            />
                                        )}
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Color legend — each tier */}
                            <div className="flex items-center gap-2 flex-wrap pl-1">
                                {TIER_DEFS.map(t => {
                                    const count = tierCounts.get(t.key) ?? 0
                                    if (count === 0 && t.key !== userTier?.key) return null
                                    const isUserTier = userTier?.key === t.key
                                    const icon = t.medalIconKey ? getMedalIcon(t.medalIconKey) : null
                                    return (
                                        <span
                                            key={t.key}
                                            className={cn(
                                                'inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-[10px] font-bold uppercase tracking-wider',
                                                isUserTier
                                                    ? 'bg-emerald-500/10 border-emerald-500/40'
                                                    : 'bg-white/[0.03] border-white/10',
                                            )}
                                        >
                                            <span
                                                className="inline-block w-2.5 h-2.5 rounded-sm"
                                                style={{ background: t.color }}
                                            />
                                            {icon && <img src={icon} alt="" className="size-3" />}
                                            <span style={{ color: t.color }}>{t.label}</span>
                                            <span className="font-mono tabular-nums text-white/80 normal-case tracking-normal">
                                                {count}
                                            </span>
                                        </span>
                                    )
                                })}
                            </div>

                            {overflowCount > 0 && xRange && (
                                <div className="text-[10px] text-muted-foreground italic px-1">
                                    <span className="tabular-nums text-white/70 font-mono">{overflowCount}</span> cap{overflowCount === 1 ? '' : 's'} slower than {formatCapTime(xRange.xMax)} not shown.
                                </div>
                            )}
                        </div>

                        {userBest != null && (
                            <div className="bg-emerald-500/[0.04] border border-emerald-500/20 rounded-lg px-4 py-3">
                                <div className="flex items-center gap-2 mb-2 text-emerald-200">
                                    <Target className="size-4" />
                                    <span className="text-[10px] uppercase tracking-wider font-bold">Your Position</span>
                                </div>
                                <div className="grid grid-cols-3 gap-3 text-xs">
                                    <PosTile label="Faster than you" value={fasterThanUser} total={otherTotal} tint="text-red-300" />
                                    <PosTile label="Tied with you" value={sameAsUser} total={otherTotal} tint="text-amber-300" />
                                    <PosTile label="Slower than you" value={slowerThanUser} total={otherTotal} tint="text-emerald-300" />
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </Modal>
    )
}

function StatTile({
    label, value, subtext, accent, highlight,
}: { label: string; value: string; subtext?: string; accent: string; highlight?: boolean }) {
    return (
        <div className={cn(
            'rounded-lg px-3 py-2 border',
            highlight ? 'bg-emerald-500/[0.07] border-emerald-500/30' : 'bg-card/50 border-white/5',
        )}>
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                {highlight && <Trophy className="size-3 text-emerald-300" />}
                <span>{label}</span>
            </div>
            <div className={cn('text-base font-bold font-mono tabular-nums leading-tight mt-0.5', accent)}>
                {value}
            </div>
            {subtext && (
                <div className="text-[10px] text-muted-foreground tabular-nums mt-0.5 truncate" title={subtext}>{subtext}</div>
            )}
        </div>
    )
}

function PosTile({ label, value, total, tint }: { label: string; value: number; total: number; tint: string }) {
    const pct = total > 0 ? (value / total) * 100 : 0
    return (
        <div className="bg-white/[0.03] border border-white/5 rounded px-2.5 py-2">
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
            <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className={cn('text-sm font-bold font-mono tabular-nums', tint)}>{value.toLocaleString()}</span>
                <span className="text-[10px] text-muted-foreground tabular-nums">({pct.toFixed(1)}%)</span>
            </div>
        </div>
    )
}
