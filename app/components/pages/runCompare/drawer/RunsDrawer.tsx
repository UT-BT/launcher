import { useEffect, useRef, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
import { Volume2, VolumeX, X } from 'lucide-react'
import { TONE_TEXT } from '@/app/components/pages/capDetail/runDelta/deltaStyles'
import { sheetBounds } from '@/app/components/ui/modalSheet'
import { useModalBehaviour } from '@/app/components/ui/useModalBehaviour'
import { getDeviceEnvironment, subscribeDeviceEnvironment } from '@/app/device/useDeviceEnvironment'
import { cn } from '@/lib/utils'
import { RunIdentity, runName } from '../analysis/RunIdentity'
import { MAX_TEAM_RUNS } from '../model/teamModel'
import type { SetEdit } from '../model/setEdits'
import type { PairMenu } from '../model/teamPairing'
import { RunMenu } from '../stage/RunMenu'
import { BaselineTag, NoteTags, OlderVideoTag, SideTag } from '../stage/Tags'
import { TeamIndex, TeamLabel } from '../stage/TeamLabel'
import { useSwipe } from '../stage/useSwipe'
import { MAX_COMPARE_RUNS } from '../url/compareUrl'
import type { RosterRow, TeamRosterGroup } from './rosterRows'

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

function RosterItem({ row, only, onEdit, audible, onAudio, seat, pairMenu = null, driving = null }: RosterItemProps) {
    const { run, capId } = row
    return (
        <li className={cn('run-compare-roster-row', seat && 'is-member')}>
            {seat && <TeamIndex index={seat.index} colour={seat.colour} />}
            <div className="run-compare-roster-who">
                <RunIdentity run={run} presentation="full" withTitle={false} />
                <span className="run-compare-roster-tags">
                    <span className="run-compare-roster-time font-mono tabular-nums">{row.time}</span>
                    <SideTag side={run.side} label={row.sideLabel} />
                    <OlderVideoTag shown={!row.frameSynced} />
                    <NoteTags notes={row.badges} />
                </span>
            </div>
            {!seat && (row.gap
                ? <span className={cn('run-compare-roster-gap font-mono tabular-nums', TONE_TEXT[row.gap.tone])}>{row.gap.label}</span>
                : row.reference && <BaselineTag />)}
            <button
                type="button"
                aria-label={`Sound from ${runName(run)}`}
                aria-pressed={audible}
                disabled={row.video !== 'on'}
                className="run-compare-icon-button run-compare-sound"
                onClick={() => onAudio(capId)}
            >
                {audible ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
            </button>
            <RunMenu
                capId={capId}
                run={run}
                baseline={seat ? null : { pinned: row.pinned, reference: row.reference }}
                video={row.video}
                offset={row.frameSynced ? null : { offsetMs: row.offsetMs, fps: row.fps }}
                pairMenu={pairMenu}
                driving={driving}
                removable={seat ? null : !only}
                onEdit={onEdit}
            />
        </li>
    )
}

interface TeamRosterItemProps {
    group: TeamRosterGroup
    only: boolean
    onEdit: (edit: SetEdit) => void
    audible: readonly string[]
    onAudio: (capId: string) => void
}

function TeamRosterItem({ group, only, onEdit, audible, onAudio }: TeamRosterItemProps) {
    const { row, members } = group
    return (
        <li className="run-compare-roster-team">
            <div className="run-compare-roster-row is-team">
                <span className="run-compare-team-swatch" style={{ background: row.colour }} />
                <div className="run-compare-roster-who">
                    <TeamLabel row={row} withTitle={false} />
                    <span className="run-compare-roster-tags"><NoteTags notes={row.badges} /></span>
                </div>
                <span className="run-compare-roster-time font-mono tabular-nums">{row.time}</span>
                {row.reference && <BaselineTag />}
                <RunMenu
                    capId={row.teamCapId}
                    run={row.team.members[0]}
                    name={row.label}
                    baseline={{ pinned: row.pinned, reference: row.reference }}
                    video={null}
                    offset={null}
                    pairMenu={null}
                    driving={null}
                    removable={!only}
                    onEdit={onEdit}
                />
            </div>
            <ol aria-label="Members" className="run-compare-roster-members">
                {members.map(({ roster, index, menu, driving }) => (
                    <RosterItem
                        key={roster.capId}
                        row={roster}
                        only={false}
                        onEdit={onEdit}
                        audible={audible.includes(roster.capId)}
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
    audible: readonly string[]
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

export function runsCount(rows: number, teams: number): string {
    return teams > 0 ? `${teams} of ${MAX_TEAM_RUNS} team runs` : `${rows} of ${MAX_COMPARE_RUNS}`
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
                    <span className="text-sm text-muted-foreground">{runsCount(rows.length, teams.length)}</span>
                    <button type="button" aria-label="Close Runs" className="run-compare-icon-button run-compare-drawer-close" onClick={onClose}>
                        <X className="size-4" />
                    </button>
                </header>
                <p aria-live="polite" className={cn('run-compare-drawer-note text-sm text-muted-foreground', !note && 'sr-only')}>{note}</p>
                <div className="run-compare-drawer-section">
                    <h3 className="run-compare-section-label">In This Comparison</h3>
                    <ol aria-label="Roster" className="run-compare-roster">
                        {teams.length > 0
                            ? teams.map(group => <TeamRosterItem key={group.row.teamCapId} group={group} only={teams.length === 1} onEdit={onEdit} audible={audible} onAudio={onAudio} />)
                            : rows.map(row => <RosterItem key={row.capId} row={row} only={rows.length === 1} onEdit={onEdit} audible={audible.includes(row.capId)} onAudio={onAudio} />)}
                    </ol>
                </div>
                {children}
            </section>
        </div>
    )
}
