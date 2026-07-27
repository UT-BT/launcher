import React from 'react'
import ReactDOM from 'react-dom/client'
import { handleOAuthCallbackIfPresent } from './platform/web/auth-web'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ThemeProvider } from './theme/ThemeProvider'
import App from './app'

const CHUNK_RELOAD_KEY = 'utbt:chunkReloadedAt'
window.addEventListener('vite:preloadError', event => {
  const last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) ?? 0)
  if (Date.now() - last < 60_000) return
  sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()))
  event.preventDefault()
  window.location.reload()
})

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
