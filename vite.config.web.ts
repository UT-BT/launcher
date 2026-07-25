import { resolve } from 'path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, type Plugin } from 'vite'

const SITE_ORIGIN = process.env.VITE_SITE_ORIGIN ?? 'https://utbt.net'

const DEFAULT_TITLE = 'UTBT.net — Unreal Tournament 1999 BunnyTrack Community'
const DEFAULT_DESCRIPTION =
  'BunnyTrack Maps, Records, Players, Teams and Servers for Unreal Tournament 1999.'
const DEFAULT_IMAGE_ALT = 'UTBT.net — Unreal Tournament 1999 BunnyTrack'

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
          .replace('</head>', `${ICON_TAGS}\n${DEFAULT_HEAD}\n  </head>`)
      },
    },
  }
}

export default defineConfig({
  root: 'app',
  define: {
    __WEB_TARGET__: 'true',
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
  },
})
