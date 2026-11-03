import { runName, RunIdentity } from '../analysis/RunIdentity'
import type { TileSlot } from '../model/raceModel'
import type { StageView } from '../model/phoneStage'
import { NO_TEAMS, type TeamModel } from '../model/teamModel'
import { TeamIndex } from './TeamLabel'

interface PovSwitcherProps {
    tiles: readonly TileSlot[]
    view: StageView
    onPov: (capId: string) => void
    teams?: TeamModel
}

export function PovSwitcher({ tiles, view, onPov, teams = NO_TEAMS }: PovSwitcherProps) {
    const shown = new Set(view.visible)
    const chip = (slot: TileSlot) => {
        const seat = teams.seats.get(slot.id)
        return (
            <button
                key={slot.id}
                type="button"
                aria-label={runName(slot.run)}
                aria-pressed={shown.has(slot.id)}
                className="run-compare-pov-chip"
                onClick={() => onPov(slot.id)}
            >
                {seat && <TeamIndex index={seat.index} colour={seat.colour} />}
                <RunIdentity run={slot.run} />
            </button>
        )
    }
    const groups = teams.rows
        .map(row => ({ row, slots: tiles.filter(slot => teams.seats.get(slot.id)?.teamCapId === row.teamCapId) }))
        .filter(group => group.slots.length > 0)
    return (
        <div role="group" aria-label="Point of View" className="run-compare-pov">
            {groups.length > 0
                ? groups.map(({ row, slots }) => (
                    <div key={row.teamCapId} role="group" aria-label={row.label} className="run-compare-pov-team">
                        <span className="run-compare-team-bar" style={{ background: row.colour }} />
                        {slots.map(chip)}
                    </div>
                ))
                : tiles.map(chip)}
        </div>
    )
}
