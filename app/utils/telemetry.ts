import { IS_WEB } from '@/app/platform'

type Counter = Record<string, number>
type Consent = 'granted' | 'denied' | null
type TelemetryState = {
  sessionId: string
  visitorId: string
  startedAt: number
  lastVisibleAt: number
  sequence: number
  entryView: string
  lastView: string
  pageViews: Counter
  outcomes: Counter
  errors: Counter
  visibleSeconds: number
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost' : 'https://api.utbt.net')).replace(/\/$/, '')
const CONSENT_KEY = 'utbt:analyticsConsent:v1'
const VISITOR_KEY = 'utbt:analyticsVisitor:v1'
const SESSION_KEY = 'utbt:analyticsSession:v1'
const MAX_IDLE_MS = 30 * 60 * 1000
const FLUSH_MS = 60 * 1000
let token: string | undefined
let state: TelemetryState | null = null
let timer: number | undefined
let initialized = false
let flushing = false
let currentView = 'home'

export function getTelemetryConsent(): Consent {
  try {
    const value = localStorage.getItem(CONSENT_KEY)
    return value === 'granted' || value === 'denied' ? value : null
  } catch { return null }
}

export function onTelemetryConsentChange(listener: (value: Consent) => void) {
  const handler = (event: Event) => listener((event as CustomEvent<Consent>).detail)
  window.addEventListener('utbt-analytics-consent', handler)
  return () => window.removeEventListener('utbt-analytics-consent', handler)
}

export async function setTelemetryConsent(granted: boolean) {
  const previousVisitor = getVisitorId()
  try { localStorage.setItem(CONSENT_KEY, granted ? 'granted' : 'denied') } catch { /* best effort */ }
  window.dispatchEvent(new CustomEvent('utbt-analytics-consent', { detail: granted ? 'granted' : 'denied' }))
  if (granted) {
    initializeTelemetry(token)
  } else {
    disableTelemetry()
    if (previousVisitor) {
      try {
        await fetch(`${API_BASE_URL}/launcher/activity/visitor`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ visitor_id: previousVisitor }),
        })
      } catch { /* deletion can be retried from Privacy settings */ }
    }
  }
}

export function getVisitorId() {
  try { return localStorage.getItem(VISITOR_KEY) } catch { return null }
}

