import { createContext, useContext } from 'react'

export type DesktopPromoClickSource = 'nav' | 'servers' | 'map-modal' | 'demo-modal' | 'settings' | 'stream'
export type DesktopPromoDismissSource = 'nav' | 'servers'

export interface DesktopPromo {
  eligible: boolean
  ambientVisible: boolean
  download: (source: DesktopPromoClickSource) => void
  dismiss: (source: DesktopPromoDismissSource) => void
}

const NOT_ELIGIBLE: DesktopPromo = {
  eligible: false,
  ambientVisible: false,
  download: () => {},
  dismiss: () => {},
}

export const DesktopPromoContext = createContext<DesktopPromo>(NOT_ELIGIBLE)

export function useDesktopPromo(): DesktopPromo {
  return useContext(DesktopPromoContext)
}
