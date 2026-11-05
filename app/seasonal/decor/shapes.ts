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

export const STAR = 'M12 2 L14.9 8.6 L22 9.3 L16.6 14 L18.2 21 L12 17.3 L5.8 21 L7.4 14 L2 9.3 L9.1 8.6 Z'

export const SPARKLE = 'M12 1 C12.8 8 16 11.2 23 12 C16 12.8 12.8 16 12 23 C11.2 16 8 12.8 1 12 C8 11.2 11.2 8 12 1 Z'

export const GOLD_COLORS = ['#fde68a', '#facc15', '#fbbf24', '#fef3c7']

export const FIREWORK_COLORS = ['#fde68a', '#f9a8d4', '#67e8f9', '#c7d2fe']

export const LANTERN_BODY = 'M8 6H16C20 7.5 22 10.5 22 15S20 22.5 16 24H8C4 22.5 2 19.5 2 15S4 7.5 8 6Z'

export const LANTERN_CAPS = 'M8 4H16V6H8ZM8 24H16V26H8Z'

export const LANTERN_RIBS = 'M12 6V24M8 6.5C5.5 10 5.5 20 8 23.5M16 6.5C18.5 10 18.5 20 16 23.5'

export const LANTERN_TASSEL = 'M12 0V4M12 26V31'

export const COIN = 'M12 2A10 10 0 1 0 12 22A10 10 0 1 0 12 2ZM9.5 9.5V14.5H14.5V9.5Z'

export const HEART = 'M12 21 C12 21 2 14.6 2 8.4 C2 5.4 4.4 3 7.3 3 C9.3 3 11 4.1 12 5.8 C13 4.1 14.7 3 16.7 3 C19.6 3 22 5.4 22 8.4 C22 14.6 12 21 12 21 Z'

export const HEART_COLORS = ['#fb7185', '#fda4af', '#f43f5e', '#fecdd3']

export const SHAMROCK_LEAF =
    'M12 12 C9.5 10.2 6.6 8 6.6 5.4 C6.6 3.6 8 2.3 9.6 2.3 C10.7 2.3 11.5 2.9 12 3.8 C12.5 2.9 13.3 2.3 14.4 2.3 C16 2.3 17.4 3.6 17.4 5.4 C17.4 8 14.5 10.2 12 12 Z'

export const SHAMROCK_STEM = 'M12 12 C12.6 15.6 13.6 18.6 15.6 21.6'

export const SHAMROCK_ANGLES = [0, 120, 240]

export const SHAMROCK_COLORS = ['#4ade80', '#22c55e', '#86efac', '#16a34a']
