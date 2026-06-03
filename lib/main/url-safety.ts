import { shell } from 'electron'
import { loggingService } from './logging-service'

export function isSafeExternalUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

export function openExternalSafe(url: string): void {
  if (isSafeExternalUrl(url)) {
    void shell.openExternal(url)
  } else {
    loggingService.warn(`Blocked openExternal for non-http(s) URL: ${url}`, 'Security')
  }
}
