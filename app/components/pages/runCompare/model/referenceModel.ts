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

export interface SideOption {
    side: number
    runs: number
}

export interface SideChoice {
    focus: number | null
    options: SideOption[]
    switchable: boolean
}

export const NO_SIDE_CHOICE: SideChoice = { focus: null, options: [], switchable: false }

export const SIDE_MIN_RUNS = 2

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

function groupCounts(runs: readonly SoloRun[]): Map<number | null, number> {
    const groupOf = sideGroupOf(runs)
    const counts = new Map<number | null, number>()
    for (const run of runs) counts.set(groupOf(run), (counts.get(groupOf(run)) ?? 0) + 1)
    return counts
}

export function focusSide(runs: readonly SoloRun[], chosen: number | null): number | null {
    if (runs.length === 0) return null
    const counts = groupCounts(runs)
    if (chosen !== null && (counts.get(chosen) ?? 0) >= SIDE_MIN_RUNS) return chosen
    const fastestGroup = sideGroupOf(runs)(fastest(runs)!)
    if ((counts.get(fastestGroup) ?? 0) >= SIDE_MIN_RUNS) return fastestGroup
    let best = fastestGroup
    for (const [group, count] of counts) {
        if (count > (counts.get(best) ?? 0)) best = group
    }
    return best
}

export function sideChoice(runs: readonly SoloRun[], focus: number | null): SideChoice {
    const counts = groupCounts(runs)
    const options = [0, 1].flatMap(side => {
        const count = counts.get(side) ?? 0
        return count > 0 ? [{ side, runs: count }] : []
    })
    if (options.length < 2) return NO_SIDE_CHOICE
    return { focus, options, switchable: options.every(option => option.runs >= SIDE_MIN_RUNS) }
}

export function focusRuns(choice: SideChoice, runs: number): number {
    return choice.options.find(option => option.side === choice.focus)?.runs ?? runs
}

export function onFocusSide(choice: SideChoice, run: Pick<SoloRun, 'side'>): boolean {
    return choice.options.length === 0 || run.side === null || run.side === choice.focus
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

export function resolveReferences(runs: readonly SoloRun[], refs: readonly string[], chosen: number | null = null): References {
    if (runs.length === 0) return NO_REFERENCES
    const groupOf = sideGroupOf(runs)
    const pins = new Set(onePinPerSide(runs, refs).refs)
    const lead = focusSide(runs, chosen)
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
