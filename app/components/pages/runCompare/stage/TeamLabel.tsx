import { Fragment } from 'react'
import { cn } from '@/lib/utils'
import { RunIdentity } from '../analysis/RunIdentity'
import type { TeamRow } from '../model/teamModel'

interface TeamLabelProps {
    row: Pick<TeamRow, 'label' | 'team'>
    className?: string
}

export function TeamLabel({ row, className }: TeamLabelProps) {
    return (
        <span className={cn('run-compare-team-label', className)}>
            <span className="sr-only">{row.label}</span>
            {row.team.members.map((member, i) => (
                <Fragment key={member.capId}>
                    {i > 0 && <span aria-hidden className="run-compare-team-join">&amp;</span>}
                    <RunIdentity run={member} />
                </Fragment>
            ))}
        </span>
    )
}

export function TeamIndex({ index, colour }: { index: number; colour: string }) {
    return (
        <span className="run-compare-team-index" style={{ borderColor: colour, color: colour }}>
            <span className="sr-only">Role </span>{index}
        </span>
    )
}
