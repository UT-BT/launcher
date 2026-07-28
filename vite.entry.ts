import type { Plugin } from 'vite'

const DEFAULT_ENTRY = '/renderer-web.tsx'

/**
 * Points app/index.html at a target-specific renderer entry.
 *
 * The entry has to be named by the HTML rather than reached through a runtime
 * `import()` dispatcher: Vite discovers the entry by parsing index.html, and
 * only a statically named entry gets its stylesheet <link> and modulepreload
 * hints emitted into the document. Behind a dynamic import the browser cannot
 * see either until the shim has been fetched and executed, which costs two
 * serial round trips before the page can paint.
 *
 * index.html names the web entry directly, so the web build needs no rewrite at
 * all. Only the desktop build swaps it.
 */
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
