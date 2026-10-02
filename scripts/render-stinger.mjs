import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'

const root = fileURLToPath(new URL('..', import.meta.url))
const whoosh = join(root, 'app', 'assets', 'sounds', 'stinger-whoosh.mp3')
const page = '/components/stream/stinger/stinger.html'
const width = 1920
const height = 1080
const whooshGainDb = -6

const usage = 'Usage: node scripts/render-stinger.mjs <output.webm> [--event "<event name>"] [--ffmpeg <path to ffmpeg>]'

function options() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      event: { type: 'string' },
      ffmpeg: { type: 'string', default: process.env.FFMPEG ?? 'ffmpeg' },
    },
  })
  if (positionals.length !== 1) {
    console.error(usage)
    process.exit(2)
  }
  return { output: resolve(positionals[0]), event: values.event, ffmpeg: values.ffmpeg }
}

function run(command, args) {
  return new Promise((done, failed) => {
    const child = spawn(command, args, { stdio: ['ignore', 'inherit', 'inherit'] })
    child.on('error', error => failed(new Error(`${command} could not start: ${error.message}`)))
    child.on('exit', code => (code === 0 ? done() : failed(new Error(`${command} exited with code ${code}`))))
  })
}

async function startServer() {
  const server = await createServer({
    configFile: join(root, 'vite.config.web.ts'),
    logLevel: 'error',
    server: { host: '127.0.0.1', port: 0, strictPort: false },
  })
  await server.listen()
  const { port } = server.httpServer.address()
  return { server, origin: `http://127.0.0.1:${port}` }
}

async function captureFrames(origin, event, framesDir) {
  const browser = await chromium.launch()
  try {
    const tab = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 })
    const url = new URL(page, origin)
    url.searchParams.set('render', '1')
    if (event) url.searchParams.set('event', event)
    await tab.goto(url.href)
    await tab.waitForFunction(() => globalThis.stinger?.ready === true, undefined, { timeout: 60_000 })
    const timeline = await tab.evaluate(() => {
      const { frames, fps, durationMs } = globalThis.stinger
      return { frames, fps, durationMs }
    })
    for (let frame = 0; frame < timeline.frames; frame += 1) {
      const ms = (frame * 1000) / timeline.fps
      await tab.evaluate(at => globalThis.stinger.seek(at), ms)
      await tab.screenshot({ path: join(framesDir, `frame-${String(frame).padStart(4, '0')}.png`), omitBackground: true, animations: 'allow' })
    }
    return timeline
  } finally {
    await browser.close()
  }
}

async function encode(ffmpeg, framesDir, timeline, output) {
  await mkdir(dirname(output), { recursive: true })
  await run(ffmpeg, [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-framerate', String(timeline.fps),
    '-i', join(framesDir, 'frame-%04d.png'),
    '-i', whoosh,
    '-filter_complex', `[1:a]volume=${whooshGainDb}dB,apad[audio]`,
    '-map', '0:v', '-map', '[audio]',
    '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-crf', '20', '-b:v', '0',
    '-deadline', 'good', '-cpu-used', '2', '-row-mt', '1', '-auto-alt-ref', '0',
    '-r', String(timeline.fps),
    '-c:a', 'libvorbis', '-q:a', '6', '-ar', '48000', '-ac', '2',
    '-t', String(timeline.durationMs / 1000),
    '-metadata', 'title=UTBT stinger',
    output,
  ])
}

async function main() {
  const { output, event, ffmpeg } = options()
  const framesDir = await mkdtemp(join(tmpdir(), 'utbt-stinger-'))
  const { server, origin } = await startServer()
  try {
    const timeline = await captureFrames(origin, event, framesDir)
    await encode(ffmpeg, framesDir, timeline, output)
    console.log(`Rendered ${timeline.frames} frames at ${timeline.fps} fps to ${output}`)
  } finally {
    await server.close()
    await rm(framesDir, { recursive: true, force: true })
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
