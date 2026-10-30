const SPECTATOR_CLASS = 'Botpack.CHSpectator'
const GAME_ALREADY_RUNNING_MESSAGE = 'UT99 is already running. Close it to join another server.'

let joinInFlight = false

export interface GameLaunchPort {
    readIniValue: (file: string, section: string, key: string) => Promise<string | undefined>
    writeIniValue: (file: string, section: string, key: string, value: string) => Promise<void>
    isGameRunning: () => Promise<boolean>
    launchGame: (ip: string, port: number) => Promise<void>
    launchGameStandalone: () => Promise<void>
}

export interface JoinTarget {
    ip: string
    hostport: number
}

export type JoinResult =
    | { status: 'launched' }
    | { status: 'already-running'; message: string }

async function resetToPlayerClass(port: GameLaunchPort): Promise<void> {
    const currentClass = await port.readIniValue('User.ini', 'DefaultPlayer', 'Class')
    if (currentClass === SPECTATOR_CLASS) {
        await port.writeIniValue('User.ini', 'DefaultPlayer', 'Class', '')
    }
    await port.writeIniValue('User.ini', 'DefaultPlayer', 'OverrideClass', '')
}

export async function joinServer(port: GameLaunchPort, server: JoinTarget, asSpectator: boolean): Promise<JoinResult> {
    if (joinInFlight) {
        return { status: 'already-running', message: GAME_ALREADY_RUNNING_MESSAGE }
    }
    joinInFlight = true
    try {
        if (await port.isGameRunning()) {
            return { status: 'already-running', message: GAME_ALREADY_RUNNING_MESSAGE }
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
