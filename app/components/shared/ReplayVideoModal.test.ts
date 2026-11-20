import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ReplayVideoPlayer } from './ReplayVideoModal'

describe('the replay video player', () => {
    it('renders without a source, so a render React throws away never loads or plays audio', () => {
        const markup = renderToStaticMarkup(createElement(ReplayVideoPlayer, { url: 'https://recorder.example/mp4/run' }))

        expect(markup).toContain('<video')
        expect(markup).not.toContain('src=')
        expect(markup).not.toContain('recorder.example')
    })
})
