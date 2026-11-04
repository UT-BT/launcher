import type { RaceModel } from './raceModel'
import type { TeamModel } from './teamModel'

function hasTile(race: RaceModel, capId: string | null): capId is string {
    return capId !== null && race.tiles.some(tile => tile.id === capId)
}

export function toggleFocus(race: RaceModel, focused: string | null, capId: string): string | null {
    if (capId === focused) return null
    return hasTile(race, capId) ? capId : focused
}

export function focusAt(race: RaceModel, n: number): string | null {
    return race.tiles[n - 1]?.id ?? null
}

export function rowFocusAt(race: RaceModel, teams: Pick<TeamModel, 'rows' | 'seats'>, n: number): string | null {
    const shown = teams.rows.filter(row => race.tiles.some(tile => teams.seats.get(tile.id)?.teamCapId === row.teamCapId))
    return shown[n - 1]?.teamCapId ?? null
}

export function rowAudio(race: RaceModel, teams: Pick<TeamModel, 'seats'>, teamCapId: string, audible: readonly string[]): string[] {
    const row = race.tiles.filter(tile => teams.seats.get(tile.id)?.teamCapId === teamCapId).map(tile => tile.id)
    const inRow = audible.filter(capId => row.includes(capId))
    if (inRow.length > 0) return inRow
    return row.length > 0 ? [row[0]] : [...audible]
}

export function nextAudio(race: RaceModel, audible: readonly string[]): string[] {
    const ids = race.tiles.map(tile => tile.id)
    const last = audible.length > 0 ? audible[audible.length - 1] : null
    if (!hasTile(race, last)) return ids.slice(0, 1)
    const next = ids[ids.indexOf(last) + 1]
    return next ? [next] : []
}
