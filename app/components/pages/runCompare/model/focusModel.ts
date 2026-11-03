import type { RaceModel } from './raceModel'

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

export function nextAudio(race: RaceModel, audible: string | null): string | null {
    const ids = race.tiles.map(tile => tile.id)
    if (!hasTile(race, audible)) return ids[0] ?? null
    return ids[ids.indexOf(audible) + 1] ?? null
}
