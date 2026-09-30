import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { Input } from '@/app/components/ui/input'
import { StreamCard } from '../../StreamCard'
import { useStreamTab } from '../../StreamTabContext'
import { fetchOwnTwitchChannel, setOwnTwitchChannel } from './channelActions'
import { ACCENT_ACTION, ACTION_SHAPE, FIELD_LABEL, MUTED_ACTION } from './channelControlStyles'
import { normaliseTwitchInput } from './channelView'
import { errorText, useChannelWriter } from './useChannelWriter'

export function OwnTwitchSection() {
    const { accessToken, refresh } = useStreamTab()
    const { pending, error, setError, run } = useChannelWriter(refresh)
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
