import { API_BASE_URL, ApiError, apiGet, apiRequest, asNum, asStr } from '@/app/utils/api'
import type { KitInfo } from './kitBanner'
import { DEFAULT_KIT_FOLDER } from './kitFolder'

const KIT_DOWNLOAD_TIMEOUT_MS = 120_000

interface KitInfoPayload {
    current_version?: unknown
    downloaded_version?: unknown
    default_folder?: unknown
}

export function kitPath(slug: string, streamerId: string, folder?: string): string {
    const base = `/tournaments/${encodeURIComponent(slug)}/stream/${encodeURIComponent(streamerId)}/kit`
    return folder === undefined ? base : `${base}?folder=${encodeURIComponent(folder)}`
}

export function kitInfoFromPayload(payload: KitInfoPayload): KitInfo {
    const downloaded = payload.downloaded_version
    return {
        currentVersion: asNum(payload.current_version, 1),
        downloadedVersion: downloaded === null || downloaded === undefined ? null : asNum(downloaded, 0),
        defaultFolder: asStr(payload.default_folder, DEFAULT_KIT_FOLDER),
    }
}

export async function fetchKitInfo(accessToken: string, slug: string, streamerId: string, signal?: AbortSignal): Promise<KitInfo> {
    const payload = await apiGet<KitInfoPayload>(`${kitPath(slug, streamerId)}/info`, { token: accessToken, signal })
    return kitInfoFromPayload(payload)
}

export function kitDownloadUrl(slug: string, streamerId: string, folder: string): string {
    return `${API_BASE_URL}${kitPath(slug, streamerId, folder)}`
}

export function kitZipName(slug: string): string {
    return `utbt-stream-kit-${slug}.zip`
}

export async function fetchKitZip(accessToken: string, slug: string, streamerId: string, folder: string): Promise<Blob> {
    const res = await apiRequest(kitPath(slug, streamerId, folder), { token: accessToken, timeoutMs: KIT_DOWNLOAD_TIMEOUT_MS })
    if (!res.ok) {
        let message: string | undefined
        try {
            const body = await res.json()
            message = body?.error || undefined
        } catch {
            message = undefined
        }
        throw new ApiError(res.status, message, `Kit download failed (${res.status})`)
    }
    return res.blob()
}

export function saveBlobAsFile(filename: string, blob: Blob): void {
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
}
