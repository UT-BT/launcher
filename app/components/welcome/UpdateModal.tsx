import { Button } from '@/app/components/ui/button'
import { useEffect, useState } from 'react'
import { PatchManifest } from '@/app/types'

interface UpdateModalProps {
  manifest: PatchManifest
  updating: boolean
  updateProgress: number
  updateText: string
  onClose: () => void
  onUpdate: (manifest?: PatchManifest) => Promise<void>
  onViewReleaseNotes: () => void
  currentVersion?: string
  forced?: boolean
  unsupportedBase?: boolean
}

export function UpdateModal({
  manifest,
  updating,
  updateProgress,
  updateText,
  onClose,
  onUpdate,
  onViewReleaseNotes,
  currentVersion,
  forced = false,
  unsupportedBase = false,
}: UpdateModalProps) {
  const [availablePatches, setAvailablePatches] = useState<any[]>([])
  const [selectedPatchTag, setSelectedPatchTag] = useState<string | null>(null)
  const [loadingPatches, setLoadingPatches] = useState(false)

  const shouldShowPatchPicker = forced && (currentVersion === 'v432' || unsupportedBase)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      if (!shouldShowPatchPicker) return
      try {
        setLoadingPatches(true)
        const patchesResp: any = await window.conveyor.app.fetchPatches()
        const list: any[] = Array.isArray(patchesResp?.data) ? patchesResp.data : (Array.isArray(patchesResp) ? patchesResp : [])
        if (!mounted) return
        setAvailablePatches(list)

        const stable = list.filter(p => (p.channel ?? 'stable') === 'stable')
        const parseDate = (v: any) => {
          const d = Date.parse(v?.added ?? v?.published_at ?? '')
          return Number.isFinite(d) ? d : 0
        }
        const sortByRecency = (arr: any[]) => arr.slice().sort((a, b) => {
          const ad = parseDate(a), bd = parseDate(b)
          if (ad !== 0 || bd !== 0) return bd - ad
          const ai = Number(a?.id ?? 0), bi = Number(b?.id ?? 0)
          if (ai !== bi) return bi - ai
          return String(b?.tag ?? '').localeCompare(String(a?.tag ?? ''))
        })
        const pick = (stable.length > 0 ? sortByRecency(stable)[0] : sortByRecency(list)[0])
        setSelectedPatchTag(pick?.tag ?? null)
      } catch (e) {
        console.error('Failed to fetch patches:', e)
      } finally {
        if (mounted) setLoadingPatches(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [shouldShowPatchPicker])

  const handleUpdateClick = async () => {
    if (shouldShowPatchPicker && selectedPatchTag && availablePatches.length > 0) {
      const item = availablePatches.find(p => p.tag === selectedPatchTag)
      if (item) {
        const chosen: PatchManifest = {
          asset_url: item.asset_url,
          sha256: item.sha256,
          tag: item.tag,
          channel: (item.channel === 'rc' ? 'rc' : 'stable') as 'stable' | 'rc',
          release_notes_url: item.release_notes_url
        }
        await onUpdate(chosen)
        return
      }
    }
    await onUpdate()
  }
  return (
    <>
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" 
        onClick={() => { if (!updating && !forced) onClose() }} 
      />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[420px] max-w-[90vw] bg-[#0f1629] border border-gray-700 rounded-lg shadow-xl p-5 h-auto">
        <h3 className="text-base font-semibold text-white mb-2">
          {forced ? 'Update Required' : 'Update Available'}
        </h3>
        
        <p className="text-[13px] text-gray-300 mb-2">
          A new version of Unreal Tournament is available.
        </p>
        <p />
        
        {currentVersion && !shouldShowPatchPicker && (
          <>
            <p className="text-[12px] text-gray-400 mb-2">
              Your current version is <span className="text-gray-200"><b>{currentVersion}</b></span>
              <br />
              The latest version is <span className="text-gray-200"><b>{manifest.tag}</b></span>
            </p>
            <br />
          </>
        )}

        {forced && (
          <p className="text-[12px] text-gray-300 mb-2">
            <b>
              <i className="text-red-500">
                {unsupportedBase ? (
                  <>Your client is currently on a patch version unsupported by the UTBT Launcher.<br />In order to continue using the application, you need to upgrade.</>
                ) : (
                  <>Our servers require all players to be on the 469 patch.<br />Please update in order to be able to play on UTBT.</>
                )}
              </i>
            </b>
          </p>
        )}
        
        {manifest.channel === 'rc' && (
          <>
            <p className="text-[12px] text-amber-400/90 mb-3">
              <i>Please note that this is a <b>Release Candidate</b> patch.</i>
              <br />
              <i>Thich means that some instability could be expected.</i>
            </p>
          </>
        )}

        {!shouldShowPatchPicker && (
          <div className="mb-3">
            <Button
              variant="secondary"
              className="w-full bg-gray-700/50 hover:bg-gray-700/80 text-[13px] border border-gray-600"
              onClick={onViewReleaseNotes}
            >
              View Release Notes
            </Button>
          </div>
        )}

        {updating && (
          <div className="mb-3 space-y-2">
            <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 rounded-full transition-all duration-300" 
                style={{ width: `${updateProgress}%` }} 
              />
            </div>
            <p className="text-[12px] text-gray-400 text-center">{updateText}</p>
          </div>
        )}

        <br />

        {shouldShowPatchPicker && !updating && (
          <div className="mb-3 space-y-2">
            <p className="text-[12px] text-gray-300">
              Select the patch you want to install:
            </p>
            <div className="flex items-center gap-2">
              <select
                className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-[13px] text-gray-200"
                value={selectedPatchTag ?? ''}
                onChange={(e) => setSelectedPatchTag(e.target.value)}
                disabled={loadingPatches}
              >
                {availablePatches.map((p) => (
                  <option key={p.tag} value={p.tag}>
                    {p.tag}{p.channel ? ` • ${String(p.channel).toUpperCase()}` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="flex justify-end items-center gap-2">
          {!forced && (
            <Button 
              variant="outline" 
              className="text-gray-300 border-gray-600 hover:bg-gray-700/60" 
              onClick={onClose} 
              disabled={updating}
            >
              Later
            </Button>
          )}
          <Button 
            className="bg-blue-600 hover:bg-blue-700" 
            onClick={handleUpdateClick} 
            disabled={updating || (shouldShowPatchPicker && !selectedPatchTag)}
          >
            {updating ? 'Updating...' : 'Update Now'}
          </Button>
        </div>
      </div>
    </>
  )
}