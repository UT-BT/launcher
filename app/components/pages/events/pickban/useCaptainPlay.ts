import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PickBanSessionStore } from './pickBanSession'
import type { PickBanView } from './pickBanView'
import {
    IDLE_CAPTAIN_PLAY,
    beginLock,
    beginReadyToggle,
    captainDockOf,
    commandRejected,
    commandSucceeded,
    createHoverSender,
    dismissRejection,
    hoverOf,
    selectMap,
    withCaptainPlay,
    type CaptainDock,
    type CaptainPlay,
    type CaptainSubmission,
} from './captainPlay'

export interface UseCaptainPlayResult {
    view: PickBanView | null
    dock: CaptainDock | null
    select: (map: string) => void
    lockIn: () => void
    toggleReady: () => void
    dismiss: () => void
}

type Begin = (play: CaptainPlay, view: PickBanView) => CaptainSubmission | null

export function useCaptainPlay(view: PickBanView | null, sendCommand: PickBanSessionStore['sendCommand']): UseCaptainPlayResult {
    const [play, setPlay] = useState<CaptainPlay>(IDLE_CAPTAIN_PLAY)
    const playRef = useRef(play)
    const viewRef = useRef(view)
    viewRef.current = view

    const update = useCallback((next: (current: CaptainPlay) => CaptainPlay) => {
        playRef.current = next(playRef.current)
        setPlay(playRef.current)
    }, [])

    const submit = useCallback((begin: Begin) => {
        const current = viewRef.current
        const submission = current ? begin(playRef.current, current) : null
        if (!submission) return
        update(() => submission.play)
        const sent = submission.command === 'lock'
            ? sendCommand('lock', submission.body)
            : sendCommand(submission.command, submission.body)
        sent.then(
            () => update(commandSucceeded),
            (error: unknown) => update((latest) => commandRejected(latest, error)),
        )
    }, [sendCommand, update])

    const hover = useMemo(() => createHoverSender(
        () => (viewRef.current ? hoverOf(playRef.current, viewRef.current) : null),
        (body) => sendCommand('hover', body),
    ), [sendCommand])

    useEffect(() => hover.cancel, [hover])

    useEffect(() => {
        hover.sync()
    }, [hover, view, play])

    const select = useCallback((map: string) => {
        const current = viewRef.current
        if (!current) return
        update((latest) => selectMap(latest, current, map))
        hover.request()
    }, [update, hover])

    const lockIn = useCallback(() => {
        hover.cancel()
        submit(beginLock)
    }, [submit, hover])
    const toggleReady = useCallback(() => submit(beginReadyToggle), [submit])
    const dismiss = useCallback(() => update(dismissRejection), [update])

    return useMemo(() => ({
        view: view ? withCaptainPlay(view, play) : null,
        dock: view ? captainDockOf(view, play) : null,
        select,
        lockIn,
        toggleReady,
        dismiss,
    }), [view, play, select, lockIn, toggleReady, dismiss])
}
