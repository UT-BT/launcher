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

const SPECTATOR_CLASS = 'Botpack.CHSpectator'

/**
 * The `unreal://` link that moves a running game to a server. The class option replaces the one the game
 * holds: the spectator class for Spec, and an empty one for Join, so a game started as a spectator joins as
 * a player. Throws `Invalid server address: <ip>` for an address that could carry extra URL options.
 */
export function runningGameJoinUrl(ip: string, port: number, asSpectator: boolean): string {
    if (!/^[a-zA-Z0-9.-]+$/.test(ip)) {
        throw new Error(`Invalid server address: ${ip}`)
    }
    return `unreal://${ip}:${port}?OverrideClass=${asSpectator ? SPECTATOR_CLASS : ''}`
}
