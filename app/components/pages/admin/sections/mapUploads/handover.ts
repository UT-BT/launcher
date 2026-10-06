import type { Draft } from '@/app/utils/mapUploadTypes'

export type MapUploadsTab = 'drafts' | 'publishing' | 'drift'

export interface DraftFormProps {
  token: string
  draft: Draft
  onDraftChange: (draft: Draft) => void
  onPublished: (publishId: number) => void
}

export interface PublishingTabProps {
  token: string
  publishId: number | null
  onSelectPublish: (publishId: number | null) => void
  onOpenDraft: (draftId: number) => void
}

export interface DriftTabProps {
  token: string
}
