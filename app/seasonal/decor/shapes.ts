export const BAT_WING =
    'M18.5 7.5 C14 4.5 8 2.4 1 3.2 C3 4.6 4 6.4 4.2 8.6 C5.8 7.6 7.8 7.8 8.8 9.6 C10.2 8.6 12.4 8.8 13.4 10.8 C15 10 17 10.6 18.5 12.4 Z'

export const BAT_BODY =
    'M20 4.6 L18.9 2.4 L18.5 5.6 C17.6 6.6 17.4 9 18 11.2 C18.6 13.4 19.4 14.6 20 15 C20.6 14.6 21.4 13.4 22 11.2 C22.6 9 22.4 6.6 21.5 5.6 L21.1 2.4 Z'

export const MIRROR_BAT = 'matrix(-1 0 0 1 40 0)'

export function seededRandom(seed: number): () => number {
    let state = seed
    return () => {
        state = (state * 1664525 + 1013904223) % 4294967296
        return state / 4294967296
    }
}
