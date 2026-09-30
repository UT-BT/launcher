const TASKLIST_ROW = /^"[^"]*","(\d+)"/

export function parseTasklistPids(output: string): number[] {
    return output
        .split(/\r?\n/)
        .map(line => TASKLIST_ROW.exec(line.trim())?.[1])
        .filter((pid): pid is string => pid !== undefined)
        .map(Number)
}

export function hasPlayerGameProcess(pids: readonly number[], camPids: ReadonlySet<number>): boolean {
    return pids.some(pid => !camPids.has(pid))
}
