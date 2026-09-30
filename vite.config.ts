import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import { existsSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'

const publicDir = fileURLToPath(new URL('./public', import.meta.url))

/**
 * Serves `public/events/{slug}/index.html` at `/events/{slug}/` in dev and preview —
 * Vite's public handler only serves exact file paths, so the SPA would claim the URL.
 * Static hosts already do this in production.
 */
function publicInvitations(): Plugin {
  const middleware = (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const match = req.url?.match(/^\/events\/([^/?#]+)(\/?)(\?.*)?$/)
    if (!match || !existsSync(`${publicDir}/events/${decodeURIComponent(match[1])}/index.html`)) return next()
    const [, slug, slash, query = ''] = match
    if (!slash) {
      // The page loads style.css, script.js and assets/ relatively — it needs the trailing slash.
      res.writeHead(301, { Location: `/events/${slug}/${query}` }).end()
      return
    }
    req.url = `/events/${slug}/index.html${query}`
    next()
  }
  return {
    name: 'public-invitations',
    configureServer: (server) => void server.middlewares.use(middleware),
    configurePreviewServer: (server) => void server.middlewares.use(middleware),
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    publicInvitations(),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
})
