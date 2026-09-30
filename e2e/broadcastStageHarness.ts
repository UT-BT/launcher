import '@vitejs/plugin-react/preamble'
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { BroadcastStage } from '../app/components/broadcast/BroadcastStage'
import '../app/styles/index.css'

const transparent = new URLSearchParams(window.location.search).get('variant') === 'transparent'

const probe = createElement('div', {
    'data-probe': '',
    style: { position: 'absolute', left: 120, top: 80, width: 240, height: 90, background: 'rgb(255, 255, 255)' },
})

createRoot(document.getElementById('app') as HTMLElement).render(createElement(BroadcastStage, { transparent }, probe))
