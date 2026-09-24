import {
    ApiError,
    fetchPickBanState,
    postPickBanCommand,
    type PickBanCommandScope,
    type PickBanManagerCommand,
    type PickBanManagerCommandBodies,
    type PickBanParticipantCommand,
    type PickBanParticipantCommandBodies,
    type PickBanSessionStatus,
    type PickBanState,
} from '@/app/utils/api'
import { createPoller, type PollerEnvironment } from '@/app/utils/poller'
import { addClockSample, clockSample, medianClockOffset } from './clockOffset'
import { mergePickBanState } from './mergePickBanState'

export const ACTIVE_POLL_MS = 1_000
export const IDLE_POLL_MS = 10_000
export const RECONNECTING_AFTER_FAILURES = 3

const ACTIVE_STATUSES: PickBanSessionStatus[] = ['lobby', 'running', 'paused']
const UNREACHABLE_HTTP_STATUSES = [401, 403, 404]

export function pickBanPollIntervalMs(status: PickBanSessionStatus | null, error: unknown, alwaysPoll: boolean): number {
    if (status) return ACTIVE_STATUSES.includes(status) ? ACTIVE_POLL_MS : IDLE_POLL_MS
    if (alwaysPoll) return ACTIVE_POLL_MS
    const unreachable = error instanceof ApiError && UNREACHABLE_HTTP_STATUSES.includes(error.status)
    return unreachable ? IDLE_POLL_MS : ACTIVE_POLL_MS
}

export interface PickBanSessionSnapshot {
    state: PickBanState | null
    clockOffsetMs: number
    loading: boolean
    error: unknown
    reconnecting: boolean
}

export type PickBanCommandInput<B> = B extends undefined
    ? []
    : object extends Omit<B, 'version'>
        ? [input?: Omit<B, 'version'>]
        : [input: Omit<B, 'version'>]

export interface PickBanSessionStoreOptions {
    slug: string
    matchId: string
    accessToken: () => string | undefined
    alwaysPoll?: boolean
    environment?: PollerEnvironment
    now?: () => number
}

export interface PickBanSessionStore {
    subscribe: (listener: () => void) => () => void
    getSnapshot: () => PickBanSessionSnapshot
    start: () => void
    stop: () => void
    refresh: () => Promise<void>
    sendCommand: <C extends PickBanParticipantCommand>(
        command: C,
        ...input: PickBanCommandInput<PickBanParticipantCommandBodies[C]>
    ) => Promise<PickBanState>
    sendManagerCommand: <C extends PickBanManagerCommand>(
        command: C,
        ...input: PickBanCommandInput<PickBanManagerCommandBodies[C]>
    ) => Promise<PickBanState>
}

function sameSnapshot(a: PickBanSessionSnapshot, b: PickBanSessionSnapshot): boolean {
    return (Object.keys(a) as (keyof PickBanSessionSnapshot)[]).every((key) => Object.is(a[key], b[key]))
}

export function createPickBanSessionStore({
    slug,
    matchId,
    accessToken,
    alwaysPoll = false,
    environment,
    now = Date.now,
}: PickBanSessionStoreOptions): PickBanSessionStore {
    const listeners = new Set<() => void>()
    let snapshot: PickBanSessionSnapshot = { state: null, clockOffsetMs: 0, loading: true, error: null, reconnecting: false }
    let etag: string | null = null
    let clockSamples: readonly number[] = []

    const publish = (patch: Partial<PickBanSessionSnapshot>) => {
        const next = { ...snapshot, ...patch }
        if (sameSnapshot(next, snapshot)) return
        snapshot = next
        for (const listener of listeners) listener()
    }

    const sampleClock = (serverNow: string | null, sentAt: number): number => {
        clockSamples = addClockSample(clockSamples, clockSample(serverNow, sentAt, now()))
        return medianClockOffset(clockSamples)
    }

    const adopt = (next: PickBanState): PickBanState => {
        const current = snapshot.state
        if (current && current.id === next.id && next.version < current.version) return current
        return mergePickBanState(current, next)
    }

    const intervalMs = (): number => pickBanPollIntervalMs(snapshot.state?.status ?? null, snapshot.error, alwaysPoll)

    const poller = createPoller({
        intervalMs,
        alwaysPoll,
        environment,
        poll: async (signal) => {
            const sentAt = now()
            const read = await fetchPickBanState(accessToken(), slug, matchId, { etag, signal })
            if (signal.aborted) return
            const clockOffsetMs = sampleClock(read.serverNow, sentAt)
            if (read.kind === 'fresh') etag = read.etag
            publish({
                state: read.kind === 'fresh' ? adopt(read.state) : snapshot.state,
                clockOffsetMs,
                loading: false,
                error: null,
                reconnecting: false,
            })
        },
        onSettled: ({ ok, consecutiveFailures, error }) => {
            if (ok) return
            publish({ loading: false, error, reconnecting: consecutiveFailures >= RECONNECTING_AFTER_FAILURES })
        },
    })

    const sendNow = async (
        scope: PickBanCommandScope,
        command: PickBanParticipantCommand | PickBanManagerCommand,
        input: readonly (object | undefined)[] | null,
    ): Promise<PickBanState> => {
        const token = accessToken()
        if (!token) throw new Error('Sign in to take part in this pick/ban.')
        const sentAt = now()
        const body = input === null ? undefined : { ...input[0], version: snapshot.state?.version ?? 0 }
        try {
            const next = await postPickBanCommand(token, slug, matchId, scope, command, body)
            const state = adopt(next)
            publish({ state, clockOffsetMs: sampleClock(next.server_now, sentAt) })
            poller.reschedule()
            return state
        } catch (error) {
            void poller.pollNow()
            throw error
        }
    }

    let commandsInFlight: Promise<unknown> = Promise.resolve()

    const runCommand = (
        scope: PickBanCommandScope,
        command: PickBanParticipantCommand | PickBanManagerCommand,
        input: readonly (object | undefined)[] | null,
    ): Promise<PickBanState> => {
        const run = commandsInFlight.then(() => sendNow(scope, command, input))
        commandsInFlight = run.catch(() => undefined)
        return run
    }

    return {
        subscribe(listener) {
            listeners.add(listener)
            return () => { listeners.delete(listener) }
        },

        getSnapshot() {
            return snapshot
        },

        start: poller.start,
        stop: poller.stop,
        refresh: poller.pollNow,

        sendCommand(command, ...input) {
            return runCommand('participant', command, input)
        },

        sendManagerCommand(command, ...input) {
            return runCommand('manager', command, command === 'open' ? null : input)
        },
    }
}
