import { useCallback, useState } from 'react'
import { capabilities } from '@/app/platform'
import { useLogger } from '@/app/hooks/use-logger'
import { joinServer, playStandalone, type GameLaunchPort, type JoinTarget } from '@/app/utils/serverJoin'

export interface LaunchNotice {
    title: string
    message: string
}

function desktopGamePort(): GameLaunchPort {
    const { ini, game } = window.conveyor
    return {
        readIniValue: (file, section, key) => ini.readIniValue(file, section, key),
        writeIniValue: (file, section, key, value) => ini.writeIniValue(file, section, key, value),
        isGameRunning: () => game.isGameRunning(),
        launchGame: (ip, port) => game.launchGame(ip, port),
        launchGameStandalone: () => game.launchGameStandalone(),
        joinRunningGame: (ip, port, asSpectator) => game.joinRunningGame(ip, port, asSpectator),
    }
}

export async function launchStandaloneGame(): Promise<void> {
    if (!capabilities.game) return
    try {
        await playStandalone(desktopGamePort())
    } catch (err) {
        console.error('Failed to launch game:', err)
    }
}

export function useServerJoin() {
    const logger = useLogger('ServerJoin')
    const [notice, setNotice] = useState<LaunchNotice | null>(null)

    const join = useCallback(async (server: JoinTarget, asSpectator: boolean) => {
        if (!capabilities.game) return
        try {
            await joinServer(desktopGamePort(), server, asSpectator)
        } catch (err) {
            logger.error('Failed to launch game', { error: err })
            setNotice({
                title: 'Launch Error',
                message: err instanceof Error ? err.message : 'An unknown error occurred while trying to launch the game.',
            })
        }
    }, [logger])

    const clearNotice = useCallback(() => setNotice(null), [])

    return { join, notice, clearNotice }
}
