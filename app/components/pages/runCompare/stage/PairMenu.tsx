import { Fragment } from 'react'
import { Link2 } from 'lucide-react'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu'
import type { SetEdit } from '../model/setEdits'
import type { PairMenu as PairMenuModel } from '../model/teamPairing'
import { TeamLabel } from './TeamLabel'

interface PairMenuProps {
    menu: PairMenuModel
    onEdit: (edit: SetEdit) => void
    variant: 'tile' | 'roster'
}

export const PAIRED_WITH = 'Paired With'

export function PairMenu({ menu, onEdit, variant }: PairMenuProps) {
    const grouped = menu.groups.length > 1
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                {variant === 'tile'
                    ? <button type="button" aria-label={PAIRED_WITH} className="run-compare-tile-action"><Link2 className="size-4" /></button>
                    : <button type="button" className="run-compare-roster-action"><Link2 className="size-4" /><span>{PAIRED_WITH}</span></button>}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="run-compare-pair-menu">
                <DropdownMenuLabel>{PAIRED_WITH}</DropdownMenuLabel>
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
                                    <PlayerInfo userId={option.run.user} alias={option.run.alias} title={option.run.title} size="sm" interactive={false} className="min-w-0" />
                                    <span className="run-compare-pair-match text-muted-foreground">{option.match ?? 'no match'}</span>
                                </DropdownMenuRadioItem>
                            ))}
                        </DropdownMenuRadioGroup>
                    </Fragment>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
