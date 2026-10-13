import { useId, useRef, useState } from 'react'
import { ArrowLeftRight, X } from 'lucide-react'
import { PICK_BAN_TONES } from '@/app/components/broadcast/broadcastTone'
import { CHIP_SHAPE } from '@/app/components/shared/chipStyles'
import { Button } from '@/app/components/ui/button'
import { Modal } from '@/app/components/ui/modal'
import { cn } from '@/lib/utils'
import type { StreamMatch } from '../../streamDesk'
import { StreamCard } from '../../StreamCard'
import { useStreamTab } from '../../StreamTabContext'
import {
    camSidesView,
    nextSidesSwappedNotice,
    sidesSwapErrorMessage,
    type CamSidesTeam,
    type SidesSwapControl,
    type SidesSwappedNotice as SidesSwappedNoticeModel,
} from './camSidesView'
import { setMatchSides } from './sidesActions'

const ACTION_SHAPE = 'h-8 px-3 rounded-md text-xs font-medium border transition-colors cursor-pointer inline-flex items-center gap-2 disabled:cursor-default disabled:opacity-50'
const ACCENT_ACTION = 'bg-accent-500/15 border-accent-500/40 text-accent-200 hover:bg-accent-500/25 hover:border-accent-500/60'
const WARN_CHIP = 'bg-amber-500/10 border-amber-500/30 text-amber-300'

function useSidesSwappedNotice(match: StreamMatch | null) {
    const [seen, setSeen] = useState(match)
    const [notice, setNotice] = useState<SidesSwappedNoticeModel | null>(null)

    if (seen !== match) {
        setSeen(match)
        setNotice(nextSidesSwappedNotice(notice, seen, match))
    }

    return { notice, dismiss: () => setNotice(null) }
}

function SideTeam({ color, letter, team }: { color: 'Red' | 'Blue'; letter: 'A' | 'B'; team: CamSidesTeam | null }) {
    const tone = PICK_BAN_TONES[letter === 'A' ? 'a' : 'b']

    return (
        <div data-testid={`cam-sides-${color.toLowerCase()}`} className={cn('flex min-w-0 flex-wrap items-center gap-2 rounded-lg border bg-card/40 px-3 py-2', tone.line)}>
            <span className={cn(CHIP_SHAPE, tone.soft, tone.line, tone.text)}>{color} · Side {letter}</span>
            <span className="min-w-0 break-words text-sm font-semibold text-foreground">{team?.name ?? 'Not set'}</span>
        </div>
    )
}

export function SidesSwappedNotice({ notice, onDismiss }: { notice: SidesSwappedNoticeModel; onDismiss: () => void }) {
    return (
        <div role="status" data-testid="cam-sides-swapped" className="flex items-start justify-between gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            <p className="min-w-0 break-words">
                <span className="font-semibold">Sides swapped.</span> {notice.red} is now Red, {notice.blue} is now Blue.
            </p>
            <button
                type="button"
                onClick={onDismiss}
                aria-label="Dismiss the sides swapped notice"
                className="-m-1 inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-amber-200/80 transition-colors hover:text-amber-100"
            >
                <X className="size-3.5" aria-hidden="true" />
            </button>
        </div>
    )
}

function SwapConfirmDialog({ swap, busy, onConfirm, onCancel }: {
    swap: SidesSwapControl
    busy: boolean
    onConfirm: () => void
    onCancel: () => void
}) {
    return (
        <Modal
            isOpen
            onClose={onCancel}
            offsetSidebar
            portal
            maxWidth="30rem"
            title={swap.confirmTitle}
            footer={
                <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border bg-muted/50 p-4">
                    <Button variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>
                    <Button onClick={onConfirm} disabled={busy || swap.disabledReason !== null}>{busy ? 'Swapping…' : 'Swap sides'}</Button>
                </div>
            }
        >
            <p className="text-sm text-foreground">{swap.confirmMessage}</p>
        </Modal>
    )
}

export function CamSides() {
    const { eventSlug, accessToken, desk, refresh } = useStreamTab()
    const match = desk?.match ?? null
    const view = camSidesView(match)
    const { notice, dismiss } = useSidesSwappedNotice(match)
    const reasonId = useId()
    const writing = useRef(false)
    const [confirming, setConfirming] = useState(false)
    const [pending, setPending] = useState(false)
    const [error, setError] = useState<string | null>(null)

    if (!match || !view) return null

    const swap = view.swap

    async function confirmSwap(control: SidesSwapControl, matchId: string) {
        if (writing.current) return
        writing.current = true
        setPending(true)
        setError(null)
        try {
            await setMatchSides({ accessToken, slug: eventSlug, matchId }, control.body)
        } catch (caught) {
            setError(sidesSwapErrorMessage(caught))
        } finally {
            await refresh()
            writing.current = false
            setPending(false)
            setConfirming(false)
        }
    }

    return (
        <StreamCard title="Red and Blue" description="Which team plays Red and which plays Blue in this match. The cams, the overlay and every scene follow it.">
            <div className="grid min-w-0 gap-2 sm:grid-cols-2">
                <SideTeam color="Red" letter="A" team={view.red} />
                <SideTeam color="Blue" letter="B" team={view.blue} />
            </div>

            {view.tbc && (
                <p data-testid="cam-sides-tbc" className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className={cn(CHIP_SHAPE, WARN_CHIP)}>Sides TBC</span>
                    <span className="min-w-0 break-words">Red and Blue are not confirmed yet, so they may still change.</span>
                </p>
            )}

            {notice && <SidesSwappedNotice notice={notice} onDismiss={dismiss} />}

            {swap && (
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        disabled={pending || swap.disabledReason !== null}
                        aria-describedby={swap.disabledReason ? reasonId : undefined}
                        onClick={() => { setError(null); setConfirming(true) }}
                        className={cn(ACTION_SHAPE, ACCENT_ACTION)}
                    >
                        <ArrowLeftRight className="size-3.5" aria-hidden="true" /> Swap Red/Blue
                    </button>
                    {swap.disabledReason && <p id={reasonId} className="min-w-0 break-words text-xs text-amber-300">{swap.disabledReason}</p>}
                </div>
            )}

            {error && <p role="alert" className="text-xs text-red-300 break-words">{error}</p>}

            {confirming && swap && (
                <SwapConfirmDialog
                    swap={swap}
                    busy={pending}
                    onConfirm={() => void confirmSwap(swap, match.id)}
                    onCancel={() => setConfirming(false)}
                />
            )}
        </StreamCard>
    )
}