const uuid = () => crypto.randomUUID()
const read = <T>(storage: Storage, key: string): T | null => {
  try { return JSON.parse(storage.getItem(key) || 'null') as T | null } catch { return null }
}
const save = () => {
  if (state) try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(state)) } catch { /* best effort */ }
}
const visitorId = () => {
  const existing = getVisitorId()
  if (existing) return existing
  const created = uuid()
  try { localStorage.setItem(VISITOR_KEY, created) } catch { /* best effort */ }
  return created
}
const allowedPages = new Set([
  'home', 'servers', 'maps', 'maps-detail', 'players', 'player-detail', 'teams',
  'team-detail', 'events', 'event-detail', 'world-records', 'cap-it-all',
  'cap-detail', 'team-cap-detail', 'achievements', 'news', 'news-detail', 'admin',
])
const pageKey = (view?: string) => view && allowedPages.has(view) ? view : 'other'
const increment = (counter: Counter, key: string) => { counter[key] = (counter[key] || 0) + 1 }
const referrer = () => {
  if (!document.referrer) return 'direct'
  try {
    const host = new URL(document.referrer).hostname
    if (host === location.hostname) return 'internal'
    if (host.includes('discord')) return 'discord'
    if (/google|bing|duckduckgo|yahoo/.test(host)) return 'search'
    if (/twitter|x\.com|facebook|reddit|instagram/.test(host)) return 'social'
    return 'external'
  } catch { return 'unknown' }
}
const browser = () => {
  if (!IS_WEB) return 'electron'
  const ua = navigator.userAgent
  if (/Edg\//.test(ua)) return 'edge'
  if (/Firefox\//.test(ua)) return 'firefox'
  if (/Chrome\//.test(ua)) return 'chrome'
  if (/Safari\//.test(ua)) return 'safari'
  return 'other'
}
const os = () => {
  const ua = navigator.userAgent
  if (/Windows/.test(ua)) return 'windows'
  if (/Android/.test(ua)) return 'android'
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios'
  if (/Mac OS/.test(ua)) return 'macos'
  if (/CrOS/.test(ua)) return 'chromeos'
  if (/Linux/.test(ua)) return 'linux'
  return 'unknown'
}
const viewport = () => innerWidth < 640 ? 'phone' : innerWidth < 1024 ? 'tablet' : 'desktop'
const sameUtcDay = (a: number, b: number) => new Date(a).toISOString().slice(0, 10) === new Date(b).toISOString().slice(0, 10)

function ensureState(view = 'home') {
  const now = Date.now()
  const stored = read<TelemetryState>(sessionStorage, SESSION_KEY)
  if (stored && now - stored.lastVisibleAt < MAX_IDLE_MS && sameUtcDay(now, stored.startedAt)) {
    state = stored
  } else {
    const key = pageKey(view)
    state = {
      sessionId: uuid(), visitorId: visitorId(), startedAt: now, lastVisibleAt: now,
      sequence: 0, entryView: key, lastView: key, pageViews: {}, outcomes: {},
      errors: {}, visibleSeconds: 0,
    }
  }
  save()
}

export function initializeTelemetry(accessToken?: string) {
  token = accessToken
  if (getTelemetryConsent() !== 'granted') return
  if (!state) {
    ensureState(currentView)
    increment(state!.pageViews, currentView)
    save()
  }
  if (initialized) return
  initialized = true
  timer = window.setInterval(() => void flushTelemetry(), FLUSH_MS)
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('pagehide', onPageHide)
  void flushTelemetry()
}

export function identifyTelemetry(accessToken?: string) {
  token = accessToken
  if (getTelemetryConsent() === 'granted') {
    initializeTelemetry(accessToken)
    void flushTelemetry()
  }
}

export function disableTelemetry() {
  if (timer !== undefined) window.clearInterval(timer)
  timer = undefined
  initialized = false
  document.removeEventListener('visibilitychange', onVisibility)
  window.removeEventListener('pagehide', onPageHide)
  state = null
  try {
    sessionStorage.removeItem(SESSION_KEY)
    localStorage.removeItem(VISITOR_KEY)
  } catch { /* best effort */ }
}

export function trackPage(view: string) {
  const key = pageKey(view)
  currentView = key
  if (getTelemetryConsent() !== 'granted') return
  if (!state) ensureState(key)
  state!.lastView = key
  increment(state!.pageViews, key)
  save()
}
export function trackOutcome(key: string) {
  if (getTelemetryConsent() !== 'granted') return
  if (!state) ensureState()
  increment(state!.outcomes, key)
  save()
  void flushTelemetry()
}
export function trackError(key: 'api_network' | 'api_timeout' | 'api_server' | 'ui_crash', dimension?: string) {
  if (getTelemetryConsent() !== 'granted') return
  if (!state) ensureState()
  increment(state!.errors, key)
  if (dimension) increment(state!.errors, `${key}:${dimension}`)
  save()
}
function onPageHide() { void flushTelemetry(true) }
function onVisibility() {
  if (!state) return
  const now = Date.now()
  if (document.visibilityState === 'hidden') {
    state.visibleSeconds += Math.max(0, Math.round((now - state.lastVisibleAt) / 1000))
    state.lastVisibleAt = now
    save()
    void flushTelemetry(true)
  } else {
    if (now - state.lastVisibleAt >= MAX_IDLE_MS || !sameUtcDay(now, state.startedAt)) {
      ensureState(state.lastView)
      trackPage(state!.lastView)
    }
    state!.lastVisibleAt = now
  }
}
export async function flushTelemetry(keepalive = false) {
  if (getTelemetryConsent() !== 'granted' || !state || flushing) return
  flushing = true
  try {
    if (document.visibilityState === 'visible') {
      const now = Date.now()
      state.visibleSeconds += Math.max(0, Math.round((now - state.lastVisibleAt) / 1000))
      state.lastVisibleAt = now
    }
    state.sequence += 1
    save()
    await fetch(`${API_BASE_URL}/launcher/activity/session`, {
      method: 'POST',
      keepalive,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({
        session_id: state.sessionId, visitor_id: state.visitorId, sequence: state.sequence,
        surface: IS_WEB ? 'web' : 'desktop', client_version: __APP_VERSION__,
        os_family: os(), browser_family: browser(), viewport_class: viewport(),
        referrer_source: referrer(), entry_view: state.entryView, last_view: state.lastView,
        page_views: state.pageViews, outcomes: state.outcomes, errors: state.errors,
        visible_seconds: state.visibleSeconds,
      }),
    })
  } catch { /* telemetry must never affect launcher behavior */ } finally { flushing = false }
}
