import { useCallback, useState } from 'react'
import { FileUp } from 'lucide-react'
import { Segmented } from '@/app/components/shared/Segmented'
import type { AdminSectionProps } from '../../types'
import { SectionShell } from '../../components/SectionShell'
import type { MapUploadsTab } from './handover'
import { useMapUploadsNav } from './useMapUploadsNav'
import { useArchiveUpload } from './useArchiveUpload'
import { uploadOutcome } from './uploadState'
import { UploadPanel } from './UploadPanel'
import { DraftList } from './DraftList'
import { DraftReport } from './DraftReport'
import { PublishingTab } from './PublishingTab'
import { DriftTab } from './DriftTab'

const TABS: { id: MapUploadsTab; label: string }[] = [
  { id: 'drafts', label: 'Drafts' },
  { id: 'publishing', label: 'Publishing / Recent' },
  { id: 'drift', label: 'Drift' },
]

export function MapUploadsSection({ userProfile }: AdminSectionProps) {
  const token = userProfile?.accessToken ?? ''
  const { tab, setTab, draftId, openDraft, publishId, openPublish, uploadedIds, setUploadedIds } = useMapUploadsNav()
  const [refreshKey, setRefreshKey] = useState(0)

  const onUploaded = useCallback((ids: number[]) => {
    setRefreshKey((key) => key + 1)
    const outcome = uploadOutcome(ids)
    if (outcome.kind === 'open') {
      setUploadedIds([])
      openDraft(outcome.draftId)
    } else {
      setUploadedIds(outcome.draftIds)
      openDraft(null)
    }
  }, [openDraft, setUploadedIds])

  const upload = useArchiveUpload(token, onUploaded)

  return (
    <SectionShell
      title="Map Uploads"
      description="Upload a map archive, check what will happen to every file, and publish it to every server."
      icon={FileUp}
    >
      <div role="group" aria-label="Map Uploads views" className="flex flex-wrap gap-2">
        {TABS.map((t) => <Segmented key={t.id} active={tab === t.id} label={t.label} onClick={() => setTab(t.id)} />)}
      </div>

      {tab === 'drafts' && (draftId === null ? (
        <>
          <UploadPanel state={upload.state} onFile={upload.upload} onCancel={upload.cancel} onReset={upload.reset} />
          <DraftList
            token={token}
            refreshKey={refreshKey}
            uploadedIds={uploadedIds}
            onDismissUploaded={() => setUploadedIds([])}
            onOpenDraft={openDraft}
          />
        </>
      ) : (
        <DraftReport
          key={draftId}
          token={token}
          draftId={draftId}
          onBack={() => openDraft(null)}
          onDiscarded={() => {
            setRefreshKey((key) => key + 1)
            openDraft(null)
          }}
          onOpenPublish={openPublish}
        />
      ))}
      {tab === 'publishing' && (
        <PublishingTab token={token} publishId={publishId} onSelectPublish={openPublish} onOpenDraft={openDraft} />
      )}
      {tab === 'drift' && <DriftTab token={token} />}
    </SectionShell>
  )
}
