import type { MedalHuntOpportunity } from './api'

export type TargetMedal = MedalHuntOpportunity['targetMedal']

export interface Opportunity extends MedalHuntOpportunity {
  worldRecordAddedTime: number
}

export function parseDateTime(value: string | null | undefined): number {
  if (!value) return 0
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : 0
}

export function toOpportunities(rows: MedalHuntOpportunity[]): Opportunity[] {
  return rows.map((row) => ({
    ...row,
    worldRecordAddedTime: parseDateTime(row.worldRecordAdded),
  }))
}
