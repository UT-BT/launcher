import { useCallback, useEffect, useState } from 'react'
import { fetchMapUploadPublishes, mapUploadErrorMessage } from '@/app/utils/api'
import type { PublishSummary } from '@/app/utils/mapUploadTypes'
import { Feedback } from '../../components/controls'
import type { PublishingTabProps } from './handover'
import { isPublishSettled } from './publishState'
import { PublishDetail } from './PublishDetail'
import { PublishList } from './PublishList'
import { usePollWhile } from './usePollWhile'

export function PublishingTab({ token, publishId, onSelectPublish, onOpenDraft }: PublishingTabProps) {
  const [publishes, setPublishes] = useState<PublishSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      setPublishes(await fetchMapUploadPublishes(token, signal))
      setError(null)
    } catch (e) {
      if (!signal?.aborted) setError(mapUploadErrorMessage(e))
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [token])

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])

  usePollWhile(publishes.some((p) => !isPublishSettled(p.state)), load)

  return (
    <div className="space-y-4">
      {publishId !== null && (
        <PublishDetail
          key={publishId}
          token={token}
          publishId={publishId}
          onClose={() => onSelectPublish(null)}
          onOpenDraft={onOpenDraft}
          onChanged={() => { void load() }}
        />
      )}
      <Feedback message={error} tone="red" onDismiss={() => setError(null)} />
      <PublishList publishes={publishes} loading={loading} selectedId={publishId} onSelect={onSelectPublish} />
    </div>
  )
}
