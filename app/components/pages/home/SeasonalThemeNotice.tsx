import { useEffect, useSyncExternalStore } from 'react'
import { Sparkles, X } from 'lucide-react'
import { useTheme } from '@/app/theme/ThemeProvider'
import { THEMES } from '@/app/theme/themes'
import { SEASONAL_THEME_ID } from '@/app/seasonal/appearance'
import {
    dismissSeasonalNotice,
    isSeasonalNoticeDismissed,
    seasonalNoticeAnnounced,
    seasonalNoticeVisible,
    subscribeSeasonalNotice,
} from './seasonalNoticeStorage'

export function SeasonalThemeNotice() {
    const { themeId } = useTheme()
    const dismissed = useSyncExternalStore(subscribeSeasonalNotice, () => isSeasonalNoticeDismissed(), () => true)
    const visible = seasonalNoticeVisible({ themes: THEMES, themeId, dismissed })
    const retiredOnSeasonal = seasonalNoticeAnnounced(THEMES) && themeId === SEASONAL_THEME_ID && !dismissed

    useEffect(() => {
        if (retiredOnSeasonal) dismissSeasonalNotice()
    }, [retiredOnSeasonal])

    if (!visible) return null

    const tryIt = () => {
        dismissSeasonalNotice()
        window.dispatchEvent(new CustomEvent('open-settings', { detail: { section: 'launcher-appearance' } }))
    }

    return (
        <div
            data-seasonal-notice=""
            className="flex items-center gap-2.5 rounded-lg border border-hairline/10 bg-card/30 pl-3 text-sm text-muted-foreground"
        >
            <Sparkles aria-hidden className="size-4 shrink-0" />
            <p className="min-w-0 flex-1 py-2.5 leading-5">
                <span className="font-medium text-foreground">New: Seasonal theme</span>
                <span aria-hidden="true"> · </span>
                Follows the seasons and holidays where you are.
            </p>
            <button
                type="button"
                onClick={tryIt}
                className="min-h-11 shrink-0 rounded-lg px-3 font-medium text-accent-300 underline-offset-2 hover:text-accent-200 hover:underline active:text-accent-200 cursor-pointer"
            >
                Try it
            </button>
            <button
                type="button"
                aria-label="Dismiss the Seasonal theme notice"
                onClick={() => dismissSeasonalNotice()}
                className="flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-hairline/10 active:bg-hairline/10 cursor-pointer"
            >
                <X aria-hidden className="size-4" />
            </button>
        </div>
    )
}
