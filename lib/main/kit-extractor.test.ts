import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { crc32 } from 'zlib'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { extractKit, isAllowedKitUrl, type KitExtractorOptions, type KitProgress } from './kit-extractor'

const KIT_URL = 'https://api.utbt.net/tournaments/cup/stream/42/kit?folder=C%3A%5CUTBT-StreamKit'
const TOKEN = 'token-abc'

function storedZip(entries: { name: string; data?: string }[]): Buffer {
    const locals: Buffer[] = []
    const centrals: Buffer[] = []
    let offset = 0
    for (const entry of entries) {
        const name = Buffer.from(entry.name, 'utf8')
        const data = Buffer.from(entry.data ?? '', 'utf8')
        const crc = crc32(data)
        const local = Buffer.alloc(30)
        local.writeUInt32LE(0x04034b50, 0)
        local.writeUInt16LE(20, 4)
        local.writeUInt16LE(0x0800, 6)
        local.writeUInt32LE(crc, 14)
        local.writeUInt32LE(data.length, 18)
        local.writeUInt32LE(data.length, 22)
        local.writeUInt16LE(name.length, 26)
        const central = Buffer.alloc(46)
        central.writeUInt32LE(0x02014b50, 0)
        central.writeUInt16LE(20, 4)
        central.writeUInt16LE(20, 6)
        central.writeUInt16LE(0x0800, 8)
        central.writeUInt32LE(crc, 16)
        central.writeUInt32LE(data.length, 20)
        central.writeUInt32LE(data.length, 24)
        central.writeUInt16LE(name.length, 28)
        central.writeUInt32LE(offset, 42)
        locals.push(local, name, data)
        centrals.push(central, name)
        offset += local.length + name.length + data.length
    }
    const centralDirectory = Buffer.concat(centrals)
    const end = Buffer.alloc(22)
    end.writeUInt32LE(0x06054b50, 0)
    end.writeUInt16LE(entries.length, 8)
    end.writeUInt16LE(entries.length, 10)
    end.writeUInt32LE(centralDirectory.length, 12)
    end.writeUInt32LE(offset, 16)
    return Buffer.concat([...locals, centralDirectory, end])
}

const SAMPLE_KIT = storedZip([
    { name: 'README.txt', data: 'Import the scene collection.' },
    { name: 'obs/' },
    { name: 'obs/scene-collection.json', data: '{"name":"UTBT Stream Kit"}' },
    { name: 'stinger.webm', data: 'webm' },
])

let root: string
let requests: { url: string; init: RequestInit }[]
let progress: KitProgress[]

function options(response: () => Response, overrides: Partial<KitExtractorOptions> = {}): KitExtractorOptions {
    return {
        supported: true,
        allowLocalApi: false,
        fetch: async (url, init) => {
            requests.push({ url, init })
            return response()
        },
        onProgress: event => progress.push(event),
        logger: { info: () => {}, error: () => {} },
        ...overrides,
    }
}

function zipResponse(bytes: Buffer, status = 200) {
    return () => new Response(new Uint8Array(bytes), { status, headers: { 'content-type': 'application/zip', 'content-length': String(bytes.length) } })
}

beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'utbt-kit-'))
    requests = []
    progress = []
})

afterEach(() => {
    rmSync(root, { recursive: true, force: true })
})

