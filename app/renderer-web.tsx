import React from 'react'
import ReactDOM from 'react-dom/client'
import { handleOAuthCallbackIfPresent } from './platform/web/auth-web'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ThemeProvider } from './theme/ThemeProvider'
import { pathToNav } from './components/navigation/routes'
import { prefetchPage } from './components/main/pageLoaders'
import App from './app'
import './styles/index.css'

const CHUNK_RELOAD_KEY = 'utbt:chunkReloadedAt'
window.addEventListener('vite:preloadError', event => {
  const last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) ?? 0)
  if (Date.now() - last < 60_000) return
  sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()))
  event.preventDefault()
  window.location.reload()
})

document.documentElement.style.setProperty('--window-titlebar-height', '0px')

// Start the landing route's chunk before React mounts. App boot already blocks
// on a profile round-trip before it can render anything past the boot screen, so
// this fetch rides along in dead time and the page is usually resident by the
// time it is needed -- no Suspense fallback on a cold, direct hit to /maps.
prefetchPage(pathToNav(window.location.pathname, window.location.search).view)

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
