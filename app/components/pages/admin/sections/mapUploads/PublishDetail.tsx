import { useCallback, useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { AlertTriangle, Check, CheckCircle2, FolderOpen, Loader2, OctagonX, Radio, Rocket, Send, Server, X, Zap } from 'lucide-react'
import { ApiError, fetchMapUploadPublish, forceActivateMapUploadPublish } from '@/app/utils/api'
import type { Publish, PublishHost } from '@/app/utils/mapUploadTypes'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { ActionButton, ConfirmDialog, Feedback, formatDateTime, relTime } from '../../components/controls'
import { ACTIVATION_LABEL, HOST_STATE_LABEL, PUBLISH_STATE_LABEL, VERSION_MODE_LABEL } from './publishLabels'
import {
  forceActivateFailure, forceAvailability, forceConfirmation, hostProgress, isPublishSettled, publishErrorMessage, publishSteps,
  shouldPollPublish, type ForceConfirmation,
} from './publishState'
import { IconTile, Panel } from './Panel'
import { ToneChip } from './ToneChip'
import { countLabel } from './reportLabels'
import { usePollWhile } from './usePollWhile'

const HOST_TONE: Record<PublishHost['state'], 'emerald' | 'red' | 'muted'> = {
  installed: 'emerald',
  pending: 'muted',
  conflict: 'red',
  error: 'red',
}

function standsOut(host: PublishHost): boolean {
  return host.state === 'conflict' || host.state === 'error'
}

function HostChip({ host }: { host: PublishHost }) {
  const state = HOST_STATE_LABEL[host.state]
  return <ToneChip tone={state.tone} dot pulse={host.state === 'pending'}>{state.label}</ToneChip>
}

function HostCard({ host }: { host: PublishHost }) {
  return (
    <li className={cn(
      'flex items-start gap-3 rounded-lg border px-3 py-2.5',
      standsOut(host) ? 'border-red-500/30 bg-red-500/[0.07]' : 'border-hairline/5 bg-hairline/[0.02]',
    )}>
      <IconTile icon={host.state === 'installed' ? CheckCircle2 : host.state === 'pending' ? Server : OctagonX} tone={HOST_TONE[host.state]} size="sm" />
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-center justify-between gap-2">
          <span className="break-all text-sm font-medium text-foreground">{host.host}</span>
          <HostChip host={host} />
        </div>
        {host.detail && <p className={cn('break-words text-xs', standsOut(host) ? 'text-red-300' : 'text-muted-foreground')}>{host.detail}</p>}
        <p className="text-[11px] text-muted-foreground/80" title={formatDateTime(host.updated_at)}>updated {relTime(host.updated_at)}</p>
      </div>
    </li>
  )
}

function HostsPanel({ hosts }: { hosts: PublishHost[] }) {
  const { installed, total } = hostProgress(hosts)
  const percent = total === 0 ? 0 : Math.round((installed / total) * 100)
  return (
    <Panel
      title="Hosts"
      icon={Server}
      meta={total === 0 ? 'No host has been asked for this map yet.' : `${installed} of ${total} have every file`}
      actions={total > 0 && (
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-hairline/10" aria-hidden>
            <div className="h-full rounded-full bg-emerald-500 transition-[width] duration-300" style={{ width: `${percent}%` }} />
          </div>
          <span className="text-xs font-medium tabular-nums text-muted-foreground">{percent}%</span>
        </div>
      )}
    >
      {total > 0 && (
        <ul className="grid gap-2 p-3 @xl/publish:grid-cols-2 @4xl/publish:grid-cols-3">
          {hosts.map((host) => <HostCard key={host.host} host={host} />)}
        </ul>
      )}
    </Panel>
  )
}

function StepTracker({ publish }: { publish: Publish }) {
  const steps = publishSteps(publish.state)
  if (!steps) return null
  return (
    <ol className="flex items-start" aria-label="Publish progress">
      {steps.map((step, index) => (
        <li key={step.state} className="flex flex-1 items-start last:flex-none">
          <div className="flex flex-col items-center gap-1.5">
            <span className={cn(
              'inline-flex size-7 items-center justify-center rounded-full border text-[11px] font-semibold',
              step.status === 'done' && 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300',
              step.status === 'current' && 'border-accent-500/60 bg-accent-500/20 text-accent-200 shadow-[0_0_12px_rgb(var(--accent-glow-rgb)/0.35)]',
              step.status === 'todo' && 'border-hairline/10 bg-hairline/5 text-muted-foreground',
            )}>
              {step.status === 'done' ? <Check className="size-3.5" /> : step.status === 'current' ? <Loader2 className="size-3.5 animate-spin" /> : index + 1}
            </span>
            <span className={cn(
              'hidden whitespace-nowrap text-[11px] @2xl/publish:block',
              step.status === 'current' ? 'font-medium text-foreground' : 'text-muted-foreground',
            )}>{step.label}</span>
          </div>
          {index < steps.length - 1 && (
            <span aria-hidden className={cn('mx-1.5 mt-3.5 h-px flex-1', step.status === 'done' ? 'bg-emerald-500/40' : 'bg-hairline/10')} />
          )}
        </li>
      ))}
    </ol>
  )
}

function useNowAt(iso: string | null): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!iso) return
    const wait = Math.max(0, Date.parse(iso) - Date.now())
    const timer = setTimeout(() => setNow(Date.now()), wait + 250)
    return () => clearTimeout(timer)
  }, [iso])
  return now
}

