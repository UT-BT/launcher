import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/app/components/ui/button'
import { ErrorBanner } from '@/app/components/pages/teams/teamsShared'
import { formatDateTime } from '@/app/components/pages/admin/components/controls'
import {
    eventErrorMessage, fetchEventScheduling, updateEventStageWindow,
    type EventSchedulingConfig, type EventSchedulingStage,
} from '@/app/utils/api'
import { toIso, toLocalInput } from '../bracket/bracketShared'
import { Field, NumberField, SubCard } from './formatFields'
import { teamInputClass } from '@/app/components/pages/teams/teamsShared'
import { cn } from '@/lib/utils'

export function SchedulingWindowsPanel({ accessToken, slug }: { accessToken: string; slug: string }) {
    const [config, setConfig] = useState<EventSchedulingConfig | null>(null)
    const [loaded, setLoaded] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const load = useCallback(async () => {
        try {
            setConfig(await fetchEventScheduling(accessToken, slug))
            setError(null)
        } catch (e) {
            setConfig(null)
            setError(eventErrorMessage(e))
        } finally {
            setLoaded(true)
        }
    }, [accessToken, slug])

    useEffect(() => { void load() }, [load])

    if (!loaded) {
        return <div className="p-6 text-center text-sm text-muted-foreground">Loading scheduling windows…</div>
    }

    if (config === null) {
        return (
            <div className="p-6 flex flex-col items-center gap-3">
                <ErrorBanner message={error} />
                <Button variant="secondary" onClick={load}>Try again</Button>
            </div>
        )
    }

    if (config.stages.length === 0) {
        return <div className="p-6 text-center text-sm text-muted-foreground">This event has no stages yet.</div>
    }

    return (
        <div className="flex flex-col gap-3">
            {config.stages.map(stage => (
                <StageWindowCard
                    key={stage.id}
                    stage={stage}
                    tournamentStartsAt={config.tournament.starts_at}
                    accessToken={accessToken}
                    slug={slug}
                    onSaved={load}
                />
            ))}
        </div>
    )
}

function StageWindowCard({ stage, tournamentStartsAt, accessToken, slug, onSaved }: {
    stage: EventSchedulingStage
    tournamentStartsAt: string | null
    accessToken: string
    slug: string
    onSaved: () => void
}) {
    const [opensAt, setOpensAt] = useState(toLocalInput(stage.window_opens_at))
    const [closesAt, setClosesAt] = useState(toLocalInput(stage.window_closes_at))
    const [roundDays, setRoundDays] = useState<number | null>(stage.default_round_duration_days)
    const [durationMinutes, setDurationMinutes] = useState<number | null>(stage.expected_match_duration_minutes)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        setOpensAt(toLocalInput(stage.window_opens_at))
        setClosesAt(toLocalInput(stage.window_closes_at))
        setRoundDays(stage.default_round_duration_days)
        setDurationMinutes(stage.expected_match_duration_minutes)
    }, [stage])

    const dirty = (
        toLocalInput(stage.window_opens_at) !== opensAt
        || toLocalInput(stage.window_closes_at) !== closesAt
        || stage.default_round_duration_days !== roundDays
        || stage.expected_match_duration_minutes !== durationMinutes
    )

    const opensAtIso = toIso(opensAt)
    const opensBeforeTournamentStart = !!opensAtIso && !!tournamentStartsAt
        && new Date(opensAtIso).getTime() < new Date(tournamentStartsAt).getTime()

    const opensHint = !opensAt && tournamentStartsAt
        ? `Falls back to the tournament start: ${formatDateTime(tournamentStartsAt)}`
        : opensBeforeTournamentStart
            ? `Teams can start proposing then, but no slot can land before the tournament starts (${formatDateTime(tournamentStartsAt)}).`
            : 'When teams can start proposing times for this stage.'

    const save = useCallback(async () => {
        setSaving(true)
        setError(null)
        try {
            await updateEventStageWindow(accessToken, slug, stage.key, {
                window_opens_at: toIso(opensAt),
                window_closes_at: toIso(closesAt),
                default_round_duration_days: roundDays,
                expected_match_duration_minutes: durationMinutes,
            })
            onSaved()
        } catch (e) {
            setError(eventErrorMessage(e))
        } finally {
            setSaving(false)
        }
    }, [accessToken, slug, stage.key, opensAt, closesAt, roundDays, durationMinutes, onSaved])

    return (
        <SubCard
            title={stage.name}
            action={
                <Button size="sm" onClick={() => void save()} disabled={!dirty || saving}>
                    {saving ? 'Saving…' : 'Save'}
                </Button>
            }
        >
            <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Proposing opens" hint={opensHint}>
                    <input
                        type="datetime-local"
                        value={opensAt}
                        onChange={event => setOpensAt(event.target.value)}
                        style={{ colorScheme: 'dark' }}
                        className={cn(teamInputClass, 'w-full h-8 py-1 text-xs')}
                    />
                </Field>
                <Field
                    label="Matches must complete by"
                    hint="Also the last moment a match time can be proposed for."
                >
                    <input
                        type="datetime-local"
                        value={closesAt}
                        onChange={event => setClosesAt(event.target.value)}
                        style={{ colorScheme: 'dark' }}
                        className={cn(teamInputClass, 'w-full h-8 py-1 text-xs')}
                    />
                </Field>
                <NumberField
                    label="Default round length (days)"
                    value={roundDays}
                    nullable
                    onChange={setRoundDays}
                    min={1}
                    max={365}
                    hint="Applied to a round's close time the first time it's drawn."
                />
                <NumberField
                    label="Match duration (minutes)"
                    value={durationMinutes}
                    nullable
                    onChange={setDurationMinutes}
                    min={1}
                    max={1440}
                    hint={stage.expected_match_duration_minutes == null && stage.effective_match_duration_minutes != null
                        ? `Defaults to ${stage.effective_match_duration_minutes}m for this stage kind.`
                        : 'Used for booking-conflict and countdown checks.'}
                />
            </div>
            <ErrorBanner message={error} />
        </SubCard>
    )
}
