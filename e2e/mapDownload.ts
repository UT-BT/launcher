import type { BrowserContext } from '@playwright/test'
import type { MapMetadata } from '../app/utils/api'

export const MAP = 'CTF-BT-Chain'

const METADATA: MapMetadata = {
    name: MAP,
    added: '2026-01-01T00:00:00Z',
    difficulty: 3,
    active: true,
    tags: '',
    author: 'Mapper',
    required_players: 1,
    preceded_by: null,
    superseded_by: null,
}

export async function serveMapDownloadRoutes(context: BrowserContext) {
    await context.route(/https:\/\/(api|gateway)\.utbt\.net\/.*/, async route => {
        const url = new URL(route.request().url())
        if (url.hostname === 'gateway.utbt.net') {
            await route.fulfill({ json: [] })
            return
        }
        const path = decodeURIComponent(url.pathname).replace(/\/$/, '')
        let data: unknown
        if (path === `/maps/${MAP}`) data = METADATA
        else if (path === '/v2/summary') {
            data = { global: { newMaps: 0, newRecords: 0 }, achievements: [], recentWorldRecords: [], newMaps: [], latestPatch: null }
        } else data = path.endsWith('/count') ? { count: 0 } : []
        await route.fulfill({ json: { success: true, data } })
    })
    await context.route(/https:\/\/api\.utmapdownload\.com\/download.*/, route =>
        route.fulfill({ status: 200, contentType: 'application/zip', body: Buffer.from('PK-mock-zip') }),
    )
}
