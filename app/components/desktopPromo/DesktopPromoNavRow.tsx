import { lazy, useState } from 'react'
import { Download, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/app/components/ui/tooltip'
import { LazyModalGate } from '@/app/components/shared/LazyModalGate'
import { useDesktopPromo } from './useDesktopPromo'

const loadDesktopPromoModal = () => import('./DesktopPromoModal').then((m) => ({ default: m.DesktopPromoModal }))
const DesktopPromoModal = lazy(loadDesktopPromoModal)

const DESKTOP_PROMO_NAV_LABEL = 'Get the desktop app'

interface DesktopPromoNavRowProps {
  collapsed: boolean
  onActivate: () => void
}

export function DesktopPromoNavRow({ collapsed, onActivate }: DesktopPromoNavRowProps) {
  const { dismiss } = useDesktopPromo()
  const [modalOpen, setModalOpen] = useState(false)

  const openModal = () => {
    onActivate()
    setModalOpen(true)
  }

  const row = (
    <button
      type="button"
      onClick={openModal}
      onPointerEnter={() => void loadDesktopPromoModal()}
      onFocus={() => void loadDesktopPromoModal()}
      className={cn(
        'flex items-center justify-center gap-2 rounded-lg bg-promo-gold text-amber-950 hover:brightness-110 shadow-lg transition duration-200 cursor-pointer',
        collapsed ? 'size-11' : 'w-full py-2.5 pl-3 pr-8'
      )}
    >
      <Download aria-hidden className={collapsed ? 'size-5' : 'size-4 shrink-0'} />
      <span className={collapsed ? 'sr-only' : 'min-w-0 truncate text-sm font-semibold'}>{DESKTOP_PROMO_NAV_LABEL}</span>
    </button>
  )

  return (
    <div className="group relative">
      {collapsed ? (
        <Tooltip
          side="right"
          className="flex w-full justify-center"
          content={<span className="font-bold text-foreground">{DESKTOP_PROMO_NAV_LABEL}</span>}
        >
          {row}
        </Tooltip>
      ) : (
        row
      )}
      <button
        type="button"
        aria-label="Dismiss the desktop app suggestion"
        onClick={() => dismiss('nav')}
        className={cn(
          'absolute flex items-center justify-center cursor-pointer',
          'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 touch:opacity-100',
          collapsed
            ? '-top-1.5 right-0 size-6 rounded-full border border-hairline/20 bg-card text-muted-foreground hover:text-foreground'
            : 'inset-y-0 right-0 w-8 rounded-lg text-amber-950 hover:bg-hairline/10'
        )}
      >
        <X aria-hidden className={collapsed ? 'size-3.5' : 'size-4'} />
      </button>
      {modalOpen && (
        <LazyModalGate open>
          <DesktopPromoModal onClose={() => setModalOpen(false)} />
        </LazyModalGate>
      )}
    </div>
  )
}
