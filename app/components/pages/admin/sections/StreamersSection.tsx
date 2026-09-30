import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2, TriangleAlert, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/app/components/ui/input'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { PlayerSearchInput } from '@/app/components/pages/teams/PlayerSearchInput'
import {
  fetchStreamerRoster, fetchRosterSuggestions, putRosterStreamer, removeRosterStreamer, eventErrorMessage,
  type RosterStreamer, type RosterSuggestion,
} from '@/app/utils/api'
import { ActionButton, ConfirmDialog, Feedback, formatDateTime } from '../components/controls'
import { PANEL_LABEL } from '../components/shared'
import { TONE_CHIP } from '../components/tone'
import type { AdminSectionProps } from '../types'
import { ROSTER_NOTE_MAX_LENGTH, assignmentLine, twitchChannelLabel } from './streamerRoster'

function nameOf(member: { display_name: string | null; user_id: string }): string {
  return member.display_name ?? member.user_id
}

function TwitchChannel({ url }: { url: string | null }) {
  if (!url) {
    return (
      <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-medium', TONE_CHIP.amber)}>
        <TriangleAlert className="size-3" />
        No Twitch channel
      </span>
    )
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex min-w-0 items-center gap-1 text-[11px] text-purple-300 hover:text-purple-200 break-all"
    >
      <ExternalLink className="size-3 shrink-0" />
      {twitchChannelLabel(url)}
    </a>
  )
}

function NoteEditor({ member, busy, onSave }: {
  member: RosterStreamer
  busy: boolean
  onSave: (note: string | null) => void
}) {
  const [draft, setDraft] = useState(member.note ?? '')
  useEffect(() => { setDraft(member.note ?? '') }, [member.note])

  const next = draft.trim() || null
  const dirty = next !== (member.note ?? null)

  return (
    <form
      className="flex w-full items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (dirty) onSave(next)
      }}
    >
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Note (optional)"
        aria-label={`Note for ${nameOf(member)}`}
        maxLength={ROSTER_NOTE_MAX_LENGTH}
        disabled={busy}
        className="h-9 min-w-0 flex-1"
      />
      <button
        type="submit"
        disabled={!dirty || busy}
        className="h-9 px-3 shrink-0 rounded-md text-xs font-medium border border-accent-500/40 bg-accent-500/15 text-accent-200 cursor-pointer hover:brightness-125 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:brightness-100"
      >
        Save note
      </button>
    </form>
  )
}

function RosterRow({ member, busy, onSaveNote, onRemove }: {
  member: RosterStreamer
  busy: boolean
  onSaveNote: (note: string | null) => void
  onRemove: () => void
}) {
  return (
    <li
      aria-label={nameOf(member)}
      className="rounded-lg border border-hairline/10 bg-card/30 px-4 py-3 space-y-2"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1 space-y-1">
          <PlayerInfo userId={member.user_id} alias={member.display_name} size="sm" />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <TwitchChannel url={member.twitch_url} />
            {member.added_by && <span>added by {member.added_by.display_name ?? member.added_by.id}</span>}
            {member.added_at && <span>{formatDateTime(member.added_at)}</span>}
            {member.upcoming_assignments.length > 0 && (
              <span>{member.upcoming_assignments.length} upcoming match{member.upcoming_assignments.length === 1 ? '' : 'es'}</span>
            )}
          </div>
        </div>
        <ActionButton tone="red" icon={Trash2} disabled={busy} onClick={onRemove}>Remove</ActionButton>
      </div>
      <NoteEditor member={member} busy={busy} onSave={onSaveNote} />
    </li>
  )
}

function SuggestionRow({ suggestion, busy, onAdd }: {
  suggestion: RosterSuggestion
  busy: boolean
  onAdd: () => void
}) {
  return (
    <li
      aria-label={nameOf(suggestion)}
      className="rounded-lg border border-hairline/10 bg-card/30 px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2"
    >
      <div className="min-w-0 flex-1 space-y-1">
        <PlayerInfo userId={suggestion.user_id} alias={suggestion.display_name} size="sm" />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span>ticked Streaming for {suggestion.event.name}</span>
          {suggestion.signed_up_at && <span>{formatDateTime(suggestion.signed_up_at)}</span>}
          <TwitchChannel url={suggestion.twitch_url} />
        </div>
      </div>
      <ActionButton icon={Plus} disabled={busy} onClick={onAdd}>Add</ActionButton>
    </li>
  )
}

