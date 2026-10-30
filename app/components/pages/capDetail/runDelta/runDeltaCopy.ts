export function differentLineNote(runner: string, reference: string): string {
    return `${runner} left ${reference}'s line in this sector`
}

export function routesDifferSummary(coveragePercent: number, reference: string): string {
    return `Only ${coveragePercent}% of this run follows ${reference}'s line, for example because they started from different spawns. Sector splits are hidden.`
}
