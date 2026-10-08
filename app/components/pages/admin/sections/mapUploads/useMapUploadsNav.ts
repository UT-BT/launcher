import { useCallback } from 'react'
import { useNavState } from '@/app/components/navigation/useNavState'
import type { MapUploadsTab } from './handover'

export function useMapUploadsNav() {
  const [tab, setTab] = useNavState<MapUploadsTab>('admin.mapUploads.tab', 'drafts')
  const [draftId, setDraftId] = useNavState<number | null>('admin.mapUploads.draftId', null)
  const [publishId, setPublishId] = useNavState<number | null>('admin.mapUploads.publishId', null)
  const [uploadedIds, setUploadedIds] = useNavState<number[]>('admin.mapUploads.uploadedIds', [])

  const openDraft = useCallback((id: number | null) => { setTab('drafts'); setDraftId(id) }, [setTab, setDraftId])
  const openPublish = useCallback((id: number | null) => { setTab('publishing'); setPublishId(id) }, [setTab, setPublishId])

  return { tab, setTab, draftId, openDraft, publishId, openPublish, uploadedIds, setUploadedIds }
}