function RemoveMessage({ member }: { member: RosterStreamer }) {
  const upcoming = member.upcoming_assignments
  return (
    <div className="space-y-2">
      <p>
        Remove <span className="font-medium text-foreground">{nameOf(member)}</span> from the streamer roster?
        They lose the Stream tab and can no longer be assigned.
      </p>
      {upcoming.length === 0 ? (
        <p>They have no upcoming assignments.</p>
      ) : (
        <>
          <p>These upcoming assignments stay in place until a manager reassigns them:</p>
          <ul aria-label="Upcoming assignments" className="space-y-1 text-foreground">
            {upcoming.map((assignment) => (
              <li key={assignment.match_id} className="rounded-md border border-hairline/10 bg-card/30 px-2 py-1 text-xs break-words">
                {assignmentLine(assignment)}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

export function StreamersSection({ userProfile }: AdminSectionProps) {
  const token = userProfile?.accessToken ?? ''

  const [roster, setRoster] = useState<RosterStreamer[]>([])
  const [suggestions, setSuggestions] = useState<RosterSuggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyUser, setBusyUser] = useState<string | null>(null)
  const [removeTarget, setRemoveTarget] = useState<RosterStreamer | null>(null)

  const loadSuggestions = useCallback(async () => {
    try {
      setSuggestions(await fetchRosterSuggestions(token))
    } catch (e) {
      setError(eventErrorMessage(e))
    }
  }, [token])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([fetchStreamerRoster(token), fetchRosterSuggestions(token)])
      .then(([members, suggested]) => {
        if (cancelled) return
        setRoster(members)
        setSuggestions(suggested)
      })
      .catch((e) => { if (!cancelled) setError(eventErrorMessage(e)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [token])

  const run = async (userId: string, change: () => Promise<RosterStreamer[]>) => {
    setBusyUser(userId)
    setError(null)
    try {
      setRoster(await change())
      await loadSuggestions()
      return true
    } catch (e) {
      setError(eventErrorMessage(e))
      return false
    } finally {
      setBusyUser(null)
    }
  }

  const add = (userId: string) => run(userId, () => putRosterStreamer(token, userId, null))
  const saveNote = (userId: string, note: string | null) => run(userId, () => putRosterStreamer(token, userId, note))
  const remove = async (userId: string) => {
    if (await run(userId, () => removeRosterStreamer(token, userId))) setRemoveTarget(null)
  }

  const onRoster = new Set(roster.map((member) => member.user_id))

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Streamers</h2>
        <p className="text-xs text-muted-foreground">
          One roster for every event. Streamers on it get the Stream tab and can be assigned to matches.
        </p>
      </div>

      <Feedback message={error} tone="red" onDismiss={() => setError(null)} />

      <div className="rounded-lg border border-hairline/10 bg-card/30 p-4 space-y-2">
        <label className={PANEL_LABEL}>Add a streamer</label>
        <PlayerSearchInput
          accessToken={token}
          disabled={busyUser !== null}
          excludeIds={onRoster}
          onPick={(player) => { void add(String(player.id)) }}
          placeholder="Search players to add to the roster…"
        />
      </div>

      <section aria-label="Roster" className="space-y-2">
        <h3 className={PANEL_LABEL}>Roster{loading ? '' : ` (${roster.length})`}</h3>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading streamers…</p>
        ) : roster.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nobody is on the roster yet.</p>
        ) : (
          <ul className="space-y-2">
            {roster.map((member) => (
              <RosterRow
                key={member.user_id}
                member={member}
                busy={busyUser !== null}
                onSaveNote={(note) => { void saveNote(member.user_id, note) }}
                onRemove={() => setRemoveTarget(member)}
              />
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Suggestions" className="space-y-2">
        <h3 className={PANEL_LABEL}>Suggestions</h3>
        <p className="text-xs text-muted-foreground">Players who ticked Streaming on an event sign-up and aren't on the roster.</p>
        {loading ? null : suggestions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No suggestions right now.</p>
        ) : (
          <ul className="space-y-2">
            {suggestions.map((suggestion) => (
              <SuggestionRow
                key={suggestion.user_id}
                suggestion={suggestion}
                busy={busyUser !== null}
                onAdd={() => { void add(suggestion.user_id) }}
              />
            ))}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={!!removeTarget}
        title="Remove streamer"
        message={removeTarget ? <RemoveMessage member={removeTarget} /> : null}
        confirmLabel="Remove"
        tone="red"
        busy={!!removeTarget && busyUser === removeTarget.user_id}
        onConfirm={() => { if (removeTarget) void remove(removeTarget.user_id) }}
        onCancel={() => setRemoveTarget(null)}
      />
    </div>
  )
}
