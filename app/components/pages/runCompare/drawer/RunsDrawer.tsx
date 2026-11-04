import { useEffect, useRef, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
import { Gauge, Pin, SlidersHorizontal, Trash2, Video, VideoOff, Volume2, VolumeX, X } from 'lucide-react'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu'
import { sheetBounds } from '@/app/components/ui/modalSheet'
import { useModalBehaviour } from '@/app/components/ui/useModalBehaviour'
import { getDeviceEnvironment, subscribeDeviceEnvironment } from '@/app/device/useDeviceEnvironment'
import { cn } from '@/lib/utils'
import type { SetEdit } from '../model/setEdits'
import type { PairMenu } from '../model/teamPairing'
import { PairMenu as PairMenuControl } from '../stage/PairMenu'
import { useSwipe } from '../stage/useSwipe'
import { formatOffset, offsetNudges } from './offsetNudge'
import { TeamIndex, TeamLabel } from '../stage/TeamLabel'
import { NOT_FRAME_SYNCED, type RosterRow, type TeamRosterGroup } from './rosterRows'

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
    audible: boolean
    onAudio: (capId: string) => void
    seat?: { index: number; colour: string }
    pairMenu?: PairMenu | null
    driving?: boolean | null
}

function AudioToggle({ row, audible, onAudio }: Pick<RosterItemProps, 'row' | 'audible' | 'onAudio'>) {
    return (
        <button
            type="button"
            aria-pressed={audible}
            disabled={row.video !== 'on'}
            className="run-compare-roster-action"
            onClick={() => onAudio(row.capId)}
        >
            {audible ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
            <span>Audio</span>
        </button>
    )
}

function RosterItem({ row, only, onEdit, audible, onAudio, seat, pairMenu = null, driving = null }: RosterItemProps) {
    const { run, capId } = row
    const videoOn = row.video === 'on'
    return (
        <li className="run-compare-roster-row">
            <div className="run-compare-roster-who run-compare-row">
                {seat && <TeamIndex index={seat.index} colour={seat.colour} />}
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
                {!seat && <button
                    type="button"
                    aria-pressed={row.pinned}
                    className="run-compare-roster-action"
                    onClick={() => onEdit({ kind: row.pinned ? 'unpin' : 'pin', capId })}
                >
                    <Pin className="size-4" />
                    <span>Pin</span>
                </button>}
                <button
                    type="button"
                    aria-pressed={videoOn}
                    disabled={row.video === 'none'}
                    className="run-compare-roster-action"
                    onClick={() => onEdit({ kind: 'video', capId, on: !videoOn })}
                >
                    {videoOn ? <Video className="size-4" /> : <VideoOff className="size-4" />}
                    <span>{seat ? 'POV' : 'Video'}</span>
                </button>
                <AudioToggle row={row} audible={audible} onAudio={onAudio} />
                {pairMenu && <PairMenuControl menu={pairMenu} onEdit={onEdit} variant="roster" />}
                {driving !== null && (
                    <button
                        type="button"
                        aria-pressed={driving}
                        className="run-compare-roster-action"
                        onClick={() => onEdit({ kind: 'drive', capId })}
                    >
                        <Gauge className="size-4" />
                        <span>Drives Sync</span>
                    </button>
                )}
                {!row.frameSynced && <OffsetMenu row={row} onEdit={onEdit} />}
                {!seat && <RemoveButton disabled={only} onRemove={() => onEdit({ kind: 'remove', capId })} />}
            </div>
        </li>
    )
}

function RemoveButton({ disabled, onRemove }: { disabled: boolean; onRemove: () => void }) {
    return (
        <button type="button" disabled={disabled} className="run-compare-roster-action" onClick={onRemove}>
            <Trash2 className="size-4" />
            <span>Remove</span>
        </button>
    )
}

interface TeamRosterItemProps {
    group: TeamRosterGroup
    only: boolean
    onEdit: (edit: SetEdit) => void
    audible: string | null
    onAudio: (capId: string) => void
}

function TeamRosterItem({ group, only, onEdit, audible, onAudio }: TeamRosterItemProps) {
    const { row, members } = group
    return (
        <li className="run-compare-roster-team">
            <div className="run-compare-roster-row">
                <div className="run-compare-roster-who run-compare-row">
                    <span className="run-compare-team-bar" style={{ background: row.colour }} />
                    <TeamLabel row={row} className="min-w-0" />
                    <span className="font-mono tabular-nums text-foreground">{row.time}</span>
                </div>
                {(row.reference || row.badges.length > 0) && (
                    <div className="run-compare-roster-badges">
                        {row.reference && <span className="run-compare-badge is-reference">REF</span>}
                        {row.badges.map(badge => <span key={badge} className="run-compare-badge">{badge}</span>)}
                    </div>
                )}
                <div className="run-compare-roster-actions">
                    <button
                        type="button"
                        aria-pressed={row.pinned}
                        className="run-compare-roster-action"
                        onClick={() => onEdit({ kind: row.pinned ? 'unpin' : 'pin', capId: row.teamCapId })}
                    >
                        <Pin className="size-4" />
                        <span>Pin</span>
                    </button>
                    <RemoveButton disabled={only} onRemove={() => onEdit({ kind: 'remove', capId: row.teamCapId })} />
                </div>
            </div>
            <ol aria-label="Members" className="run-compare-roster-members">
                {members.map(({ roster, index, menu, driving }) => (
                    <RosterItem
                        key={roster.capId}
                        row={roster}
                        only={false}
                        onEdit={onEdit}
                        audible={audible === roster.capId}
                        onAudio={onAudio}
                        seat={{ index, colour: row.colour }}
                        pairMenu={menu}
                        driving={driving}
                    />
                ))}
            </ol>
        </li>
    )
}

interface RunsDrawerProps {
    open: boolean
    onClose: () => void
    rows: readonly RosterRow[]
    note: string | null
    onEdit: (edit: SetEdit) => void
    audible: string | null
    onAudio: (capId: string) => void
    sheet: boolean
    teams?: readonly TeamRosterGroup[]
    children?: ReactNode
}

function useSheetAboveKeyboard(layerRef: RefObject<HTMLElement | null>, active: boolean) {
    useEffect(() => {
        const layer = layerRef.current
        if (!layer || !active) return
        const follow = () => {
            const bounds = sheetBounds(getDeviceEnvironment().viewport)
            const covered = bounds ? Math.max(0, window.innerHeight - bounds.top - bounds.height) : 0
            layer.style.setProperty('--run-compare-keyboard', `${Math.round(covered)}px`)
            layer.style.setProperty('--run-compare-visible-height', `${Math.round(bounds?.height ?? window.innerHeight)}px`)
        }
        follow()
        return subscribeDeviceEnvironment(follow)
    }, [layerRef, active])
}

export function RunsDrawer({ open, onClose, rows, note, onEdit, audible, onAudio, sheet, teams = [], children }: RunsDrawerProps) {
    const panelRef = useRef<HTMLElement>(null)
    const layerRef = useRef<HTMLDivElement>(null)
    const swipeClose = useSwipe(direction => {
        if (direction === 'down') onClose()
    })
    useModalBehaviour(panelRef, open, onClose, false)
    useSheetAboveKeyboard(layerRef, open && sheet)

    if (!open) return null

    const closeOnEscape = (event: KeyboardEvent<HTMLElement>) => {
        if (event.key !== 'Escape' || event.defaultPrevented || !event.currentTarget.contains(event.target as Node)) return
        event.preventDefault()
        onClose()
    }

    return (
        <div ref={layerRef} className={cn('run-compare-drawer-layer', sheet && 'is-sheet')}>
            <section ref={panelRef} id="run-compare-drawer" aria-label="Runs" className="run-compare-drawer" onKeyDown={closeOnEscape}>
                <header className="run-compare-drawer-header" {...(sheet ? swipeClose : {})}>
                    {sheet && <span aria-hidden className="run-compare-sheet-handle" />}
                    <h2 className="text-base font-semibold text-foreground">Runs</h2>
                    <button type="button" aria-label="Close Runs" className="run-compare-roster-action" onClick={onClose}>
                        <X className="size-4" />
                    </button>
                </header>
                <p aria-live="polite" className={cn('run-compare-drawer-note text-sm text-muted-foreground', !note && 'sr-only')}>{note}</p>
                <ol aria-label="Roster" className="run-compare-roster">
                    {teams.length > 0
                        ? teams.map(group => <TeamRosterItem key={group.row.teamCapId} group={group} only={teams.length === 1} onEdit={onEdit} audible={audible} onAudio={onAudio} />)
                        : rows.map(row => <RosterItem key={row.capId} row={row} only={rows.length === 1} onEdit={onEdit} audible={audible === row.capId} onAudio={onAudio} />)}
                </ol>
                {children}
            </section>
        </div>
    )
}
