export type MedalThresholdKey = 'champion_medal' | 'gold_medal' | 'silver_medal' | 'bronze_medal'

export type MedalThresholds = { world_record: number } & Record<MedalThresholdKey, number>

export const MEDAL_MULTIPLIERS: Record<MedalThresholdKey, number> = {
    champion_medal: 1.025,
    gold_medal: 1.125,
    silver_medal: 1.30,
    bronze_medal: 1.60,
}

export function medalThresholdsFromWorldRecord(worldRecord: number): MedalThresholds {
    return {
        world_record: worldRecord,
        champion_medal: worldRecord * MEDAL_MULTIPLIERS.champion_medal,
        gold_medal: worldRecord * MEDAL_MULTIPLIERS.gold_medal,
        silver_medal: worldRecord * MEDAL_MULTIPLIERS.silver_medal,
        bronze_medal: worldRecord * MEDAL_MULTIPLIERS.bronze_medal,
    }
}

export function medalMultiplierLabel(key: MedalThresholdKey): string {
    const percent = Number(((MEDAL_MULTIPLIERS[key] - 1) * 100).toFixed(1))
    return `WR + ${percent}%`
}

export function teamWorldRecord(runs: { verified: boolean; cap_time_seconds: number }[]): number | null {
    const verifiedTimes = runs.filter(run => run.verified).map(run => run.cap_time_seconds)
    return verifiedTimes.length === 0 ? null : Math.min(...verifiedTimes)
}
