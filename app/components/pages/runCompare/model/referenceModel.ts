import type { SoloRun } from '../loading/soloRuns'

export interface SideReference {
    side: number | null
    capId: string
    pinned: boolean
}

export interface References {
    lead: string | null
    sides: SideReference[]
    partners: ReadonlyMap<string, string>
}

export interface PinsPerSide {
    refs: string[]
    dropped: string[]
}

export const NO_REFERENCES: References = { lead: null, sides: [], partners: new Map() }

function fastest(runs: readonly SoloRun[]): SoloRun | null {
    return runs.reduce<SoloRun | null>((best, run) => (!best || run.timeSeconds < best.timeSeconds ? run : best), null)
}

export function leadSide(runs: readonly SoloRun[]): number | null {
    return fastest(runs.filter(run => run.side !== null))?.side ?? null
}

export function sideGroupOf(runs: readonly SoloRun[]): (run: SoloRun) => number | null {
    const lead = leadSide(runs)
    return run => run.side ?? lead
}

export function onePinPerSide(runs: readonly SoloRun[], refs: readonly string[]): PinsPerSide {
    const groupOf = sideGroupOf(runs)
    const byId = new Map(runs.map(run => [run.capId, run]))
    const taken = new Set<number | null>()
    const kept: string[] = []
    const dropped: string[] = []
    for (const capId of refs) {
        const run = byId.get(capId)
        if (!run) continue
        const group = groupOf(run)
        if (taken.has(group)) {
            dropped.push(capId)
            continue
        }
        taken.add(group)
        kept.push(capId)
    }
    return { refs: kept, dropped }
}

export function resolveReferences(runs: readonly SoloRun[], refs: readonly string[]): References {
    if (runs.length === 0) return NO_REFERENCES
    const groupOf = sideGroupOf(runs)
    const pins = new Set(onePinPerSide(runs, refs).refs)
    const lead = groupOf(fastest(runs)!)
    const groups = [...new Set(runs.map(groupOf))].sort((a, b) => Number(b === lead) - Number(a === lead))
    const sides = groups.map(side => {
        const members = runs.filter(run => groupOf(run) === side)
        const pinned = members.find(run => pins.has(run.capId))
        return { side, capId: (pinned ?? fastest(members)!).capId, pinned: !!pinned }
    })
    const referenceOf = new Map(sides.map(entry => [entry.side, entry.capId]))
    const leadReference = sides[0].capId
    const partners = new Map(runs.map(run => {
        const own = referenceOf.get(groupOf(run))!
        return [run.capId, own === run.capId ? leadReference : own] as const
    }))
    return { lead: leadReference, sides, partners }
}

export function isSideReference(references: References, capId: string): boolean {
    return references.sides.some(entry => entry.capId === capId)
}
