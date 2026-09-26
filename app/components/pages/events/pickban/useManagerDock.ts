import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PickBanState } from '@/app/utils/api'
import type { FinalDraft } from './editFinal'
import type { PickBanSessionStore } from './pickBanSession'
import type { PickBanView } from './pickBanView'
import {
    IDLE_MANAGER_PLAY,
    beginActForLock,
    beginManagerCommand,
    changeFinalEditor,
    closeFinalEditor,
    confirmManagerCommand,
    dismissManagerConfirm,
    dismissManagerRejection,
    managerCommandRejected,
    managerCommandSucceeded,
    managerDockOf,
    openFinalEditor,
    selectActForMap,
    settleManagerPlay,
    withManagerPlay,
    type ManagerAction,
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
    run: (action: ManagerAction) => void
    confirm: () => void
    dismissConfirm: () => void
    dismiss: () => void
    openFinalEditor: () => void
    changeFinalEditor: (change: (draft: FinalDraft) => FinalDraft) => void
    closeFinalEditor: () => void
}

type Begin = (play: ManagerPlay, view: PickBanView) => ManagerSubmission | null

type ManagerSender = Pick<PickBanSessionStore, 'sendManagerCommand' | 'sendManagerCommandAt'>

function sendManagerRequest({ sendManagerCommand: send, sendManagerCommandAt: sendAt }: ManagerSender, request: ManagerRequest): Promise<PickBanState> {
    switch (request.command) {
        case 'choose-a':
            return send(request.command, request.body)
        case 'override-sequence':
            return 'preset_id' in request.body ? send(request.command, request.body) : send(request.command, request.body)
        case 'hand-over':
            return send(request.command, request.body)
        case 'lock':
            return send(request.command, request.body)
        case 'edit-final':
            return sendAt(request.version, request.command, request.body)
        default:
            return request.version === undefined ? send(request.command) : sendAt(request.version, request.command)
    }
}

export function useManagerDock(view: PickBanView | null, { sendManagerCommand, sendManagerCommandAt }: ManagerSender): UseManagerDockResult {
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
        sendManagerRequest({ sendManagerCommand, sendManagerCommandAt }, request).then(
            () => update(managerCommandSucceeded),
            (error: unknown) => update((latest) => managerCommandRejected(latest, error)),
        )
    }, [sendManagerCommand, sendManagerCommandAt, update])

    const select = useCallback((map: string) => {
        const current = viewRef.current
        if (current) update((latest) => selectActForMap(latest, current, map))
    }, [update])

    const lockIn = useCallback(() => submit(beginActForLock), [submit])
    const run = useCallback((action: ManagerAction) => submit((latest, current) => beginManagerCommand(latest, current, action)), [submit])
    const confirm = useCallback(() => submit(confirmManagerCommand), [submit])
    const dismissConfirm = useCallback(() => update(dismissManagerConfirm), [update])
    const dismiss = useCallback(() => update(dismissManagerRejection), [update])

    const openEditor = useCallback(() => {
        const current = viewRef.current
        if (current) update((latest) => openFinalEditor(latest, current))
    }, [update])
    const changeEditor = useCallback((change: (draft: FinalDraft) => FinalDraft) => update((latest) => changeFinalEditor(latest, change)), [update])
    const closeEditor = useCallback(() => update(closeFinalEditor), [update])

    return useMemo(() => ({
        view: view ? withManagerPlay(view, play) : null,
        dock: view ? managerDockOf(view, play) : null,
        select,
        lockIn,
        run,
        confirm,
        dismissConfirm,
        dismiss,
        openFinalEditor: openEditor,
        changeFinalEditor: changeEditor,
        closeFinalEditor: closeEditor,
    }), [view, play, select, lockIn, run, confirm, dismissConfirm, dismiss, openEditor, changeEditor, closeEditor])
}
