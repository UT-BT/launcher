import type { DraftSummary } from '@/app/utils/mapUploadTypes'
import { formatDateTime, relTime } from '../../components/controls'

export function DraftExpiry({ draft }: { draft: Pick<DraftSummary, 'expires_at' | 'publish_id'> }) {
  if (draft.publish_id !== null) return <span title="Kept with its publish history">never expires</span>
  return <span title={formatDateTime(draft.expires_at)}>expires {relTime(draft.expires_at)}</span>
}
