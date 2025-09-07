import { useEffect, useState, useCallback } from 'react'
import { SplashScreen } from '@/app/components/welcome/WelcomeScreen'
import { Main } from '@/app/components/main/Main'
import { InstallationWizard } from '@/app/components/installation/InstallationWizard'
import { Modal } from '@/app/components/shared/Modal'
import { Button } from '@/app/components/ui/button'
import './styles/index.css'

export default function App() {
  const [appPhase, setAppPhase] = useState<'splash' | 'install' | 'main'>('splash')
  const [forceInstallPrompt, setForceInstallPrompt] = useState(false)

  const runInstallationChecks = useCallback(async () => {
    try {
      setForceInstallPrompt(false)
      const installPath = await window.conveyor.app.getInstallPath()
      if (!installPath) {
        setForceInstallPrompt(true)
        return false
      }
      const isValid = await window.conveyor.app.verifyInstallPath(installPath)
      if (!isValid) {
        setForceInstallPrompt(true)
        return false
      }
      return true
    } catch {
      setForceInstallPrompt(true)
      return false
    }
  }, [])

  const handleSplashComplete = () => {
    setAppPhase('main')
  }

  const handleShowInstallWizard = () => {
    setAppPhase('install')
  }

  useEffect(() => {
    if (appPhase === 'splash') {
      runInstallationChecks()
    }
  }, [appPhase, runInstallationChecks])

  return (
    <>
      {appPhase === 'install' ? (
        <InstallationWizard
          onBack={() => setAppPhase('splash')}
          onComplete={() => setAppPhase('splash')}
        />
      ) : appPhase === 'main' ? (
        <Main />
      ) : (
        <>
          <SplashScreen onReady={handleSplashComplete} />

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
              <Button onClick={handleShowInstallWizard}>Open Installation Wizard</Button>
            </div>
          </Modal>
        </>
      )}
    </>
  )
}