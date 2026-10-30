import { EventEmitter } from 'events'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type { BrowserWindow } from 'electron'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isUt99DownloadCancelled } from '@/app/utils/ut99Install'
import { InstallationService } from './installation-service'

class FakeRequest extends EventEmitter {
    end = vi.fn()
    abort = vi.fn(() => {
        this.emit('abort')
    })
}

class FakeResponse extends EventEmitter {
    statusCode = 200
    headers = { 'content-length': '100' }
}

const fake = vi.hoisted(() => ({ temp: '', requests: [] as unknown[] }))

vi.mock('electron', () => ({
    app: { getPath: () => fake.temp },
    net: {
        request: vi.fn(() => {
            const request = new FakeRequest()
            fake.requests.push(request)
            return request
        }),
    },
}))
vi.mock('./logging-service', () => ({
    loggingService: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

const window = { webContents: { send: vi.fn() } } as unknown as BrowserWindow

function lastRequest(): FakeRequest {
    return fake.requests[fake.requests.length - 1] as FakeRequest
}

function isoPath(): string {
    return join(fake.temp, 'utbt-ut99', 'UT_GOTY_CD1.iso')
}

function settled(promise: Promise<unknown>) {
    return promise.then(
        () => ({ status: 'resolved' as const }),
        (error: unknown) => ({ status: 'rejected' as const, error }),
    )
}

let service: InstallationService

beforeEach(() => {
    fake.temp = mkdtempSync(join(tmpdir(), 'utbt-installation-'))
    fake.requests = []
    service = new InstallationService()
})

afterEach(() => {
    rmSync(fake.temp, { recursive: true, force: true })
})

describe('cancelling the UT99 download', () => {
    it('rejects downloadISO with the abort error while the ISO is streaming and removes the partial file', async () => {
        const download = settled(service.downloadISO(window))
        await vi.waitFor(() => expect(fake.requests).toHaveLength(1))
        const response = new FakeResponse()
        lastRequest().emit('response', response)
        response.emit('data', Buffer.alloc(40))
        await vi.waitFor(() => expect(existsSync(isoPath())).toBe(true))

        service.cancelDownload()

        const result = await download
        expect(result.status).toBe('rejected')
        expect(isUt99DownloadCancelled(result.status === 'rejected' && result.error)).toBe(true)
        expect(lastRequest().abort).toHaveBeenCalledTimes(1)
        await vi.waitFor(() => expect(existsSync(isoPath())).toBe(false))
    })

    it('rejects downloadISO with the abort error before the server answers', async () => {
        const download = settled(service.downloadISO(window))
        await vi.waitFor(() => expect(fake.requests).toHaveLength(1))

        service.cancelDownload()

        const result = await download
        expect(result.status).toBe('rejected')
        expect(isUt99DownloadCancelled(result.status === 'rejected' && result.error)).toBe(true)
    })

    it('rejects downloadISO with the abort error while a cached ISO is checked, without starting a request', async () => {
        writeFileSync(isoPath(), 'not the real iso')
        const download = settled(service.downloadISO(window))

        service.cancelDownload()

        const result = await download
        expect(result.status).toBe('rejected')
        expect(isUt99DownloadCancelled(result.status === 'rejected' && result.error)).toBe(true)
        expect(fake.requests).toHaveLength(0)
    })

    it('a failed download keeps its own error, not the abort error', async () => {
        const download = settled(service.downloadISO(window))
        await vi.waitFor(() => expect(fake.requests).toHaveLength(1))

        lastRequest().emit('error', new Error('net::ERR_CONNECTION_RESET'))

        const result = await download
        expect(result.status).toBe('rejected')
        expect(isUt99DownloadCancelled(result.status === 'rejected' && result.error)).toBe(false)
    })

    it('cancelling with no download running does nothing, and the next download starts normally', async () => {
        service.cancelDownload()

        const download = settled(service.downloadISO(window))
        await vi.waitFor(() => expect(fake.requests).toHaveLength(1))
        lastRequest().emit('error', new Error('offline'))

        const result = await download
        expect(result.status).toBe('rejected')
        expect(isUt99DownloadCancelled(result.status === 'rejected' && result.error)).toBe(false)
    })
})
