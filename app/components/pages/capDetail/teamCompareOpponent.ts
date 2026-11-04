export interface RankedTeamRun {
    entry: { id: string; cap_time_seconds: number }
}

function nearestByTime(rows: readonly RankedTeamRun[], teamCapId: string, seconds: number): string | null {
    const others = rows.filter(row => row.entry.id !== teamCapId)
    const faster = others.filter(row => row.entry.cap_time_seconds < seconds)
    if (faster.length > 0) return faster.reduce((best, row) => row.entry.cap_time_seconds > best.entry.cap_time_seconds ? row : best).entry.id
    const slower = others.filter(row => row.entry.cap_time_seconds >= seconds)
    if (slower.length > 0) return slower.reduce((best, row) => row.entry.cap_time_seconds < best.entry.cap_time_seconds ? row : best).entry.id
    return null
}

export function teamCompareOpponent(rows: readonly RankedTeamRun[], teamCapId: string, teamTimeSeconds: number | null): string | null {
    const index = rows.findIndex(row => row.entry.id === teamCapId)
    if (index > 0) return rows[index - 1].entry.id
    if (index === 0) return rows[1]?.entry.id ?? null
    return teamTimeSeconds == null ? null : nearestByTime(rows, teamCapId, teamTimeSeconds)
}
