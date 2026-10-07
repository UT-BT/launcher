import { useCallback, useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { FolderOpen, Loader2, OctagonX, X, Zap } from 'lucide-react'
import { ApiError, fetchMapUploadPublish, forceActivateMapUploadPublish } from '@/app/utils/api'
import type { Publish, PublishHost } from '@/app/utils/mapUploadTypes'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import {
  DataTableShell, DataTableHeaderRow, DataTableHeaderCell, DataTableRow, DataTableCell, DataTableEmpty, type ResponsiveColumn,
} from '@/app/components/shared/DataTable'
import { ActionButton, ConfirmDialog, Feedback, formatDateTime, relTime } from '../../components/controls'
import { PANEL_LABEL } from '../../components/shared'
import { ACTIVATION_LABEL, HOST_STATE_LABEL, PUBLISH_STATE_LABEL, VERSION_MODE_LABEL } from './publishLabels'
import {
  forceActivateFailure, forceAvailability, forceConfirmation, publishErrorMessage, shouldPollPublish, type ForceConfirmation,
} from './publishState'
import { ToneChip } from './ToneChip'
import { countLabel } from './reportLabels'
import { usePollWhile } from './usePollWhile'

const HOST_COLUMNS: ResponsiveColumn[] = [
  { id: 'host', width: '10rem', required: true },
  { id: 'state', width: '8rem', required: true },
  { id: 'detail', width: '20rem', priority: 60 },
  { id: 'updated', width: '8rem', priority: 40 },
]

function standsOut(host: PublishHost): boolean {
  return host.state === 'conflict' || host.state === 'error'
}

function HostChip({ host }: { host: PublishHost }) {
  const state = HOST_STATE_LABEL[host.state]
  return <ToneChip tone={state.tone}>{state.label}</ToneChip>
}

function HostDetail({ host }: { host: PublishHost }) {
  if (!host.detail) return <span className="text-xs text-muted-foreground">—</span>
  return <span className={cn('text-xs break-words', standsOut(host) ? 'text-red-300' : 'text-muted-foreground')}>{host.detail}</span>
}

function HostsTable({ hosts }: { hosts: PublishHost[] }) {
  const [resolved, setResolved] = useState<Set<string> | null>(null)
  const handleResolve = useCallback((ids: Set<string>) => setResolved(ids), [])
  const isVisible = (id: string) => !resolved || resolved.has(id)
  const visibleCount = HOST_COLUMNS.filter((c) => isVisible(c.id)).length
  const rowClass = (host: PublishHost) => (standsOut(host) ? 'bg-red-500/[0.06]' : undefined)

  const compactRows = (
    <ul className="space-y-2">
      {hosts.map((host) => (
        <li key={host.host} className={cn('rounded-lg border px-4 py-3 space-y-1', standsOut(host) ? 'border-red-500/30 bg-red-500/10' : 'border-hairline/10 bg-card/30')}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-foreground break-all">{host.host}</span>
            <HostChip host={host} />
          </div>
          <HostDetail host={host} />
          <p className="text-xs text-muted-foreground" title={formatDateTime(host.updated_at)}>updated {relTime(host.updated_at)}</p>
        </li>
      ))}
    </ul>
  )

  return (
    <section aria-label="Hosts" className="space-y-2">
      <h3 className={PANEL_LABEL}>Hosts</h3>
      <DataTableShell
        className="!flex-none"
        responsive={{ columns: HOST_COLUMNS, onResolve: handleResolve, compactContent: compactRows, compactAriaLabel: 'Hosts' }}
      >
        <DataTableHeaderRow>
          <DataTableHeaderCell width="10rem">Host</DataTableHeaderCell>
          <DataTableHeaderCell width="8rem">State</DataTableHeaderCell>
          {isVisible('detail') && <DataTableHeaderCell width="20rem">Detail</DataTableHeaderCell>}
          {isVisible('updated') && <DataTableHeaderCell width="8rem">Last update</DataTableHeaderCell>}
        </DataTableHeaderRow>
        <tbody>
          {hosts.length === 0 ? (
            <DataTableEmpty colSpan={visibleCount} message="No host has been asked for this map yet." />
          ) : hosts.map((host) => (
            <DataTableRow key={host.host} className={rowClass(host)}>
              <DataTableCell><span className="text-sm font-medium text-foreground break-all">{host.host}</span></DataTableCell>
              <DataTableCell><HostChip host={host} /></DataTableCell>
              {isVisible('detail') && <DataTableCell><HostDetail host={host} /></DataTableCell>}
              {isVisible('updated') && (
                <DataTableCell><span className="text-xs text-muted-foreground" title={formatDateTime(host.updated_at)}>{relTime(host.updated_at)}</span></DataTableCell>
              )}
            </DataTableRow>
          ))}
        </tbody>
      </DataTableShell>
    </section>
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
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2">
      <p className="text-sm text-amber-200">
        {countLabel(stragglerCount, 'host')} not confirmed yet.{' '}
        {availability.kind === 'available'
          ? 'You can force the map live without them.'
          : availability.opensAt
            ? <span title={formatDateTime(availability.opensAt)}>Force live opens {relTime(availability.opensAt)}.</span>
            : 'Force live opens 15 minutes after the hosts were asked.'}
      </p>
      <ActionButton tone="red" icon={Zap} disabled={availability.kind !== 'available'} onClick={onForce}>Force live</ActionButton>
    </div>
  )
}

function StatusLine({ publish }: { publish: Publish }) {
  if (publish.state === 'failed') {
    return (
      <div role="alert" className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
        <OctagonX className="size-4 shrink-0 mt-0.5" />
        <span className="break-words">This publish failed: {publish.error || 'no reason was given.'}</span>
      </div>
    )
  }
  if (publish.state === 'active') {
    return (
      <p className="flex flex-wrap items-center gap-2 text-sm text-emerald-300">
        <span title={formatDateTime(publish.activated_at)}>Live since {relTime(publish.activated_at)}</span>
        {publish.activation && <span>· {ACTIVATION_LABEL[publish.activation]}</span>}
        {publish.activated_by && (
          <span className="inline-flex items-center gap-2">by <PlayerInfo userId={publish.activated_by.id} alias={publish.activated_by.alias} size="sm" /></span>
        )}
      </p>
    )
  }
  return (
    <p className="inline-flex items-center gap-2 text-sm text-amber-300">
      <Loader2 className="size-4 animate-spin" />
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
    <section aria-label="Publish" className="space-y-3">
      <Feedback message={error} tone="red" onDismiss={() => setError(null)} />
      {!publish ? (
        !error && <p className="inline-flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Loading the publish…</p>
      ) : (
        <>
          <div className="rounded-lg border border-hairline/10 bg-card/30 p-4 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold text-foreground break-all">{publish.map_name}</h2>
                  {state && <ToneChip tone={state.tone}>{state.label}</ToneChip>}
                </div>
                <p className="text-xs text-muted-foreground">
                  <span title={formatDateTime(publish.created_at)}>Started {relTime(publish.created_at)}</span>
                  {' · '}
                  {publish.version.old_map
                    ? <>Replaces <span className="font-medium text-foreground break-all">{publish.version.old_map}</span>{publish.version.mode && ` (${VERSION_MODE_LABEL[publish.version.mode]})`}</>
                    : 'A new map'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <ActionButton icon={FolderOpen} onClick={() => onOpenDraft(publish.draft_id)}>Open draft</ActionButton>
                <ActionButton icon={X} onClick={onClose}>Close</ActionButton>
              </div>
            </div>
            <StatusLine publish={publish} />
            <ForcePanel publish={publish} onForce={openForce} />
          </div>
          <HostsTable hosts={publish.hosts} />
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
