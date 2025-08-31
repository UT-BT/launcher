import { Button } from '@/app/components/ui/button'
import { PatchManifest } from '@/app/types'

interface UpdateModalProps {
  manifest: PatchManifest
  updating: boolean
  updateProgress: number
  updateText: string
  onClose: () => void
  onUpdate: () => Promise<void>
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
        
        {currentVersion && (
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

        <div className="mb-3">
          <Button
            variant="secondary"
            className="w-full bg-gray-700/50 hover:bg-gray-700/80 text-[13px] border border-gray-600"
            onClick={onViewReleaseNotes}
          >
            View Release Notes
          </Button>
        </div>

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
            onClick={onUpdate} 
            disabled={updating}
          >
            {updating ? 'Updating...' : 'Update Now'}
          </Button>
        </div>
      </div>
    </>
  )
}