import { readFileSync } from 'node:fs'
import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'

const SOUNDS_DIR = path.resolve(__dirname, '../app/assets/sounds')

const SOUNDS = ['stinger-whoosh', 'pick', 'decider', 'intro', 'ban', 'ban-down']

const MAX_CHANNEL_RMS_GAP_DB = 1
const MIN_CHANNEL_CORRELATION = 0.99
const MAX_PEAK_DBFS = -1
const WINDOW_SECONDS = 0.1
const AUDIBLE_WINDOW_RANGE_DB = 30
const SUB_BASS_HZ = 30
const BUTTERWORTH_Q_DB = 20 * Math.log10(Math.SQRT1_2)
const MAX_SUB_BASS_SHARE = 0.02

interface Balance {
    channels: number
    rmsLeftDb: number
    rmsRightDb: number
    worstWindowGapDb: number
    correlation: number
    peakDbfs: number
    subBassShare: number
}

async function measureBalance(page: Page, sound: string): Promise<Balance> {
    const base64 = readFileSync(path.join(SOUNDS_DIR, `${sound}.mp3`)).toString('base64')
    await page.goto('about:blank')
    return page.evaluate(async ({ base64, windowSeconds, audibleRangeDb, subBassHz, butterworthQDb }) => {
        const encoded = Uint8Array.from(atob(base64), character => character.charCodeAt(0))
        const audio = await new OfflineAudioContext(2, 1, 48000).decodeAudioData(encoded.buffer)
        const left = audio.getChannelData(0)
        const right = audio.getChannelData(audio.numberOfChannels > 1 ? 1 : 0)
        const energy = (samples: Float32Array, start: number, end: number) => {
            let sum = 0
            for (let index = start; index < end; index += 1) sum += samples[index] * samples[index]
            return sum
        }
        const decibels = (value: number) => 20 * Math.log10(value)
        const leftEnergy = energy(left, 0, left.length)
        const rightEnergy = energy(right, 0, right.length)
        let crossEnergy = 0
        let peak = 0
        for (let index = 0; index < left.length; index += 1) {
            crossEnergy += left[index] * right[index]
            peak = Math.max(peak, Math.abs(left[index]), Math.abs(right[index]))
        }
        const windowLength = Math.round(audio.sampleRate * windowSeconds)
        const windows: { left: number; right: number }[] = []
        for (let start = 0; start + windowLength <= left.length; start += windowLength) {
            windows.push({ left: energy(left, start, start + windowLength), right: energy(right, start, start + windowLength) })
        }
        const loudestWindow = Math.max(...windows.map(window => Math.max(window.left, window.right)))
        const audibleFloor = loudestWindow * 10 ** (-audibleRangeDb / 10)
        const worstWindowGapDb = Math.max(
            ...windows
                .filter(window => Math.max(window.left, window.right) >= audibleFloor)
                .map(window => Math.abs(10 * Math.log10(window.left / window.right))),
        )
        const lowpassed = new OfflineAudioContext(1, audio.length, audio.sampleRate)
        const source = new AudioBufferSourceNode(lowpassed, { buffer: audio })
        const lowpass = () => new BiquadFilterNode(lowpassed, { type: 'lowpass', frequency: subBassHz, Q: butterworthQDb })
        source.connect(lowpass()).connect(lowpass()).connect(lowpassed.destination)
        source.start()
        const subBass = (await lowpassed.startRendering()).getChannelData(0)
        return {
            channels: audio.numberOfChannels,
            rmsLeftDb: decibels(Math.sqrt(leftEnergy / left.length)),
            rmsRightDb: decibels(Math.sqrt(rightEnergy / right.length)),
            worstWindowGapDb,
            correlation: crossEnergy / Math.sqrt(leftEnergy * rightEnergy),
            peakDbfs: decibels(peak),
            subBassShare: energy(subBass, 0, subBass.length) / leftEnergy,
        }
    }, { base64, windowSeconds: WINDOW_SECONDS, audibleRangeDb: AUDIBLE_WINDOW_RANGE_DB, subBassHz: SUB_BASS_HZ, butterworthQDb: BUTTERWORTH_Q_DB })
}

for (const sound of SOUNDS) {
    test(`${sound} decodes centred, with identical channels, headroom and no sub-bass rumble`, async ({ page }) => {
        const balance = await measureBalance(page, sound)

        expect(balance.channels).toBe(2)
        expect(Math.abs(balance.rmsLeftDb - balance.rmsRightDb)).toBeLessThanOrEqual(MAX_CHANNEL_RMS_GAP_DB)
        expect(balance.worstWindowGapDb).toBeLessThanOrEqual(MAX_CHANNEL_RMS_GAP_DB)
        expect(balance.correlation).toBeGreaterThan(MIN_CHANNEL_CORRELATION)
        expect(balance.peakDbfs).toBeLessThanOrEqual(MAX_PEAK_DBFS)
        expect(balance.subBassShare).toBeLessThanOrEqual(MAX_SUB_BASS_SHARE)
    })
}
