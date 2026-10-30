import { useEffect, useState } from 'react'
import { Heart } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { openExternal } from '@/app/platform'
import { fetchUserSummary } from '@/app/utils/api'
import { getPatreonMembers, loadPatreonMembers } from '@/app/utils/patreon'
import { cn } from '@/lib/utils'
import { patronDrawOrder } from './splashPatron'

const PATREON_URL = 'https://patreon.com/utbt'
const MAX_LOOKUPS = 3

type FeaturedPatron = { id: string; alias: string }

function useFeaturedPatron(active: boolean) {
  const [result, setResult] = useState<{ patron: FeaturedPatron | null; settled: boolean }>({ patron: null, settled: false })

  useEffect(() => {
    if (!active) return
    let cancelled = false
    void (async () => {
      await loadPatreonMembers()
      for (const id of patronDrawOrder(getPatreonMembers()).slice(0, MAX_LOOKUPS)) {
        const summary = await fetchUserSummary('', id).catch(() => null)
        const alias = summary?.profile.alias?.trim()
        if (alias) {
          if (!cancelled) setResult({ patron: { id, alias }, settled: true })
          return
        }
      }
      if (!cancelled) setResult({ patron: null, settled: true })
    })()
    return () => {
      cancelled = true
    }
  }, [active])

  return result
}

export function SplashPatreonCard({ active }: { active: boolean }) {
  const { patron, settled } = useFeaturedPatron(active)

  return (
    <div className={cn('splash-patreon', active && settled && 'is-visible')}>
      {patron ? (
        <PlayerInfo userId={patron.id} alias={patron.alias} presentation="avatar" size="lg" interactive={false} />
      ) : (
        <span className="splash-patreon-heart" aria-hidden="true">
          <Heart className="size-5 fill-current" />
        </span>
      )}
      <div className="splash-patreon-copy">
        <span className="splash-patreon-title">Love BunnyTrack?</span>
        {patron ? (
          <span className="splash-patreon-line">
            Be a legend like
            <PlayerInfo userId={patron.id} alias={patron.alias} presentation="name" size="sm" interactive={false} />
          </span>
        ) : (
          <span className="splash-patreon-line">Patrons keep our servers hopping.</span>
        )}
      </div>
      <Button size="sm" onClick={() => openExternal(PATREON_URL)} className="bg-rose-500 text-white hover:bg-rose-500/90">
        <Heart className="size-4 fill-current" />
        Support on Patreon
      </Button>
    </div>
  )
}
