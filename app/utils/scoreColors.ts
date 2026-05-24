// Score = a 0–10 review/rating value (overall, aesthetics, learning, luck).
// `inverted` flips the palette so lower-is-better dimensions (luck, learning,
// in-review difficulty) read green-when-low instead of red-when-low.
//
// Thresholds are <=3 / <=7 so the yellow band brackets the "average to good"
// range (matches the rating tier definitions in MapsPage.tsx).

export function scoreTextColor(value: number, inverted = false): string {
    if (inverted) {
        if (value <= 3) return 'text-emerald-400'
        if (value <= 7) return 'text-yellow-400'
        return 'text-red-400'
    }
    if (value <= 3) return 'text-red-400'
    if (value <= 7) return 'text-yellow-400'
    return 'text-emerald-400'
}

export function scoreBgColor(value: number, inverted = false): string {
    if (inverted) {
        if (value <= 3) return 'bg-emerald-500'
        if (value <= 7) return 'bg-yellow-500'
        return 'bg-red-500'
    }
    if (value <= 3) return 'bg-red-500'
    if (value <= 7) return 'bg-yellow-500'
    return 'bg-emerald-500'
}

export function scoreSliderAccent(value: number, inverted = false): string {
    if (inverted) {
        if (value <= 3) return 'accent-emerald-500'
        if (value <= 7) return 'accent-yellow-500'
        return 'accent-red-500'
    }
    if (value <= 3) return 'accent-red-500'
    if (value <= 7) return 'accent-yellow-500'
    return 'accent-emerald-500'
}

// Difficulty = a 1-10 map-difficulty value tied to DIFFICULTY_RANGES
// (beginner 1-3, intermediate 4-6, advanced 7-8, expert 9-10). Yellow band
// covers the intermediate tier specifically — different from scoreTextColor.

export function difficultyTextColor(d: number): string {
    if (d <= 3) return 'text-green-400'
    if (d <= 6) return 'text-yellow-400'
    return 'text-red-400'
}

export function difficultyBgColor(d: number): string {
    if (d <= 3) return 'bg-green-500'
    if (d <= 6) return 'bg-yellow-500'
    return 'bg-red-500'
}
