import type { PublishingTabProps } from './handover'

export function PublishingTab({ publishId }: PublishingTabProps) {
  return (
    <section aria-label="Publishing" className="rounded-lg border border-hairline/10 bg-card/30 p-4">
      <p className="text-sm text-muted-foreground">
        {publishId === null ? 'Publishing and recent publishes are not available yet.' : `Publish #${publishId} cannot be shown yet.`}
      </p>
    </section>
  )
}
