import React from 'react'
import ReactDOM from 'react-dom/client'
import appIcon from '@/resources/build/icon.png'
import { WindowContextProvider } from '@/app/components/window'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ThemeProvider } from './theme/ThemeProvider'
import App from './app'
import './styles/index.css'
import './styles/desktop.css'

ReactDOM.createRoot(document.getElementById('app') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <WindowContextProvider titlebar={{ title: 'UTBT', icon: appIcon }}>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </WindowContextProvider>
    </ErrorBoundary>
  </React.StrictMode>
)
