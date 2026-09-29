import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { Input } from '@/app/components/ui/input'
import { StreamCard, StreamLoading } from '../StreamCard'
import { useStreamTab } from '../StreamTabContext'
import { fetchOwnTwitchChannel, setMatchChannel, setOwnTwitchChannel } from './channel/channelActions'
import {
    NO_CHANNEL_HINT, currentLinkText, normaliseTwitchInput, otherUrlProblem, type ChannelChoice,
} from './channel/channelView'

const ACTION_SHAPE = 'h-8 px-3 rounded-md text-xs font-medium border transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:cursor-default disabled:opacity-50'
const ACCENT_ACTION = 'bg-accent-500/15 border-accent-500/40 text-accent-200 hover:bg-accent-500/25 hover:border-accent-500/60'
const MUTED_ACTION = 'bg-card/50 border-hairline/10 text-muted-foreground hover:text-foreground hover:border-hairline/20'
const FIELD_LABEL = 'text-[10px] uppercase tracking-wider text-muted-foreground'

function errorText(error: unknown): string {
    return error instanceof Error && error.message ? error.message : 'Something went wrong.'
}

function useWriter(refresh: () => Promise<void>) {
    const writing = useRef(false)
    const [pending, setPending] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const run = async (write: () => Promise<unknown>): Promise<boolean> => {
        if (writing.current) return false
        writing.current = true
        setPending(true)
        setError(null)
        let ok = false
        try {
            await write()
            ok = true
        } catch (caught) {
            setError(errorText(caught))
        } finally {
            await refresh()
            writing.current = false
            setPending(false)
        }
        return ok
    }

    return { pending, error, setError, run }
}

