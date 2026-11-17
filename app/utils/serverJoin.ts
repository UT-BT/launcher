const SPECTATOR_CLASS = 'Botpack.CHSpectator'

let joinInFlight = false

export interface GameLaunchPort {
    readIniValue: (file: string, section: string, key: string) => Promise<string | undefined>
    writeIniValue: (file: string, section: string, key: string, value: string) => Promise<void>
    isGameRunning: () => Promise<boolean>
    launchGame: (ip: string, port: number) => Promise<void>
    launchGameStandalone: () => Promise<void>
    /** Hands the server's link to the running game, as a spectator or as a player. */
    joinRunningGame: (ip: string, port: number, asSpectator: boolean) => Promise<void>
}

export interface JoinTarget {
    ip: string
    hostport: number
}

/**
 * `launched`: the game was closed and started on the server. `joined`: the running game got
 * the server's link. `busy`: another Join or Spec was still in flight, so nothing happened.
 */
export type JoinResult =
    | { status: 'launched' }
    | { status: 'joined' }
    | { status: 'busy' }

async function resetToPlayerClass(port: GameLaunchPort): Promise<void> {
    const currentClass = await port.readIniValue('User.ini', 'DefaultPlayer', 'Class')
    if (currentClass === SPECTATOR_CLASS) {
        await port.writeIniValue('User.ini', 'DefaultPlayer', 'Class', '')
    }
    await port.writeIniValue('User.ini', 'DefaultPlayer', 'OverrideClass', '')
}

/**
 * Joins a server as a player or a spectator. A running game gets the link with no ini write,
 * since it keeps its settings in memory; a closed game gets the class written to `User.ini`
 * and is launched on the server.
 */
export async function joinServer(port: GameLaunchPort, server: JoinTarget, asSpectator: boolean): Promise<JoinResult> {
    if (joinInFlight) {
        return { status: 'busy' }
    }
    joinInFlight = true
    try {
        if (await port.isGameRunning()) {
            await port.joinRunningGame(server.ip, server.hostport, asSpectator)
            return { status: 'joined' }
        }
        if (asSpectator) {
            await port.writeIniValue('User.ini', 'DefaultPlayer', 'OverrideClass', SPECTATOR_CLASS)
        } else {
            await resetToPlayerClass(port)
        }
        await port.launchGame(server.ip, server.hostport)
        return { status: 'launched' }
    } finally {
        joinInFlight = false
    }
}

export async function playStandalone(port: GameLaunchPort): Promise<void> {
    await resetToPlayerClass(port)
    await port.launchGameStandalone()
}
