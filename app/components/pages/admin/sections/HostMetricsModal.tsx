import { useCallback, useEffect, useState } from 'react'
import { Activity, Cpu, HardDrive, MemoryStick, Server } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  fetchAdminHostMetrics,
  type AdminHost,
  type AdminHostMetrics,
  type AdminMetricWindow,
} from '@/app/utils/api'
import { Modal } from '@/app/components/ui/modal'
import { CHART_AMBER, CHART_CYAN, CHART_TEAL } from '@/app/utils/chartColors'
import { StatCard } from '../components/StatCard'
import { AdminSelect, Feedback, errMessage, relTime } from '../components/controls'

const WINDOW_OPTIONS = [
  { value: '24h', label: 'Last 24 hours' },
  { value: '1w', label: 'Last week' },
  { value: '1m', label: 'Last month' },
]

const AXIS_TICK = 'var(--muted-foreground)'
const AXIS_LINE = 'rgb(var(--hairline-rgb) / 0.12)'
const GRID_STROKE = 'rgb(var(--hairline-rgb) / 0.08)'

function percent(value: number | null | undefined) {
  return value === null || value === undefined ? '--' : `${Math.round(value)}%`
}

function MetricsTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { name?: string; value?: number; color?: string; dataKey?: string | number }[]
  label?: string | number
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-hairline/15 bg-card/95 px-3 py-2 shadow-xl backdrop-blur-sm">
      <div className="text-[11px] text-muted-foreground mb-1">{new Date(String(label)).toLocaleString()}</div>
      <div className="space-y-1">
        {payload.map((entry) => (
          <div key={String(entry.dataKey)} className="flex items-center gap-2">
            <span className="size-2 rounded-full shrink-0" style={{ background: entry.color }} />
            <span className="text-xs text-muted-foreground">{entry.name}</span>
            <span className="text-sm font-semibold text-foreground tabular-nums ml-auto">
              {Math.round(Number(entry.value ?? 0))}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function HostMetricsModal({ host, token, onClose }: {
  host: AdminHost
  token: string
  onClose: () => void
}) {
  const [window, setWindow] = useState<AdminMetricWindow>('24h')
  const [data, setData] = useState<AdminHostMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback((signal?: AbortSignal) => {
    setLoading(true)
    fetchAdminHostMetrics(token, host.id, window, signal)
      .then((next) => { setData(next); setError(null) })
      .catch((e) => { if (!signal?.aborted) setError(errMessage(e)) })
      .finally(() => { if (!signal?.aborted) setLoading(false) })
  }, [token, host.id, window])

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
    return () => controller.abort()
  }, [load])

  const runtime = host.runtime
  const points = data?.points ?? []

  return (
    <Modal isOpen onClose={onClose} title={`${host.name} — host metrics`} offsetSidebar maxWidth="60rem">
      <div className="p-4 space-y-4">
        <Feedback message={error} tone="red" onDismiss={() => setError(null)} />

        {runtime?.known && runtime.reachable === false && (
          <Feedback
            message={`This host's agent is not responding${runtime.polled_at ? ` (last tried ${relTime(runtime.polled_at)})` : ''}. Readings below are the last ones recorded.`}
            tone="amber"
          />
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="CPU" value={percent(runtime?.cpu_percent)} icon={Cpu} tone={(runtime?.cpu_percent ?? 0) > 85 ? 'red' : 'accent'} />
          <StatCard label="Memory" value={percent(runtime?.memory_percent)} icon={MemoryStick} tone={(runtime?.memory_percent ?? 0) > 85 ? 'red' : 'accent'} />
          <StatCard label="Disk" value={percent(runtime?.disk_percent)} icon={HardDrive} tone={(runtime?.disk_percent ?? 0) > 85 ? 'amber' : 'accent'} />
          <StatCard
            label="Servers up"
            value={runtime?.known ? `${runtime.servers_up ?? 0}/${runtime.server_count ?? 0}` : '--'}
            icon={Server}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-semibold flex items-center gap-2">
            <Activity className="size-4 text-muted-foreground" />
            Utilisation
          </div>
          <AdminSelect
            value={window}
            onChange={(value) => setWindow(value as AdminMetricWindow)}
            options={WINDOW_OPTIONS}
            ariaLabel="Metrics window"
          />
        </div>

        {loading && points.length === 0 ? (
          <div className="h-64 rounded-xl border border-hairline/5 bg-card/20 flex items-center justify-center text-sm text-muted-foreground">
            Loading metrics...
          </div>
        ) : points.length === 0 ? (
          <div className="h-64 rounded-xl border border-hairline/5 bg-card/20 flex items-center justify-center text-sm text-muted-foreground text-center px-6">
            No readings for this window yet. Metrics start accumulating once the host reports in.
          </div>
        ) : (
          <div className="h-64 rounded-xl border border-hairline/5 bg-card/20 p-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                <defs>
                  <linearGradient id="hostCpuFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_CYAN} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={CHART_CYAN} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="hostMemFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_TEAL} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={CHART_TEAL} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                <XAxis
                  dataKey="at"
                  tick={{ fill: AXIS_TICK, fontSize: 11 }}
                  axisLine={{ stroke: AXIS_LINE }}
                  tickLine={false}
                  tickFormatter={(value) => new Date(String(value)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  minTickGap={32}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fill: AXIS_TICK, fontSize: 11 }}
                  axisLine={{ stroke: AXIS_LINE }}
                  tickLine={false}
                  width={44}
                />
                <Tooltip content={<MetricsTooltip />} cursor={{ stroke: AXIS_LINE }} />
                <Area type="monotone" dataKey="cpu_percent" stroke={CHART_CYAN} strokeWidth={2} fill="url(#hostCpuFill)" dot={false} name="CPU" />
                <Area type="monotone" dataKey="memory_percent" stroke={CHART_TEAL} strokeWidth={2} fill="url(#hostMemFill)" dot={false} name="Memory" />
                <Area type="monotone" dataKey="disk_percent" stroke={CHART_AMBER} strokeWidth={1.5} fillOpacity={0} dot={false} name="Disk" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        <p className="text-[11px] text-muted-foreground">
          {data?.bucket === 'hour'
            ? 'Hourly averages. Short spikes are smoothed out at this range — switch to 24 hours to see them.'
            : 'Individual readings, roughly one every 30 seconds.'}
        </p>
      </div>
    </Modal>
  )
}
