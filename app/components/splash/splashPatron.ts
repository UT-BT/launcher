import type { PatreonTier } from '@/app/utils/patreon'

export type PatronCandidate = { id: string; tier: PatreonTier }

export function patronDrawOrder(members: PatronCandidate[], random: () => number = Math.random): string[] {
  return members
    .map((member) => ({ id: member.id, key: Math.pow(random(), 1 / member.tier) }))
    .sort((a, b) => b.key - a.key)
    .map((entry) => entry.id)
}
