import { Button } from '@/app/components/ui/button'

type Manifest = {
  asset_url: string
  sha256: string
  tag: string
  channel: 'stable' | 'rc'
  release_notes_url?: string
}

export function UpdateModal({
  pendingManifest,
  updating,
  updateProgress,
  updateText,
  onClose,
  onUpdate,
  currentVersion,
  force = false,
}: {
  pendingManifest: Manifest
  updating: boolean
  updateProgress: number
  updateText: string
  onClose: () => void
  onUpdate: () => Promise<void>
  currentVersion?: string
  force?: boolean
}) {
  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={() => { if (!updating && !force) onClose() }} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[420px] max-w-[90vw] bg-[#0f1629] border border-gray-700 rounded-lg shadow-xl p-5 h-auto">
        <h3 className="text-base font-semibold text-white mb-2">{force ? 'Update Required' : 'Update Available'}</h3>
        <p className="text-[13px] text-gray-300 mb-2">
          A new version of Unreal Tournament 1999 is available.
        </p>
        {force && (
          <p className="text-[12px] text-gray-300 mb-2">
            <b><i className="text-red-500">Our servers require all players to be on the 469 patch.<br />Please update in order to be able to play on UTBT.</i></b>
          </p>
        )}
        {currentVersion && (
          <p className="text-[12px] text-gray-400 mb-2">
            Your current version is <span className="text-gray-300">{currentVersion}</span>
            <br />
            Upgrade to <span className="text-gray-200">{pendingManifest.tag}</span>
          </p>
        )}
        {pendingManifest.channel === 'rc' && (
          <>
            <p className="text-[12px] text-amber-400/90 mb-3">
              Please note that this is a Release Candidate patch, which means that some instability could be expected.
            </p>
            <p className="text-[12px] text-gray-400 mb-3">  
              You can check the release notes below for more information.
            </p>
          </>
        )}

        <div className="mb-3">
          <Button
            variant="secondary"
            className="w-full bg-gray-700/50 hover:bg-gray-700/80 text-[13px] border border-gray-600"
            onClick={() => {
              const url = pendingManifest.release_notes_url
              if (url) window.conveyor.window.webOpenUrl(url)
            }}
          >
            View Patch Release Notes
          </Button>
        </div>

        {updating && (
          <div className="mb-3 space-y-2">
            <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${updateProgress}%` }} />
            </div>
            <p className="text-[12px] text-gray-400 text-center">{updateText}</p>
          </div>
        )}

        <div className="flex justify-end items-center gap-2">
          {!force && (
            <Button variant="outline" className="text-gray-300 border-gray-600 hover:bg-gray-700/60" onClick={onClose} disabled={updating}>
              Later
            </Button>
          )}
          <Button className="bg-blue-600 hover:bg-blue-700" onClick={onUpdate} disabled={updating}>
            {updating ? 'Updating...' : 'Update Now'}
          </Button>
        </div>
      </div>
    </>
  )
}


