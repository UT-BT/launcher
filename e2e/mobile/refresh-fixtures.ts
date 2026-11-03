import { devices, test, type Page, type Route } from '@playwright/test'
import { RECORDED_SETS } from './fixtures'
import { dataFrom, hostOf, requestPath, type FixtureData } from './fixtures/data'
import { addResponse, emptyRecording, fixtureSetOf, trimRecording, writeRecording, type Recording } from './fixtures/recording'
import { publicClientFields } from './fixtures/client-fields'
import { keepOffline, LOCAL_HOSTS } from './fixtures/router'
import { scrubRecorded } from './fixtures/scrub'
import { crawlSurfaces, MOBILE_MANIFEST, surfaceSteps, type CrawlSurface } from './manifest'

const API_HOSTS = /^https:\/\/(api|gateway)\.utbt\.net\//
const PRIVATE_HEADERS = new Set(['authorization', 'cookie', 'if-none-match', 'if-modified-since'])
const RECORDING_VIEWPORTS = [{ width: 390, height: 844 }, { width: 844, height: 390 }]
const RECORDABLE = (status: number) => status < 300 || status === 404
const CLIENT_FIELDS = publicClientFields()

class Recorder {
    recording: Recording
    private readonly addresses = new Map<string, string>()
    private readonly answered = new Map<string, { status: number; body: unknown }>()
    inFlight = 0
    skipped: string[] = []

    constructor(set: string) {
        this.recording = emptyRecording(set)
    }

    readonly data: FixtureData = {
        api: (path, query) => dataFrom(fixtureSetOf(this.recording)).api(path, query),
        gateway: (path, query) => dataFrom(fixtureSetOf(this.recording)).gateway(path, query),
    }

    async handle(route: Route) {
        const request = route.request()
        if (!API_HOSTS.test(request.url())) return keepOffline(route)
        if (request.method() !== 'GET' || request.resourceType() === 'image') return keepOffline(route)
        const url = new URL(request.url())
        const key = `${url.hostname}${url.pathname}${url.search}`
        const known = this.answered.get(key)
        if (known) return route.fulfill({ status: known.status, json: known.body }).catch(() => undefined)
        this.inFlight += 1
        try {
            const headers = Object.fromEntries(Object.entries(request.headers()).filter(([name]) => !PRIVATE_HEADERS.has(name.toLowerCase())))
            const response = await route.fetch({ headers })
            const status = response.status()
            const body = await response.json().catch(() => undefined)
            if (body === undefined || !RECORDABLE(status)) {
                this.skipped.push(`${status} ${key}`)
                await route.fulfill({ response }).catch(() => undefined)
                return
            }
            const scrubbed = scrubRecorded(body, this.addresses, key => CLIENT_FIELDS.has(key))
            this.answered.set(key, { status, body: scrubbed })
            this.recording = addResponse(this.recording, {
                host: hostOf(url),
                path: requestPath(url),
                query: url.search,
                status,
                body: scrubbed,
            })
            await route.fulfill({ status, json: scrubbed }).catch(() => undefined)
        } catch (error) {
            this.skipped.push(`${key}: ${(error as Error).message}`)
            await route.abort().catch(() => undefined)
        } finally {
            this.inFlight -= 1
        }
    }
}

async function untilApiQuiet(page: Page, recorder: Recorder) {
    for (let quiet = 0; quiet < 3;) {
        await page.waitForTimeout(500)
        quiet = recorder.inFlight === 0 ? quiet + 1 : 0
    }
}

async function recordSurface(page: Page, surface: CrawlSurface, recorder: Recorder): Promise<string | null> {
    const storage = { 'utbt:analyticsConsent:v1': 'denied', 'utbt:seasonalThemes:v1': '"off"', ...surface.entry.storage }
    await page.addInitScript(entries => {
        for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value)
    }, storage)
    await page.route(url => !LOCAL_HOSTS.has(url.hostname), route => recorder.handle(route))
    const { path, steps } = surfaceSteps(surface, recorder.data)
    try {
        await page.goto(path)
        for (const step of steps) await step(page)
        return null
    } catch (error) {
        return `${surface.id}: ${(error as Error).message.split('\n')[0]}`
    } finally {
        await untilApiQuiet(page, recorder)
    }
}

const RECORDED = MOBILE_MANIFEST.filter(entry => entry.tier === 'public' && RECORDED_SETS.includes(entry.fixtures))

for (const entry of RECORDED) {
    test(entry.fixtures, async ({ browser, baseURL }) => {
        const recorder = new Recorder(entry.fixtures)
        const failures: string[] = []
        for (const surface of crawlSurfaces('pr').filter(candidate => candidate.entry === entry)) {
            for (const viewport of RECORDING_VIEWPORTS) {
                const context = await browser.newContext({ ...devices['Pixel 7'], viewport, baseURL })
                const page = await context.newPage()
                const failure = await recordSurface(page, surface, recorder)
                if (failure) failures.push(`${viewport.width}x${viewport.height} ${failure}`)
                await context.close()
            }
        }
        writeRecording(trimRecording(recorder.recording))
        process.stdout.write(`${entry.fixtures}: ${recorder.recording.responses.length} responses recorded\n`)
        for (const line of recorder.skipped) console.warn(`${entry.fixtures}: not recorded: ${line}`)
        if (failures.length) throw new Error(`some surfaces did not open; their steps need the new data:\n${failures.join('\n')}`)
    })
}
