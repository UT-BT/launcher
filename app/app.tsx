import { useState, useRef, useEffect } from 'react'
import { SplashScreen } from '@/app/components/splash/SplashScreen'
import { Main } from '@/app/components/main/Main'
import { useLogger } from '@/app/hooks/use-logger'
import './styles/index.css'

let globalAppMounted = false

export default function App() {
  const loggerRef = useRef(useLogger('App'))
  const logger = loggerRef.current
  const mountedRef = useRef(false)
  const [appPhase, setAppPhase] = useState<'splash' | 'main'>('splash')

  const handleSplashComplete = () => {
    logger.info('Splash screen completed, transitioning to main phase')
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
      {appPhase === 'main' ? (
        <Main />
      ) : (
        <SplashScreen onReady={handleSplashComplete} />
      )}
    </>
  )
}