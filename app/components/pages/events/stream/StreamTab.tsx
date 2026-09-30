import { Fragment, Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNavState } from '@/app/components/navigation/useNavState'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu'
import { fetchEventStreamers, type EventStreamer } from '@/app/utils/api'
import { streamerName } from '@/app/components/pages/events/eventsShared'
import { ROSTER_EMPTY_TEXT, ROSTER_FAILED_TEXT, streamerListNote } from '@/app/components/pages/events/streamerRoster'
import { StreamLoading } from './StreamCard'
import { StreamTabProvider, type StreamTabIdentity } from './StreamTabContext'
import { STREAM_PANELS, initialStreamPanel, isStreamPanelId } from './streamPanels'
import { operatingAsChoices, operatingAsId, type OperatingViewer } from './streamTabAccess'
import { useStreamKitState } from './useStreamKitState'

const PANELS = STREAM_PANELS.map(panel => ({ ...panel, Component: lazy(panel.load) }))

interface StreamTabProps {
    eventSlug: string
    accessToken: string
    viewer: OperatingViewer
}

export function StreamTab({ eventSlug, accessToken, viewer }: StreamTabProps) {
    const [chosenId, setChosenId] = useNavState<string | null>('event.streamAs', null)
    const [rememberedPanel, setRememberedPanel] = useNavState<string | null>('event.streamPanel', null)
    const [streamers, setStreamers] = useState<EventStreamer[] | null>(null)
    const [streamersFailed, setStreamersFailed] = useState(false)

    useEffect(() => {
        if (!viewer.isManager) return
        const controller = new AbortController()
        fetchEventStreamers(accessToken, eventSlug, controller.signal)
            .then(list => {
                setStreamers(list)
                setStreamersFailed(false)
            })
            .catch(() => {
                if (controller.signal.aborted) return
                setStreamers([])
                setStreamersFailed(true)
            })
        return () => controller.abort()
    }, [accessToken, eventSlug, viewer.isManager])

    const choices = useMemo(() => operatingAsChoices(viewer, streamers), [viewer, streamers])
    const streamerId = operatingAsId(viewer, streamers, chosenId)
    const kitState = useStreamKitState(eventSlug, streamerId, accessToken, !isStreamPanelId(rememberedPanel))
    const panelId = initialStreamPanel(rememberedPanel, kitState)
    const activePanel = PANELS.find(panel => panel.id === panelId) ?? null

    const context = useMemo<StreamTabIdentity | null>(() => (
        streamerId ? { eventSlug, streamerId, isManager: viewer.isManager, accessToken } : null
    ), [eventSlug, streamerId, viewer.isManager, accessToken])

    return (
        <div className="space-y-4">
            <OperatingAs
                viewer={viewer}
                choices={choices}
                streamerId={streamerId}
                loading={viewer.isManager && streamers === null}
                failed={streamersFailed}
                onChoose={setChosenId}
            />

            {context ? (
                <>
                    <nav aria-label="Stream panels" className="flex items-center gap-1 border-b border-hairline/10 overflow-x-auto">
                        {PANELS.map((panel, index) => (
                            <Fragment key={panel.id}>
                                {index > 0 && PANELS[index - 1].group !== panel.group && (
                                    <span role="separator" aria-orientation="vertical" className="mx-1 sm:mx-1.5 h-4 w-px shrink-0 bg-hairline/20" />
                                )}
                                <button
                                    type="button"
                                    aria-pressed={activePanel?.id === panel.id}
                                    onClick={() => setRememberedPanel(panel.id)}
                                    className={cn(
                                        'px-2.5 sm:px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 -mb-px transition-colors cursor-pointer',
                                        activePanel?.id === panel.id
                                            ? 'border-accent-400 text-foreground'
                                            : 'border-transparent text-muted-foreground hover:text-foreground',
                                    )}
                                >
                                    {panel.label}
                                </button>
                            </Fragment>
                        ))}
                    </nav>

                    <StreamTabProvider key={context.streamerId} identity={context}>
                        {activePanel ? (
                            <Suspense key={`${context.streamerId}:${activePanel.id}`} fallback={<StreamLoading label={activePanel.label} />}>
                                <activePanel.Component />
                            </Suspense>
                        ) : (
                            <StreamLoading label="your stream desk" />
                        )}
                    </StreamTabProvider>
                </>
            ) : (
                <p className="text-sm text-muted-foreground">
                    {nobodyMessage(viewer.isManager && streamers === null, choices.length === 0, streamersFailed)}
                </p>
            )}
        </div>
    )
}

function nobodyMessage(loading: boolean, noChoices: boolean, failed: boolean): string {
    if (loading) return 'Loading the streamer roster…'
    if (failed) return `${ROSTER_FAILED_TEXT} Refresh to try again.`
    if (noChoices) return ROSTER_EMPTY_TEXT
    return 'Choose a streamer to open their controls.'
}

function OperatingAs({ viewer, choices, streamerId, loading, failed, onChoose }: {
    viewer: OperatingViewer
    choices: EventStreamer[]
    streamerId: string | null
    loading: boolean
    failed: boolean
    onChoose: (streamerId: string) => void
}) {
    const current = choices.find(streamer => streamer.id === streamerId) ?? null

    return (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-hairline/10 bg-card/30 px-3 py-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {viewer.isManager ? 'Operating as' : 'Streaming as'}
            </span>
            {viewer.isManager ? (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button
                            type="button"
                            aria-label={current ? `Operating as ${streamerName(current)}` : 'Choose a streamer'}
                            className="inline-flex h-8 max-w-full min-w-0 items-center gap-1.5 rounded-lg border border-hairline/10 bg-card/50 px-2 text-xs text-foreground hover:border-hairline/20 transition-colors cursor-pointer"
                        >
                            {current ? (
                                <PlayerInfo userId={current.id} alias={streamerName(current)} size="sm" interactive={false} showYouBadge={current.id === viewer.id} />
                            ) : (
                                <span className="text-muted-foreground">{loading && streamerId ? 'Loading…' : 'Choose a streamer'}</span>
                            )}
                            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-64 max-h-80 overflow-y-auto">
                        <DropdownMenuRadioGroup value={streamerId ?? ''} onValueChange={onChoose}>
                            {choices.map(streamer => (
                                <DropdownMenuRadioItem key={streamer.id} value={streamer.id}>
                                    <PlayerInfo userId={streamer.id} alias={streamerName(streamer)} size="sm" interactive={false} showYouBadge={streamer.id === viewer.id} />
                                </DropdownMenuRadioItem>
                            ))}
                        </DropdownMenuRadioGroup>
                        {choices.length === 0 && (
                            <p className="px-2 py-1.5 text-xs text-muted-foreground">{streamerListNote(failed, loading)}</p>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            ) : (
                <PlayerInfo userId={viewer.id} alias={streamerName({ display_name: viewer.name })} size="sm" interactive={false} showYouBadge />
            )}
        </div>
    )
}
