import { Fragment } from 'react'
import { MoreHorizontal } from 'lucide-react'
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { RunIdentity, runName } from '../analysis/RunIdentity'
import { formatOffset, offsetNudges } from '../drawer/offsetNudge'
import type { RosterVideo } from '../drawer/rosterRows'
import type { SoloRun } from '../loading/soloRuns'
import type { SetEdit } from '../model/setEdits'
import type { PairMenu } from '../model/teamPairing'
import { TeamLabel } from './TeamLabel'

export const SET_AS_BASELINE = 'Set as Baseline'
export const UNPIN_BASELINE = 'Unpin Baseline'
export const HIDE_VIDEO = 'Hide Video, Keep the Graph'
export const SHOW_VIDEO = 'Show Video'
export const LEADS_SAME_SPOT = 'Leads Same Spot Sync'

export interface RunMenuOffset {
    offsetMs: number
    fps: number
}

export interface RunMenuProps {
    capId: string
    run: SoloRun
    baseline: { pinned: boolean; reference: boolean } | null
    video: RosterVideo | null
    offset: RunMenuOffset | null
    pairMenu: PairMenu | null
    driving: boolean | null
    removable: boolean | null
    onEdit: (edit: SetEdit) => void
    name?: string
    className?: string
}

function OffsetItems({ capId, offset, onEdit }: { capId: string; offset: RunMenuOffset; onEdit: (edit: SetEdit) => void }) {
    return (
        <DropdownMenuSub>
            <DropdownMenuSubTrigger>Adjust Sync · {formatOffset(offset.offsetMs)}</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="run-compare-menu">
                {offsetNudges(offset.fps).map(nudge => (
                    <DropdownMenuItem
                        key={nudge.label}
                        onSelect={event => {
                            event.preventDefault()
                            onEdit({ kind: 'offset', capId, ms: offset.offsetMs + nudge.ms })
                        }}
                    >
                        {nudge.label}
                    </DropdownMenuItem>
                ))}
                <DropdownMenuItem disabled={offset.offsetMs === 0} onSelect={() => onEdit({ kind: 'offset', capId, ms: 0 })}>
                    Reset
                </DropdownMenuItem>
            </DropdownMenuSubContent>
        </DropdownMenuSub>
    )
}

function PairItems({ run, menu, onEdit }: { run: SoloRun; menu: PairMenu; onEdit: (edit: SetEdit) => void }) {
    const grouped = menu.groups.length > 1
    return (
        <>
            <DropdownMenuLabel className="run-compare-menu-heading">Compare {runName(run)} With</DropdownMenuLabel>
            {menu.groups.map(group => (
                <Fragment key={group.row.teamCapId}>
                    {grouped && (
                        <DropdownMenuLabel className="run-compare-row run-compare-pair-team">
                            <span className="run-compare-team-bar" style={{ background: group.row.colour }} />
                            <TeamLabel row={group.row} className="min-w-0" />
                        </DropdownMenuLabel>
                    )}
                    {group.options.length === 0 && <DropdownMenuItem disabled>Nobody on the same side</DropdownMenuItem>}
                    <DropdownMenuRadioGroup value={group.options.find(option => option.current)?.capId ?? ''}>
                        {group.options.map(option => (
                            <DropdownMenuRadioItem
                                key={option.capId}
                                value={option.capId}
                                className="run-compare-pair-option"
                                onSelect={() => {
                                    if (!option.current) onEdit({ kind: 'pair', capId: menu.capId, partner: option.capId })
                                }}
                            >
                                <RunIdentity run={option.run} withTitle={false} />
                                <span className="run-compare-pair-match text-muted-foreground">{option.match ?? 'no match'}</span>
                            </DropdownMenuRadioItem>
                        ))}
                    </DropdownMenuRadioGroup>
                </Fragment>
            ))}
        </>
    )
}

export function RunMenu({ capId, run, baseline, video, offset, pairMenu, driving, removable, onEdit, name, className }: RunMenuProps) {
    const showBaseline = baseline !== null && (baseline.pinned || !baseline.reference)
    const showVideo = video === 'on' || video === 'off'
    const general = showBaseline || showVideo || offset !== null || driving !== null
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button type="button" aria-label={`More for ${name ?? runName(run)}`} className={cn('run-compare-icon-button', className)}>
                    <MoreHorizontal className="size-4" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="run-compare-menu">
                {showBaseline && (
                    <DropdownMenuItem onSelect={() => onEdit({ kind: baseline.pinned ? 'unpin' : 'pin', capId })}>
                        {baseline.pinned ? UNPIN_BASELINE : SET_AS_BASELINE}
                    </DropdownMenuItem>
                )}
                {showVideo && (
                    <DropdownMenuItem onSelect={() => onEdit({ kind: 'video', capId, on: video === 'off' })}>
                        {video === 'on' ? HIDE_VIDEO : SHOW_VIDEO}
                    </DropdownMenuItem>
                )}
                {offset && <OffsetItems capId={capId} offset={offset} onEdit={onEdit} />}
                {driving !== null && (
                    <DropdownMenuCheckboxItem checked={driving} onSelect={() => onEdit({ kind: 'drive', capId })}>
                        {LEADS_SAME_SPOT}
                    </DropdownMenuCheckboxItem>
                )}
                {pairMenu && (
                    <>
                        {general && <DropdownMenuSeparator />}
                        <PairItems run={run} menu={pairMenu} onEdit={onEdit} />
                    </>
                )}
                {removable !== null && (
                    <>
                        {(general || pairMenu) && <DropdownMenuSeparator />}
                        <DropdownMenuItem disabled={!removable} className="run-compare-menu-danger" onSelect={() => onEdit({ kind: 'remove', capId })}>
                            Remove
                        </DropdownMenuItem>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
