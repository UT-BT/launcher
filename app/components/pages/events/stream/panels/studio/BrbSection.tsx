import { useId, useState } from 'react'
import { cn } from '@/lib/utils'
import { StreamCard, StreamLoading } from '../../StreamCard'
import { useStreamTab } from '../../StreamTabContext'
import { BRB_MESSAGE_MAX } from './casterList'
import { setBrbMessage } from './showActions'
import { useShowWrite } from './useShowWrite'

const ACTION_SHAPE = 'h-9 px-3 rounded-md text-xs font-medium border transition-colors cursor-pointer disabled:cursor-default disabled:opacity-50 sm:h-8'
const ACCENT_ACTION = 'bg-accent-500/15 border-accent-500/40 text-accent-200 hover:bg-accent-500/25 hover:border-accent-500/60'
const MUTED_ACTION = 'bg-card/50 border-hairline/10 text-muted-foreground hover:text-foreground hover:border-hairline/20'

export function BrbSection() {
    const { eventSlug, streamerId, accessToken, desk } = useStreamTab()
    const { run, pending, error } = useShowWrite()
    const inputId = useId()
    const [draft, setDraft] = useState<string | null>(null)

    if (!desk) {
        return (
            <StreamCard title="BRB message" description="Shown on the pause screen while you are away.">
                <StreamLoading label="your show settings" />
            </StreamCard>
        )
    }

    const saved = desk.desk.brb_message ?? ''
    const value = draft ?? saved
    const dirty = draft !== null && draft.trim() !== saved

    const save = async (message: string | null) => {
        if (await run(() => setBrbMessage(accessToken, eventSlug, streamerId, message))) setDraft(null)
    }

    return (
        <StreamCard title="BRB message" description="Shown on the pause screen while you are away.">
            <form
                className="space-y-2"
                onSubmit={event => {
                    event.preventDefault()
                    if (dirty && !pending) void save(draft!.trim() || null)
                }}
            >
                <label htmlFor={inputId} className="text-xs font-medium text-foreground">Message</label>
                <input
                    id={inputId}
                    type="text"
                    value={value}
                    maxLength={BRB_MESSAGE_MAX}
                    onChange={event => setDraft(event.target.value)}
                    disabled={pending}
                    autoComplete="off"
                    placeholder="Back in a few minutes"
                    className="h-9 w-full rounded-md border border-hairline/10 bg-card/40 px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-accent-500/60 disabled:opacity-60"
                />
                <div className="flex flex-wrap items-center gap-2">
                    <button type="submit" disabled={!dirty || pending} className={cn(ACTION_SHAPE, ACCENT_ACTION)}>
                        Save message
                    </button>
                    {saved && (
                        <button
                            type="button"
                            disabled={pending}
                            onClick={() => void save(null)}
                            className={cn(ACTION_SHAPE, MUTED_ACTION)}
                        >
                            Clear message
                        </button>
                    )}
                    <span className="text-xs text-muted-foreground tabular-nums sm:ml-auto">{value.length}/{BRB_MESSAGE_MAX}</span>
                </div>
                {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
            </form>
        </StreamCard>
    )
}
