import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SAMPLE_RATE = 16000
const PCM_FORMAT = 1
const MONO_CHANNELS = 1
const BYTES_PER_SAMPLE = 2
const outDir = fileURLToPath(new URL('../app/assets/sounds/', import.meta.url))

function silence(seconds) {
  return new Float32Array(Math.round(seconds * SAMPLE_RATE))
}

function tone(frequencyHz, seconds, { attack, decay, gain, overtoneGain = 0, overtoneRatio = 2 }) {
  const length = Math.round(seconds * SAMPLE_RATE)
  const samples = new Float32Array(length)
  for (let i = 0; i < length; i++) {
    const t = i / SAMPLE_RATE
    const envelope = t < attack ? t / attack : Math.exp(-(t - attack) / decay)
    const wave = Math.sin(2 * Math.PI * frequencyHz * t) + overtoneGain * Math.sin(2 * Math.PI * frequencyHz * overtoneRatio * t)
    samples[i] = wave * envelope * gain
  }
  return samples
}

function delayed(seconds, samples) {
  return concat(silence(seconds), samples)
}

function concat(...parts) {
  const length = parts.reduce((total, part) => total + part.length, 0)
  const out = new Float32Array(length)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

function mix(...parts) {
  const length = Math.max(...parts.map((part) => part.length))
  const out = new Float32Array(length)
  for (const part of parts) {
    for (let i = 0; i < part.length; i++) out[i] += part[i]
  }
  return out
}

function normalize(samples, peak) {
  let max = 0
  for (const sample of samples) max = Math.max(max, Math.abs(sample))
  if (max === 0) return samples
  const scale = peak / max
  const out = new Float32Array(samples.length)
  for (let i = 0; i < samples.length; i++) out[i] = samples[i] * scale
  return out
}

function encodeWav(samples) {
  const dataSize = samples.length * BYTES_PER_SAMPLE
  const buffer = Buffer.alloc(44 + dataSize)
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(PCM_FORMAT, 20)
  buffer.writeUInt16LE(MONO_CHANNELS, 22)
  buffer.writeUInt32LE(SAMPLE_RATE, 24)
  buffer.writeUInt32LE(SAMPLE_RATE * BYTES_PER_SAMPLE, 28)
  buffer.writeUInt16LE(BYTES_PER_SAMPLE, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataSize, 40)
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]))
    buffer.writeInt16LE(Math.round(clamped * 32767), 44 + i * BYTES_PER_SAMPLE)
  }
  return buffer
}

const lockIn = normalize(
  concat(
    tone(660, 0.09, { attack: 0.004, decay: 0.05, gain: 0.7, overtoneGain: 0.25, overtoneRatio: 2 }),
    tone(880, 0.13, { attack: 0.004, decay: 0.09, gain: 0.7, overtoneGain: 0.25, overtoneRatio: 2 }),
  ),
  0.9,
)

const ban = normalize(
  concat(
    tone(392, 0.1, { attack: 0.002, decay: 0.05, gain: 0.75, overtoneGain: 0.3, overtoneRatio: 0.5 }),
    tone(220, 0.14, { attack: 0.002, decay: 0.09, gain: 0.75, overtoneGain: 0.3, overtoneRatio: 0.5 }),
  ),
  0.9,
)

const decider = normalize(
  mix(
    delayed(0, tone(523.25, 0.36, { attack: 0.005, decay: 0.3, gain: 0.55, overtoneGain: 0.2, overtoneRatio: 2 })),
    delayed(0.08, tone(659.25, 0.32, { attack: 0.005, decay: 0.26, gain: 0.55, overtoneGain: 0.2, overtoneRatio: 2 })),
    delayed(0.16, tone(784, 0.26, { attack: 0.005, decay: 0.22, gain: 0.55, overtoneGain: 0.25, overtoneRatio: 2 })),
  ),
  0.9,
)

await mkdir(outDir, { recursive: true })

const files = { 'lock-in.wav': lockIn, 'ban.wav': ban, 'decider.wav': decider }
for (const [name, samples] of Object.entries(files)) {
  const encoded = encodeWav(samples)
  await writeFile(join(outDir, name), encoded)
  console.log(`${name.padEnd(14)} ${String(encoded.length).padStart(7)} B`)
}
