import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const buildDir = fileURLToPath(new URL('../resources/build/', import.meta.url))
const master = join(buildDir, 'icon.png')
const target = join(buildDir, 'icon.ico')
const SIZES = [16, 20, 24, 30, 32, 36, 40, 48, 60, 64, 72, 80, 96, 128, 256]

async function rgba(size) {
  return sharp(master).resize(size, size, { kernel: 'lanczos3' }).ensureAlpha().raw().toBuffer()
}

function bmpFrame(size, pixels) {
  const header = Buffer.alloc(40)
  const maskRow = Math.ceil(size / 32) * 4
  const xor = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const from = (y * size + x) * 4
      const to = ((size - 1 - y) * size + x) * 4
      xor[to] = pixels[from + 2]
      xor[to + 1] = pixels[from + 1]
      xor[to + 2] = pixels[from]
      xor[to + 3] = pixels[from + 3]
    }
  }
  header.writeUInt32LE(40, 0)
  header.writeInt32LE(size, 4)
  header.writeInt32LE(size * 2, 8)
  header.writeUInt16LE(1, 12)
  header.writeUInt16LE(32, 14)
  header.writeUInt32LE(xor.length + maskRow * size, 20)
  return Buffer.concat([header, xor, Buffer.alloc(maskRow * size)])
}

async function frame(size) {
  if (size >= 256) {
    return sharp(master).resize(size, size, { kernel: 'lanczos3' }).png({ compressionLevel: 9 }).toBuffer()
  }
  return bmpFrame(size, await rgba(size))
}

const frames = await Promise.all(SIZES.map(async (size) => ({ size, data: await frame(size) })))
const directory = Buffer.alloc(6 + frames.length * 16)
directory.writeUInt16LE(1, 2)
directory.writeUInt16LE(frames.length, 4)

let offset = directory.length
frames.forEach(({ size, data }, index) => {
  const entry = 6 + index * 16
  directory.writeUInt8(size >= 256 ? 0 : size, entry)
  directory.writeUInt8(size >= 256 ? 0 : size, entry + 1)
  directory.writeUInt16LE(1, entry + 4)
  directory.writeUInt16LE(32, entry + 6)
  directory.writeUInt32LE(data.length, entry + 8)
  directory.writeUInt32LE(offset, entry + 12)
  offset += data.length
})

await writeFile(target, Buffer.concat([directory, ...frames.map(({ data }) => data)]))
console.log(`icon.ico  ${SIZES.join(', ')} px  ${offset} B`)
