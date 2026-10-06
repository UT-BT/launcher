import type { DraftFormProps } from './handover'

export function DraftForm({ draft }: DraftFormProps) {
  return (
    <section aria-label="Draft details" className="rounded-lg border border-hairline/10 bg-card/30 p-4">
      <p className="text-sm text-muted-foreground">Editing and publishing {draft.map_name} is not available yet.</p>
    </section>
  )
}
