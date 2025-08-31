import { motion } from 'framer-motion'
import { Button } from '@/app/components/ui/button'
import { useInstallation } from '@/app/hooks/useInstallation'
import { useConfirmDialog } from '@/app/hooks/useConfirmDialog'
import { Modal } from '@/app/components/shared/Modal'
import { ConfirmModal } from '@/app/components/shared/ConfirmModal'
import { ProgressSection } from '@/app/components/shared/ProgressSection'
import { BackButton } from '@/app/components/shared/BackButton'
import { Tooltip } from '@/app/components/shared/Tooltip'
import logo from '@/app/assets/logo.png'
import { useState } from 'react'

interface InstallationWizardProps {
  onBack?: () => void
  onComplete?: () => void
}

export function InstallationWizard({ onBack, onComplete }: InstallationWizardProps) {
  const { state, config, actions } = useInstallation({
    onInstallComplete: () => setShowInstallPathModal(true)
  })
  const confirmDialog = useConfirmDialog()
  
  const [showInstallPathModal, setShowInstallPathModal] = useState(false)
  const [showErrorModal, setShowErrorModal] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const handleChooseExisting = async () => {
    const path = await actions.pickInstallFolder()
    if (!path) return
    
    const success = await actions.setInstallPath(path)
    if (!success) {
      setErrorMessage('Invalid UT99 installation directory.\n\nPlease select the folder containing:\nSystem/UnrealTournament.exe')
      setShowErrorModal(true)
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
          <Button 
            variant="ghost" 
            onClick={() => setShowInstallPathModal(false)}
          >
            Skip for Now
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

      <ConfirmModal
        isOpen={confirmDialog.isOpen}
        onClose={confirmDialog.close}
        onConfirm={confirmDialog.confirm}
        title={confirmDialog.dialog?.title || ''}
        message={confirmDialog.dialog?.message || ''}
        detail={confirmDialog.dialog?.detail}
      />
    </div>
  )
}
