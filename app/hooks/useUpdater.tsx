import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { UpdaterStateSnapshot } from '@/lib/conveyor/schemas/updater-schema'
import { capabilities } from '@/app/platform'

const DEFAULT_STATE: UpdaterStateSnapshot = {
  phase: 'idle',
  currentVersion: '',
  lastCheckTrigger: null,
}

type UpdaterContextValue = {
  state: UpdaterStateSnapshot
  isModalOpen: boolean
  openModal: () => void
  closeModal: () => void
  check: (manual?: boolean) => Promise<void>
  download: () => Promise<void>
  install: () => Promise<void>
}

const UpdaterContext = createContext<UpdaterContextValue | null>(null)

export function UpdaterProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<UpdaterStateSnapshot>(DEFAULT_STATE)
  const [isModalOpen, setModalOpen] = useState(false)
  const autoOpenedForVersionRef = useRef<string | null>(null)

  useEffect(() => {
    if (!capabilities.updater) return
    let cancelled = false
    window.conveyor.updater
      .getState()
      .then((s) => {
        if (cancelled || !s) return
        setState(s)
      })
      .catch(() => { /* main not ready yet — first state event will arrive shortly */ })
    const remove = window.utbtUpdater?.onStateChanged((next) => {
      setState(next)
    })
    return () => {
      cancelled = true
      remove?.()
    }
  }, [])

  useEffect(() => {
    if (state.phase !== 'available') return
    if (state.lastCheckTrigger !== 'auto') return
    if (!state.version) return
    if (autoOpenedForVersionRef.current === state.version) return
    autoOpenedForVersionRef.current = state.version
    setModalOpen(true)
  }, [state.phase, state.lastCheckTrigger, state.version])

  const check = useCallback(async (manual = false) => {
    if (!capabilities.updater) return
    await window.conveyor.updater.check(manual)
  }, [])

  const download = useCallback(async () => {
    if (!capabilities.updater) return
    await window.conveyor.updater.download()
  }, [])

  const install = useCallback(async () => {
    if (!capabilities.updater) return
    await window.conveyor.updater.quitAndInstall()
  }, [])

  const openModal = useCallback(() => setModalOpen(true), [])
  const closeModal = useCallback(() => setModalOpen(false), [])

  const value = useMemo<UpdaterContextValue>(() => ({
    state,
    isModalOpen,
    openModal,
    closeModal,
    check,
    download,
    install,
  }), [state, isModalOpen, openModal, closeModal, check, download, install])

  return <UpdaterContext.Provider value={value}>{children}</UpdaterContext.Provider>
}

export function useUpdater(): UpdaterContextValue {
  const ctx = useContext(UpdaterContext)
  if (!ctx) {
    throw new Error('useUpdater must be used within an UpdaterProvider')
  }
  return ctx
}
