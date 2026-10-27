import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ChevronRight, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Modal } from '@/app/components/ui/modal'
import { ErrorBanner } from '@/app/components/pages/teams/teamsShared'
import {
    eventErrorMessage, fetchEventCapReview, fetchEventMatch, linkEventMatchMapCaps,
    type EventBracket, type EventCapReviewItem, type EventMatch, type EventSide,
} from '@/app/utils/api'
import { CapLinkPicker } from '../CapLinkPicker'
import { capsNeedLinkingRows, type CapsNeedLinkingRow, type CapsNeedLinkingSide } from './capsNeedLinkingView'

interface CapsNeedLinkingProps {
    accessToken: string
    slug: string
    bracket: EventBracket | null
    onLinked: () => void
}

function redTeamIdsOf(bracket: EventBracket | null): Record<string, string | null> {
    return Object.fromEntries((bracket?.stages ?? []).flatMap(stage => stage.matches.map(match => [match.id, match.red_team_id])))
}

export function CapsNeedLinking({ accessToken, slug, bracket, onLinked }: CapsNeedLinkingProps) {
    const [items, setItems] = useState<EventCapReviewItem[]>([])
    const [opened, setOpened] = useState<CapsNeedLinkingRow | null>(null)
    const tokenRef = useRef(accessToken)
    tokenRef.current = accessToken
    const latestRef = useRef(0)

    const reload = useCallback(async (signal?: AbortSignal) => {
        const request = ++latestRef.current
        try {
            const fresh = await fetchEventCapReview(tokenRef.current, slug, null, signal)
            if (request === latestRef.current) setItems(fresh)
        } catch {
            if (!signal?.aborted && request === latestRef.current) setItems([])
        }
    }, [slug])

    useEffect(() => {
        const controller = new AbortController()
        void reload(controller.signal)
        return () => controller.abort()
    }, [reload, bracket])

    const redTeamIds = useMemo(() => redTeamIdsOf(bracket), [bracket])
    const rows = useMemo(() => capsNeedLinkingRows(items, redTeamIds), [items, redTeamIds])

    if (rows.length === 0) return null

    return (
        <section aria-label="Caps need linking" className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 space-y-2">
            <div className="flex items-start gap-2">
                <AlertTriangle className="size-4 shrink-0 mt-px text-amber-300" />
                <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-amber-200">
                        Caps need linking <span className="tabular-nums text-amber-300/80">({rows.length})</span>
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                        These maps have a recorded score, but their runs aren&apos;t all linked. Open one to find and link its runs.
                    </p>
                </div>
            </div>
            <ul className="divide-y divide-hairline/5">
                {rows.map(row => (
                    <li key={row.key}>
                        <button
                            type="button"
                            onClick={() => setOpened(row)}
                            className="w-full min-h-11 py-2 px-1 flex items-center gap-2 text-left rounded-md cursor-pointer hover:bg-hairline/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400/60"
                        >
                            <span className="min-w-0 flex-1 space-y-0.5">
                                <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                    <span className="text-xs font-semibold text-foreground">{row.match}</span>
                                    {row.round && <span className="text-[11px] text-muted-foreground">{row.round}</span>}
                                    <span className="text-[11px] text-foreground/90">{row.map}</span>
                                </span>
                                <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                                    {row.sides.map(side => <SideCount key={side.side} side={side} />)}
                                </span>
                                <span className="block text-[11px] text-amber-300">{row.reason}</span>
                            </span>
                            <ChevronRight className="size-4 shrink-0 text-amber-300/70" />
                        </button>
                    </li>
                ))}
            </ul>

            {opened && (
                <LinkRunsModal
                    key={opened.key}
                    accessToken={accessToken}
                    slug={slug}
                    row={opened}
                    onClose={() => setOpened(null)}
                    onLinked={() => {
                        setOpened(null)
                        void reload()
                        onLinked()
                    }}
                />
            )}
        </section>
    )
}

function SideCount({ side }: { side: CapsNeedLinkingSide }) {
    const short = side.linked < side.expected

    return (
        <span className="inline-flex min-w-0 items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider">{side.label}</span>
            <span className="truncate text-foreground/80">{side.team}</span>
            <span className={cn('tabular-nums', short ? 'text-amber-300' : 'text-emerald-300')}>
                {side.linked}/{side.expected} linked
            </span>
        </span>
    )
}

function LinkRunsModal({ accessToken, slug, row, onClose, onLinked }: {
    accessToken: string
    slug: string
    row: CapsNeedLinkingRow
    onClose: () => void
    onLinked: () => void
}) {
    const { item } = row
    const [match, setMatch] = useState<EventMatch | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const controller = new AbortController()
        fetchEventMatch(accessToken, slug, item.match_id, controller.signal)
            .then(setMatch)
            .catch(e => {
                if (!controller.signal.aborted) setError(eventErrorMessage(e))
            })
        return () => controller.abort()
    }, [accessToken, slug, item.match_id])

    const mapRow = match?.maps?.find(entry => entry.ordinal === item.ordinal) ?? null
    const teamNames: Record<EventSide, string> = { a: item.team_a.name, b: item.team_b.name }

    return (
        <Modal
            isOpen
            onClose={onClose}
            offsetSidebar
            maxWidth="40rem"
            title={row.match}
            leftAction={row.round ? (
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground shrink-0">{row.round}</span>
            ) : undefined}
        >
            <div className="space-y-3">
                <div className="space-y-1">
                    <div className="text-sm font-semibold text-foreground">Map {item.ordinal + 1} · {row.map}</div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                        {row.sides.map(side => <SideCount key={side.side} side={side} />)}
                    </div>
                    <p className="text-[11px] text-amber-300">{row.reason}</p>
                </div>

                <ErrorBanner message={error} />

                {!match && !error && (
                    <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Loader2 className="size-3.5 animate-spin" /> Loading the match…
                    </p>
                )}

                {match && !mapRow && (
                    <p className="text-[11px] text-muted-foreground">This map is no longer on the match.</p>
                )}

                {match && mapRow && (
                    <CapLinkPicker
                        accessToken={accessToken}
                        slug={slug}
                        matchId={item.match_id}
                        row={mapRow}
                        teamNames={teamNames}
                        initialMap={row.prefill.map}
                        initialFrom={row.prefill.from}
                        initialTo={row.prefill.to}
                        onLink={async caps => {
                            await linkEventMatchMapCaps(accessToken, slug, item.match_id, item.ordinal, caps)
                            onLinked()
                        }}
                    />
                )}
            </div>
        </Modal>
    )
}