function StreamingOnCard() {
    const { eventSlug, accessToken, desk, deskLoading, deskError, refresh } = useStreamTab()
    const { pending, error, run } = useWriter(refresh)
    const [choosingOther, setChoosingOther] = useState(false)
    const [otherUrl, setOtherUrl] = useState('')
    const [otherProblem, setOtherProblem] = useState<string | null>(null)

    const description = 'Where viewers are sent from the schedule\'s Watch Stream button.'

    if (!desk) {
        return (
            <StreamCard title="Streaming on" description={description}>
                {deskLoading || !deskError
                    ? <StreamLoading label="the current match" />
                    : <p role="alert" className="text-xs text-red-300">The current match could not be loaded. {errorText(deskError)}</p>}
            </StreamCard>
        )
    }

    const match = desk.match
    const ownChannel = desk.streamer.channel
    const matchId = match?.id ?? null

    const choose = (choice: ChannelChoice, url?: string) => {
        if (!matchId) return Promise.resolve(false)
        return run(() => setMatchChannel(accessToken, eventSlug, matchId, choice, url))
    }

    const applyOther = async () => {
        const problem = otherUrlProblem(otherUrl)
        setOtherProblem(problem)
        if (problem) return
        if (await choose('other', otherUrl.trim())) setChoosingOther(false)
    }

    return (
        <StreamCard title="Streaming on" description={description}>
            {match ? (
                <>
                    <div className="space-y-1 rounded-lg border border-hairline/10 bg-card/40 p-3">
                        <p className={FIELD_LABEL}>Current link</p>
                        <p data-testid="channel-current-link" className="text-sm text-foreground break-all">{currentLinkText(match.stream_url)}</p>
                    </div>

                    <div className="flex flex-wrap items-start gap-2">
                        <div className="space-y-1">
                            <button
                                type="button"
                                disabled={pending || !ownChannel}
                                onClick={() => choose('mine')}
                                className={cn(ACTION_SHAPE, ACCENT_ACTION)}
                            >
                                My channel
                            </button>
                            {!ownChannel && <p className="text-xs text-muted-foreground max-w-[14rem]">{NO_CHANNEL_HINT}</p>}
                        </div>
                        <button
                            type="button"
                            disabled={pending}
                            onClick={() => choose('utbt')}
                            className={cn(ACTION_SHAPE, ACCENT_ACTION)}
                        >
                            UTBT channel
                        </button>
                        <button
                            type="button"
                            aria-expanded={choosingOther}
                            disabled={pending}
                            onClick={() => setChoosingOther(open => !open)}
                            className={cn(ACTION_SHAPE, MUTED_ACTION)}
                        >
                            Other URL
                        </button>
                    </div>

                    {choosingOther && (
                        <form
                            noValidate
                            className="space-y-1.5"
                            onSubmit={event => {
                                event.preventDefault()
                                void applyOther()
                            }}
                        >
                            <label htmlFor="channel-other-url" className={FIELD_LABEL}>Stream link</label>
                            <div className="flex flex-wrap items-start gap-2">
                                <Input
                                    id="channel-other-url"
                                    type="url"
                                    inputMode="url"
                                    autoComplete="off"
                                    placeholder="https://"
                                    value={otherUrl}
                                    aria-invalid={otherProblem !== null}
                                    onChange={event => {
                                        setOtherUrl(event.target.value)
                                        setOtherProblem(null)
                                    }}
                                    className="h-8 min-w-0 flex-1 basis-56 text-xs"
                                />
                                <button type="submit" disabled={pending} className={cn(ACTION_SHAPE, ACCENT_ACTION)}>
                                    Use this link
                                </button>
                            </div>
                            {otherProblem && <p role="alert" className="text-xs text-red-300">{otherProblem}</p>}
                        </form>
                    )}
                </>
            ) : (
                <p className="text-xs text-muted-foreground">
                    No match is on your scenes right now. Choose a current match on the Match tab to set where it streams.
                </p>
            )}

            {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
        </StreamCard>
    )
}

function OwnTwitchCard() {
    const { accessToken, refresh } = useStreamTab()
    const { pending, error, setError, run } = useWriter(refresh)
    const [stored, setStored] = useState<string | null | undefined>(undefined)
    const [draft, setDraft] = useState<string | null>(null)
    const [problem, setProblem] = useState<string | null>(null)

    useEffect(() => {
        let current = true
        fetchOwnTwitchChannel(accessToken)
            .then(channel => {
                if (current) setStored(channel)
            })
            .catch(caught => {
                if (!current) return
                setStored(null)
                setError(errorText(caught))
            })
        return () => {
            current = false
        }
    }, [accessToken, setError])

    const value = draft ?? stored ?? ''

    const save = async (input: string) => {
        const parsed = normaliseTwitchInput(input)
        if ('problem' in parsed) {
            setProblem(parsed.problem)
            return
        }
        setProblem(null)
        const saved = await run(async () => {
            const channel = await setOwnTwitchChannel(accessToken, parsed.url)
            setStored(channel)
        })
        if (saved) setDraft(null)
    }

    return (
        <StreamCard title="Own Twitch channel" description="Saved on your profile. Choosing My channel sends viewers here.">
            <form
                className="space-y-1.5"
                onSubmit={event => {
                    event.preventDefault()
                    void save(value)
                }}
            >
                <label htmlFor="channel-own-twitch" className={FIELD_LABEL}>Twitch channel</label>
                <div className="flex flex-wrap items-start gap-2">
                    <Input
                        id="channel-own-twitch"
                        autoComplete="off"
                        spellCheck={false}
                        placeholder="your_login or twitch.tv/your_login"
                        value={value}
                        aria-invalid={problem !== null}
                        onChange={event => {
                            setDraft(event.target.value)
                            setProblem(null)
                            setError(null)
                        }}
                        className="h-8 min-w-0 flex-1 basis-56 text-xs"
                    />
                    <button type="submit" disabled={pending || stored === undefined} className={cn(ACTION_SHAPE, ACCENT_ACTION)}>
                        Save
                    </button>
                    <button
                        type="button"
                        disabled={pending || !stored}
                        onClick={() => save('')}
                        className={cn(ACTION_SHAPE, MUTED_ACTION)}
                    >
                        Clear
                    </button>
                </div>
                {problem && <p role="alert" className="text-xs text-red-300">{problem}</p>}
                {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
            </form>
        </StreamCard>
    )
}

export function ChannelPanel() {
    return (
        <div className="grid gap-4 2xl:grid-cols-2">
            <StreamingOnCard />
            <OwnTwitchCard />
        </div>
    )
}
