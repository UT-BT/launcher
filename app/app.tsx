import { useState, useRef, useEffect, useCallback } from 'react'
import { SplashScreen } from '@/app/components/splash/SplashScreen'
import { Main } from '@/app/components/main/Main'
import { LoginPage } from '@/app/components/pages/LoginPage'
import { ErrorModal } from '@/app/components/ErrorModal'
import { UpdaterProvider } from '@/app/hooks/useUpdater'
import { UpdateModal } from '@/app/components/updater/UpdateModal'
import { useLogger } from '@/app/hooks/use-logger'
import { IS_WEB, platformAuth } from '@/app/platform'
import { fetchUserProfile, UserProfile, logLauncherStartup, fetchLatestActivity } from '@/app/utils/api'

import './styles/index.css'

let globalAppMounted = false

type InitResult =
  | { status: 'loggedin'; profile: UserProfile }
  | { status: 'loggedout' }
  | { status: 'error'; error: Error }

export default function App() {
  const loggerRef = useRef(useLogger('App'))
  const logger = loggerRef.current
  const mountedRef = useRef(false)

  const [appPhase, setAppPhase] = useState<'splash' | 'login' | 'main'>('splash')
  const [userProfile, setUserProfile] = useState<UserProfile | undefined>(undefined)
  const [initError, setInitError] = useState<{ message: string; retry: () => void } | null>(null)

  const initPromiseRef = useRef<Promise<InitResult> | null>(null)

  const preloadData = useCallback(async (): Promise<InitResult> => {
    try {
      logger.info('Starting data preload...')
      const authConfig = await platformAuth.getProfile()

      if (!authConfig) {
        logger.info('Preload: User not logged in')
        return { status: 'loggedout' }
      }

      logger.info('Preload: User logged in, fetching extended profile')
      const [extendedProfile, latestActivity] = await Promise.all([
        fetchUserProfile(authConfig.accessToken),
        fetchLatestActivity(authConfig.accessToken)
      ])

      const fullProfile: UserProfile = {
        ...authConfig,
        ...extendedProfile,
        latest_activity: latestActivity
      }

      return { status: 'loggedin', profile: fullProfile }

    } catch (error: any) {
      logger.error('Preload failed', error)
      return { status: 'error', error: error instanceof Error ? error : new Error(String(error)) }
    }
  }, [logger])

  // Start preloading immediately on mount
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true
      if (!globalAppMounted) {
        globalAppMounted = true
        logger.info('App component mounted, initiating preload')
        initPromiseRef.current = preloadData()
      }
    }
    return () => { mountedRef.current = false }
  }, [preloadData, logger])

  const handleSplashComplete = async () => {
    logger.info('Splash screen completed, awaiting preload result')

    if (!initPromiseRef.current) {
      initPromiseRef.current = preloadData()
    }

    const result = await initPromiseRef.current

    if (result.status === 'loggedin') {
      logger.info('Preload successful: transitioning to Main')
      setUserProfile(result.profile)
      setAppPhase('main')
    } else if (result.status === 'loggedout') {
      logger.info(IS_WEB ? 'Preload result: Not logged in, browsing anonymously' : 'Preload result: Not logged in, transitioning to Login')
      setAppPhase(IS_WEB ? 'main' : 'login')
    } else {
      logger.error('Preload result: Error', result.error)
      setInitError({
        message: 'Failed to load user data. Please check your internet connection and try again.',
        retry: handleRetry
      })
    }
  }

  const handleRetry = () => {
    setInitError(null)
    setAppPhase('splash')
    initPromiseRef.current = preloadData()
    processRetry()
  }

  const processRetry = async () => {
    if (!initPromiseRef.current) return
    const result = await initPromiseRef.current
    if (result.status === 'loggedin') {
      setUserProfile(result.profile)
      setAppPhase('main')
    } else if (result.status === 'loggedout') {
      setAppPhase(IS_WEB ? 'main' : 'login')
    } else {
      setInitError({
        message: 'Failed to load user data. Please check your internet connection and try again.',
        retry: handleRetry
      })
    }
  }

  const handleLoginSuccess = async () => {
    logger.info('Login successful, proceeding to main')
    initPromiseRef.current = preloadData()
    const result = await initPromiseRef.current
    if (result.status === 'loggedin') {
      setUserProfile(result.profile)
      setAppPhase('main')
    } else {
      logger.error('Login succeeded but profile fetch failed')
      setInitError({
        message: 'Failed to load user data. Please check your internet connection and try again.',
        retry: handleLoginSuccess
      })
    }
  }

  useEffect(() => {
    if (userProfile?.accessToken) {
      logLauncherStartup(userProfile.accessToken)
    }
  }, [userProfile?.accessToken])

  useEffect(() => {
    const handleRefreshProfile = async () => {
      if (!userProfile?.accessToken) return;
      logger.info('Refreshing user profile...');
      try {
        const extendedProfile = await fetchUserProfile(userProfile.accessToken);
        setUserProfile((prev) => (prev ? { ...prev, ...extendedProfile } : prev));
      } catch (e) {
        logger.error('Failed to refresh profile', e);
      }
    };

    window.addEventListener('refresh-user-profile', handleRefreshProfile);
    return () => window.removeEventListener('refresh-user-profile', handleRefreshProfile);
  }, [userProfile?.accessToken, logger]);

  useEffect(() => {
    const titlebarContext = document.getElementById('titlebar-context')
    if (titlebarContext) {
      const disabled = appPhase !== 'main'
      titlebarContext.dispatchEvent(new CustomEvent('set-titlebar-global-disabled', {
        detail: { disabled }
      }))
    }
  }, [appPhase])

  return (
    <UpdaterProvider>
      {appPhase === 'main' && <Main userProfile={userProfile} />}
      {appPhase === 'login' && <LoginPage onLoginSuccess={handleLoginSuccess} />}
      {appPhase === 'splash' && <SplashScreen onReady={handleSplashComplete} variant={initError ? 'error' : 'intro'} />}

      <UpdateModal />

      <ErrorModal
        isOpen={!!initError}
        onClose={() => setInitError(null)}
        title="Connection Error"
        message={initError?.message || ''}
        actionLabel="Retry"
        onAction={initError?.retry}
        fullScreen={true}
        disableClose={true}
      />
    </UpdaterProvider>
  )
}