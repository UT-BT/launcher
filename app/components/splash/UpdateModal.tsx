import { Button } from '@/app/components/ui/button'
import { useEffect, useState, useRef } from 'react'
import { useLogger } from '@/app/hooks/use-logger'
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
  const logger = useLogger('UpdateModal')
  const mountedRef = useRef(false)
  const [availablePatches, setAvailablePatches] = useState<any[]>([])
  const [selectedPatchTag, setSelectedPatchTag] = useState<string | null>(null)
  const [loadingPatches, setLoadingPatches] = useState(false)
  const noPickerLoggedRef = useRef(false)

  const shouldShowPatchPicker = forced && (currentVersion === 'v432' || unsupportedBase)

  useEffect(() => {
    if (!mountedRef.current) {
      logger.info('Mounted', { forced, unsupportedBase, currentVersion })
      mountedRef.current = true
    }
    let mounted = true
  
    const load = async () => {
      if (!shouldShowPatchPicker) {
        if (!noPickerLoggedRef.current) {
          logger.debug('Patch picker not needed', { shouldShowPatchPicker })
          noPickerLoggedRef.current = true
        }
        return
      }
      logger.info('Loading available patches for forced update')
      try {
        setLoadingPatches(true)
        const patchesResp: any = await window.conveyor.app.fetchPatches()
        const list: any[] = Array.isArray(patchesResp?.data) ? patchesResp.data : (Array.isArray(patchesResp) ? patchesResp : [])
        if (!mounted) return
        logger.debug('Fetched patches', { count: list.length })
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
        logger.info('Selected default patch', { tag: pick?.tag, channel: pick?.channel })
        setSelectedPatchTag(pick?.tag ?? null)
      } catch (e) {
        logger.error('Failed to fetch patches', { error: e })
      } finally {
        if (mounted) setLoadingPatches(false)
      }
    }
  
    load()
    return () => {
      mounted = false
    }
  }, [shouldShowPatchPicker, forced, unsupportedBase, currentVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleUpdateClick = async () => {
    logger.info('User clicked update button', {
      shouldShowPatchPicker,
      selectedPatchTag,
      availablePatchesCount: availablePatches.length
    })

    if (shouldShowPatchPicker && selectedPatchTag && availablePatches.length > 0) {
      const item = availablePatches.find(p => p.tag === selectedPatchTag)
      if (item) {
        logger.info('Applying selected patch', {
          tag: item.tag,
          channel: item.channel,
          asset_url: item.asset_url
        })
        const chosen: PatchManifest = {
          asset_url: item.asset_url,
          sha256: item.sha256,
          tag: item.tag,
          channel: (item.channel === 'rc' ? 'rc' : 'stable') as 'stable' | 'rc',
          release_notes_url: item.release_notes_url
        }
        await onUpdate(chosen)
        return
      } else {
        logger.warn('Selected patch not found in available patches', { selectedPatchTag })
      }
    }

    logger.info('Applying default update manifest', { tag: manifest.tag })
    await onUpdate()
  }
  return (
    <>
      <div 
        className="update-modal-overlay" 
        onClick={() => { if (!updating && !forced) onClose() }} 
      />
      <div className="update-modal-content">
        <h3 className="update-modal-title">
          {forced ? 'Update Required' : 'Update Available'}
        </h3>
        
        <p className="update-modal-description">
          A new version of Unreal Tournament is available.
        </p>
        <p />
        
        {currentVersion && !shouldShowPatchPicker && (
          <>
            <p className="update-modal-version-info">
              Your current version is <span className="update-modal-version-highlight">{currentVersion}</span>
              <br />
              The latest version is <span className="update-modal-version-highlight">{manifest.tag}</span>
            </p>
            <br />
          </>
        )}

        {forced && (
          <p className="update-modal-forced-message">
            <span className="update-modal-forced-text">
              {unsupportedBase ? (
                <>Your client is currently on a patch version unsupported by the UTBT Launcher.<br />In order to continue using the application, you need to upgrade.</>
              ) : (
                <>Our servers require all players to be on the 469 patch.<br />Please update in order to be able to play on UTBT.</>
              )}
            </span>
          </p>
        )}
        
        {manifest.channel === 'rc' && (
          <>
            <p className="update-modal-rc-warning">
              Please note that this is a <b>Release Candidate</b> patch.
              <br />
              This means that some instability could be expected.
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
          <div className="update-modal-progress-container">
            <div className="update-modal-progress-bar">
              <div 
                className="update-modal-progress-fill" 
                style={{ width: `${updateProgress}%` }} 
              />
            </div>
            <p className="update-modal-progress-text">{updateText}</p>
          </div>
        )}

        <br />

        {shouldShowPatchPicker && !updating && (
          <div className="update-modal-patch-section">
            <p className="update-modal-patch-label">
              Select the patch you want to install:
            </p>
            <div className="update-modal-patch-selector-container">
              <select
                className="update-modal-patch-selector"
                value={selectedPatchTag ?? ''}
                onChange={(e) => setSelectedPatchTag(e.target.value)}
                disabled={loadingPatches}
              >
                {availablePatches.map((p) => (
                  <option key={p.tag} value={p.tag} className="update-modal-patch-option">
                    {p.tag}{p.channel ? ` • ${String(p.channel).toUpperCase()}` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="update-modal-actions">
          {!forced && (
            <Button 
              variant="outline" 
              className="update-modal-later-button" 
              onClick={onClose} 
              disabled={updating}
            >
              Later
            </Button>
          )}
          <Button 
            className="update-modal-update-button" 
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