import { resolve } from 'path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, type Plugin } from 'vite'
import packageJson from './package.json'

const SITE_ORIGIN = process.env.VITE_SITE_ORIGIN ?? 'https://utbt.net'

const DEFAULT_TITLE = 'UTBT.net — Unreal Tournament 1999 BunnyTrack Community'
const DEFAULT_DESCRIPTION =
  'BunnyTrack Maps, Records, Players, Teams and Servers for Unreal Tournament 1999.'
const DEFAULT_IMAGE_ALT = 'UTBT.net — Unreal Tournament 1999 BunnyTrack'

// Deliberately outside the utbt-head markers: the backend rewrites that block
// per URL, and these are the same on every page.
//
// api.utbt.net appears twice on purpose. Anonymous and CORS requests use
// separate connection pools, and that origin serves both -- map screenshots as
// plain <img> (anonymous) and the JSON the page is built from via fetch (CORS).
// A single preconnect would warm one pool and leave the other cold.
const PRECONNECT_TAGS = `
    <link rel="preconnect" href="https://api.utbt.net" />
    <link rel="preconnect" href="https://api.utbt.net" crossorigin />
    <link rel="preconnect" href="https://gateway.utbt.net" crossorigin />
    <link rel="dns-prefetch" href="https://flagcdn.com" />`

const ICON_TAGS = `
    <link rel="icon" href="/favicon.ico" sizes="32x32" />
    <link rel="icon" type="image/png" href="/favicon-96x96.png" sizes="96x96" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <link rel="manifest" href="/site.webmanifest" />`

const DEFAULT_HEAD = `
    <!--utbt-head-start-->
    <title>${DEFAULT_TITLE}</title>
    <meta name="description" content="${DEFAULT_DESCRIPTION}" />
    <link rel="canonical" href="${SITE_ORIGIN}/" />
    <meta name="robots" content="index,follow" />
    <meta property="og:site_name" content="UTBT.net" />
    <meta property="og:type" content="website" />
    <meta property="og:locale" content="en_US" />
    <meta property="og:url" content="${SITE_ORIGIN}/" />
    <meta property="og:title" content="${DEFAULT_TITLE}" />
    <meta property="og:description" content="${DEFAULT_DESCRIPTION}" />
    <meta property="og:image" content="${SITE_ORIGIN}/og-default.png" />
    <meta property="og:image:secure_url" content="${SITE_ORIGIN}/og-default.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:alt" content="${DEFAULT_IMAGE_ALT}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${DEFAULT_TITLE}" />
    <meta name="twitter:description" content="${DEFAULT_DESCRIPTION}" />
    <meta name="twitter:image" content="${SITE_ORIGIN}/og-default.png" />
    <meta name="twitter:image:alt" content="${DEFAULT_IMAGE_ALT}" />
    <meta name="theme-color" content="#070b12" />
    <!--utbt-head-end-->`

function webHead(): Plugin {
  return {
    name: 'utbt-web-head',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        return html
          .replace(/^[ \t]*<title>[\s\S]*?<\/title>\r?\n?/m, '')
          .replace(/^[ \t]*<meta\s+name="description"[^>]*>\r?\n?/m, '')
          .replace(/^[ \t]*<meta\s+name="theme-color"[^>]*>\r?\n?/m, '')
          .replace('</head>', `${PRECONNECT_TAGS}\n${ICON_TAGS}\n${DEFAULT_HEAD}\n  </head>`)
      },
    },
  }
}

export default defineConfig({
  root: 'app',
  define: {
    __WEB_TARGET__: 'true',
    __APP_VERSION__: JSON.stringify(process.env.VITE_BUILD_SHA || packageJson.version),
  },
  resolve: {
    alias: {
      '@/app': resolve(__dirname, 'app'),
      '@/lib': resolve(__dirname, 'lib'),
      '@/resources': resolve(__dirname, 'resources'),
    },
  },
  plugins: [tailwindcss(), react(), webHead()],
  server: {
    port: 5174,
    watch: {
      ignored: ['**/test-results/**', '**/playwright-report/**'],
    },
  },
  build: {
    outDir: resolve(__dirname, 'dist-web'),
    emptyOutDir: true,
    manifest: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Exactly one pinned chunk, and only the packages that every page
          // already needs. The site redeploys on every push to main, so holding
          // React still across a deploy is worth ~45KB gzip to returning users.
          //
          // Do NOT widen this to `id.includes('node_modules')`. That would sweep
          // recharts, framer-motion and react-markdown into a chunk the entry
          // statically imports and modulepreloads, undoing every split above and
          // making the first paint bigger, not smaller.
          //
          // radix stays in the same chunk as react-dom on purpose: splitting a
          // module-scope React consumer away from react-dom is the classic cause
          // of a production-only "Cannot access '...' before initialization".
          if (/node_modules[\\/](react|react-dom|scheduler|@radix-ui)[\\/]/.test(id)) {
            return 'vendor-react'
          }
        },
      },
    },
  },
})
