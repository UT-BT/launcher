import { Check, Download } from 'lucide-react'
import { Modal } from '@/app/components/ui/modal'
import { DESKTOP_APP_DOWNLOAD_URL } from '@/app/constants/desktopApp'
import { useDesktopPromo } from './useDesktopPromo'

const DESKTOP_APP_FEATURES = [
  'One-click join and spectate from the server browser',
  'Installs maps straight into UT',
  'Installs UT99 and the 469 patch for you',
  'Edit your UT99 player, controls, video and audio settings',
  'Can upload your personal-best and record demos automatically',
  'Spectator cams for event streamers',
  'Updates itself',
]

export function DesktopPromoModal({ onClose }: { onClose: () => void }) {
  const { download } = useDesktopPromo()

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Get the UTBT desktop app"
      offsetSidebar
      portal
      maxWidth="32rem"
      footer={
        <div className="p-4 border-t border-border bg-muted/50 shrink-0 flex flex-col gap-3">
          <a
            href={DESKTOP_APP_DOWNLOAD_URL}
            onClick={() => download('nav')}
            className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-md border border-accent-500/40 bg-accent-500/15 px-4 text-sm font-medium text-accent-200 transition-colors hover:border-accent-500/60 hover:bg-accent-500/25 max-sm:self-stretch"
          >
            <Download aria-hidden className="size-4" />
            Download for Windows
          </a>
          <p className="text-xs text-muted-foreground">Windows 10/11 · free</p>
          <p className="text-xs text-muted-foreground">
            Windows may warn about an unrecognised app: choose More info → Run anyway.
          </p>
        </div>
      }
    >
      <ul className="space-y-2.5">
        {DESKTOP_APP_FEATURES.map((feature) => (
          <li key={feature} className="flex items-start gap-3 text-sm text-foreground">
            <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
    </Modal>
  )
}
