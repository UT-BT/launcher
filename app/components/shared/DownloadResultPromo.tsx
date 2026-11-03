import { lazy, Suspense } from 'react'
import { capabilities } from '@/app/platform'
import { useDesktopPromo, type DesktopPromoClickSource } from '@/app/components/desktopPromo/useDesktopPromo'

const DesktopAppNotice = lazy(() => import('@/app/components/desktopPromo/DesktopAppNotice').then(m => ({ default: m.DesktopAppNotice })))

interface DownloadResultPromoProps {
    source: Extract<DesktopPromoClickSource, 'map-modal' | 'demo-modal'>
    message: string
}

export function DownloadResultPromo({ source, message }: DownloadResultPromoProps) {
    const { eligible } = useDesktopPromo()
    if (!capabilities.desktopPromo || !eligible) return null

    return (
        <Suspense fallback={null}>
            <DesktopAppNotice source={source} message={message} className="text-xs" />
        </Suspense>
    )
}
