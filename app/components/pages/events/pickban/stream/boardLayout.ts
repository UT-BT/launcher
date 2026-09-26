export interface BoardLayout {
    columns: number
    rows: number
    tile: number
}

export function boardLayout(count: number, width: number, height: number, gap: number, maxTile: number): BoardLayout {
    let best: BoardLayout = { columns: 0, rows: 0, tile: 0 }
    for (let columns = 1; columns <= count; columns += 1) {
        const rows = Math.ceil(count / columns)
        const fit = Math.min((width - gap * (columns - 1)) / columns, (height - gap * (rows - 1)) / rows)
        const tile = Math.floor(Math.min(maxTile, fit))
        if (tile > best.tile) best = { columns, rows, tile }
    }
    return best
}