describe('extractKit', () => {
    it('downloads the kit with the bearer token and extracts it into a new folder', async () => {
        const folder = join(root, 'UTBT-StreamKit')
        const result = await extractKit({ url: KIT_URL, token: TOKEN, folder }, options(zipResponse(SAMPLE_KIT)))

        expect(result).toEqual({ ok: true, folder, files: ['README.txt', 'obs/scene-collection.json', 'stinger.webm'] })
        expect(requests[0].url).toBe(KIT_URL)
        expect(requests[0].init.headers).toMatchObject({ Authorization: `Bearer ${TOKEN}` })
        expect(requests[0].init.redirect).toBe('error')
        expect(readFileSync(join(folder, 'obs', 'scene-collection.json'), 'utf8')).toBe('{"name":"UTBT Stream Kit"}')
        expect(readdirSync(folder).sort()).toEqual(['README.txt', 'obs', 'stinger.webm'])
    })

    it('overwrites an older kit in the same folder', async () => {
        const folder = join(root, 'Kit')
        await extractKit({ url: KIT_URL, token: TOKEN, folder }, options(zipResponse(storedZip([{ name: 'README.txt', data: 'old' }]))))
        await extractKit({ url: KIT_URL, token: TOKEN, folder }, options(zipResponse(SAMPLE_KIT)))
        expect(readFileSync(join(folder, 'README.txt'), 'utf8')).toBe('Import the scene collection.')
    })

    it('reports download and extraction progress', async () => {
        await extractKit({ url: KIT_URL, token: TOKEN, folder: join(root, 'Kit') }, options(zipResponse(SAMPLE_KIT)))
        expect(progress.at(0)).toMatchObject({ phase: 'downloading', total: SAMPLE_KIT.length })
        expect(progress.filter(event => event.phase === 'downloading').at(-1)?.done).toBe(SAMPLE_KIT.length)
        expect(progress.at(-1)).toEqual({ phase: 'extracting', done: 4, total: 4 })
    })

    it.each(['UTBT-StreamKit', '.\\kit', '\\\\server\\share\\kit'])('refuses the relative or network folder %s without downloading', async folder => {
        const result = await extractKit({ url: KIT_URL, token: TOKEN, folder }, options(zipResponse(SAMPLE_KIT)))
        expect(result).toEqual({ ok: false, reason: 'not-absolute' })
        expect(requests).toHaveLength(0)
    })

    it('refuses a traversal folder without downloading', async () => {
        const result = await extractKit({ url: KIT_URL, token: TOKEN, folder: `${root}\\Kit\\..\\..\\Windows` }, options(zipResponse(SAMPLE_KIT)))
        expect(result).toEqual({ ok: false, reason: 'traversal' })
        expect(requests).toHaveLength(0)
    })

    it.each([
        ['../evil.txt'],
        ['obs/../../evil.txt'],
        ['..\\evil.txt'],
        ['C:/evil.txt'],
        ['/evil.txt'],
    ])('rejects the zip-slip entry %s and writes nothing', async name => {
        const folder = join(root, 'Kit')
        const zip = storedZip([{ name: 'README.txt', data: 'fine' }, { name, data: 'evil' }])
        const result = await extractKit({ url: KIT_URL, token: TOKEN, folder }, options(zipResponse(zip)))
        expect(result).toEqual({ ok: false, reason: 'zip-slip' })
        expect(existsSync(join(folder, 'README.txt'))).toBe(false)
        expect(existsSync(join(root, 'evil.txt'))).toBe(false)
    })

    it('rejects a download that is not a zip', async () => {
        const result = await extractKit({ url: KIT_URL, token: TOKEN, folder: join(root, 'Kit') }, options(zipResponse(Buffer.from('<html>oops</html>'))))
        expect(result).toEqual({ ok: false, reason: 'invalid-zip' })
    })

    it.each([
        [401, 'unauthorized'],
        [403, 'forbidden'],
        [404, 'not-found'],
        [500, 'download-failed'],
    ])('maps HTTP %i to %s', async (status, reason) => {
        const result = await extractKit({ url: KIT_URL, token: TOKEN, folder: join(root, 'Kit') }, options(zipResponse(Buffer.from('{}'), status)))
        expect(result).toEqual({ ok: false, reason, status })
        expect(existsSync(join(root, 'Kit'))).toBe(false)
    })

    it('reports a network failure', async () => {
        const result = await extractKit(
            { url: KIT_URL, token: TOKEN, folder: join(root, 'Kit') },
            options(() => { throw new Error('offline') }),
        )
        expect(result).toEqual({ ok: false, reason: 'download-failed' })
    })

    it('stops a download that grows past the limit', async () => {
        const result = await extractKit(
            { url: KIT_URL, token: TOKEN, folder: join(root, 'Kit') },
            options(() => new Response(new Uint8Array(SAMPLE_KIT)), { maxBytes: 10 }),
        )
        expect(result).toEqual({ ok: false, reason: 'too-large' })
    })

    it('refuses a URL outside the API', async () => {
        const result = await extractKit({ url: 'https://example.com/kit.zip', token: TOKEN, folder: join(root, 'Kit') }, options(zipResponse(SAMPLE_KIT)))
        expect(result).toEqual({ ok: false, reason: 'invalid-url' })
        expect(requests).toHaveLength(0)
    })

    it('refuses an empty token', async () => {
        const result = await extractKit({ url: KIT_URL, token: ' ', folder: join(root, 'Kit') }, options(zipResponse(SAMPLE_KIT)))
        expect(result).toEqual({ ok: false, reason: 'missing-token' })
    })

    it('refuses on an unsupported platform', async () => {
        const result = await extractKit({ url: KIT_URL, token: TOKEN, folder: join(root, 'Kit') }, options(zipResponse(SAMPLE_KIT), { supported: false }))
        expect(result).toEqual({ ok: false, reason: 'unsupported-platform' })
    })
})

describe('isAllowedKitUrl', () => {
    it('allows the API over https', () => {
        expect(isAllowedKitUrl(KIT_URL, false)).toBe(true)
    })

    it.each([
        'http://api.utbt.net/kit',
        'https://api.utbt.net:8443/kit',
        'https://user:pass@api.utbt.net/kit',
        'https://api.utbt.net.example.com/kit',
        'file:///C:/kit.zip',
        'not a url',
    ])('refuses %s', url => {
        expect(isAllowedKitUrl(url, false)).toBe(false)
    })

    it('allows a local API only in development', () => {
        expect(isAllowedKitUrl('http://localhost:5000/kit', false)).toBe(false)
        expect(isAllowedKitUrl('http://localhost:5000/kit', true)).toBe(true)
        expect(isAllowedKitUrl('http://127.0.0.1/kit', true)).toBe(true)
    })
})
