import type { BestCap, MapMetadata } from './api'

export type TargetMedal = 'Bronze Medal' | 'Silver Medal' | 'Gold Medal' | 'Champion Medal' | 'World Record'

export interface Opportunity {
  mapName: string
  difficulty: number
  currentTime: number
  targetTime: number
  targetMedal: TargetMedal
  improvement: number
  improvementPct: number
  worldRecordAdded: string | null
  worldRecordAddedTime: number
}

const CERTIFIED_CAP_TYPE = 2
const WR_EPSILON_SECONDS = 0.0005

type MedalThreshold = { medal: TargetMedal; time: number | undefined }

function getMedalThresholds(map: MapMetadata): MedalThreshold[] {
  return [
    { medal: 'Bronze Medal', time: map.bronze_medal },
    { medal: 'Silver Medal', time: map.silver_medal },
    { medal: 'Gold Medal', time: map.gold_medal },
    { medal: 'Champion Medal', time: map.champion_medal },
    { medal: 'World Record', time: map.world_record },
  ]
}

function nextTarget(
  cap: BestCap,
  thresholds: MedalThreshold[]
): Pick<Opportunity, 'targetMedal' | 'targetTime'> | null {
  if (cap.cap_type !== CERTIFIED_CAP_TYPE || cap.cap_time_seconds <= 0) return null

  const time = cap.cap_time_seconds
  for (const threshold of thresholds) {
    if (threshold.time == null || threshold.time <= 0) continue
    if (time - threshold.time > WR_EPSILON_SECONDS) {
      return { targetMedal: threshold.medal, targetTime: threshold.time }
    }
  }

  return null
}

export function parseDateTime(value: string | null | undefined): number {
  if (!value) return 0
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : 0
}

export function buildOpportunities(
  bestCaps: BestCap[],
  maps: MapMetadata[],
  worldRecordDatesByMap: Record<string, string | null> = {}
): Opportunity[] {
  const mapsByName = new Map(maps.map((map) => [map.name, map]))
  const thresholdsByName = new Map(maps.map((map) => [map.name, getMedalThresholds(map)]))

  return bestCaps
    .map((cap) => {
      const map = mapsByName.get(cap.map)
      if (!map) return null
      const thresholds = thresholdsByName.get(cap.map)
      if (!thresholds) return null
      const target = nextTarget(cap, thresholds)
      if (!target) return null
      const improvement = cap.cap_time_seconds - target.targetTime
      if (improvement <= WR_EPSILON_SECONDS) return null

      return {
        mapName: cap.map,
        difficulty: map.difficulty,
        currentTime: cap.cap_time_seconds,
        targetTime: target.targetTime,
        targetMedal: target.targetMedal,
        improvement,
        improvementPct: improvement / cap.cap_time_seconds,
        worldRecordAdded: worldRecordDatesByMap[cap.map] ?? null,
        worldRecordAddedTime: parseDateTime(worldRecordDatesByMap[cap.map]),
      } satisfies Opportunity
    })
    .filter((item): item is Opportunity => item !== null)
    .sort((a, b) => {
      const pct = a.improvementPct - b.improvementPct
      return Math.abs(pct) > 0.0001 ? pct : a.improvement - b.improvement
    })
}
