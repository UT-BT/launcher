export type DifficultyTierValue = 'beginner' | 'intermediate' | 'advanced' | 'expert'

export const DIFFICULTY_TIER_RANGES: Record<DifficultyTierValue, [number, number]> = {
    beginner: [1, 3],
    intermediate: [4, 6],
    advanced: [7, 8],
    expert: [9, 10],
}

export const DIFFICULTY_TIER_OPTIONS: [DifficultyTierValue, string][] = [
    ['beginner', 'Beginner (1–3)'],
    ['intermediate', 'Intermediate (4–6)'],
    ['advanced', 'Advanced (7–8)'],
    ['expert', 'Expert (9–10)'],
]

export const DIFFICULTY_TIER_LABEL: Record<DifficultyTierValue, string> =
    Object.fromEntries(DIFFICULTY_TIER_OPTIONS) as Record<DifficultyTierValue, string>

export function expandDifficultyTiers(tiers: DifficultyTierValue[]): number[] {
    const out = new Set<number>()
    for (const t of tiers) {
        const [lo, hi] = DIFFICULTY_TIER_RANGES[t]
        for (let d = lo; d <= hi; d++) out.add(d)
    }
    return [...out].sort((a, b) => a - b)
}
