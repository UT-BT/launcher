import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import { Pin, SlidersHorizontal, Trash2, Video, VideoOff, X } from 'lucide-react'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu'
import { useModalBehaviour } from '@/app/components/ui/useModalBehaviour'
import { cn } from '@/lib/utils'
import type { SetEdit } from '../model/setEdits'
import { formatOffset, offsetNudges } from './offsetNudge'
import { NOT_FRAME_SYNCED, type RosterRow } from './rosterRows'

function OffsetMenu({ row, onEdit }: { row: RosterRow; onEdit: (edit: SetEdit) => void }) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button type="button" className="run-compare-roster-action">
                    <SlidersHorizontal className="size-4" />
                    <span>Offset {formatOffset(row.offsetMs)}</span>
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="run-compare-offset-menu">
                <DropdownMenuLabel>Offset {formatOffset(row.offsetMs)}</DropdownMenuLabel>
                {offsetNudges(row.fps).map(nudge => (
                    <DropdownMenuItem
                        key={nudge.label}
                        onSelect={event => {
                            event.preventDefault()
                            onEdit({ kind: 'offset', capId: row.capId, ms: row.offsetMs + nudge.ms })
                        }}
                    >
                        {nudge.label}
                    </DropdownMenuItem>
                ))}
                <DropdownMenuItem
                    disabled={row.offsetMs === 0}
                    onSelect={() => onEdit({ kind: 'offset', capId: row.capId, ms: 0 })}
                >
                    Reset
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

interface RosterItemProps {
    row: RosterRow
    only: boolean
    onEdit: (edit: SetEdit) => void
}

function RosterItem({ row, only, onEdit }: RosterItemProps) {
    const { run, capId } = row
    const videoOn = row.video === 'on'
    return (
        <li className="run-compare-roster-row">
            <div className="run-compare-roster-who run-compare-row">
                <PlayerInfo userId={run.user} alias={run.alias} title={run.title} size="sm" interactive={false} className="min-w-0" />
                <span className="font-mono tabular-nums text-foreground">{row.time}</span>
            </div>
            <div className="run-compare-roster-badges">
                {row.reference && <span className="run-compare-badge is-reference">REF</span>}
                {row.badges.map(badge => <span key={badge} className="run-compare-badge">{badge}</span>)}
                {row.sideLabel && <span className="run-compare-badge">{row.sideLabel}</span>}
                {!row.frameSynced && <span className="run-compare-badge">{NOT_FRAME_SYNCED}</span>}
            </div>
            <div className="run-compare-roster-actions">
                <button
                    type="button"
                    aria-pressed={row.pinned}
                    className="run-compare-roster-action"
                    onClick={() => onEdit({ kind: row.pinned ? 'unpin' : 'pin', capId })}
                >
                    <Pin className="size-4" />
                    <span>Pin</span>
                </button>
                <button
                    type="button"
                    aria-pressed={videoOn}
                    disabled={row.video === 'none'}
                    className="run-compare-roster-action"
                    onClick={() => onEdit({ kind: 'video', capId, on: !videoOn })}
                >
                    {videoOn ? <Video className="size-4" /> : <VideoOff className="size-4" />}
                    <span>Video</span>
                </button>
                {!row.frameSynced && <OffsetMenu row={row} onEdit={onEdit} />}
                <button
                    type="button"
                    disabled={only}
                    className="run-compare-roster-action"
                    onClick={() => onEdit({ kind: 'remove', capId })}
                >
                    <Trash2 className="size-4" />
                    <span>Remove</span>
                </button>
            </div>
        </li>
    )
}

interface RunsDrawerProps {
    open: boolean
    onClose: () => void
    rows: readonly RosterRow[]
    note: string | null
    onEdit: (edit: SetEdit) => void
    children?: ReactNode
}

export function RunsDrawer({ open, onClose, rows, note, onEdit, children }: RunsDrawerProps) {
    const panelRef = useRef<HTMLElement>(null)
    useModalBehaviour(panelRef, open, onClose, false)

    if (!open) return null

    const closeOnEscape = (event: KeyboardEvent<HTMLElement>) => {
        if (event.key !== 'Escape' || event.defaultPrevented || !event.currentTarget.contains(event.target as Node)) return
        event.preventDefault()
        onClose()
    }

    return (
        <div className="run-compare-drawer-layer">
            <section ref={panelRef} id="run-compare-drawer" aria-label="Runs" className="run-compare-drawer" onKeyDown={closeOnEscape}>
                <header className="run-compare-drawer-header">
                    <h2 className="text-base font-semibold text-foreground">Runs</h2>
                    <button type="button" aria-label="Close Runs" className="run-compare-roster-action" onClick={onClose}>
                        <X className="size-4" />
                    </button>
                </header>
                <p aria-live="polite" className={cn('run-compare-drawer-note text-sm text-muted-foreground', !note && 'sr-only')}>{note}</p>
                <ol aria-label="Roster" className="run-compare-roster">
                    {rows.map(row => <RosterItem key={row.capId} row={row} only={rows.length === 1} onEdit={onEdit} />)}
                </ol>
                {children}
            </section>
        </div>
    )
}
