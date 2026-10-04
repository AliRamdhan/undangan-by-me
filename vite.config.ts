import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import { createReadStream, createWriteStream, existsSync, mkdirSync, rmSync, statSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { checkMedia, extOf, MEDIA_DIR, MEDIA_FIELDS, mediaFileName, type MediaField } from './src/core/domain/media.ts'

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

/**
 * `/events/config.js` tells the static invitation pages where the Apps Script
 * Web App is (`window.INVITATION_API`), from VITE_APPS_SCRIPT_URL — .env in dev,
 * .env.production in a build. public/ files never see import.meta.env.
 */
function invitationConfig(mode: string): Plugin {
  const url = loadEnv(mode, process.cwd(), 'VITE_').VITE_APPS_SCRIPT_URL || ''
  const source = `window.INVITATION_API = ${JSON.stringify(url)}\n`
  const middleware = (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (req.url?.split('?')[0] !== '/events/config.js') return next()
    res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-cache' }).end(source)
  }
  return {
    name: 'invitation-config',
    configureServer: (server) => void server.middlewares.use(middleware),
    configurePreviewServer: (server) => void server.middlewares.use(middleware),
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'events/config.js', source })
    },
  }
}

/** Images the dev server serves straight from disk (see mediaUpload). */
const MEDIA_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
}

/**
 * Dev only: `POST /__media/upload?slug=&field=&name=` with the raw file as body
 * saves it to `public/events/{slug}/assets/media/` and answers `{ path }`, the
 * relative path the event field stores (Hadiah & Media, #A.4). A production
 * build has no server to write to, so the form hides the upload button there.
 *
 * It also serves uploaded images under `/events/{slug}/assets/media/` straight
 * from disk (audio stays with Vite, which handles range requests): Vite learns
 * of new public files from its watcher, so for a moment after an upload it
 * would answer the SPA's index.html and the form's preview would break.
 */
function mediaUpload(): Plugin {
  const reply = (res: ServerResponse, status: number, body: object) =>
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }).end(JSON.stringify(body))

  const serveMedia = (url: URL, res: ServerResponse) => {
    const m = /^\/events\/([a-z0-9-]+)\/assets\/media\/([a-z0-9.-]+)$/.exec(url.pathname)
    const type = m && MEDIA_TYPES[extOf(m[2])]
    const file = m && `${publicDir}/events/${m[1]}/${MEDIA_DIR}/${m[2]}`
    if (!type || !file || !existsSync(file)) return false
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': statSync(file).size, 'Cache-Control': 'no-cache' })
    createReadStream(file).pipe(res)
    return true
  }

  const middleware = (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = new URL(req.url ?? '', 'http://localhost')
    if (req.method === 'GET' && serveMedia(url, res)) return
    if (url.pathname !== '/__media/upload') return next()
    if (req.method !== 'POST') return reply(res, 405, { message: 'Gunakan POST' })

    const q = (k: string) => url.searchParams.get(k) ?? ''
    const slug = q('slug')
    const field = q('field') as MediaField
    const name = q('name')
    const declared = Number(req.headers['content-length'])
    const invalid = checkMedia(slug, field, name, Number.isFinite(declared) ? declared : undefined)
    if (invalid) return reply(res, 400, { message: invalid })

    const eventDir = `${publicDir}/events/${slug}`
    if (!existsSync(`${eventDir}/index.html`)) {
      return reply(res, 404, { message: `Folder template public/events/${slug}/ belum ada` })
    }
    const dir = `${eventDir}/${MEDIA_DIR}`
    mkdirSync(dir, { recursive: true })
    const file = mediaFileName(field, name)
    const target = `${dir}/${file}`

    // Stream to disk; past the limit (a missing or lying Content-Length) drop the partial file.
    const max = MEDIA_FIELDS[field].maxBytes
    let size = 0
    let failed = false
    const out = createWriteStream(target)
    const fail = (status: number, message: string) => {
      if (failed) return
      failed = true
      req.unpipe(out)
      out.destroy()
      rmSync(target, { force: true })
      reply(res, status, { message })
    }
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > max) fail(413, `File maksimal ${max / 1024 / 1024} MB`)
    })
    req.on('error', () => fail(400, 'Unggahan terputus'))
    out.on('error', (e) => fail(500, `Gagal menyimpan file: ${e.message}`))
    out.on('finish', () => {
      if (failed) return
      if (!size) return fail(400, 'File kosong')
      reply(res, 200, { path: `${MEDIA_DIR}/${file}` })
    })
    req.pipe(out)
  }
  return {
    name: 'media-upload',
    apply: 'serve',
    configureServer: (server) => void server.middlewares.use(middleware),
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    invitationConfig(mode),
    publicInvitations(),
    mediaUpload(),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
}))
