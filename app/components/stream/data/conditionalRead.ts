import { ApiError, apiRequest } from '@/app/utils/api'

export type ConditionalRead =
    | { kind: 'unchanged'; serverNow: string | null }
    | { kind: 'fresh'; data: object; etag: string | null; serverNow: string | null }

export interface ConditionalReadOptions {
    etag?: string | null
    signal?: AbortSignal
}

async function apiErrorOf(res: Response): Promise<ApiError> {
    const body: unknown = await res.json().catch(() => null)
    const fields = typeof body === 'object' && body !== null ? (body as { [key: string]: unknown }) : {}
    const message = typeof fields.error === 'string' ? fields.error : undefined
    const reason = typeof fields.code === 'string' ? fields.code : undefined
    return new ApiError(res.status, message, `Request failed (${res.status})`, reason)
}

export async function readConditional(path: string, { etag, signal }: ConditionalReadOptions = {}): Promise<ConditionalRead> {
    const res = await apiRequest(path, { signal, headers: etag ? { 'If-None-Match': etag } : {} })
    const serverNow = res.headers.get('X-Server-Now')
    if (res.status === 304) return { kind: 'unchanged', serverNow }
    if (!res.ok) throw await apiErrorOf(res)
    const json: unknown = await res.json()
    const envelope = typeof json === 'object' && json !== null ? (json as { success?: unknown; data?: unknown }) : {}
    if (!envelope.success || typeof envelope.data !== 'object' || envelope.data === null) throw new Error('Invalid response format from server')
    return { kind: 'fresh', data: envelope.data, etag: res.headers.get('ETag'), serverNow }
}
