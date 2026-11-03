import type { RaceModel } from './raceModel'

export function audibleRun(race: RaceModel, audioFrom: string | null): string | null {
    return audioFrom !== null && race.tiles.some(tile => tile.id === audioFrom) ? audioFrom : null
}

export function chooseAudio(race: RaceModel, audible: string | null, capId: string): string | null {
    if (capId === audible) return null
    return race.tiles.some(tile => tile.id === capId) ? capId : audible
}
