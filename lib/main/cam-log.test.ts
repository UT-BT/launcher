import { describe, expect, it } from 'vitest'
import { EMPTY_CAM_LOG_STATE, readCamLogChunk } from './cam-log'

function read(...chunks: string[]) {
    return chunks.reduce(readCamLogChunk, EMPTY_CAM_LOG_STATE)
}

describe('readCamLogChunk', () => {
    it('has no server before any map is loaded', () => {
        expect(read('Log: Log file open, 09/29/26 20:00:00\r\nInit: Version 469f\r\n').server).toBeNull()
    })

    it('takes the server from a network LoadMap line', () => {
        const state = read(
            'Log: Browse: 203.0.113.10:7778/Index.unr?OverrideClass=Botpack.CHSpectator\r\n',
            'Log: LoadMap: 203.0.113.10:7778/BT-Colors?OverrideClass=Botpack.CHSpectator?UTBTFollow=111111111111111111\r\n',
        )
        expect(state.server).toBe('203.0.113.10:7778')
    })

    it('fills in the default port when UT leaves it out', () => {
        expect(read('Log: LoadMap: bt.example.net/BT-Colors?Name=Cam\r\n').server).toBe('bt.example.net:7777')
    })

    it('accepts a fully qualified unreal:// target', () => {
        expect(read('Log: LoadMap: unreal://203.0.113.10:7777/BT-Colors?Name=Cam\n').server).toBe('203.0.113.10:7777')
    })

    it('does not count a Browse as connected until the map loads', () => {
        const state = read(
            'Log: LoadMap: 203.0.113.10:7777/BT-Colors?Name=Cam\r\n',
            'Log: Browse: 198.51.100.20:7777/Index.unr?Name=Cam\r\n',
        )
        expect(state.server).toBe('203.0.113.10:7777')
    })

    it('follows a cam to another synced server', () => {
        const first = read('Log: LoadMap: 203.0.113.10:7777/BT-Colors?Name=Cam\r\n')
        const second = readCamLogChunk(first, 'Log: Browse: 198.51.100.20:7780/Index.unr?Name=Cam\r\nLog: LoadMap: 198.51.100.20:7780/BT-Maze?Name=Cam\r\n')
        expect(first.server).toBe('203.0.113.10:7777')
        expect(second.server).toBe('198.51.100.20:7780')
    })

    it('clears the server when the cam falls back to a local map', () => {
        const state = read(
            'Log: LoadMap: 203.0.113.10:7777/BT-Colors?Name=Cam\r\n',
            'Log: LoadMap: Entry?Name=Cam\r\n',
        )
        expect(state.server).toBeNull()
    })

    it('ignores local map loads such as the intro map', () => {
        expect(read('Log: LoadMap: UT-Logo-Map.unr?Name=Cam\r\n').server).toBeNull()
    })

    it('waits for the rest of a line split across chunks', () => {
        const partial = read('Log: LoadMap: 203.0.1')
        expect(partial.server).toBeNull()
        expect(readCamLogChunk(partial, '13.10:7777/BT-Colors?Name=Cam\r\n').server).toBe('203.0.113.10:7777')
    })

    it('ignores a garbled address', () => {
        expect(read('Log: LoadMap: 999.1.1.1:7777/BT-Colors\r\n').server).toBeNull()
    })

    it('ignores the same words inside a chat or script line', () => {
        expect(read('Say: Player: LoadMap: 203.0.113.10:7777/BT-Colors\r\n').server).toBeNull()
    })
})
