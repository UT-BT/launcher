import Welcome from '@/app/components/welcome/Welcome'
import Install from './components/welcome/contents/Install'
import { useState } from 'react'
import './styles/app.css'

export default function App() {
  const [screen, setScreen] = useState<'welcome' | 'install'>('welcome')

  if (screen === 'install') {
    return <Install onBack={() => setScreen('welcome')} />
  }

  return <Welcome onInstall={() => setScreen('install')} />
}