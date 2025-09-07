import { useEffect, useState, useCallback, useRef } from 'react'
import { SplashScreen } from '@/app/components/welcome/WelcomeScreen'
import { Main } from '@/app/components/main/Main'
import { InstallationWizard } from '@/app/components/installation/InstallationWizard'
import { Modal } from '@/app/components/shared/Modal'
import { Button } from '@/app/components/ui/button'
import { useLogger } from '@/app/hooks/use-logger'
import './styles/index.css'

export default function App() {
  const loggerRef = useRef(useLogger('App'))
  const logger = loggerRef.current
  const [appPhase, setAppPhase] = useState<'splash' | 'install' | 'main'>('splash')
  const [forceInstallPrompt, setForceInstallPrompt] = useState(false)

  const runInstallationChecks = useCallback(async () => {
    try {
      logger.info('Running installation checks')
      setForceInstallPrompt(false)
      const installPath = await window.conveyor.app.getInstallPath()
      logger.debug('Install path retrieved', { installPath })

      if (!installPath) {
        logger.warn('No install path found, prompting user to install')
        setForceInstallPrompt(true)
        return false
      }

      const isValid = await window.conveyor.app.verifyInstallPath(installPath)
      logger.debug('Install path verification result', { installPath, isValid })

      if (!isValid) {
        logger.warn('Install path is invalid, prompting user to reinstall', { installPath })
        setForceInstallPrompt(true)
        return false
      }

      logger.info('Installation checks passed successfully')
      return true
    } catch (error) {
      logger.error('Installation check failed', { error })
      setForceInstallPrompt(true)
      return false
    }
  }, [logger])

  const handleSplashComplete = () => {
    logger.info('Splash screen completed, transitioning to main phase')
    setAppPhase('main')
  }

  const handleShowInstallWizard = () => {
    logger.info('User requested installation wizard')
    setAppPhase('install')
  }

  useEffect(() => {
    logger.info('App component mounted')
  }, [logger])

  useEffect(() => {
    logger.info('App phase changed', { newPhase: appPhase })
    if (appPhase === 'splash') {
      runInstallationChecks()
    }
  }, [appPhase, runInstallationChecks, logger])

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