import { GATEWAY_BASE_URL } from '@/app/utils/api'
import { IS_WEB } from './target'

async function fetchGatewayJson<T>(path: string): Promise<T> {
    const response = await fetch(`${GATEWAY_BASE_URL}${path}`)
    if (!response.ok) {
        throw new Error(`Gateway request ${path} failed with status ${response.status}`)
    }
    return response.json() as Promise<T>
}

export function fetchGatewayServers<T = unknown>(): Promise<T> {
    if (!IS_WEB) return window.conveyor.game.fetchServers() as Promise<T>
    return fetchGatewayJson<T>('/server-info')
}

export function fetchGatewayPatrons<T = unknown>(): Promise<T> {
    if (!IS_WEB) return window.conveyor.game.fetchPatrons() as Promise<T>
    return fetchGatewayJson<T>('/patreon')
}
