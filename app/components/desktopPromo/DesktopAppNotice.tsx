import { useState, type ReactNode } from 'react'
import { Download, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DESKTOP_APP_DOWNLOAD_URL } from '@/app/constants/desktopApp'
import { useDesktopPromo, type DesktopPromoClickSource } from './useDesktopPromo'

const DOWNLOADING_HINT = 'Downloading… If Windows warns about an unrecognised app, choose More info → Run anyway.'

interface DesktopAppNoticeProps {
  source: DesktopPromoClickSource
  message: ReactNode
  fallback?: ReactNode
  onDismiss?: () => void
  className?: string
}

export function DesktopAppNotice({ source, message, fallback = null, onDismiss, className }: DesktopAppNoticeProps) {
  const { eligible, download } = useDesktopPromo()
  const [downloading, setDownloading] = useState(false)

  if (!eligible) return fallback

  const startDownload = () => {
    download(source)
    setDownloading(true)
  }

  return (
    <div
      data-desktop-app-notice=""
      className={cn(
        'flex items-center gap-2.5 rounded-lg border border-hairline/10 bg-card/30 pl-3 text-sm text-muted-foreground',
        onDismiss ? 'pr-0' : 'pr-3',
        className,
      )}
    >
      <Download aria-hidden className="size-4 shrink-0" />
      <p aria-live="polite" className="min-w-0 flex-1 py-2.5 leading-5">
        {downloading ? (
          DOWNLOADING_HINT
        ) : (
          <>
            {message}
            <span aria-hidden="true"> · </span>
            <a
              href={DESKTOP_APP_DOWNLOAD_URL}
              onClick={startDownload}
              className="-mx-2 -my-2.5 inline-block rounded-md px-2 py-2.5 font-medium text-accent-300 underline-offset-2 hover:text-accent-200 hover:underline"
            >
              Download
            </a>
          </>
        )}
      </p>
      {onDismiss && (
        <button
          type="button"
          aria-label="Dismiss the desktop app suggestion"
          onClick={onDismiss}
          className="flex size-10 shrink-0 items-center justify-center self-start rounded-lg text-muted-foreground hover:text-foreground hover:bg-hairline/10 cursor-pointer"
        >
          <X aria-hidden className="size-4" />
        </button>
      )}
    </div>
  )
}
