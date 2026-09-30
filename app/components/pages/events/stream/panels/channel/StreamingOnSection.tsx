import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Input } from '@/app/components/ui/input'
import { StreamCard, StreamLoading } from '../../StreamCard'
import { useStreamTab } from '../../StreamTabContext'
import { setMatchChannel } from './channelActions'
import { ACCENT_ACTION, ACTION_SHAPE, FIELD_LABEL, MUTED_ACTION } from './channelControlStyles'
import { NO_CHANNEL_HINT, currentLinkText, otherUrlProblem, type ChannelChoice } from './channelView'
import { errorText, useChannelWriter } from './useChannelWriter'

export function StreamingOnSection() {
    const { eventSlug, accessToken, desk, deskLoading, deskError, refresh } = useStreamTab()
    const { pending, error, run } = useChannelWriter(refresh)
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
