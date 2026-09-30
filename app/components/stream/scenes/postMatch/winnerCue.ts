export interface WinnerCueMemory {
    matchId: string | null
    done: boolean
}

export interface WinnerCueSight {
    matchId: string
    decided: boolean
    active: boolean
}

export const WINNER_CUE_START: WinnerCueMemory = { matchId: null, done: false }

export function winnerCueStep(memory: WinnerCueMemory, { matchId, decided, active }: WinnerCueSight): { memory: WinnerCueMemory; play: boolean } {
    if (memory.matchId !== matchId) return { memory: { matchId, done: decided }, play: false }
    if (memory.done || !decided || !active) return { memory, play: false }
    return { memory: { matchId, done: true }, play: true }
}
