import { useState } from 'react'
import { WelcomeScreen } from '@/app/components/welcome/WelcomeScreen'
import { InstallationWizard } from '@/app/components/installation/InstallationWizard'
import './styles/index.css'

export default function App() {
  const [screen, setScreen] = useState<'welcome' | 'install'>('welcome')

  return (
    <>
      {screen === 'install' ? (
        <InstallationWizard 
          onBack={() => setScreen('welcome')}
          onComplete={() => setScreen('welcome')}
        />
      ) : (
        <WelcomeScreen 
          onInstall={() => setScreen('install')} 
        />
      )}
    </>
  )
}