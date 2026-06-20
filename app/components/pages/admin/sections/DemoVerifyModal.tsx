import { useEffect, useRef, useState } from 'react'
import { UploadCloud, FileCheck, AlertTriangle } from 'lucide-react'
import { verifyCapWithDemo, type AdminCapRow, type DemoVerifyResult } from '@/app/utils/api'
import { Modal } from '@/app/components/ui/modal'
import { Button } from '@/app/components/ui/button'
import { cn } from '@/lib/utils'
import { Feedback, errMessage } from '../components/controls'

export function DemoVerifyModal({ open, onClose, token, cap, onVerified }: {
  open: boolean
  onClose: () => void
  token: string
  cap: AdminCapRow | null
  onVerified: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [skipBtpog, setSkipBtpog] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<DemoVerifyResult | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setFile(null); setSkipBtpog(false); setResult(null) }, [cap?.id, open])

  const submit = async () => {
    if (!cap || !file) return
    setBusy(true); setResult(null)
    try {
      const r = await verifyCapWithDemo(token, cap.id, file, file.name, skipBtpog)
      setResult(r)
      if (r.success) onVerified()
    } catch (e) {
      setResult({ success: false, reason: errMessage(e) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="Verify cap with demo"
      offsetSidebar
      maxWidth="36rem"
      footer={
        <div className="p-4 border-t border-border bg-muted/50 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={submit} disabled={!file || busy}>{busy ? 'Verifying…' : 'Upload & Verify'}</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Upload the <span className="font-mono text-xs">.dem</span> for{' '}
          <span className="text-foreground font-medium">{cap?.alias || cap?.user}</span> on{' '}
          <span className="text-foreground font-medium">{cap?.map}</span>. The demo's BTPog ID must match this cap.
        </p>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={cn(
            'w-full rounded-xl border border-dashed border-hairline/20 bg-card/30 p-6 flex flex-col items-center gap-2',
            'hover:border-accent-500/40 hover:bg-card/50 transition-colors cursor-pointer',
          )}
        >
          {file ? <FileCheck className="size-8 text-emerald-300" /> : <UploadCloud className="size-8 text-muted-foreground/40" />}
          <span className="text-sm text-muted-foreground">{file ? file.name : 'Click to choose a .dem file'}</span>
        </button>
        <input ref={inputRef} type="file" accept=".dem" className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)} />

        <label className="flex items-start gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={skipBtpog}
            onChange={(e) => setSkipBtpog(e.target.checked)}
            style={{ colorScheme: 'dark' }}
            className="mt-0.5 size-4 shrink-0 cursor-pointer accent-red-500"
          />
          <span className="text-sm text-foreground">
            Skip BTPog ID check
            <span className="block text-xs text-muted-foreground">Verify even when the demo's BTPog ID doesn't match this cap.</span>
          </span>
        </label>

        {skipBtpog && (
          <div className="flex items-start gap-2.5 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2.5 text-red-300">
            <AlertTriangle className="size-4 shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed">
              The BTPog ID check will be skipped. Make sure you are uploading the correct demo for this run.
            </p>
          </div>
        )}

        {result && (
          <div className="space-y-2">
            <Feedback message={result.success ? (result.message || 'Cap verified.') : (result.reason || 'Verification failed.')}
              tone={result.success ? 'emerald' : 'red'} />
            {result.debug && result.debug.steps.length > 0 && (
              <div className="bg-card/30 border border-hairline/5 rounded-lg p-3">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Debug log</span>
                <pre className="mt-1.5 text-xs text-muted-foreground/90 whitespace-pre-wrap font-mono">{result.debug.steps.join('\n')}</pre>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
