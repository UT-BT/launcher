import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import {
  LayoutDashboard, Flag, Ban, AlertTriangle, Activity, Users, Map as MapIcon, Tag,
  Database, ArrowRight, type LucideIcon,
} from 'lucide-react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  fetchAdminOverview, fetchAdminActivity,
  type AdminOverview, type AdminActivity,
} from '@/app/utils/api'
import {
  BUCKET_LABEL, DAY_MS, RANGE_PRESETS, asChartBucket, bucketForSpanDays, formatWeekRange,
  isoDay, needsPointMarkers, presetById, presetRange, rangeSpanDays, splitPartialSeries,
  validateRange, type ChartBucket, type PartialSeriesPoint,
} from '@/app/utils/chartBuckets'
import { cn } from '@/lib/utils'
import type { AdminSectionProps, Tone } from '../types'
import { SectionShell } from '../components/SectionShell'
import { StatCard } from '../components/StatCard'
import { ActionButton, DateRangeControl, Feedback, errMessage, type DateRangeSelection } from '../components/controls'
import { TONE_CHIP } from '../components/tone'
import { CHART_EMERALD, CHART_VIOLET, CHART_CYAN, CHART_AMBER, CHART_PINK, CHART_TEAL } from '@/app/utils/chartColors'

function ActionCard({ tone, icon: Icon, label, value, hint, cta, onClick }: {
  tone: Tone
  icon: LucideIcon
  label: string
  value: string | number
  hint?: string
  cta: string
  onClick?: () => void
}) {
  return (
    <div className="bg-card/30 border border-hairline/5 rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-3 min-w-0">
        <div className={cn('p-2.5 rounded-xl border shrink-0', TONE_CHIP[tone])}><Icon className="size-5" /></div>
        <div className="min-w-0">
          <div className="text-2xl font-bold text-foreground tabular-nums leading-none">{value}</div>
          <div className="text-sm text-foreground mt-1">{label}</div>
          {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
        </div>
      </div>
      <ActionButton tone={tone} icon={ArrowRight} onClick={onClick}>{cta}</ActionButton>
    </div>
  )
}

const KPIS: { key: keyof AdminOverview['stats']; label: string; tone: Tone; icon: LucideIcon }[] = [
  { key: 'warns_24h', label: 'Warnings (24h)', tone: 'amber', icon: AlertTriangle },
  { key: 'total_users', label: 'Players', tone: 'accent', icon: Users },
  { key: 'total_caps', label: 'Caps', tone: 'accent', icon: Database },
  { key: 'disallowed_caps', label: 'Disallowed Caps', tone: 'red', icon: Flag },
  { key: 'active_maps', label: 'Active Maps', tone: 'accent', icon: MapIcon },
  { key: 'inactive_maps', label: 'Inactive Maps', tone: 'amber', icon: MapIcon },
  { key: 'total_titles', label: 'Titles', tone: 'accent', icon: Tag },
]

const ACCENT = 'var(--accent-500, #3b82f6)'
const AXIS_TICK = 'var(--muted-foreground, #94a3b8)'
const GRID_STROKE = 'rgba(255,255,255,0.05)'
const AXIS_LINE = 'rgba(255,255,255,0.06)'

const RANGE_STORAGE_KEY = 'utbt:admin:overview:range:v1'
const DEFAULT_PRESET_ID = '7d'

type SeriesKey = 'caps' | 'players' | 'playtime_hours' | 'new_users' | 'new_maps' | 'achievements' | 'web_sessions' | 'desktop_sessions'

const SERIES: { key: SeriesKey; title: string; unit: string; color: string; gradientId: string }[] = [
  { key: 'caps', title: 'Caps', unit: 'caps', color: ACCENT, gradientId: 'ovCaps' },
  { key: 'players', title: 'Unique Players', unit: 'unique players', color: CHART_EMERALD, gradientId: 'ovPlayers' },
  { key: 'playtime_hours', title: 'Playtime', unit: 'hours', color: CHART_VIOLET, gradientId: 'ovPlaytime' },
  { key: 'new_users', title: 'New Users', unit: 'new users', color: CHART_CYAN, gradientId: 'ovUsers' },
  { key: 'new_maps', title: 'New Maps', unit: 'new maps', color: CHART_AMBER, gradientId: 'ovMaps' },
  { key: 'achievements', title: 'Achievements Unlocked', unit: 'unlocked', color: CHART_PINK, gradientId: 'ovAch' },
  { key: 'web_sessions', title: 'Website Sessions', unit: 'sessions', color: CHART_CYAN, gradientId: 'ovWebSessions' },
  { key: 'desktop_sessions', title: 'Desktop App Sessions', unit: 'sessions', color: CHART_TEAL, gradientId: 'ovDesktopSessions' },
]

function defaultRange(nowMs: number): DateRangeSelection {
  const preset = presetById(DEFAULT_PRESET_ID) ?? RANGE_PRESETS[0]
  return { presetId: preset.id, ...presetRange(preset.days, nowMs) }
}

function loadRange(nowMs: number): DateRangeSelection {
  const base = defaultRange(nowMs)
  if (typeof window === 'undefined') return base
  try {
    const raw = window.localStorage.getItem(RANGE_STORAGE_KEY)
    if (!raw) return base
    const saved = JSON.parse(raw) as Partial<DateRangeSelection>
    const preset = typeof saved.presetId === 'string' ? presetById(saved.presetId) : null
    if (preset) return { presetId: preset.id, ...presetRange(preset.days, nowMs) }
    const start = typeof saved.start === 'string' ? saved.start : base.start
    const end = typeof saved.end === 'string' ? saved.end : base.end
    return validateRange(start, end, isoDay(nowMs)) ? base : { presetId: null, start, end }
  } catch {
    return base
  }
}

const UTC = 'UTC'

function formatLabel(t: string | null, bucket: ChartBucket): string {
  if (!t) return ''
  const d = new Date(t)
  if (Number.isNaN(d.getTime())) return ''
  if (bucket === 'hour') return d.toLocaleTimeString([], { hour: '2-digit', timeZone: UTC })
  if (bucket === 'month') return d.toLocaleDateString([], { month: 'short', year: '2-digit', timeZone: UTC })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', timeZone: UTC })
}

function formatFull(t: string | null, bucket: ChartBucket): string {
  if (!t) return ''
  const d = new Date(t)
  if (Number.isNaN(d.getTime())) return ''
  if (bucket === 'hour') return d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', timeZone: UTC })
  if (bucket === 'month') return d.toLocaleDateString([], { month: 'long', year: 'numeric', timeZone: UTC })
  if (bucket === 'week') return formatWeekRange(d.getTime(), d.getTime() + 7 * DAY_MS - 1)
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric', timeZone: UTC })
}

function formatSpan(startIso: string | null, endIso: string | null): string {
  if (!startIso || !endIso) return ''
  const start = new Date(startIso)
  const lastInstant = new Date(new Date(endIso).getTime() - 1)
  if (Number.isNaN(start.getTime()) || Number.isNaN(lastInstant.getTime())) return ''
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric', timeZone: UTC }
  return `${start.toLocaleDateString([], opts)} – ${lastInstant.toLocaleDateString([], opts)}`
}

function seriesNote(key: SeriesKey, dayResolution: string[], unavailable: string[]): string | undefined {
  if (unavailable.includes(key)) return 'not kept this far back'
  if (dayResolution.includes(key)) return 'daily totals'
  return undefined
}

function formatValue(v: number, unit: string): string {
  const n = unit === 'hours'
    ? v.toLocaleString(undefined, { maximumFractionDigits: 1 })
    : Math.round(v).toLocaleString()
  return `${n} ${unit}`
}

function ChartTooltip({ active, payload, unit, bucket }: {
  active?: boolean
  payload?: { value: number | null; color?: string; payload: PartialSeriesPoint }[]
  unit: string
  bucket: ChartBucket
}) {
  if (!active || !payload?.length) return null
  const entry = payload.find((p) => p.value !== null && p.value !== undefined)
  if (!entry) return null
  const point = entry.payload
  return (
    <div className="rounded-lg border border-hairline/15 bg-card/95 px-3 py-2 shadow-xl backdrop-blur-sm">
      <div className="text-[11px] text-muted-foreground mb-1">{formatFull(point.t, bucket)}</div>
      <div className="flex items-center gap-2">
        <span className="size-2 rounded-full shrink-0" style={{ background: entry.color }} />
        <span className="text-sm font-semibold text-foreground tabular-nums">{formatValue(entry.value ?? 0, unit)}</span>
      </div>
      {point.partial && <div className="text-[11px] text-amber-300 mt-1">Still in progress</div>}
    </div>
  )
}

const ActivityChart = memo(function ActivityChart({ title, dataKey, color, gradientId, unit, bucket, points, note }: {
  title: string
  dataKey: SeriesKey
  color: string
  gradientId: string
  unit: string
  bucket: ChartBucket
  points: AdminActivity['points']
  note?: string
}) {
  const series = useMemo(
    () => splitPartialSeries(points, (p) => p[dataKey], (p) => formatLabel(p.t, bucket)),
    [points, dataKey, bucket],
  )
  const showDots = needsPointMarkers(series)
  return (
    <div className="bg-card/30 border border-hairline/5 rounded-xl p-3">
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{title}</span>
        {note && <span className="text-[10px] text-muted-foreground">{note}</span>}
      </div>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
              <linearGradient id={`${gradientId}Partial`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.12} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: AXIS_TICK, fontSize: 10 }}
              axisLine={{ stroke: AXIS_LINE }}
              tickLine={{ stroke: AXIS_LINE }}
              minTickGap={16}
            />
            <YAxis
              tick={{ fill: AXIS_TICK, fontSize: 10 }}
              axisLine={{ stroke: AXIS_LINE }}
              tickLine={{ stroke: AXIS_LINE }}
              allowDecimals={unit === 'hours'}
              width={48}
            />
            <Tooltip
              content={<ChartTooltip unit={unit} bucket={bucket} />}
              cursor={{ stroke: 'rgba(255,255,255,0.12)' }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              dot={showDots ? { r: 3, fill: color, stroke: color } : false}
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="partialValue"
              stroke={color}
              strokeWidth={2}
              strokeDasharray="4 3"
              strokeOpacity={0.75}
              fill={`url(#${gradientId}Partial)`}
              dot={showDots ? { r: 3, fill: color, stroke: color, fillOpacity: 0.75 } : false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
})

export function OverviewSection({ userProfile, onNavigate }: AdminSectionProps) {
  const token = userProfile?.accessToken
  const [data, setData] = useState<AdminOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const todayIso = useMemo(() => isoDay(Date.now()), [])
  const [range, setRange] = useState<DateRangeSelection>(() => loadRange(Date.now()))
  const [activity, setActivity] = useState<AdminActivity | null>(null)
  const [activityLoading, setActivityLoading] = useState(true)

  const rangeError = validateRange(range.start, range.end, todayIso)

  const applyRange = useCallback((next: DateRangeSelection) => {
    const preset = presetById(next.presetId)
    const resolved = preset ? { presetId: preset.id, ...presetRange(preset.days, Date.now()) } : next
    setRange(resolved)
    try {
      window.localStorage.setItem(RANGE_STORAGE_KEY, JSON.stringify(resolved))
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    if (!token) return
    const ctrl = new AbortController()
    setLoading(true)
    setError(null)
    fetchAdminOverview(token, ctrl.signal)
      .then((d) => { setData(d); setLoading(false) })
      .catch((e) => { if (!ctrl.signal.aborted) { setError(errMessage(e)); setLoading(false) } })
    return () => ctrl.abort()
  }, [token])

  useEffect(() => {
    if (!token || rangeError) return
    const ctrl = new AbortController()
    setActivityLoading(true)
    fetchAdminActivity(token, { start: range.start, end: range.end }, ctrl.signal)
      .then((d) => { setActivity(d); setActivityLoading(false) })
      .catch((e) => { if (!ctrl.signal.aborted) { setError(errMessage(e)); setActivityLoading(false) } })
    return () => ctrl.abort()
  }, [token, range.start, range.end, rangeError])

  const v = (key: keyof AdminOverview['stats']) => (loading || !data ? '—' : data.stats[key])

  const bucket = activity
    ? asChartBucket(activity.bucket)
    : bucketForSpanDays(rangeError ? 1 : rangeSpanDays(range.start, range.end))
  const points = activity?.points ?? []
  const hasPoints = points.length > 0
  const spanLabel = formatSpan(activity?.start ?? null, activity?.end ?? null)
  const dayResolution = activity?.dayResolutionSeries ?? []
  const unavailable = activity?.unavailableSeries ?? []

  return (
    <SectionShell title="Overview" icon={LayoutDashboard}>
      <Feedback message={error} tone="red" onDismiss={() => setError(null)} />

      <div className="grid gap-3 sm:grid-cols-2">
        <ActionCard
          tone="red" icon={Ban} label="Active bans" value={v('active_bans')}
          cta="Manage users" onClick={() => onNavigate?.('user-management')}
        />
        <ActionCard
          tone="emerald" icon={Activity} label="Staff actions (24h)" value={v('staff_actions_24h')}
          cta="View audit log" onClick={() => onNavigate?.('audit-logs')}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-7 gap-3">
        {KPIS.map((k) => (
          <StatCard key={k.key} label={k.label} value={v(k.key)} tone={k.tone} icon={k.icon} />
        ))}
      </div>

      <div className="space-y-3">
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Activity</span>
            <span className="text-xs text-muted-foreground">
              {spanLabel ? `${spanLabel} · ` : ''}{BUCKET_LABEL[bucket]}
              {activity?.partialFrom ? ' · dashed = still in progress' : ''}
            </span>
          </div>
          <DateRangeControl
            value={range}
            presets={RANGE_PRESETS}
            maxDate={todayIso}
            error={rangeError}
            onChange={applyRange}
          />
        </div>

        {!hasPoints ? (
          <div className="bg-card/30 border border-hairline/5 rounded-xl p-4">
            <div className="h-40 flex items-center justify-center text-sm text-muted-foreground text-center px-4">
              {rangeError ? 'Adjust the dates to load activity.' : activityLoading ? 'Loading…' : 'No activity in this range.'}
            </div>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {SERIES.map((s) => (
              <ActivityChart
                key={s.key}
                title={s.title}
                dataKey={s.key}
                unit={s.unit}
                color={s.color}
                gradientId={s.gradientId}
                bucket={bucket}
                points={points}
                note={seriesNote(s.key, dayResolution, unavailable)}
              />
            ))}
          </div>
        )}
      </div>
    </SectionShell>
  )
}
