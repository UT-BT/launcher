import { protocol, net } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { loggingService } from '@/lib/main/logging-service'
import { resolveWithin } from '@/lib/main/path-safety'

export function registerResourcesProtocol() {
  protocol.handle('res', async (request) => {
    try {
      const url = new URL(request.url)
      // Combine hostname and pathname to get the full path
      const fullPath = join(url.hostname, url.pathname.slice(1))
      // Contain to the resources dir; reject `..` traversal out of it.
      const filePath = resolveWithin(join(__dirname, '../../resources'), fullPath)
      return net.fetch(pathToFileURL(filePath).toString())
    } catch (error) {
      loggingService.error('Protocol error', 'Protocol', error)
      return new Response('Resource not found', { status: 404 })
    }
  })
}
