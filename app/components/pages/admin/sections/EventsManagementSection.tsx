import { useCallback, useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Users2, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/app/components/ui/input'
import { Button } from '@/app/components/ui/button'
import { Modal } from '@/app/components/ui/modal'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { PlayerSearchInput } from '@/app/components/pages/teams/PlayerSearchInput'
import { EventStatusBadge, formatEventDateTime, formatTeamSize } from '@/app/components/pages/events/eventsShared'
import {
  createEvent, updateEvent, deleteEvent, fetchEvent, fetchEvents, fetchEventManagers, grantEventManager, revokeEventManager,
  eventErrorMessage, type AdminEventInput, type EventDetail, type EventManager, type EventStatus, type EventSummary,
} from '@/app/utils/api'
import { ActionButton, AdminSelect, ConfirmDialog, Feedback } from '../components/controls'
import { PANEL_LABEL } from '../components/shared'
import type { AdminSectionProps } from '../types'

const TEXTAREA_CLASS = 'flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'

const STATUS_OPTIONS: { value: EventStatus; label: string }[] = [
  { value: 'draft', label: 'Draft (hidden)' },
  { value: 'announced', label: 'Announced (signups from dates)' },
  { value: 'signups_open', label: 'Signups open (forced)' },
  { value: 'signups_closed', label: 'Signups closed' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' },
]

interface EventForm {
  name: string
  slug: string
  summary: string
  description: string
  rules: string
  teamSize: string
  bracketType: string
  status: EventStatus
  signupOpensAt: string
  signupClosesAt: string
  startsAt: string
  endsAt: string
  maxTeams: string
}

const EMPTY_FORM: EventForm = {
  name: '', slug: '', summary: '', description: '', rules: '',
  teamSize: '2', bracketType: '', status: 'draft',
  signupOpensAt: '', signupClosesAt: '', startsAt: '', endsAt: '', maxTeams: '',
}

function eventTsToLocalInput(ts: string | null): string {
  if (!ts) return ''
  const d = new Date(`${ts.replace(' ', 'T')}Z`)
  if (isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function localInputToIso(value: string): string | null {
  if (!value) return null
  const d = new Date(value)
  if (isNaN(d.getTime())) return null
  return d.toISOString()
}

function formFromEvent(event: EventDetail): EventForm {
  return {
    name: event.name,
    slug: event.slug,
    summary: event.summary ?? '',
    description: event.description ?? '',
    rules: event.rules ?? '',
    teamSize: String(event.team_size),
    bracketType: event.bracket_type ?? '',
    status: event.status,
    signupOpensAt: eventTsToLocalInput(event.signup_opens_at),
    signupClosesAt: eventTsToLocalInput(event.signup_closes_at),
    startsAt: eventTsToLocalInput(event.starts_at),
    endsAt: eventTsToLocalInput(event.ends_at),
    maxTeams: event.max_teams != null ? String(event.max_teams) : '',
  }
}

function formToInput(form: EventForm): AdminEventInput {
  return {
    name: form.name.trim(),
    slug: form.slug.trim(),
    summary: form.summary.trim() || null,
    description: form.description.trim() || null,
    rules: form.rules.trim() || null,
    team_size: Number(form.teamSize),
    bracket_type: form.bracketType.trim() || null,
    status: form.status,
    signup_opens_at: localInputToIso(form.signupOpensAt),
    signup_closes_at: localInputToIso(form.signupClosesAt),
    starts_at: localInputToIso(form.startsAt),
    ends_at: localInputToIso(form.endsAt),
    max_teams: form.maxTeams.trim() ? Number(form.maxTeams) : null,
  }
}

function fieldLabel(text: string) {
  return <label className={PANEL_LABEL}>{text}</label>
}

function EventFormModal({ open, onClose, token, editing, onSaved }: {
  open: boolean
  onClose: () => void
  token: string
  editing: EventSummary | null
  onSaved: () => void
}) {
  const [form, setForm] = useState<EventForm>(EMPTY_FORM)
  const [busy, setBusy] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    if (!editing) {
      setForm(EMPTY_FORM)
      return
    }
    let cancelled = false
    setDetailLoading(true)
    fetchEvent(token, editing.slug)
      .then((detail) => { if (!cancelled) setForm(formFromEvent(detail)) })
      .catch((e) => { if (!cancelled) setError(eventErrorMessage(e)) })
      .finally(() => { if (!cancelled) setDetailLoading(false) })
    return () => { cancelled = true }
  }, [open, editing, token])

  const set = <K extends keyof EventForm>(key: K, value: EventForm[K]) => setForm((prev) => ({ ...prev, [key]: value }))

  const slugChanged = !!editing && form.slug.trim() !== editing.slug

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      if (editing) {
        await updateEvent(token, editing.slug, formToInput(form))
      } else {
        await createEvent(token, formToInput(form))
      }
      onSaved()
      onClose()
    } catch (e) {
      setError(eventErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={editing ? `Edit ${editing.name}` : 'Create event'}
      offsetSidebar
      maxWidth="42rem"
      footer={
        <div className="p-4 border-t border-border bg-muted/50 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={save} disabled={busy || detailLoading || !form.name.trim() || !form.slug.trim() || !form.teamSize.trim()}>
            {busy ? 'Saving…' : editing ? 'Save changes' : 'Create event'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Feedback message={error} tone="red" onDismiss={() => setError(null)} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            {fieldLabel('Name')}
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="2v2 Cup 2026" />
          </div>
          <div className="space-y-1.5">
            {fieldLabel('Slug (URL key)')}
            <Input value={form.slug} onChange={(e) => set('slug', e.target.value)} placeholder="2v2-cup-2026" />
            {slugChanged && (
              <p className="text-[11px] text-amber-300 flex items-center gap-1">
                <TriangleAlert className="size-3 shrink-0" /> Changing the slug breaks existing links to this event.
              </p>
            )}
          </div>
        </div>
        <div className="space-y-1.5">
          {fieldLabel('Summary')}
          <Input value={form.summary} onChange={(e) => set('summary', e.target.value)} placeholder="Short one-line teaser" />
        </div>
        <div className="space-y-1.5">
          {fieldLabel('Description (markdown)')}
          <textarea className={TEXTAREA_CLASS} rows={5} value={form.description} onChange={(e) => set('description', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          {fieldLabel('Rules (markdown)')}
          <textarea className={TEXTAREA_CLASS} rows={4} value={form.rules} onChange={(e) => set('rules', e.target.value)} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="space-y-1.5">
            {fieldLabel('Team size')}
            <Input type="number" min={1} value={form.teamSize} onChange={(e) => set('teamSize', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            {fieldLabel('Max teams')}
            <Input type="number" min={1} value={form.maxTeams} onChange={(e) => set('maxTeams', e.target.value)} placeholder="Uncapped" />
          </div>
          <div className="space-y-1.5">
            {fieldLabel('Bracket type')}
            <Input value={form.bracketType} onChange={(e) => set('bracketType', e.target.value)} placeholder="TBD" />
          </div>
          <div className="space-y-1.5">
            {fieldLabel('Status')}
            <AdminSelect
              value={form.status}
              onChange={(v) => set('status', v as EventStatus)}
              options={STATUS_OPTIONS}
              ariaLabel="Event status"
              className="w-full"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {([
            ['signupOpensAt', 'Signups open'],
            ['signupClosesAt', 'Signups close'],
            ['startsAt', 'Event starts'],
            ['endsAt', 'Event ends'],
          ] as const).map(([key, label]) => (
            <div key={key} className="space-y-1.5">
              {fieldLabel(`${label} (your local time)`)}
              <Input type="datetime-local" style={{ colorScheme: 'dark' }} value={form[key]} onChange={(e) => set(key, e.target.value)} />
            </div>
          ))}
        </div>
      </div>
    </Modal>
  )
}

function ManagersModal({ open, onClose, token, event }: {
  open: boolean
  onClose: () => void
  token: string
  event: EventSummary | null
}) {
  const [managers, setManagers] = useState<EventManager[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<EventManager | null>(null)

  useEffect(() => {
    if (!open || !event) return
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchEventManagers(token, event.slug)
      .then((items) => { if (!cancelled) setManagers(items) })
      .catch((e) => { if (!cancelled) setError(eventErrorMessage(e)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [open, event, token])

  if (!event) return null

  const grant = async (userId: string) => {
    setBusy(true)
    setError(null)
    try {
      setManagers(await grantEventManager(token, event.slug, userId))
    } catch (e) {
      setError(eventErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const revoke = async (userId: string) => {
    setBusy(true)
    setError(null)
    try {
      setManagers(await revokeEventManager(token, event.slug, userId))
      setRevokeTarget(null)
    } catch (e) {
      setError(eventErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal isOpen={open} onClose={onClose} title={`Managers — ${event.name}`} offsetSidebar maxWidth="30rem">
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Managers can moderate this event's teams, volunteers and LFP list without staff access. Admins and moderators always can.
        </p>
        <Feedback message={error} tone="red" onDismiss={() => setError(null)} />
        <div className="space-y-2">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : managers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No managers assigned.</p>
          ) : (
            managers.map((m) => (
              <div key={m.user} className="flex items-center justify-between gap-2 rounded-md border border-hairline/10 bg-card/30 px-3 py-2">
                <PlayerInfo userId={m.user} alias={m.alias} size="sm" />
                <ActionButton tone="red" icon={Trash2} disabled={busy} onClick={() => setRevokeTarget(m)}>Revoke</ActionButton>
              </div>
            ))
          )}
        </div>
        <div className="space-y-1.5">
          {fieldLabel('Add manager')}
          <PlayerSearchInput
            accessToken={token}
            disabled={busy}
            excludeIds={new Set(managers.map((m) => m.user))}
            onPick={(player) => { void grant(player.id) }}
            placeholder="Search players to add as manager…"
          />
        </div>
      </div>
      <ConfirmDialog
        open={!!revokeTarget}
        title="Revoke manager"
        message={`Remove ${revokeTarget?.alias ?? revokeTarget?.user} as a manager of ${event.name}?`}
        confirmLabel="Revoke"
        tone="red"
        busy={busy}
        onConfirm={() => { if (revokeTarget) void revoke(revokeTarget.user) }}
        onCancel={() => setRevokeTarget(null)}
      />
    </Modal>
  )
}

export function EventsManagementSection({ userProfile }: AdminSectionProps) {
  const token = userProfile?.accessToken ?? ''

  const [events, setEvents] = useState<EventSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<EventSummary | null>(null)
  const [managersFor, setManagersFor] = useState<EventSummary | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<EventSummary | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    fetchEvents(token)
      .then(setEvents)
      .catch((e) => setError(eventErrorMessage(e)))
      .finally(() => setLoading(false))
  }, [token])

  useEffect(() => { load() }, [load])

  const remove = async (event: EventSummary) => {
    setBusy(true)
    setError(null)
    try {
      await deleteEvent(token, event.slug)
      setDeleteTarget(null)
      load()
    } catch (e) {
      setError(eventErrorMessage(e))
      setDeleteTarget(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Events</h2>
          <p className="text-xs text-muted-foreground">Create cups, control signups and assign per-event managers.</p>
        </div>
        <ActionButton icon={Plus} onClick={() => { setEditing(null); setFormOpen(true) }}>New event</ActionButton>
      </div>

      <Feedback message={error} tone="red" onDismiss={() => setError(null)} />

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading events…</p>
      ) : events.length === 0 ? (
        <p className="text-sm text-muted-foreground">No events yet. Create the first one.</p>
      ) : (
        <div className="space-y-2">
          {events.map((event) => (
            <div key={event.id} className="rounded-lg border border-hairline/10 bg-card/30 px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-foreground">{event.name}</span>
                  <EventStatusBadge event={event} />
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  <code className="text-[11px]">{event.slug}</code>
                  <span>{formatTeamSize(event.team_size)}</span>
                  <span>{event.team_count} team{event.team_count === 1 ? '' : 's'}</span>
                  {event.signup_closes_at && <span>signups close {formatEventDateTime(event.signup_closes_at)}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <ActionButton icon={Pencil} onClick={() => { setEditing(event); setFormOpen(true) }}>Edit</ActionButton>
                <ActionButton icon={Users2} onClick={() => setManagersFor(event)}>Managers</ActionButton>
                <ActionButton tone="red" icon={Trash2} onClick={() => setDeleteTarget(event)} title={event.team_count > 0 ? 'Only events without teams can be deleted' : undefined} />
              </div>
            </div>
          ))}
        </div>
      )}

      <EventFormModal open={formOpen} onClose={() => setFormOpen(false)} token={token} editing={editing} onSaved={load} />
      <ManagersModal open={!!managersFor} onClose={() => setManagersFor(null)} token={token} event={managersFor} />
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete event"
        message={
          <span>
            Permanently delete <span className={cn('font-medium text-foreground')}>{deleteTarget?.name}</span>?
            Events with signed-up teams cannot be deleted — archive them instead.
          </span>
        }
        confirmLabel="Delete"
        tone="red"
        busy={busy}
        onConfirm={() => { if (deleteTarget) void remove(deleteTarget) }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
