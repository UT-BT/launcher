import '@vitejs/plugin-react/preamble'
import { createElement, useState, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import type { CamRequest, CamToolStatus } from '../lib/conveyor/schemas/stream-kit-schema'
import { CAM_SLOTS, CAM_WINDOW_TITLES, camFpsOf, type CamFps, type CamSlot } from '../lib/stream-kit/cam-plan'
import { NavigationContext, type NavigationContextValue } from '../app/components/navigation/NavigationContext'
import { ThemeProvider } from '../app/theme/ThemeProvider'
import { StreamTabProvider } from '../app/components/pages/events/stream/StreamTabContext'
import { CamTool } from '../app/components/pages/events/stream/panels/CamTool'
import '../app/styles/index.css'

type CamStatus = CamToolStatus['cams'][number]

const search = new URLSearchParams(window.location.search)

function idleCam(slot: CamSlot): CamStatus {
    return {
        slot,
        windowTitle: CAM_WINDOW_TITLES[slot],
        running: false,
        pid: null,
        titled: false,
        server: null,
        target: null,
        plannedServer: null,
        startedAt: null,
        exitCode: null,
        error: null,
    }
}

const harness = {
    installPath: search.get('install') === '0' ? undefined : 'C:\\UnrealTournament',
    camFps: camFpsOf(Number(search.get('fps'))),
    cams: CAM_SLOTS.map(idleCam),
    calls: [] as { channel: string; args: unknown[] }[],
    nextPid: 4000,
    windows() {
        return this.cams.filter(cam => cam.running && cam.titled).map(cam => cam.windowTitle)
    },
    moveCam(slot: CamSlot, server: string) {
        const cam = this.cams.find(entry => entry.slot === slot)
        if (cam) cam.server = server
    },
    snapshot(): CamToolStatus {
        return { supported: true, retitle: { available: true, error: null }, cams: this.cams.map(cam => ({ ...cam })) }
    },
    start(slot: CamSlot, request: CamRequest) {
        const team = slot.startsWith('A') ? 'A' : 'B'
        const server = request.servers[team] ?? null
        const index = CAM_SLOTS.indexOf(slot)
        this.cams[index] = {
            ...idleCam(slot),
            running: true,
            pid: this.nextPid++,
            server,
            plannedServer: server,
            target: request.lineup[slot] ?? null,
            startedAt: new Date().toISOString(),
        }
    },
    applyTitles() {
        for (const cam of this.cams) cam.titled = cam.running
    },
}

let launched: CamRequest | null = null

function record<T>(channel: string, args: unknown[], result: T): Promise<T> {
    harness.calls.push({ channel, args })
    return Promise.resolve(result)
}

const streamKit = {
    planCams: (request: CamRequest) => record('planCams', [request], { ok: true as const, cams: [] }),
    launchCams: (request: CamRequest) => {
        launched = request
        for (const slot of CAM_SLOTS) harness.start(slot, request)
        return record('launchCams', [request], { ok: true as const, status: harness.snapshot() })
    },
    getCamStatus: () => {
        harness.applyTitles()
        return record('getCamStatus', [], harness.snapshot())
    },
    retitleCams: () => {
        harness.applyTitles()
        return record('retitleCams', [], harness.snapshot())
    },
    restartCam: (slot: CamSlot, request: CamRequest | null) => {
        const plan = request ?? launched
        if (!plan) return record('restartCam', [slot, request], { ok: false as const, errors: [{ code: 'not-launched' as const, slot }] })
        harness.start(slot, plan)
        return record('restartCam', [slot, request], { ok: true as const, status: harness.snapshot() })
    },
    getCamFps: () => record('getCamFps', [], harness.camFps),
    setCamFps: (fps: CamFps) => {
        harness.camFps = fps
        return record('setCamFps', [fps], fps)
    },
    stopCams: () => {
        harness.cams = harness.cams.map(cam => ({ ...cam, running: false, pid: null, titled: false }))
        return record('stopCams', [], harness.snapshot())
    },
}

Object.assign(window, {
    camHarness: harness,
    conveyor: {
        app: { getUt99InstallPath: () => Promise.resolve(harness.installPath) },
        streamKit,
    },
})

function HarnessNavigation({ children }: { children: ReactNode }) {
    const [state, setState] = useState<Record<string, unknown>>({})
    const value: NavigationContextValue = {
        entry: { id: 1, view: 'event-detail', params: {}, state },
        currentView: 'event-detail',
        navigate: () => undefined,
        back: () => undefined,
        forward: () => undefined,
        canBack: false,
        canForward: false,
        getEntryState: <T,>(key: string, def: T) => (key in state ? (state[key] as T) : def),
        setEntryState: (key, next) => setState(current => ({ ...current, [key]: next })),
        registerLeaveGuard: () => () => undefined,
    }
    return createElement(NavigationContext.Provider, { value }, children)
}

const identity = { eventSlug: 'cam-cup', streamerId: '555555555555555555', isManager: false, accessToken: 'cam-token' }

createRoot(document.getElementById('app') as HTMLElement).render(
    createElement(ThemeProvider, null,
        createElement(HarnessNavigation, null,
            createElement(StreamTabProvider, { identity }, createElement(CamTool)),
        ),
    ),
)
