import React from 'react'
import ReactDOM from 'react-dom/client'
import appIcon from '@/resources/build/icon.png'
import { WindowContextProvider } from '@/app/components/window'
import { ErrorBoundary } from './components/ErrorBoundary'
import App from './app'

ReactDOM.createRoot(document.getElementById('app') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <WindowContextProvider titlebar={{ title: 'UTBT', icon: appIcon }}>
        <App />
      </WindowContextProvider>
    </ErrorBoundary>
  </React.StrictMode>
)
