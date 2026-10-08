import { useEffect, useRef } from 'react'
import { createPoller } from '@/app/utils/poller'

export const ANALYSIS_POLL_MS = 3_000

export function usePollWhile(active: boolean, poll: (signal: AbortSignal) => Promise<void>) {
  const pollRef = useRef(poll)
  useEffect(() => { pollRef.current = poll }, [poll])

  useEffect(() => {
    if (!active) return
    const poller = createPoller({
      poll: (signal) => pollRef.current(signal),
      intervalMs: () => ANALYSIS_POLL_MS,
      pollOnStart: false,
    })
    poller.start()
    return () => poller.stop()
  }, [active])
}
