import { useCallback, useEffect, useState } from 'react'
import { BellRing, Check, CircleAlert, Eye, TriangleAlert } from 'lucide-react'
import {
  acknowledgeAdminAlert,
  fetchAdminAlerts,
  resolveAdminAlert,
  unacknowledgeAdminAlert,
  type AdminAlert,
} from '@/app/utils/api'
import { cn } from '@/lib/utils'
import { ActionButton, ConfirmDialog, Feedback, errMessage, relTime } from '../components/controls'

const REFRESH_MS = 60_000

const KIND_LABELS: Record<string, string> = {
  'map.switch_failed': 'Map switch failed',
  'ace.initialisation_failed': 'Anti-cheat did not start',
  'ace.not_ready': 'Anti-cheat not ready',
  'mapvote.degraded': 'Map vote data not serving',
  'host.unreachable': 'Host unreachable',
  'server.process_down': 'Server process down',
}

function target(alert: AdminAlert) {
  if (alert.server_name) return alert.server_name
  if (alert.raw_server) return alert.raw_server
  if (alert.port) return `port ${alert.port}`
  if (alert.host_name) return alert.host_name
  return 'Unknown target'
}

function AlertRow({ alert, busy, onAck, onUnack, onResolve }: {
  alert: AdminAlert
  busy: boolean
  onAck: () => void
  onUnack: () => void
  onResolve: () => void
}) {
  const critical = alert.severity === 'critical'
  const acknowledged = alert.status === 'acknowledged'

  return (
    <div
      className={cn(
        'flex flex-wrap items-start gap-3 rounded-lg border px-3 py-2.5',
        acknowledged
          ? 'border-hairline/10 bg-card/20'
          : critical
            ? 'border-red-500/30 bg-red-500/5'
            : 'border-amber-500/30 bg-amber-500/5',
      )}
    >
      <div className={cn('mt-0.5 shrink-0', acknowledged ? 'text-muted-foreground' : critical ? 'text-red-300' : 'text-amber-300')}>
        {critical ? <CircleAlert className="size-4" /> : <TriangleAlert className="size-4" />}
      </div>

      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium truncate">{KIND_LABELS[alert.kind] ?? alert.kind}</span>
          <span className="text-xs text-muted-foreground truncate">{target(alert)}</span>
          {alert.map_name && <span className="text-[11px] text-muted-foreground truncate">{alert.map_name}</span>}
          {alert.occurrences > 1 && (
            <span className="text-[11px] px-1.5 py-0.5 rounded border border-hairline/20 bg-card/40 text-muted-foreground tabular-nums">
              {alert.occurrences}x
            </span>
          )}
          {acknowledged && (
            <span className="text-[11px] px-1.5 py-0.5 rounded border border-hairline/20 bg-card/40 text-muted-foreground">
              Acknowledged
            </span>
          )}
        </div>
        <div className="text-xs text-muted-foreground">{alert.summary}</div>
        <div className="text-[11px] text-muted-foreground">
          {alert.host_name && <span>{alert.host_name} · </span>}
          last seen {relTime(alert.last_seen_at)}
          {alert.first_seen_at !== alert.last_seen_at && <span> · first {relTime(alert.first_seen_at)}</span>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 shrink-0">
        {acknowledged ? (
          <ActionButton icon={Eye} onClick={onUnack} disabled={busy}>Reopen</ActionButton>
        ) : (
          <ActionButton icon={Eye} onClick={onAck} disabled={busy}>Acknowledge</ActionButton>
        )}
        <ActionButton tone="emerald" icon={Check} onClick={onResolve} disabled={busy}>Resolve</ActionButton>
      </div>
    </div>
  )
}

export function AlertsPanel({ token, onCountChange }: {
  token?: string
  onCountChange?: (unresolved: number) => void
}) {
  const [alerts, setAlerts] = useState<AdminAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [showResolved, setShowResolved] = useState(false)
  const [resolveTarget, setResolveTarget] = useState<AdminAlert | null>(null)

  const load = useCallback((signal?: AbortSignal) => {
    if (!token) return
    fetchAdminAlerts(token, { status: showResolved ? 'all' : 'unresolved', limit: 50 }, signal)
      .then((data) => {
        setAlerts(data.items ?? [])
        setError(null)
        onCountChange?.(data.unresolved_count ?? 0)
      })
      .catch((e) => { if (!signal?.aborted) setError(errMessage(e)) })
      .finally(() => { if (!signal?.aborted) setLoading(false) })
  }, [token, showResolved, onCountChange])

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
    return () => controller.abort()
  }, [load])

  useEffect(() => {
    const interval = setInterval(() => load(), REFRESH_MS)
    return () => clearInterval(interval)
  }, [load])

  const run = async (alert: AdminAlert, action: () => Promise<unknown>, message: string) => {
    setBusy(alert.id)
    setError(null)
    try {
      await action()
      setNotice(message)
      load()
    } catch (e) {
      setError(errMessage(e))
    } finally {
      setBusy(null)
    }
  }

  if (!token) return null

  const unresolved = alerts.filter((alert) => alert.status !== 'resolved')
  const visible = showResolved ? alerts : unresolved

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <BellRing className={cn('size-4', unresolved.length > 0 ? 'text-amber-300' : 'text-muted-foreground')} />
          Alerts
          {unresolved.length > 0 && (
            <span className="text-[11px] px-1.5 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-300 tabular-nums">
              {unresolved.length}
            </span>
          )}
        </div>
        <ActionButton onClick={() => setShowResolved((value) => !value)}>
          {showResolved ? 'Hide resolved' : 'Show resolved'}
        </ActionButton>
      </div>

      <Feedback message={error} tone="red" onDismiss={() => setError(null)} />
      <Feedback message={notice} tone="emerald" onDismiss={() => setNotice(null)} />

      {loading && alerts.length === 0 ? (
        <div className="rounded-lg border border-hairline/10 bg-card/20 px-3 py-4 text-xs text-muted-foreground">
          Loading alerts...
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-lg border border-hairline/10 bg-card/20 px-3 py-4 text-xs text-muted-foreground">
          Nothing to action. Failures reported by the hosts show up here.
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((alert) => (
            <AlertRow
              key={alert.id}
              alert={alert}
              busy={busy === alert.id}
              onAck={() => run(alert, () => acknowledgeAdminAlert(token, alert.id), 'Alert acknowledged.')}
              onUnack={() => run(alert, () => unacknowledgeAdminAlert(token, alert.id), 'Alert reopened.')}
              onResolve={() => setResolveTarget(alert)}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!resolveTarget}
        title="Resolve this alert?"
        tone="accent"
        confirmLabel="Resolve"
        withReason
        reasonPlaceholder="What fixed it?"
        busy={busy === resolveTarget?.id}
        message={
          <>
            <p>
              Resolving records that this was dealt with. It does not change anything on the server.
            </p>
            <p className="mt-2 text-muted-foreground">
              If the same failure happens again a new alert opens, so nothing is lost by resolving early.
            </p>
          </>
        }
        onCancel={() => setResolveTarget(null)}
        onConfirm={(reason) => {
          const alert = resolveTarget
          if (!alert) return
          setResolveTarget(null)
          run(alert, () => resolveAdminAlert(token, alert.id, reason), 'Alert resolved.')
        }}
      />
    </div>
  )
}
