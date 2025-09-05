import { motion } from 'framer-motion'
import { Button } from '@/app/components/ui/button'
import { useInstallation } from '@/app/hooks/useInstallation'
import { useConfirmDialog } from '@/app/hooks/useConfirmDialog'
import { Modal } from '@/app/components/shared/Modal'
import { ConfirmModal } from '@/app/components/shared/ConfirmModal'
import { ProgressSection } from '@/app/components/shared/ProgressSection'
import { BackButton } from '@/app/components/shared/BackButton'
import { Tooltip } from '@/app/components/shared/Tooltip'
import { installationService } from '@/app/services/InstallationService'
import logo from '@/app/assets/logo.png'
import { useState } from 'react'

interface InstallationWizardProps {
  onBack?: () => void
  onComplete?: () => void
}

export function InstallationWizard({ onBack, onComplete: _onComplete }: InstallationWizardProps) {
  const { state, config, actions } = useInstallation({
    onInstallComplete: () => setShowInstallPathModal(true),
    onAnnouncerComplete: () => {
      installationService.setWindowLocked(false)
      setShowShortcutModal(true)
    }
  })
  const confirmDialog = useConfirmDialog()
  
  const [showInstallPathModal, setShowInstallPathModal] = useState(false)
  const [showErrorModal, setShowErrorModal] = useState(false)
  const [showShortcutModal, setShowShortcutModal] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [shortcutOptions, setShortcutOptions] = useState({
    desktop: true,
    startMenu: true
  })
  const [showUnsupportedModal, setShowUnsupportedModal] = useState(false)
  const [availablePatches, setAvailablePatches] = useState<any[]>([])
  const [selectedPatchTag, setSelectedPatchTag] = useState<string | null>(null)
  const [upgradeInProgress, setUpgradeInProgress] = useState(false)

  const handleChooseExisting = async () => {
    const path = await actions.pickInstallFolder()
    if (!path) return
    
    const success = await actions.setInstallPath(path)
    if (!success) {
      setErrorMessage('Invalid UT99 installation directory.\n\nPlease select the folder containing:\nSystem/UnrealTournament.exe')
      setShowErrorModal(true)
      return
    }

    try {
      const md5 = await window.conveyor.app.getExeMD5(path)
      if (!md5) {
        throw new Error('Failed to fingerprint UnrealTournament.exe')
      }

      const patchesResp: any = await window.conveyor.app.fetchPatches()
      const list: any[] = Array.isArray(patchesResp?.data) ? patchesResp.data : (Array.isArray(patchesResp) ? patchesResp : [])
      const match = list.find(p => (p.exe_md5 || '').toLowerCase() === md5.toLowerCase())
      if (match) {
        const stamp = { tag: match.tag, sha256: match.sha256, channel: (match.channel === 'rc' ? 'rc' : 'stable') as 'stable' | 'rc', installedAt: new Date().toISOString() }
        await window.conveyor.app.setInstalledPatch(stamp)
      } else {
        try { await window.conveyor.app.setBaseVersion('unsupported') } catch (e) { console.warn('setBaseVersion unsupported failed', e) }
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
        setShowUnsupportedModal(true)
      }
    } catch (err) {
      console.error('Existing install detection failed:', err)
      setAvailablePatches([])
      setSelectedPatchTag(null)
      setShowUnsupportedModal(true)
    }
  }

  const handleStartInstallation = () => {
    actions.startInstallation()
  }

  const handlePatchChannelChange = (channel: 'stable' | 'rc') => {
    actions.setPatchChannel(channel)
  }

  const handleModalInstallPathSelect = async () => {
    const path = await actions.pickInstallFolder()
    if (!path) return

    const success = await actions.setInstallPath(path)
    if (!success) {
      setErrorMessage('Invalid UT99 installation directory.\n\nPlease select the folder containing:\nSystem/UnrealTournament.exe')
      setShowErrorModal(true)
      return
    }

    setShowInstallPathModal(false)

    try {
      await actions.applyPatchAfterInstall(path, config.patchChannel)
    } catch (error) {
      console.error('Patch application failed after install:', error)
    }
  }

  const handleShortcutOptionChange = (option: 'desktop' | 'startMenu') => {
    setShortcutOptions(prev => ({
      ...prev,
      [option]: !prev[option]
    }))
  }

  const handleCreateShortcuts = async () => {
    if (!config.installPath) return

    try {
      if (shortcutOptions.desktop) {
        await window.conveyor.app.createDesktopShortcut(config.installPath)
      }
      if (shortcutOptions.startMenu) {
        await window.conveyor.app.createStartMenuShortcut(config.installPath)
      }
    } catch (error) {
      console.error('Shortcut creation failed:', error)
      setErrorMessage('Failed to create shortcuts. You can create them manually later.')
      setShowErrorModal(true)
    }

    setShowShortcutModal(false)
  }

  const handleSkipShortcuts = () => {
    setShowShortcutModal(false)
  }

  const handleApplySelectedUpgrade = async () => {
    if (!selectedPatchTag) return
    const item = availablePatches.find(p => p.tag === selectedPatchTag)
    if (!item) return
    try {
      setUpgradeInProgress(true)
      await installationService.setWindowLocked(true)
      setShowUnsupportedModal(false)
      const manifest = { asset_url: item.asset_url, sha256: item.sha256, tag: item.tag, channel: (item.channel === 'rc' ? 'rc' : 'stable') as 'stable' | 'rc' }
      
      await installationService.applyPatch(manifest)
      
      await installationService.installAnnouncer()
      installationService.setWindowLocked(false)
      setShowShortcutModal(true)
    } catch (error) {
      console.error('Upgrade apply failed:', error)
      setErrorMessage('Failed to upgrade. Please try again or choose a different patch.')
      setShowErrorModal(true)
    } finally {
      await installationService.setWindowLocked(false)
      setUpgradeInProgress(false)
    }
  }

  const isProcessing = state.status === 'downloading' || state.status === 'installing'

  return (
    <div className="page-container">
      <div className="nebula-bg" aria-hidden="true" />
      
      {onBack && (
        <BackButton 
          onClick={onBack} 
          disabled={isProcessing}
        />
      )}

      <motion.div
        className="page-content"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <motion.div
          className="glass-card"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <motion.img
            src={logo}
            alt="UTBT.net Logo"
            className="app-logo--small"
            draggable="false"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{
              duration: 0.5,
              delay: 0.15,
              ease: "easeOut"
            }}
          />
          
          <motion.h1
            className="section-title"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            Install Unreal Tournament 1999
          </motion.h1>

          <hr className="section-divider" />
          
          {config.installPath ? (
            <motion.div
              className="current-path-display"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <div className="current-path-label">Configured Installation Directory</div>
              <div className="current-path-value">{config.installPath}</div>
            </motion.div>
          ) : (
            <motion.p
              className="subtitle"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              Choose your installation method below
            </motion.p>
          )}

          <motion.div
            className="form-section"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <div className="form-preferences">
              <label className="form-checkbox">
                <input
                  type="checkbox"
                  checked={config.patchChannel === 'stable'}
                  disabled={isProcessing}
                  onChange={(e) => {
                    if (e.target.checked) {
                      handlePatchChannelChange('stable')
                    }
                  }}
                />
                <span>Install full release patches only</span>
              </label>
              
              <label className="form-checkbox">
                <input
                  type="checkbox"
                  checked={config.patchChannel === 'rc'}
                  disabled={isProcessing}
                  onChange={(e) => {
                    if (e.target.checked) {
                      handlePatchChannelChange('rc')
                    }
                  }}
                />
                <span>
                  Install release candidate patches
                  <Tooltip
                    content={
                      <span>
                        Unreal Tournament developers often release pre-release versions of newer patches to allow the community to test features. 
                        <br /><br />
                        These patches are considered mostly stable by the developers, but could still contain some small bugs and issues.
                      </span>
                    }
                  >
                    <span className="help-icon" aria-label="Help">
                      ℹ️
                    </span>
                  </Tooltip>
                </span>
              </label>
            </div>
            
            <div className="actions-row">
              <Button 
                variant="secondary" 
                onClick={handleChooseExisting}
                disabled={isProcessing}
                className="enhanced-button"
              >
                {config.installPath ? '📁 Change Install Directory' : '📁 Choose Existing Install'}
              </Button>
              
              <Button 
                onClick={handleStartInstallation} 
                disabled={isProcessing}
                className="enhanced-button"
              >
                {state.status === 'downloading' ? 'Downloading…' : 
                 state.status === 'installing' ? 'Installing…' : 
                 '🚀 Download & Install'}
              </Button>
            </div>
          </motion.div>

          {state.status !== 'idle' && (
            <ProgressSection
              progress={state.progress}
              progressText={state.progressText}
              speedText={state.speedText}
              etaText={state.etaText}
              showDetails={state.status === 'downloading'}
            />
          )}
        </motion.div>
      </motion.div>

      <Modal
        isOpen={showInstallPathModal}
        onClose={() => setShowInstallPathModal(false)}
        title="🎉 Installation Complete!"
      >
        <p className="modal-subtitle">
          Please select the folder where UT99 was installed to complete the setup.
        </p>
        <div className="modal-actions">
          <Button onClick={handleModalInstallPathSelect}>
            📁 Select Install Folder
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        title="Invalid Path"
        variant="error"
      >
        <p className="modal-subtitle">
          {errorMessage}
        </p>
        <div className="modal-actions">
          <Button onClick={() => setShowErrorModal(false)}>
            OK
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={showUnsupportedModal}
        onClose={() => !upgradeInProgress && setShowUnsupportedModal(false)}
        title="Unsupported Version Detected"
        closeOnOverlayClick={!upgradeInProgress}
      >
        <p className="modal-subtitle">
          Your current version of Unreal Tournament 1999 is unsupported by the UTBT Launcher.<br /><br />If you want to continue using the launcher with your existing install, you need to upgrade to one of the supported versions.<br /><br /><i>Patching will <b>NOT</b> affect your settings and is safe to do.</i>
        </p>

        {availablePatches && availablePatches.length > 0 ? (
          <div className="form-section install-modal-top-gap">
            <label className="form-checkbox install-modal-select-row">
              <span className="install-modal-select-label">Select Patch</span>
              <select
                value={selectedPatchTag ?? ''}
                onChange={(e) => setSelectedPatchTag(e.target.value)}
                disabled={upgradeInProgress}
                className="modal-select install-modal-select"
              >
                {availablePatches.map((p) => (
                  <option key={p.tag} value={p.tag}>
                    {p.tag}{p.channel ? ` • ${String(p.channel).toUpperCase()}` : ''}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : (
          <p className="install-modal-top-gap">No patches available from the gateway.</p>
        )}

        <div className="modal-actions">
          <Button variant="secondary" onClick={() => setShowUnsupportedModal(false)} disabled={upgradeInProgress}>
            Cancel
          </Button>
          <Button onClick={handleApplySelectedUpgrade} disabled={!selectedPatchTag || upgradeInProgress}>
            {upgradeInProgress ? 'Upgrading…' : 'Upgrade Now'}
          </Button>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={confirmDialog.isOpen}
        onClose={confirmDialog.close}
        onConfirm={confirmDialog.confirm}
        title={confirmDialog.dialog?.title || ''}
        message={confirmDialog.dialog?.message || ''}
        detail={confirmDialog.dialog?.detail}
      />

      <Modal
        isOpen={showShortcutModal}
        onClose={handleSkipShortcuts}
        title="🎯 Create Shortcuts"
        closeOnOverlayClick={false}
      >
        <p className="modal-subtitle">
          Would you like to create shortcuts for Unreal Tournament 1999?
        </p>

        <div className="shortcut-options">
          <label className="form-checkbox">
            <input
              type="checkbox"
              checked={shortcutOptions.desktop}
              onChange={() => handleShortcutOptionChange('desktop')}
            />
            <span>📁 Desktop Shortcut</span>
          </label>

          <label className="form-checkbox">
            <input
              type="checkbox"
              checked={shortcutOptions.startMenu}
              onChange={() => handleShortcutOptionChange('startMenu')}
            />
            <span>🚀 Start Menu Shortcut</span>
          </label>
        </div>

        <div className="modal-actions">
          <Button variant="secondary" onClick={handleSkipShortcuts}>
            Skip
          </Button>
          <Button
            onClick={handleCreateShortcuts}
            disabled={!shortcutOptions.desktop && !shortcutOptions.startMenu}
          >
            Create Shortcuts
          </Button>
        </div>
      </Modal>
    </div>
  )
}
