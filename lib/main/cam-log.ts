import { parseServerAddress } from '@/lib/stream-kit/cam-plan'

export interface CamLogState {
    server: string | null
    remainder: string
}

export const EMPTY_CAM_LOG_STATE: CamLogState = { server: null, remainder: '' }

const DEFAULT_PORT = 7777
const LOAD_MAP_LINE = /^(?:Log:\s+)?LoadMap:\s+(\S+)/
const PROTOCOL_PREFIX = /^unreal:\/\//i

function networkAddressOf(target: string): string | null | undefined {
    const url = target.replace(PROTOCOL_PREFIX, '')
    const slash = url.indexOf('/')
    const query = url.indexOf('?')
    if (slash === -1 || (query !== -1 && query < slash)) return null
    const hostPart = url.slice(0, slash)
    const withPort = hostPart.includes(':') ? hostPart : `${hostPart}:${DEFAULT_PORT}`
    const address = parseServerAddress(withPort)
    return address ? `${address.host}:${address.port}` : undefined
}

export function readCamLogChunk(state: CamLogState, chunk: string): CamLogState {
    const lines = (state.remainder + chunk).split(/\r?\n/)
    const remainder = lines.pop() ?? ''
    let server = state.server
    for (const line of lines) {
        const target = LOAD_MAP_LINE.exec(line.trim())?.[1]
        if (target === undefined) continue
        const address = networkAddressOf(target)
        if (address !== undefined) server = address
    }
    return { server, remainder }
}
