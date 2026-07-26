import { useState } from 'react'
import { createPortal } from 'react-dom'
import { PRIVACY_POLICY } from '@/app/constants/legal'
import { setTelemetryConsent } from '@/app/utils/telemetry'
import { Modal } from '@/app/components/ui/modal'
import { MarkdownBody } from '@/app/components/shared/MarkdownBody'

export function AnalyticsConsentBanner({ onChoice }: { onChoice: () => void }) {
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const choose = async (granted: boolean) => {
    void setTelemetryConsent(granted)
    onChoice()
  }
  return createPortal(
    <>
      <div
        className="fixed left-1/2 lg:left-[calc(50%+8rem)] w-[calc(100vw-24px)] lg:w-[calc(100vw-280px)] max-w-3xl -translate-x-1/2 z-[45] rounded-xl border border-border bg-card p-4 shadow-2xl"
        style={{
          top: 'auto',
          right: 'auto',
          bottom: 12,
          height: 'auto',
          minHeight: 0,
          maxHeight: 'none',
          overflow: 'hidden',
          boxSizing: 'border-box',
          contain: 'layout paint',
        }}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex-1">
            <div className="font-semibold">Help improve UTBT</div>
            <p className="text-sm text-muted-foreground">
              Would you like to enable first-party, pseudonymous usage analytics?
              <br />
              Your choice can be changed anytime in Settings → Privacy.
            </p>
            <button className="mt-1 text-xs text-primary underline" onClick={() => setPrivacyOpen(true)}>Read the privacy policy</button>
          </div>
          <div className="flex gap-2">
            <button className="rounded-lg border border-border px-4 py-2 text-sm" onClick={() => void choose(false)}>Reject</button>
            <button className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground" onClick={() => void choose(true)}>Accept analytics</button>
          </div>
        </div>
      </div>
      <Modal isOpen={privacyOpen} onClose={() => setPrivacyOpen(false)} title="Privacy Policy" className="max-w-3xl">
        <MarkdownBody className="text-sm">{PRIVACY_POLICY}</MarkdownBody>
      </Modal>
    </>,
    document.body,
  )
}
