import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { runnerImport } from 'vite'

const root = fileURLToPath(new URL('../', import.meta.url))

export const MOBILE_ROUTES_DOC = 'agents/mobile-routes.md'

const commonJsDirname = {
  name: 'commonjs-dirname',
  transform(code, id) {
    if (code.includes('__dirname')) return code.replace(/\b__dirname\b/g, JSON.stringify(dirname(id)))
  },
}

export async function renderMobileRoutes() {
  const { module } = await runnerImport(join(root, 'e2e/mobile/routes-doc.ts'), {
    root,
    configFile: false,
    logLevel: 'error',
    plugins: [commonJsDirname],
  })
  return { text: module.mobileRoutesDoc(), command: module.MOBILE_ROUTES_COMMAND }
}

export async function mobileRoutesProblem() {
  const { text, command } = await renderMobileRoutes()
  const path = join(root, MOBILE_ROUTES_DOC)
  if (!existsSync(path)) return `${MOBILE_ROUTES_DOC}: missing; run ${command}`
  const committed = readFileSync(path, 'utf8').replaceAll('\r\n', '\n')
  return committed === text ? null : `${MOBILE_ROUTES_DOC}: stale, it no longer matches the mobile route manifest; run ${command}`
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { text } = await renderMobileRoutes()
  writeFileSync(join(root, MOBILE_ROUTES_DOC), text)
  console.log(`Wrote ${MOBILE_ROUTES_DOC}.`)
}
