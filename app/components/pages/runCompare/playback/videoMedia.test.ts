import { describe, expect, it } from 'vitest'
import type { PlaybackMediaEvent } from './playbackMedia'
import { createVideoMedia } from './videoMedia'

class FakeVideo extends EventTarget {
    readyState = 0
    seeking = false
    currentTime = 0
    duration = Number.NaN
    playbackRate = 1
    muted = false
    paused = true
    playResult: Promise<void> = Promise.resolve()

    play() {
        this.paused = false
        return this.playResult
    }

    pause() {
        this.paused = true
    }
}

function adapt(video: FakeVideo) {
    return createVideoMedia(video as unknown as HTMLVideoElement)
}

describe('the <video> media adapter', () => {
    it('can play once the element has future data and is not seeking', () => {
        const video = new FakeVideo()
        const media = adapt(video)

        expect(media.canPlay()).toBe(false)
        video.readyState = 3
        expect(media.canPlay()).toBe(true)
        video.seeking = true
        expect(media.canPlay()).toBe(false)
    })

    it('drives the element with play, pause, seek, rate and mute', () => {
        const video = new FakeVideo()
        video.duration = 82.5
        const media = adapt(video)

        media.play()
        expect(video.paused).toBe(false)
        media.seek(12.5)
        media.setRate(0.25)
        media.setMuted(true)
        media.pause()

        expect(video.paused).toBe(true)
        expect(media.currentTime()).toBe(12.5)
        expect(video.playbackRate).toBe(0.25)
        expect(video.muted).toBe(true)
        expect(media.duration()).toBe(82.5)
    })

    it('never throws when the browser refuses to play', async () => {
        const video = new FakeVideo()
        video.playResult = Promise.reject(new DOMException('not allowed', 'NotAllowedError'))
        const media = adapt(video)

        expect(() => media.play()).not.toThrow()
        await new Promise(resolve => setTimeout(resolve, 0))
    })

    it('forwards the element events the controller listens to until unsubscribed', () => {
        const video = new FakeVideo()
        const heard: PlaybackMediaEvent[] = []
        const unsubscribe = adapt(video).subscribe(event => heard.push(event))

        for (const event of ['waiting', 'seeking', 'seeked', 'canplay', 'error', 'timeupdate']) video.dispatchEvent(new Event(event))
        unsubscribe()
        video.dispatchEvent(new Event('waiting'))

        expect(heard).toEqual(['waiting', 'seeking', 'seeked', 'canplay', 'error'])
    })
})
