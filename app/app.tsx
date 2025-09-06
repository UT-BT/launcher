import { useEffect, useState, useCallback } from 'react'
import { WelcomeScreen } from '@/app/components/welcome/WelcomeScreen'
import { InstallationWizard } from '@/app/components/installation/InstallationWizard'
import { Modal } from '@/app/components/shared/Modal'
import { Button } from '@/app/components/ui/button'
import './styles/index.css'

export default function App() {
  const [screen, setScreen] = useState<'welcome' | 'install'>('welcome')
  const [checking, setChecking] = useState(true)
  const [forceInstallPrompt, setForceInstallPrompt] = useState(false)

  const runStartupChecks = useCallback(async () => {
    try {
      setForceInstallPrompt(false)
      setChecking(true)
      const installPath = await window.conveyor.app.getInstallPath()
      if (!installPath) {
        setForceInstallPrompt(true)
        return
      }
      const isValid = await window.conveyor.app.verifyInstallPath(installPath)
      if (!isValid) {
        setForceInstallPrompt(true)
        return
      }
    } catch {
      setForceInstallPrompt(true)
    } finally {
      setChecking(false)
    }
  }, [])

  useEffect(() => {
    if (screen === 'welcome') {
      runStartupChecks()
    }
  }, [screen, runStartupChecks])

  return (
    <>
      {screen === 'install' ? (
        <InstallationWizard 
          onBack={() => setScreen('welcome')}
          onComplete={() => setScreen('welcome')}
        />
      ) : (
        <>
          {checking ? (
            <div className="page-container">
              <div className="nebula-bg" aria-hidden="true" />
              <div className="page-content" style={{ textAlign: 'center' }}>
                <h1 className="gradient-title">Loading…</h1>
                <p>Checking your UT99 installation</p>
              </div>
            </div>
          ) : (
            <WelcomeScreen />
          )}

          <Modal
            isOpen={forceInstallPrompt}
            onClose={() => { /* sorry, no cancelling allowed */ }}
            title="Unreal Tournament Not Found"
            closeOnOverlayClick={false}
          >
            <p className="modal-subtitle">
              We couldn't find a valid Unreal Tournament 1999 installation.
              <br />
              <br />
              Please run the installation wizard to continue to the launcher.
            </p>
            <div className="modal-actions">
              <Button onClick={() => setScreen('install')}>Open Installation Wizard</Button>
            </div>
          </Modal>
        </>
      )}
    </>
  )
}