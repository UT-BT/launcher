import { useState, useRef, useEffect } from 'react'
import { SplashScreen } from '@/app/components/splash/SplashScreen'
import { Main } from '@/app/components/main/Main'
import { LoginPage } from '@/app/components/pages/LoginPage'
import { useLogger } from '@/app/hooks/use-logger'
import './styles/index.css'

let globalAppMounted = false

export default function App() {
  const loggerRef = useRef(useLogger('App'))
  const logger = loggerRef.current
  const mountedRef = useRef(false)
  const [appPhase, setAppPhase] = useState<'splash' | 'login' | 'main'>('splash')
  const [userProfile, setUserProfile] = useState<import('@/lib/main/config').AuthConfig | undefined>(undefined)

  const checkAuthAndProceed = async () => {
    try {
      const profile = await window.auth.getProfile()
      if (profile) {
        logger.info('User already logged in, proceeding to main')
        setUserProfile(profile)
        setAppPhase('main')
      } else {
        logger.info('User not logged in, proceeding to login')
        setAppPhase('login')
      }
    } catch (error) {
      logger.error('Failed to check auth status', error)
      setAppPhase('login')
    }
  }

  const handleSplashComplete = () => {
    logger.info('Splash screen completed, checking auth')
    checkAuthAndProceed()
  }

  const handleLoginSuccess = async () => {
    logger.info('Login successful, proceeding to main')
    const profile = await window.auth.getProfile()
    setUserProfile(profile)
    setAppPhase('main')
  }

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true

      if (!globalAppMounted) {
        globalAppMounted = true
        logger.info('App component mounted')
      }
    }

    return () => {
      mountedRef.current = false
    }
  }, [])

  return (
    <>
      {appPhase === 'main' && <Main userProfile={userProfile} />}
      {appPhase === 'login' && <LoginPage onLoginSuccess={handleLoginSuccess} />}
      {appPhase === 'splash' && <SplashScreen onReady={handleSplashComplete} />}
    </>
  )
}