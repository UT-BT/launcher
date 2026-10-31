import { describe, expect, it, vi } from 'vitest'
import { joinServer, playStandalone, type GameLaunchPort } from './serverJoin'

const SERVER = { ip: '10.0.0.1', hostport: 7777 }

function fakeGame({ running = false, ini = {} as Record<string, string> } = {}) {
    const values = new Map(Object.entries(ini))
    const port: GameLaunchPort = {
        readIniValue: vi.fn(async (_file: string, _section: string, key: string) => values.get(key)),
        writeIniValue: vi.fn(async (_file: string, _section: string, key: string, value: string) => {
            values.set(key, value)
        }),
        isGameRunning: vi.fn(async () => running),
        launchGame: vi.fn(async () => undefined),
        launchGameStandalone: vi.fn(async () => undefined),
    }
    return { port, ini: (key: string) => values.get(key) }
}

describe('joinServer', () => {
    it('Spec sets the spectator override class and launches the server', async () => {
        const game = fakeGame()
        const result = await joinServer(game.port, SERVER, true)
        expect(game.ini('OverrideClass')).toBe('Botpack.CHSpectator')
        expect(game.port.writeIniValue).toHaveBeenCalledWith('User.ini', 'DefaultPlayer', 'OverrideClass', 'Botpack.CHSpectator')
        expect(game.port.launchGame).toHaveBeenCalledWith('10.0.0.1', 7777)
        expect(result).toEqual({ status: 'launched' })
    })

    it('Join as a player clears the override class and a spectator Class', async () => {
        const game = fakeGame({ ini: { OverrideClass: 'Botpack.CHSpectator', Class: 'Botpack.CHSpectator' } })
        await joinServer(game.port, SERVER, false)
        expect(game.ini('OverrideClass')).toBe('')
        expect(game.ini('Class')).toBe('')
        expect(game.port.launchGame).toHaveBeenCalledWith('10.0.0.1', 7777)
    })

    it('Join as a player keeps a non-spectator Class', async () => {
        const game = fakeGame({ ini: { OverrideClass: 'Botpack.CHSpectator', Class: 'Botpack.TMale1' } })
        await joinServer(game.port, SERVER, false)
        expect(game.ini('OverrideClass')).toBe('')
        expect(game.ini('Class')).toBe('Botpack.TMale1')
    })

    it.each([
        ['Join', false],
        ['Spec', true],
    ])('%s with the game running returns the already-running notice without launching or writing the ini', async (_label, asSpectator) => {
        const game = fakeGame({ running: true, ini: { OverrideClass: '' } })
        const result = await joinServer(game.port, SERVER, asSpectator)
        expect(result).toEqual({
            status: 'already-running',
            message: 'UT99 is already running. Close it to join another server.',
        })
        expect(game.port.launchGame).not.toHaveBeenCalled()
        expect(game.port.writeIniValue).not.toHaveBeenCalled()
    })

    it('a second Join while the first is still starting returns the notice and launches once', async () => {
        const game = fakeGame()
        const [first, second] = await Promise.all([
            joinServer(game.port, SERVER, false),
            joinServer(game.port, SERVER, true),
        ])
        expect(first).toEqual({ status: 'launched' })
        expect(second).toEqual({
            status: 'already-running',
            message: 'UT99 is already running. Close it to join another server.',
        })
        expect(game.port.launchGame).toHaveBeenCalledTimes(1)
        expect(game.ini('OverrideClass')).toBe('')
    })

    it('a failed launch does not block the next Join', async () => {
        const game = fakeGame()
        vi.mocked(game.port.launchGame).mockRejectedValueOnce(new Error('exe missing'))
        await expect(joinServer(game.port, SERVER, false)).rejects.toThrow('exe missing')
        await expect(joinServer(game.port, SERVER, false)).resolves.toEqual({ status: 'launched' })
    })
})

describe('playStandalone', () => {
    it('after a Spec, Play writes an empty override class before launching', async () => {
        const game = fakeGame()
        await joinServer(game.port, SERVER, true)
        expect(game.ini('OverrideClass')).toBe('Botpack.CHSpectator')

        await playStandalone(game.port)

        expect(game.ini('OverrideClass')).toBe('')
        expect(game.port.writeIniValue).toHaveBeenLastCalledWith('User.ini', 'DefaultPlayer', 'OverrideClass', '')
        expect(game.port.launchGameStandalone).toHaveBeenCalledTimes(1)
    })

    it('clears a spectator Class like Join does', async () => {
        const game = fakeGame({ ini: { Class: 'Botpack.CHSpectator', OverrideClass: 'Botpack.CHSpectator' } })
        await playStandalone(game.port)
        expect(game.ini('Class')).toBe('')
        expect(game.ini('OverrideClass')).toBe('')
    })
})
