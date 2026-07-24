import { IS_WEB } from './target'

export type DemoSaveResult =
    | { ok: true; path: string; bytes: number }
    | { ok: false; reason: string }

export type MapSaveResult =
    | { ok: true; installPath: string; extracted: string[]; skipped: string[] }
    | { ok: false; reason: string }

function triggerBrowserDownload(filename: string, bytes: Uint8Array<ArrayBuffer>, mimeType: string): void {
    const blob = new Blob([bytes.buffer], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
}

export async function saveDemoFile(filename: string, bytes: Uint8Array<ArrayBuffer>): Promise<DemoSaveResult> {
    if (!IS_WEB) return window.conveyor.demos.saveToSystem(filename, bytes)
    triggerBrowserDownload(filename, bytes, 'application/octet-stream')
    return { ok: true, path: filename, bytes: bytes.byteLength }
}

export async function saveMapZip(mapName: string, bytes: Uint8Array<ArrayBuffer>): Promise<MapSaveResult> {
    if (!IS_WEB) return window.conveyor.maps.extractToInstall(mapName, bytes)
    triggerBrowserDownload(`${mapName}.zip`, bytes, 'application/zip')
    return { ok: true, installPath: '', extracted: [], skipped: [] }
}
