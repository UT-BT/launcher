import { IS_WEB } from './target'

export function openExternal(url: string): void {
    if (IS_WEB) {
        window.open(url, '_blank', 'noopener,noreferrer')
        return
    }
    void window.conveyor.window.webOpenUrl(url)
}
