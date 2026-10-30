import { describe, expect, it } from 'vitest'
import { patronDrawOrder, type PatronCandidate } from './splashPatron'

function seeded(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

describe('patronDrawOrder', () => {
  it('returns nothing without patrons', () => {
    expect(patronDrawOrder([], seeded(1))).toEqual([])
  })

  it('lists every patron exactly once', () => {
    const members: PatronCandidate[] = [
      { id: 'a', tier: 1 },
      { id: 'b', tier: 2 },
      { id: 'c', tier: 3 },
      { id: 'd', tier: 1 },
    ]

    const order = patronDrawOrder(members, seeded(7))

    expect([...order].sort()).toEqual(['a', 'b', 'c', 'd'])
  })

  it('features higher tiers first more often', () => {
    const members: PatronCandidate[] = [
      { id: 'tier1', tier: 1 },
      { id: 'tier3', tier: 3 },
    ]
    const random = seeded(42)
    const firsts = { tier1: 0, tier3: 0 }

    for (let draw = 0; draw < 4000; draw++) {
      firsts[patronDrawOrder(members, random)[0] as keyof typeof firsts]++
    }

    expect(firsts.tier3 / 4000).toBeGreaterThan(0.7)
    expect(firsts.tier1).toBeGreaterThan(0)
  })
})
