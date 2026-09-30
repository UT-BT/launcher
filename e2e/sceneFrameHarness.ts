import '@vitejs/plugin-react/preamble'
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { StreamDataProvider } from '../app/components/stream/data/StreamDataProvider'
import { SceneFrame } from '../app/components/stream/frame/SceneFrame'
import { streamSceneOptionsOf } from '../app/components/stream/streamSceneOptions'
import { STREAM_EVENT, STREAM_STREAMER_ID } from '../app/components/stream/data/streamFixtures'
import '../app/styles/index.css'
import '../app/components/stream/streamScenes.css'

const search = new URLSearchParams(window.location.search)

const body = createElement('div', {
    'data-probe': '',
    style: { position: 'absolute', inset: 0, border: '2px dashed rgba(255, 255, 255, 0.35)', borderRadius: 24 },
})

const frame = createElement(
    SceneFrame,
    { scene: 'starting-soon', title: 'Starting Soon', kicker: search.get('kicker'), backdrop: search.get('backdrop') !== '0' },
    body,
)

createRoot(document.getElementById('app') as HTMLElement).render(
    createElement(StreamDataProvider, { eventSlug: STREAM_EVENT.slug, streamerId: STREAM_STREAMER_ID, options: streamSceneOptionsOf(window.location.search) }, frame),
)
