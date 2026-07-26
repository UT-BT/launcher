import { lazy, Suspense, useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { platformAuth } from '@/app/platform'
import { API_BASE_URL, bearerHeaders } from '@/app/utils/api'
import { getTelemetryConsent, getVisitorId, onTelemetryConsentChange, setTelemetryConsent } from '@/app/utils/telemetry'
import { PRIVACY_POLICY } from '@/app/constants/legal'
const MarkdownBody = lazy(() => import('@/app/components/shared/MarkdownBody').then(m => ({ default: m.MarkdownBody })))

export function PrivacySettings() {
  const [consent, setConsent] = useState(getTelemetryConsent())
  const [status, setStatus] = useState<string | null>(null)
  const [policyOpen, setPolicyOpen] = useState(false)
  useEffect(() => onTelemetryConsentChange(setConsent), [])

  const exportAccountData = async () => {
    setStatus('Preparing export…')
    const profile = await platformAuth.getProfile()
    if (!profile) return setStatus('Sign in to export account-linked telemetry.')
    const response = await fetch(`${API_BASE_URL}/launcher/activity/me`, { headers: bearerHeaders(profile.accessToken) })
    if (!response.ok) return setStatus('Export failed. Contact hello@utbt.net if this continues.')
    const body = await response.json()
    const blob = new Blob([JSON.stringify(body.data || {}, null, 2)], { type: 'application/json' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'utbt-usage-data.json'
    link.click()
    URL.revokeObjectURL(link.href)
    setStatus('Export downloaded.')
  }
  const erase = async () => {
    const profile = await platformAuth.getProfile()
    const visitor = getVisitorId()
    if (profile) {
      await fetch(`${API_BASE_URL}/launcher/activity/me`, { method: 'DELETE', headers: bearerHeaders(profile.accessToken) })
    } else if (visitor) {
      await fetch(`${API_BASE_URL}/launcher/activity/visitor`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ visitor_id: visitor }),
      })
    }
    await setTelemetryConsent(false)
    setStatus('Raw usage data deleted where identifiable. Anonymous aggregate statistics cannot identify you.')
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2"><ShieldCheck className="size-5" /> Privacy & Data</h2>
        <p className="text-sm text-muted-foreground mt-1">Control optional usage analytics and exercise your data rights.</p>
      </div>
      <div className="rounded-xl border border-border/50 bg-card/30 p-4 flex items-center justify-between gap-4">
        <div><div className="font-medium">Pseudonymous usage analytics</div><div className="text-sm text-muted-foreground">Off by default. No analytics identifier is created until you accept.</div></div>
        <button
          className={`rounded-lg px-4 py-2 text-sm ${consent === 'granted' ? 'bg-primary text-primary-foreground' : 'border border-border'}`}
          onClick={() => void setTelemetryConsent(consent !== 'granted')}
        >{consent === 'granted' ? 'Enabled' : 'Disabled'}</button>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="rounded-lg border border-border px-4 py-2 text-sm" onClick={() => void exportAccountData()}>Export my usage data</button>
        <button className="rounded-lg border border-red-500/40 px-4 py-2 text-sm text-red-300" onClick={() => void erase()}>Delete my usage data</button>
      </div>
      {status && <p className="text-sm text-muted-foreground">{status}</p>}
      <details className="rounded-xl border border-border/50 p-4" onToggle={(event) => setPolicyOpen(event.currentTarget.open)}>
        <summary className="cursor-pointer font-medium">Privacy Policy</summary>
        {policyOpen && (
          <Suspense fallback={<div className="mt-4 h-24 rounded bg-hairline/5 animate-pulse" />}>
            <MarkdownBody className="mt-4 text-sm">{PRIVACY_POLICY}</MarkdownBody>
          </Suspense>
        )}
      </details>
    </div>
  )
}