function ForcePanel({ publish, onForce }: { publish: Publish; onForce: () => void }) {
  const availability = forceAvailability(publish, useNowAt(publish.force_available_at))
  if (availability.kind === 'closed') return null
  const stragglerCount = forceConfirmation(publish).hosts.length
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/[0.07] px-3 py-2.5">
      <AlertTriangle className="size-4 shrink-0 text-amber-300" />
      <p className="min-w-0 flex-1 text-sm text-amber-100">
        {countLabel(stragglerCount, 'host')} not confirmed yet.{' '}
        <span className="text-amber-200/80">
          {availability.kind === 'available'
            ? 'You can force the map live without them.'
            : availability.opensAt
              ? <span title={formatDateTime(availability.opensAt)}>Force live opens {relTime(availability.opensAt)}.</span>
              : 'Force live opens 15 minutes after the hosts were asked.'}
        </span>
      </p>
      <ActionButton tone="red" icon={Zap} disabled={availability.kind !== 'available'} onClick={onForce}>Force live</ActionButton>
    </div>
  )
}

function StatusLine({ publish }: { publish: Publish }) {
  if (publish.state === 'failed') {
    return (
      <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/[0.07] px-3 py-2.5 text-sm text-red-200">
        <OctagonX className="mt-0.5 size-4 shrink-0" />
        <span className="break-words">This publish failed: {publish.error || 'no reason was given.'}</span>
      </div>
    )
  }
  if (publish.state === 'active') {
    return (
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-emerald-300">
        <Radio className="size-4" />
        <span title={formatDateTime(publish.activated_at)}>Live since {relTime(publish.activated_at)}</span>
        {publish.activation && <span className="text-emerald-300/70">· {ACTIVATION_LABEL[publish.activation]}</span>}
        {publish.activated_by && (
          <span className="inline-flex items-center gap-2 text-muted-foreground">by <PlayerInfo userId={publish.activated_by.id} alias={publish.activated_by.alias} size="sm" /></span>
        )}
      </p>
    )
  }
  return (
    <p className="text-sm text-muted-foreground">
      {publish.state === 'distributing'
        ? 'Waiting for every host to install the map. It goes live by itself once they all have it.'
        : 'Getting the files ready for the hosts. This view updates by itself.'}
    </p>
  )
}

function ForceLiveDialog({ confirmation, error, busy, onConfirm, onCancel }: {
  confirmation: ForceConfirmation | null
  error: string | null
  busy: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <ConfirmDialog
      open={!!confirmation}
      title="Force the map live"
      message={confirmation && (
        <div className="space-y-2">
          <p>The map goes live now, without these hosts. Players on them cannot load it until they catch up.</p>
          <ul className="space-y-1">
            {confirmation.hosts.map((host) => (
              <li key={host.host} className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-foreground">{host.host}</span>
                <HostChip host={host} />
                {host.detail && <span className="text-xs break-words">{host.detail}</span>}
              </li>
            ))}
          </ul>
          <Feedback message={error} tone="red" />
        </div>
      )}
      confirmLabel="Force live"
      tone="red"
      busy={busy}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  )
}

