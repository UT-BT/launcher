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

export const LEAF =
    'M12 1.5 C17.5 5.5 20 11 16.6 17 C15.2 19.4 13.4 20.6 12 21 C10.6 20.6 8.8 19.4 7.4 17 C4 11 6.5 5.5 12 1.5 Z'

export const LEAF_VEIN = 'M12 4.5 L12 23'

export const BLOSSOM_COLORS = ['#fbcfe8', '#f9a8d4', '#fce7f3', '#f5d0fe']

export const LEAF_COLORS = ['#d97706', '#c2410c', '#ca8a04', '#b45309', '#9a3412']

export const ICE_CRYSTAL =
    'M12 3V21M4.2 7.5L19.8 16.5M4.2 16.5L19.8 7.5M12 6.5L13.9 4.2M12 6.5L10.1 4.2M12 17.5L10.1 19.8M12 17.5L13.9 19.8M7.2 9.2L6.2 6.4M7.2 9.2L4.3 9.8M7.2 14.8L4.3 14.2M7.2 14.8L6.2 17.6M16.8 14.8L17.8 17.6M16.8 14.8L19.7 14.2M16.8 9.2L19.7 9.8M16.8 9.2L17.8 6.4'
