import { useCallback, useEffect, useState } from 'react'
import { Activity, Clock3, Eye, Monitor, Users } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fetchAdminUsage, fetchAdminUsageRecent, toActiveTitle, type ActivityWindow, type AdminUsage, type AdminUsageRecent } from '@/app/utils/api'
import { ROLE } from '@/app/utils/roles'
import type { AdminSectionProps } from '../types'
import { SectionShell } from '../components/SectionShell'
import { StatCard } from '../components/StatCard'
import { Feedback, errMessage } from '../components/controls'
import { DataTableCell, DataTableHeaderCell, DataTableHeaderRow, DataTableRow, DataTableShell } from '@/app/components/shared/DataTable'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'

const WINDOWS: ActivityWindow[] = ['24h', '1w', '1m', '1y']
const RECENT_COLUMNS = [
  { id: 'player', width: '14rem', required: true },
  { id: 'surface', width: '6rem', priority: 30 },
  { id: 'view', width: '8rem', priority: 20 },
  { id: 'seen', width: '11rem', priority: 40 },
]

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
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)" />
                <XAxis dataKey="t" tickFormatter={(v) => new Date(v).toLocaleDateString([], { month: 'short', day: 'numeric' })} />
                <YAxis />
                <Tooltip labelFormatter={(v) => new Date(String(v)).toLocaleString()} />
                <Area type="monotone" dataKey="web_sessions" stackId="sessions" stroke="#38bdf8" fill="#38bdf855" name="Web sessions" />
                <Area type="monotone" dataKey="desktop_sessions" stackId="sessions" stroke="#2dd4bf" fill="#2dd4bf55" name="Desktop sessions" />
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
                        <span>{new Date(item.last_seen_at).toLocaleString()}</span>
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
                      {recentColumnVisible('seen') && <DataTableCell align="center" width="11rem">{new Date(item.last_seen_at).toLocaleString()}</DataTableCell>}
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
