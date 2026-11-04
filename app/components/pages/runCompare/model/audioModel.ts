import type { RaceModel } from './raceModel'

function hasTile(race: RaceModel, capId: string): boolean {
    return race.tiles.some(tile => tile.id === capId)
}

export function audibleRuns(race: RaceModel, audioFrom: readonly string[] | null): string[] {
    return (audioFrom ?? []).filter(capId => hasTile(race, capId))
}

export function toggleAudio(race: RaceModel, audible: readonly string[], capId: string): string[] {
    if (audible.includes(capId)) return audible.filter(id => id !== capId)
    return hasTile(race, capId) ? [...audible, capId] : [...audible]
}

export function audioOnFocus(audible: readonly string[], capId: string): string[] {
    return audible.includes(capId) ? [...audible] : [capId]
}
