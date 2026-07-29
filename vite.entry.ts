import type { Plugin } from 'vite'

const DEFAULT_ENTRY = '/renderer-web.tsx'

export function rendererEntry(entry: string): Plugin {
  return {
    name: 'utbt-renderer-entry',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        if (!html.includes(`src="${DEFAULT_ENTRY}"`)) {
          throw new Error(
            `app/index.html no longer loads ${DEFAULT_ENTRY}, so the entry could not be ` +
              `rewritten to ${entry}. Update DEFAULT_ENTRY in vite.entry.ts to match index.html.`
          )
        }

        return html.replace(`src="${DEFAULT_ENTRY}"`, `src="${entry}"`)
      },
    },
  }
}
