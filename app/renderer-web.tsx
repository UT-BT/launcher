import React from 'react'
import ReactDOM from 'react-dom/client'
import { handleOAuthCallbackIfPresent } from './platform/web/auth-web'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ThemeProvider } from './theme/ThemeProvider'
import App from './app'

document.documentElement.style.setProperty('--window-titlebar-height', '0px')

void handleOAuthCallbackIfPresent().finally(() => {
  ReactDOM.createRoot(document.getElementById('app') as HTMLElement).render(
    <React.StrictMode>
      <ErrorBoundary>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </ErrorBoundary>
    </React.StrictMode>
  )
})