export function PublishDetail({ token, publishId, onClose, onOpenDraft, onChanged }: {
  token: string
  publishId: number
  onClose: () => void
  onOpenDraft: (draftId: number) => void
  onChanged: () => void
}) {
  const [publish, setPublish] = useState<Publish | null>(null)
  const [missing, setMissing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState<ForceConfirmation | null>(null)
  const [forceError, setForceError] = useState<string | null>(null)
  const [forcing, setForcing] = useState(false)

  const load = useCallback(async (signal?: AbortSignal): Promise<Publish | null> => {
    try {
      const next = await fetchMapUploadPublish(token, publishId, signal)
      setPublish(next)
      setError(null)
      return next
    } catch (e) {
      if (signal?.aborted) return null
      if (e instanceof ApiError && e.status === 404) {
        setPublish(null)
        setMissing(true)
      }
      setError(publishErrorMessage(e))
      return null
    }
  }, [token, publishId])

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])

  const poll = useCallback(async (signal: AbortSignal) => { await load(signal) }, [load])
  usePollWhile(shouldPollPublish(publish, missing), poll)

  const openForce = () => {
    if (!publish) return
    setForceError(null)
    setConfirmation(forceConfirmation(publish))
  }

  const force = async () => {
    if (!confirmation) return
    setForcing(true)
    setForceError(null)
    try {
      setPublish(await forceActivateMapUploadPublish(token, confirmation.publishId, confirmation.payload))
      setConfirmation(null)
      onChanged()
    } catch (e) {
      const failure = forceActivateFailure(e)
      const fresh = await load()
      if (failure.askAgain && fresh && forceAvailability(fresh, Date.now()).kind === 'available') {
        setConfirmation(forceConfirmation(fresh))
        setForceError(failure.message)
      } else {
        setConfirmation(null)
        if (!failure.askAgain) setError(failure.message)
        onChanged()
      }
    } finally {
      setForcing(false)
    }
  }

  const state = publish && PUBLISH_STATE_LABEL[publish.state]

  return (
    <section aria-label="Publish" className="@container/publish space-y-4">
      <Feedback message={error} tone="red" onDismiss={() => setError(null)} />
      {!publish ? (
        !error && <div className="h-40 rounded-xl border border-hairline/5 bg-hairline/[0.03] animate-pulse" aria-busy aria-label="Loading the publish" />
      ) : (
        <>
          <div className="rounded-xl border border-hairline/5 bg-card/30">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-hairline/5 p-4">
              <div className="flex min-w-0 items-center gap-3">
                <IconTile icon={publish.state === 'active' ? Rocket : publish.state === 'failed' ? OctagonX : Send} tone={state?.tone ?? 'accent'} />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <h2 className="break-all text-lg font-bold leading-tight text-foreground">{publish.map_name}</h2>
                    {state && <ToneChip tone={state.tone} dot pulse={!isPublishSettled(publish.state)}>{state.label}</ToneChip>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <span title={formatDateTime(publish.created_at)}>Started {relTime(publish.created_at)}</span>
                    {' · '}
                    {publish.version.old_map
                      ? <>Replaces <span className="font-medium text-foreground break-all">{publish.version.old_map}</span>{publish.version.mode && ` (${VERSION_MODE_LABEL[publish.version.mode]})`}</>
                      : 'A new map'}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <ActionButton icon={FolderOpen} onClick={() => onOpenDraft(publish.draft_id)}>Open draft</ActionButton>
                <ActionButton icon={X} onClick={onClose}>Close</ActionButton>
              </div>
            </div>
            <div className="space-y-4 p-4">
              <StepTracker publish={publish} />
              <StatusLine publish={publish} />
              <ForcePanel publish={publish} onForce={openForce} />
            </div>
          </div>
          <HostsPanel hosts={publish.hosts} />
        </>
      )}
      {!publish && error && <ActionButton icon={X} onClick={onClose}>Close</ActionButton>}
      <ForceLiveDialog
        confirmation={publish?.state === 'distributing' ? confirmation : null}
        error={forceError}
        busy={forcing}
        onConfirm={() => { void force() }}
        onCancel={() => setConfirmation(null)}
      />
    </section>
  )
}
