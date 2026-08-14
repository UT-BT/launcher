import { lazy, Suspense, useEffect, useState } from 'react'
import { Cake, ShieldCheck } from 'lucide-react'
import { platformAuth } from '@/app/platform'
import { API_BASE_URL, bearerHeaders } from '@/app/utils/api'
import { getTelemetryConsent, getVisitorId, onTelemetryConsentChange, setTelemetryConsent } from '@/app/utils/telemetry'
import { PRIVACY_POLICY } from '@/app/constants/legal'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { getPrototypeBirthday, setPrototypeBirthday } from '@/app/utils/birthdayPrototype'
import type { BirthdaySettings } from '@/app/utils/api'
const MarkdownBody = lazy(() => import('@/app/components/shared/MarkdownBody').then(m => ({ default: m.MarkdownBody })))

function birthdayText(value: BirthdaySettings | null): string {
  if (!value) return ''
  return `${String(value.day).padStart(2, '0')}.${String(value.month).padStart(2, '0')}`
}

function parseBirthday(value: string): BirthdaySettings | null {
  const match = /^(\d{1,2})\.(\d{1,2})\.?$/.exec(value.trim())
  if (!match) return null
  const day = Number(match[1])
  const month = Number(match[2])
  const probe = new Date(2024, month - 1, day)
  if (probe.getMonth() !== month - 1 || probe.getDate() !== day) return null
  return { day, month, visible: true }
}

export function PrivacySettings() {
  const [consent, setConsent] = useState(getTelemetryConsent())
  const [status, setStatus] = useState<string | null>(null)
  const [policyOpen, setPolicyOpen] = useState(false)
  const [savedBirthday, setSavedBirthday] = useState(getPrototypeBirthday)
  const [birthday, setBirthday] = useState(() => birthdayText(getPrototypeBirthday()))
  const [birthdayVisible, setBirthdayVisible] = useState(() => getPrototypeBirthday()?.visible ?? true)
  const [birthdayStatus, setBirthdayStatus] = useState<string | null>(null)
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
  const saveBirthday = () => {
    const parsed = parseBirthday(birthday)
    if (!parsed) return setBirthdayStatus('Enter a valid date in DD.MM. format.')
    const saved = setPrototypeBirthday({ ...parsed, visible: birthdayVisible })
    setSavedBirthday(saved)
    setBirthdayStatus('Birthday saved locally.')
  }
  const removeBirthday = () => {
    setPrototypeBirthday(null)
    setSavedBirthday(null)
    setBirthday('')
    setBirthdayStatus('Birthday removed.')
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2"><ShieldCheck className="size-5" /> Privacy & Data</h2>
        <p className="text-sm text-muted-foreground mt-1">Control optional usage analytics and exercise your data rights.</p>
      </div>
      <section className="rounded-xl border border-border/50 bg-card/30 p-4 space-y-4">
        <div className="flex items-start gap-3">
          <Cake className="mt-0.5 size-5 shrink-0 text-accent-300" />
          <div>
            <div className="font-medium">Community calendar birthday</div>
            <div className="mt-1 text-sm text-muted-foreground">Optional. Only your day and month are stored and shown; your birth year is never requested.</div>
          </div>
        </div>
        <div className="flex flex-col gap-3 @md/panel:flex-row @md/panel:items-end">
          <div className="space-y-1.5">
            <label htmlFor="privacy-birthday" className="text-xs font-medium text-muted-foreground">Birthday</label>
            <Input id="privacy-birthday" value={birthday} onChange={event => { setBirthday(event.target.value); setBirthdayStatus(null) }} placeholder="DD.MM." inputMode="numeric" className="w-36" />
          </div>
          <label className="inline-flex min-h-9 items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={birthdayVisible} onChange={event => setBirthdayVisible(event.target.checked)} className="size-4 accent-accent-500" />
            Show in calendar
          </label>
          <div className="flex gap-2 @md/panel:ml-auto">
            {savedBirthday && <Button variant="ghost" onClick={removeBirthday}>Remove</Button>}
            <Button onClick={saveBirthday} disabled={!birthday.trim()}>Save</Button>
          </div>
        </div>
        {birthdayStatus && <p className="text-xs text-muted-foreground" role="status">{birthdayStatus}</p>}
      </section>
      <div className="rounded-xl border border-border/50 bg-card/30 p-4 flex flex-col items-start gap-3 @md/panel:flex-row @md/panel:items-center @md/panel:justify-between @md/panel:gap-4">
        <div className="min-w-0"><div className="font-medium">Pseudonymous usage analytics</div><div className="text-sm text-muted-foreground">Off by default. No analytics identifier is created until you accept.</div></div>
        <button
          className={`shrink-0 rounded-lg px-4 py-2 text-sm ${consent === 'granted' ? 'bg-primary text-primary-foreground' : 'border border-border'}`}
          onClick={() => void setTelemetryConsent(consent !== 'granted')}
        >{consent === 'granted' ? 'Enabled' : 'Disabled'}</button>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="flex-1 rounded-lg border border-border px-4 py-2 text-sm whitespace-nowrap @md/panel:flex-none" onClick={() => void exportAccountData()}>Export my usage data</button>
        <button className="flex-1 rounded-lg border border-red-500/40 px-4 py-2 text-sm text-red-300 whitespace-nowrap @md/panel:flex-none" onClick={() => void erase()}>Delete my usage data</button>
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
