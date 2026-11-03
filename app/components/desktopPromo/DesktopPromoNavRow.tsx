import { lazy, Suspense, useState } from 'react'
import { Download, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/app/components/ui/tooltip'
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
        'w-full flex rounded-lg text-muted-foreground hover:text-foreground hover:bg-hairline/5 transition-colors cursor-pointer',
        collapsed
          ? 'items-center justify-center min-h-11 px-1 py-1.5 [@media(max-height:800px)]:py-1'
          : 'items-center gap-4 pl-4 pr-9 py-3 [@media(max-height:800px)]:py-2'
      )}
    >
      <Download aria-hidden className="size-5 shrink-0" />
      <span className={collapsed ? 'sr-only' : 'min-w-0 truncate text-sm font-medium'}>{DESKTOP_PROMO_NAV_LABEL}</span>
    </button>
  )

  return (
    <div className={cn('relative z-10 pt-2 pb-3', collapsed ? 'px-1.5' : 'px-4')}>
      <div className="group relative">
        {collapsed ? (
          <Tooltip
            side="right"
            className="flex w-full"
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
            'absolute flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-hairline/10 cursor-pointer',
            'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100',
            collapsed ? 'top-0 right-0 size-6' : 'inset-y-0 right-0 w-8'
          )}
        >
          <X aria-hidden className={collapsed ? 'size-3.5' : 'size-4'} />
        </button>
      </div>
      {modalOpen && (
        <Suspense fallback={null}>
          <DesktopPromoModal onClose={() => setModalOpen(false)} />
        </Suspense>
      )}
    </div>
  )
}
