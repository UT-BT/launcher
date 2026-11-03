import type { Page, Request } from '@playwright/test'

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost'])
const APP_RESOURCES = new Set(['document', 'script', 'stylesheet'])

class DroppedRequest extends Error {}

function droppedByDevServer(request: Request): boolean {
    return LOCAL_HOSTS.has(new URL(request.url()).hostname)
        && APP_RESOURCES.has(request.resourceType())
        && !/cancel|abort/i.test(request.failure()?.errorText ?? '')
}

export async function reopenOnDroppedModule(page: Page, open: (signal: AbortSignal) => Promise<void>) {
    for (let attempt = 1; ; attempt += 1) {
        const abandon = new AbortController()
        let onFailed: (request: Request) => void = () => undefined
        const dropped = new Promise<never>((_, reject) => {
            onFailed = request => {
                if (droppedByDevServer(request)) reject(new DroppedRequest(`the dev server dropped ${request.url()} (${request.failure()?.errorText})`))
            }
        })
        page.on('requestfailed', onFailed)
        const opening = open(abandon.signal)
        opening.catch(() => undefined)
        try {
            await Promise.race([opening, dropped])
            return
        } catch (error) {
            abandon.abort()
            if (!(error instanceof DroppedRequest) || attempt === 2) throw error
            console.warn(`mobile crawl: ${error.message}; reopening the surface once`)
        } finally {
            page.off('requestfailed', onFailed)
        }
    }
}
