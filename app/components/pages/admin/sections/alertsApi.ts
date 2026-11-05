import { apiGet } from '@/app/utils/api'
import type { AdminAlert, AdminAlertsResponse } from '@/app/utils/api'

export async function fetchAdminAlerts(
  accessToken: string,
  params: { status?: string; host?: string; server?: string; kind?: string; limit?: number } = {},
  signal?: AbortSignal,
): Promise<AdminAlertsResponse> {
  const query = new URLSearchParams()
  if (params.status) query.set('status', params.status)
  if (params.host) query.set('host', params.host)
  if (params.server) query.set('server', params.server)
  if (params.kind) query.set('kind', params.kind)
  if (params.limit !== undefined) query.set('limit', String(params.limit))
  const suffix = query.toString() ? `?${query.toString()}` : ''
  return apiGet(`/admin/alerts${suffix}`, { token: accessToken, signal })
}

export async function acknowledgeAdminAlert(accessToken: string, alertId: string, reason?: string): Promise<AdminAlert> {
  return apiGet(`/admin/alerts/${encodeURIComponent(alertId)}/ack`, { token: accessToken, method: 'POST', body: { reason } })
}

export async function unacknowledgeAdminAlert(accessToken: string, alertId: string): Promise<AdminAlert> {
  return apiGet(`/admin/alerts/${encodeURIComponent(alertId)}/unack`, { token: accessToken, method: 'POST' })
}

export async function resolveAdminAlert(accessToken: string, alertId: string, resolution?: string): Promise<AdminAlert> {
  return apiGet(`/admin/alerts/${encodeURIComponent(alertId)}/resolve`, { token: accessToken, method: 'POST', body: { resolution } })
}
