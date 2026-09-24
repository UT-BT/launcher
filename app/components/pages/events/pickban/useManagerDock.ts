import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PickBanState } from '@/app/utils/api'
import type { PickBanSessionStore } from './pickBanSession'
import type { PickBanView } from './pickBanView'
import {
    IDLE_MANAGER_PLAY,
    beginActForLock,
    beginManagerCommand,
    confirmManagerCommand,
    dismissManagerConfirm,
    dismissManagerRejection,
    managerCommandRejected,
    managerCommandSucceeded,
    managerDockOf,
    selectActForMap,
    settleManagerPlay,
    withManagerPlay,
    type ManagerDock,
    type ManagerPlay,
    type ManagerRequest,
    type ManagerSubmission,
} from './managerDock'

export interface UseManagerDockResult {
    view: PickBanView | null
    dock: ManagerDock | null
    select: (map: string) => void
    lockIn: () => void
    run: (request: ManagerRequest) => void
    confirm: () => void
    dismissConfirm: () => void
    dismiss: () => void
}

type Begin = (play: ManagerPlay, view: PickBanView) => ManagerSubmission | null

type SendRequest = (command: ManagerRequest['command'], input?: object) => Promise<PickBanState>

export function useManagerDock(view: PickBanView | null, sendManagerCommand: PickBanSessionStore['sendManagerCommand']): UseManagerDockResult {
    const [play, setPlay] = useState<ManagerPlay>(IDLE_MANAGER_PLAY)
    const playRef = useRef(play)
    const viewRef = useRef(view)
    viewRef.current = view

    const update = useCallback((next: (current: ManagerPlay) => ManagerPlay) => {
        playRef.current = next(playRef.current)
        setPlay(playRef.current)
    }, [])

    useEffect(() => {
        if (!view) return
        const settled = settleManagerPlay(playRef.current, view)
        if (settled !== playRef.current) update(() => settled)
    }, [view, update])

    const submit = useCallback((begin: Begin) => {
        const current = viewRef.current
        const submission = current ? begin(playRef.current, current) : null
        if (!submission) return
        update(() => submission.play)
        const { request } = submission
        if (!request) return
        const send = sendManagerCommand as SendRequest
        send(request.command, 'body' in request ? request.body : undefined).then(
            () => update(managerCommandSucceeded),
            (error: unknown) => update((latest) => managerCommandRejected(latest, error)),
        )
    }, [sendManagerCommand, update])

    const select = useCallback((map: string) => {
        const current = viewRef.current
        if (current) update((latest) => selectActForMap(latest, current, map))
    }, [update])

    const lockIn = useCallback(() => submit(beginActForLock), [submit])
    const run = useCallback((request: ManagerRequest) => submit((latest, current) => beginManagerCommand(latest, current, request)), [submit])
    const confirm = useCallback(() => submit(confirmManagerCommand), [submit])
    const dismissConfirm = useCallback(() => update(dismissManagerConfirm), [update])
    const dismiss = useCallback(() => update(dismissManagerRejection), [update])

    return useMemo(() => ({
        view: view ? withManagerPlay(view, play) : null,
        dock: view ? managerDockOf(view, play) : null,
        select,
        lockIn,
        run,
        confirm,
        dismissConfirm,
        dismiss,
    }), [view, play, select, lockIn, run, confirm, dismissConfirm, dismiss])
}
