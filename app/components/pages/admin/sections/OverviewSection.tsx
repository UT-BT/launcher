import { memo, useEffect, useMemo, useState } from 'react'
import {
  LayoutDashboard, Flag, Ban, AlertTriangle, Activity, Users, Map as MapIcon, Tag,
  Database, ArrowRight, type LucideIcon,
} from 'lucide-react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  fetchAdminOverview, fetchAdminActivity,
  type AdminOverview, type AdminActivity, type ActivityWindow,
} from '@/app/utils/api'
import { cn } from '@/lib/utils'
import type { AdminSectionProps, Tone } from '../types'
import { SectionShell } from '../components/SectionShell'
import { StatCard } from '../components/StatCard'
import { ActionButton, Feedback, errMessage } from '../components/controls'
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

const WINDOWS: ActivityWindow[] = ['24h', '1w', '1m', '1y']

type SeriesKey = 'caps' | 'players' | 'playtime_hours' | 'new_users' | 'new_maps' | 'achievements' | 'launcher_logins'

const SERIES: { key: SeriesKey; title: string; unit: string; color: string; gradientId: string }[] = [
  { key: 'caps', title: 'Caps', unit: 'caps', color: ACCENT, gradientId: 'ovCaps' },
  { key: 'players', title: 'Unique Players', unit: 'unique players', color: CHART_EMERALD, gradientId: 'ovPlayers' },
  { key: 'playtime_hours', title: 'Playtime', unit: 'hours', color: CHART_VIOLET, gradientId: 'ovPlaytime' },
  { key: 'new_users', title: 'New Users', unit: 'new users', color: CHART_CYAN, gradientId: 'ovUsers' },
  { key: 'new_maps', title: 'New Maps', unit: 'new maps', color: CHART_AMBER, gradientId: 'ovMaps' },
  { key: 'achievements', title: 'Achievements Unlocked', unit: 'unlocked', color: CHART_PINK, gradientId: 'ovAch' },
  { key: 'launcher_logins', title: 'Launcher Logins', unit: 'logins', color: CHART_TEAL, gradientId: 'ovLogins' },
]

type ChartPoint = AdminActivity['points'][number] & { label: string }

function formatLabel(t: string | null, bucket: string): string {
  if (!t) return ''
  const d = new Date(t)
  if (Number.isNaN(d.getTime())) return ''
  if (bucket === 'hour') return d.toLocaleTimeString([], { hour: '2-digit' })
  if (bucket === 'month') return d.toLocaleDateString([], { month: 'short', year: '2-digit' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function formatFull(t: string | null, bucket: string): string {
  if (!t) return ''
  const d = new Date(t)
  if (Number.isNaN(d.getTime())) return ''
  if (bucket === 'hour') return d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric' })
  if (bucket === 'month') return d.toLocaleDateString([], { month: 'long', year: 'numeric' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatValue(v: number, unit: string): string {
  const n = unit === 'hours'
    ? v.toLocaleString(undefined, { maximumFractionDigits: 1 })
    : Math.round(v).toLocaleString()
  return `${n} ${unit}`
}

function ChartTooltip({ active, payload, unit, bucket }: {
  active?: boolean
  payload?: { value: number; color?: string; payload: ChartPoint }[]
  unit: string
  bucket: string
}) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  return (
    <div className="rounded-lg border border-hairline/15 bg-card/95 px-3 py-2 shadow-xl backdrop-blur-sm">
      <div className="text-[11px] text-muted-foreground mb-1">{formatFull(p.payload.t, bucket)}</div>
      <div className="flex items-center gap-2">
        <span className="size-2 rounded-full shrink-0" style={{ background: p.color }} />
        <span className="text-sm font-semibold text-foreground tabular-nums">{formatValue(p.value, unit)}</span>
      </div>
    </div>
  )
}

const ActivityChart = memo(function ActivityChart({ title, dataKey, color, gradientId, unit, bucket, points }: {
  title: string
  dataKey: SeriesKey
  color: string
  gradientId: string
  unit: string
  bucket: string
  points: ChartPoint[]
}) {
  return (
    <div className="bg-card/30 border border-hairline/5 rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{title}</span>
      </div>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.35} />
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
              dataKey={dataKey}
              stroke={color}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              dot={false}
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

  const [activityWindow, setActivityWindow] = useState<ActivityWindow>('1w')
  const [activity, setActivity] = useState<AdminActivity | null>(null)
  const [activityLoading, setActivityLoading] = useState(true)

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
    if (!token) return
    const ctrl = new AbortController()
    setActivityLoading(true)
    fetchAdminActivity(token, activityWindow, ctrl.signal)
      .then((d) => { setActivity(d); setActivityLoading(false) })
      .catch((e) => { if (!ctrl.signal.aborted) { setError(errMessage(e)); setActivityLoading(false) } })
    return () => ctrl.abort()
  }, [token, activityWindow])

  const v = (key: keyof AdminOverview['stats']) => (loading || !data ? '—' : data.stats[key])

  const bucket = activity?.bucket ?? 'day'
  const chartData = useMemo<ChartPoint[]>(
    () => (activity?.points ?? []).map((p) => ({ ...p, label: formatLabel(p.t, activity?.bucket ?? 'day') })),
    [activity],
  )
  const hasPoints = chartData.length > 0

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
        <div className="flex items-center justify-between gap-3">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Activity</span>
          <div className="flex items-center gap-1.5">
            {WINDOWS.map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setActivityWindow(w)}
                className={cn(
                  'h-7 px-2.5 rounded-md border text-xs cursor-pointer transition-colors',
                  activityWindow === w
                    ? 'bg-accent-500/15 border-accent-500/40 text-accent-200'
                    : 'border-hairline/10 bg-card/30 text-muted-foreground hover:text-foreground',
                )}
              >
                {w}
              </button>
            ))}
          </div>
        </div>

        {!hasPoints ? (
          <div className="bg-card/30 border border-hairline/5 rounded-xl p-4">
            <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">
              {activityLoading ? 'Loading…' : 'No activity in this window.'}
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
                points={chartData}
              />
            ))}
          </div>
        )}
      </div>
    </SectionShell>
  )
}
