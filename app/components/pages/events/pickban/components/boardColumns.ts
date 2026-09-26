export const BOARD_COLUMN_CAPS = [3, 4, 5, 6, 7, 8] as const

export function balancedColumns(count: number, cap: number): number {
    if (count <= 0) return 1
    const rows = Math.ceil(count / cap)
    return Math.ceil(count / rows)
}

export function boardColumnVars(count: number): Record<`--cols-${number}` | `--rows-${number}`, number> {
    const vars: Record<`--cols-${number}` | `--rows-${number}`, number> = {}
    BOARD_COLUMN_CAPS.forEach((cap, index) => {
        const columns = balancedColumns(count, cap)
        vars[`--cols-${index}`] = columns
        vars[`--rows-${index}`] = Math.max(1, Math.ceil(count / columns))
    })
    return vars
}
