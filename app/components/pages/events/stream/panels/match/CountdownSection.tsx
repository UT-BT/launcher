import { useId, useState, type FormEvent } from 'react'
import { cn } from '@/lib/utils'
import { CHIP_SHAPE } from '@/app/components/shared/chipStyles'
import { StreamCard, StreamLoading } from '../../StreamCard'
import { clearCountdown, moveCountdown } from './scoreActions'
import { COUNTDOWN_STEPS, buildCountdownView, isoFromUtcInput } from './countdownView'
import { useMatchWrite, useServerNow } from './useMatchWrite'
import { ACCENT_ACTION, ACTION_SHAPE, MUTED_ACTION } from './scoreControlStyles'

const SECTION_TITLE = 'Countdown'
const SECTION_DESCRIPTION = 'Move the Starting Soon countdown when a match runs late.'

const MOVED_STYLE = 'bg-amber-500/10 text-amber-300 border-amber-500/30'

export function CountdownSection() {
    const { match, loading, loadError, clockOffsetMs, pending, writeError, run } = useMatchWrite()
    const now = useServerNow(clockOffsetMs)
    const view = buildCountdownView(match, now)
    const inputId = useId()
    const [draft, setDraft] = useState({ base: '', value: '' })
    const [timeError, setTimeError] = useState<string | null>(null)
    const target = view?.inputValue ?? ''
    const time = draft.base === target ? draft.value : target

    if (!view) {
        return (
            <StreamCard title={SECTION_TITLE} description={SECTION_DESCRIPTION}>
                {loading ? <StreamLoading label="the countdown" />
                    : loadError ? <p role="alert" className="text-xs text-red-300">The countdown could not be loaded. {loadError}</p>
                        : <p className="text-xs text-muted-foreground">No match on your scenes, so there is no countdown to move.</p>}
            </StreamCard>
        )
    }

    const submit = (event: FormEvent) => {
        event.preventDefault()
        const at = isoFromUtcInput(time)
        if (!at) {
            setTimeError('Pick a date and time in UTC.')
            return
        }
        setTimeError(null)
        run(broadcast => moveCountdown(broadcast, { at }))
    }

    return (
        <StreamCard title={SECTION_TITLE} description={SECTION_DESCRIPTION}>
            <dl className="grid gap-2 rounded-lg border border-hairline/10 bg-card/40 p-3 text-xs sm:grid-cols-2">
                <div className="min-w-0 space-y-0.5">
                    <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Scheduled</dt>
                    <dd className="text-foreground tabular-nums break-words">{view.scheduledText}</dd>
                </div>
                <div className="min-w-0 space-y-0.5">
                    <dt className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                        Counting down to
                        {view.moved && <span className={cn(CHIP_SHAPE, MOVED_STYLE)}>Moved</span>}
                    </dt>
                    <dd data-testid="countdown-target" className="text-foreground tabular-nums break-words">{view.targetText}</dd>
                </div>
            </dl>

            <div className="flex flex-wrap items-center gap-2">
                {COUNTDOWN_STEPS.map(minutes => (
                    <button
                        key={minutes}
                        type="button"
                        disabled={pending}
                        onClick={() => run(broadcast => moveCountdown(broadcast, { add_minutes: minutes }))}
                        aria-label={`Move the countdown ${minutes} minutes later`}
                        className={cn(ACTION_SHAPE, MUTED_ACTION)}
                    >
                        +{minutes} min
                    </button>
                ))}
                {view.moved && (
                    <button
                        type="button"
                        disabled={pending}
                        onClick={() => run(clearCountdown)}
                        className={cn(ACTION_SHAPE, MUTED_ACTION, 'sm:ml-auto')}
                    >
                        Use scheduled time
                    </button>
                )}
            </div>

            <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
                <div className="min-w-0 space-y-1">
                    <label htmlFor={inputId} className="block text-xs font-medium text-foreground">New time (UTC)</label>
                    <input
                        id={inputId}
                        type="datetime-local"
                        value={time}
                        onChange={event => setDraft({ base: target, value: event.target.value })}
                        disabled={pending}
                        style={{ colorScheme: 'dark' }}
                        aria-invalid={timeError !== null}
                        className={cn(
                            'h-9 w-full max-w-full rounded-md border bg-card/40 px-3 text-xs text-foreground outline-none transition-colors focus-visible:border-accent-500/60 disabled:opacity-60',
                            timeError ? 'border-destructive/60' : 'border-hairline/10',
                        )}
                    />
                </div>
                <button type="submit" disabled={pending} className={cn(ACTION_SHAPE, ACCENT_ACTION, 'h-9')}>
                    Set countdown
                </button>
            </form>

            {timeError && <p role="alert" className="text-xs text-red-300">{timeError}</p>}
            {writeError && <p role="alert" className="text-xs text-red-300">{writeError}</p>}
        </StreamCard>
    )
}
