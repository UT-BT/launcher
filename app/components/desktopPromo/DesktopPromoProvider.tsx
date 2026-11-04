import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { capabilities } from '@/app/platform'
import type { UserProfile } from '@/app/utils/api'
import { trackOutcome } from '@/app/utils/telemetry'
import { desktopPromoAccount, desktopPromoView } from './desktopPromoView'
import {
  readStoredDesktopSeen,
  readStoredDismissedAt,
  writeStoredDesktopSeen,
  writeStoredDismissedAt,
} from './desktopPromoStorage'
import {
  DesktopPromoContext,
  type DesktopPromo,
  type DesktopPromoClickSource,
  type DesktopPromoDismissSource,
} from './useDesktopPromo'

export function DesktopPromoProvider({ userProfile, children }: { userProfile?: UserProfile; children: ReactNode }) {
  const account = desktopPromoAccount(userProfile)
  const profileDesktopSeen = account.status === 'loaded' ? account.lastDesktopSeenAt : undefined
  const [storedDesktopSeen, setStoredDesktopSeen] = useState(readStoredDesktopSeen)
  const [storedDismissedAt, setStoredDismissedAt] = useState(readStoredDismissedAt)
  const [now] = useState(Date.now)

  useEffect(() => {
    if (!capabilities.desktopPromo || profileDesktopSeen === undefined) return
    writeStoredDesktopSeen(profileDesktopSeen)
    setStoredDesktopSeen(profileDesktopSeen)
  }, [userProfile, profileDesktopSeen])

  const download = useCallback((source: DesktopPromoClickSource) => {
    trackOutcome(`desktop_promo_click:${source}`)
  }, [])

  const dismiss = useCallback((source: DesktopPromoDismissSource) => {
    const at = new Date().toISOString()
    writeStoredDismissedAt(at)
    setStoredDismissedAt(at)
    trackOutcome(`desktop_promo_dismiss:${source}`)
  }, [])

  const { eligible, ambientVisible } = desktopPromoView({
    capability: capabilities.desktopPromo,
    userAgent: navigator.userAgent,
    account,
    storedDesktopSeen,
    storedDismissedAt,
    now,
  })

  const value = useMemo<DesktopPromo>(
    () => ({ eligible, ambientVisible, download, dismiss }),
    [eligible, ambientVisible, download, dismiss],
  )

  return <DesktopPromoContext.Provider value={value}>{children}</DesktopPromoContext.Provider>
}
