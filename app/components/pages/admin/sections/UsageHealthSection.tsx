import { useCallback, useEffect, useState } from 'react'
import { Activity, Clock3, Eye, Monitor, Users } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fetchAdminUsage, fetchAdminUsageRecent, toActiveTitle, type ActivityWindow, type AdminUsage, type AdminUsageRecent } from '@/app/utils/api'
import { ROLE } from '@/app/utils/roles'
import type { AdminSectionProps } from '../types'
import { SectionShell } from '../components/SectionShell'
import { StatCard } from '../components/StatCard'
import { Feedback, errMessage, formatDateTime } from '../components/controls'
import { DataTableCell, DataTableHeaderCell, DataTableHeaderRow, DataTableRow, DataTableShell } from '@/app/components/shared/DataTable'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { CHART_CYAN, CHART_TEAL } from '@/app/utils/chartColors'
import { parseApiDate } from '@/app/utils/format'

const WINDOWS: ActivityWindow[] = ['24h', '1w', '1m', '1y']
const TICK_FORMATS: Record<AdminUsage['bucket'], Intl.DateTimeFormatOptions> = {
  hour: { hour: 'numeric', timeZone: 'UTC' },
  day: { month: 'short', day: 'numeric', timeZone: 'UTC' },
  month: { month: 'short', year: 'numeric', timeZone: 'UTC' },
}
const POINT_FORMATS: Record<AdminUsage['bucket'], Intl.DateTimeFormatOptions> = {
  hour: { month: 'short', day: 'numeric', hour: 'numeric', timeZone: 'UTC', timeZoneName: 'short' },
  day: { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' },
  month: { month: 'long', year: 'numeric', timeZone: 'UTC' },
}

function formatBucket(value: unknown, bucket: AdminUsage['bucket'], formats: Record<AdminUsage['bucket'], Intl.DateTimeFormatOptions>): string {
  const parsed = parseApiDate(typeof value === 'string' ? value : String(value ?? ''))
  return parsed ? parsed.toLocaleString(undefined, formats[bucket]) : ''
}
const AXIS_TICK = 'var(--muted-foreground)'
const AXIS_LINE = 'rgb(var(--hairline-rgb) / 0.12)'
const GRID_STROKE = 'rgb(var(--hairline-rgb) / 0.08)'
const RECENT_COLUMNS = [
  { id: 'player', width: '14rem', required: true },
  { id: 'surface', width: '6rem', priority: 30 },
  { id: 'view', width: '8rem', priority: 20 },
  { id: 'seen', width: '11rem', priority: 40 },
]

function SessionsTooltip({ active, payload, label, bucket }: {
  active?: boolean
  payload?: { name?: string; value?: number; color?: string; dataKey?: string | number }[]
  label?: string | number
  bucket: AdminUsage['bucket']
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-hairline/15 bg-card/95 px-3 py-2 shadow-xl backdrop-blur-sm">
      <div className="text-[11px] text-muted-foreground mb-1">{formatBucket(label, bucket, POINT_FORMATS)}</div>
      <div className="space-y-1">
        {payload.map((entry) => (
          <div key={String(entry.dataKey)} className="flex items-center gap-2">
            <span className="size-2 rounded-full shrink-0" style={{ background: entry.color }} />
            <span className="text-xs text-muted-foreground">{entry.name}</span>
            <span className="text-sm font-semibold text-foreground tabular-nums ml-auto">{Number(entry.value ?? 0).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function UsageHealthSection({ userProfile }: AdminSectionProps) {
  const token = userProfile?.accessToken
  const [window, setWindow] = useState<ActivityWindow>('1w')
  const [data, setData] = useState<AdminUsage | null>(null)
  const [recent, setRecent] = useState<AdminUsageRecent['items']>([])
  const [error, setError] = useState<string | null>(null)
  const [recentColumns, setRecentColumns] = useState<Set<string> | null>(null)
  const resolveRecentColumns = useCallback((ids: Set<string>) => setRecentColumns(ids), [])
  const recentColumnVisible = (id: string) => !recentColumns || recentColumns.has(id)

  useEffect(() => {
    if (!token) return
    const controller = new AbortController()
    setError(null)
    void fetchAdminUsage(token, window, controller.signal).then(setData).catch((e) => {
      if (!controller.signal.aborted) setError(errMessage(e))
    })
    if (userProfile?.utbt_role === ROLE.ADMIN) {
      void fetchAdminUsageRecent(token, controller.signal).then((value) => setRecent(value.items)).catch(() => {})
    } else {
      setRecent([])
    }
    return () => controller.abort()
  }, [token, window, userProfile?.utbt_role])

  return (
    <SectionShell
      icon={Activity}
      title="Usage & Health"
      description="Pseudonymous web and desktop sessions. Raw sessions are retained for 90 days; aggregates are retained for trends."
      actions={<div className="flex gap-1">{WINDOWS.map((value) => (
        <button key={value} onClick={() => setWindow(value)} className={`px-3 py-1.5 rounded-lg text-xs ${window === value ? 'bg-accent text-accent-foreground' : 'bg-card/40 text-muted-foreground'}`}>{value}</button>
      ))}</div>}
    >
      {error && <Feedback tone="red" message={error} />}
      {!data ? <Feedback message="Loading usage..." /> : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
            <StatCard label="Active now" value={data.summary.active_now.web + data.summary.active_now.desktop} icon={Activity} tone="emerald" />
            <StatCard label="Sessions" value={data.summary.sessions} icon={Monitor} tone="accent" />
            <StatCard label={data.summary.visitor_metric.label} value={data.summary.visitor_metric.value} icon={Users} tone="accent" />
            <StatCard label="Page views" value={data.summary.page_views} icon={Eye} tone="accent" />
            <StatCard label="Engaged hours" value={data.summary.engaged_hours} icon={Clock3} tone="amber" />
          </div>
          <div className="h-72 rounded-xl border border-hairline/5 bg-card/30 p-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.points}>
                <defs>
                  <linearGradient id="usageWebFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_CYAN} stopOpacity={0.45} />
                    <stop offset="100%" stopColor={CHART_CYAN} stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="usageDesktopFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_TEAL} stopOpacity={0.45} />
                    <stop offset="100%" stopColor={CHART_TEAL} stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
                <XAxis
                  dataKey="t"
                  tick={{ fill: AXIS_TICK, fontSize: 10 }}
                  axisLine={{ stroke: AXIS_LINE }}
                  tickLine={{ stroke: AXIS_LINE }}
                  minTickGap={16}
                  tickFormatter={(v) => formatBucket(v, data.bucket, TICK_FORMATS)}
                />
                <YAxis
                  tick={{ fill: AXIS_TICK, fontSize: 10 }}
                  axisLine={{ stroke: AXIS_LINE }}
                  tickLine={{ stroke: AXIS_LINE }}
                  allowDecimals={false}
                  width={40}
                />
                <Tooltip content={<SessionsTooltip bucket={data.bucket} />} cursor={{ stroke: AXIS_LINE }} />
                <Area type="monotone" dataKey="web_sessions" stackId="sessions" stroke={CHART_CYAN} strokeWidth={2} fill="url(#usageWebFill)" dot={false} name="Web sessions" />
                <Area type="monotone" dataKey="desktop_sessions" stackId="sessions" stroke={CHART_TEAL} strokeWidth={2} fill="url(#usageDesktopFill)" dot={false} name="Desktop sessions" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="grid lg:grid-cols-3 gap-3">
            {(['pages', 'outcomes', 'errors'] as const).map((key) => (
              <div key={key} className="rounded-xl border border-hairline/5 bg-card/30 p-4">
                <h3 className="font-semibold capitalize mb-3">{key}</h3>
                <div className="space-y-2">{data.breakdowns[key].map((item) => (
                  <div key={item.key} className="flex justify-between text-sm"><span className="text-muted-foreground">{item.key.replaceAll('_', ' ')}</span><span className="tabular-nums">{item.count}</span></div>
                ))}</div>
              </div>
            ))}
          </div>
          {userProfile?.utbt_role === ROLE.ADMIN && (
            <div className="space-y-2">
              <div className="font-semibold">Recent signed-in users</div>
              <DataTableShell
                className="!flex-none"
                responsive={{
                  columns: RECENT_COLUMNS,
                  onResolve: resolveRecentColumns,
                  compactAriaLabel: 'Recent signed-in users',
                  compactContent: recent.map((item) => (
                    <div key={item.user_id} role="listitem" className="p-3 space-y-2 border-b border-hairline/5 last:border-0">
                      <PlayerInfo userId={item.user_id} alias={item.alias} title={toActiveTitle(item.active_title)} size="sm" />
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="capitalize">{item.surface}</span>
                        <span>{item.last_view.replaceAll('_', ' ')}</span>
                        <span>{formatDateTime(item.last_seen_at)}</span>
                      </div>
                    </div>
                  )),
                }}
              >
                <DataTableHeaderRow>
                  <DataTableHeaderCell width="14rem">Player</DataTableHeaderCell>
                  {recentColumnVisible('surface') && <DataTableHeaderCell align="center" width="6rem">Surface</DataTableHeaderCell>}
                  {recentColumnVisible('view') && <DataTableHeaderCell align="center" width="8rem">Last view</DataTableHeaderCell>}
                  {recentColumnVisible('seen') && <DataTableHeaderCell align="center" width="11rem">Last seen</DataTableHeaderCell>}
                </DataTableHeaderRow>
                <tbody>
                  {recent.map((item) => (
                    <DataTableRow key={item.user_id}>
                      <DataTableCell width="14rem"><PlayerInfo userId={item.user_id} alias={item.alias} title={toActiveTitle(item.active_title)} size="sm" /></DataTableCell>
                      {recentColumnVisible('surface') && <DataTableCell align="center" width="6rem" className="capitalize">{item.surface}</DataTableCell>}
                      {recentColumnVisible('view') && <DataTableCell align="center" width="8rem">{item.last_view.replaceAll('_', ' ')}</DataTableCell>}
                      {recentColumnVisible('seen') && <DataTableCell align="center" width="11rem">{formatDateTime(item.last_seen_at)}</DataTableCell>}
                    </DataTableRow>
                  ))}
                </tbody>
              </DataTableShell>
            </div>
          )}
        </div>
      )}
    </SectionShell>
  )
}
