import { join } from 'path'
import { Unzip } from 'zip-lib'
import { isWithin } from './path-safety'
import { validateKitFolder, type KitFolderResult } from './kit-folder'

export interface KitExtractRequest {
    url: string
    token: string
    folder: string
}

export type KitExtractFailure =
    | 'unsupported-platform'
    | Extract<KitFolderResult, { ok: false }>['reason']
    | 'invalid-url'
    | 'missing-token'
    | 'unauthorized'
    | 'forbidden'
    | 'not-found'
    | 'download-failed'
    | 'too-large'
    | 'invalid-zip'
    | 'zip-slip'
    | 'extract-error'

export type KitExtractResult =
    | { ok: true; folder: string; files: string[] }
    | { ok: false; reason: KitExtractFailure; status?: number }

export interface KitProgress {
    phase: 'downloading' | 'extracting'
    done: number
    total: number | null
}

export interface KitExtractorOptions {
    supported: boolean
    allowLocalApi: boolean
    fetch: (url: string, init: RequestInit) => Promise<Response>
    onProgress?: (progress: KitProgress) => void
    logger: { info: (message: string, data?: unknown) => void; error: (message: string, data?: unknown) => void }
    maxBytes?: number
    timeoutMs?: number
}

const KIT_API_HOST = 'api.utbt.net'
const LOCAL_API_HOSTS = new Set(['localhost', '127.0.0.1'])
const DEFAULT_MAX_BYTES = 200 * 1024 * 1024
const DEFAULT_TIMEOUT_MS = 120_000
const UNSAFE_ENTRY_NAME = /(relative path|absolute path)/i

export function isAllowedKitUrl(value: string, allowLocalApi: boolean): boolean {
    let url: URL
    try {
        url = new URL(value)
    } catch {
        return false
    }
    if (url.username !== '' || url.password !== '') return false
    if (url.protocol === 'https:' && url.hostname === KIT_API_HOST && url.port === '') return true
    return allowLocalApi && (url.protocol === 'http:' || url.protocol === 'https:') && LOCAL_API_HOSTS.has(url.hostname)
}

function failureForStatus(status: number): KitExtractFailure {
    if (status === 401) return 'unauthorized'
    if (status === 403) return 'forbidden'
    if (status === 404) return 'not-found'
    return 'download-failed'
}

async function download(
    request: KitExtractRequest,
    options: KitExtractorOptions,
): Promise<{ ok: true; bytes: Buffer } | { ok: false; reason: KitExtractFailure; status?: number }> {
    const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES
    let response: Response
    try {
        response = await options.fetch(request.url, {
            method: 'GET',
            headers: { Authorization: `Bearer ${request.token}`, Accept: 'application/zip' },
            redirect: 'error',
            signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
        })
    } catch (error) {
        options.logger.error('Stream kit download failed', error)
        return { ok: false, reason: 'download-failed' }
    }
    if (!response.ok) return { ok: false, reason: failureForStatus(response.status), status: response.status }

    const declared = Number(response.headers.get('content-length'))
    const total = Number.isFinite(declared) && declared > 0 ? declared : null
    if (total !== null && total > maxBytes) return { ok: false, reason: 'too-large' }
    if (!response.body) return { ok: false, reason: 'invalid-zip' }

    const chunks: Uint8Array[] = []
    let received = 0
    const reader = response.body.getReader()
    try {
        for (;;) {
            const { done, value } = await reader.read()
            if (done) break
            received += value.byteLength
            if (received > maxBytes) {
                await reader.cancel()
                return { ok: false, reason: 'too-large' }
            }
            chunks.push(value)
            options.onProgress?.({ phase: 'downloading', done: received, total })
        }
    } catch (error) {
        options.logger.error('Stream kit download was interrupted', error)
        return { ok: false, reason: 'download-failed' }
    }
    return { ok: true, bytes: Buffer.concat(chunks) }
}

async function scanEntries(bytes: Buffer, folder: string): Promise<'ok' | 'zip-slip' | 'invalid-zip'> {
    let unsafe = false
    const scan = new Unzip({
        onEntry: entry => {
            if (!isWithin(folder, join(folder, entry.entryName))) unsafe = true
            entry.preventDefault()
        },
    })
    try {
        await scan.extract(bytes, folder)
    } catch (error) {
        return error instanceof Error && UNSAFE_ENTRY_NAME.test(error.message) ? 'zip-slip' : 'invalid-zip'
    }
    return unsafe ? 'zip-slip' : 'ok'
}

export async function extractKit(request: KitExtractRequest, options: KitExtractorOptions): Promise<KitExtractResult> {
    if (!options.supported) return { ok: false, reason: 'unsupported-platform' }
    const folderResult = validateKitFolder(request.folder)
    if (!folderResult.ok) return folderResult
    if (!isAllowedKitUrl(request.url, options.allowLocalApi)) return { ok: false, reason: 'invalid-url' }
    if (request.token.trim() === '') return { ok: false, reason: 'missing-token' }
    const { folder } = folderResult

    const downloaded = await download(request, options)
    if (!downloaded.ok) return downloaded

    const scan = await scanEntries(downloaded.bytes, folder)
    if (scan !== 'ok') {
        options.logger.error('Refused the stream kit archive', { reason: scan })
        return { ok: false, reason: scan }
    }

    const files: string[] = []
    let unsafe = false
    let index = 0
    const unzip = new Unzip({
        overwrite: false,
        safeSymlinksOnly: true,
        onEntry: entry => {
            index += 1
            options.onProgress?.({ phase: 'extracting', done: index, total: entry.entryCount })
            if (!isWithin(folder, join(folder, entry.entryName))) {
                unsafe = true
                entry.preventDefault()
                return
            }
            if (!entry.entryName.endsWith('/')) files.push(entry.entryName)
        },
    })
    try {
        await unzip.extract(downloaded.bytes, folder)
    } catch (error) {
        options.logger.error('Stream kit extraction failed', error)
        return { ok: false, reason: 'extract-error' }
    }
    if (unsafe) return { ok: false, reason: 'zip-slip' }

    options.logger.info('Extracted the stream kit', { folder, files: files.length })
    return { ok: true, folder, files }
}
