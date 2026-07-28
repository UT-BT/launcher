import type { BestCap, MapMetadata } from '@/app/utils/api'
import championIcon from '@/app/assets/champion.webp'
import goldIcon from '@/app/assets/gold.webp'
import silverIcon from '@/app/assets/silver.webp'
import bronzeIcon from '@/app/assets/bronze.webp'
import certifiedIcon from '@/app/assets/certified.webp'
import casualIcon from '@/app/assets/casual.webp'
import worldRecordIcon from '@/app/assets/world_record.webp'

export type MedalTier = 'uncapped' | 'casual' | 'verified' | 'bronze' | 'silver' | 'gold' | 'champion' | 'world_record'

export const TIER_ICONS: Record<Exclude<MedalTier, 'uncapped'>, string> = {
    casual: casualIcon,
    verified: certifiedIcon,
    bronze: bronzeIcon,
    silver: silverIcon,
    gold: goldIcon,
    champion: championIcon,
    world_record: worldRecordIcon,
}

export const TIER_LABELS: Record<MedalTier, string> = {
    uncapped: 'Uncapped',
    casual: 'Casual',
    verified: 'Certified',
    bronze: 'Bronze',
    silver: 'Silver',
    gold: 'Gold',
    champion: 'Champion',
    world_record: 'World Record',
}

export const TIER_RANK: Record<MedalTier, number> = {
    uncapped: 0,
    casual: 1,
    verified: 2,
    bronze: 3,
    silver: 4,
    gold: 5,
    champion: 6,
    world_record: 7,
}

// Epsilon for matching a PB against a world record. Cap times are reported in
// seconds with sub-millisecond noise from server round-trips, so an exact ===
// comparison would never trigger the world_record tier.
const WR_TIME_EPSILON_SECONDS = 0.0005

export function computeMedalTier(
    bestCap: BestCap | undefined,
    map: (Pick<MapMetadata, 'bronze_medal' | 'silver_medal' | 'gold_medal' | 'champion_medal'> & { world_record?: number }) | undefined,
): MedalTier {
    if (!bestCap) return 'uncapped'
    if (bestCap.cap_type !== 2) return 'casual'
    if (!map) return 'verified'
    const t = bestCap.cap_time_seconds
    if (map.world_record != null && map.world_record > 0 && t - map.world_record <= WR_TIME_EPSILON_SECONDS) return 'world_record'
    if (map.champion_medal != null && t <= map.champion_medal) return 'champion'
    if (map.gold_medal != null && t <= map.gold_medal) return 'gold'
    if (map.silver_medal != null && t <= map.silver_medal) return 'silver'
    if (map.bronze_medal != null && t <= map.bronze_medal) return 'bronze'
    return 'verified'
}
