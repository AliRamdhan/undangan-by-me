/**
 * Screenshots each portfolio design for its card on /portfolio:
 *   public/events/{slug}/assets/portfolio.jpg — the whole opened invitation, 480px wide.
 *
 *   npm run portfolio:thumbs                       # every design in src/core/domain/portfolio.ts
 *   npm run portfolio:thumbs -- aurum bloom        # only these
 *   npm run portfolio:thumbs -- --width=1440 --out=/tmp/shots   # review shots, assets untouched
 *
 * Starts its own Vite dev server and drives the installed Google Chrome through
 * playwright-core (no browser download). Pages load in demo mode (?demo=1), so no
 * Apps Script backend is needed. Exits non-zero if a page throws or fails to open.
 */
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { createServer } from 'vite'
import { PORTFOLIO } from '../src/core/domain/portfolio.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
const MAX_HEIGHT = 5000

const flags = Object.fromEntries(
  process.argv
    .slice(2)
    .filter((a) => a.startsWith('--'))
    .map((a) => a.slice(2).split('=')),
)
const picked = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const width = Number(flags.width) || 480
const slugs = picked.length ? picked : PORTFOLIO.map((p) => p.slug)

const server = await createServer({ root, logLevel: 'warn', server: { port: 5199 } })
await server.listen()
const base = server.resolvedUrls.local[0]
const browser = await chromium.launch({ channel: 'chrome' })
let failed = false

try {
  for (const slug of slugs) {
    const page = await browser.newPage({ viewport: { width, height: 900 } })
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
    try {
      await page.goto(`${base}events/${slug}/?demo=1`, { waitUntil: 'networkidle' })
      await page.waitForSelector('#open-btn:not([disabled])', { timeout: 20_000 })
      await page.click('#open-btn')
      await page.waitForTimeout(1200)
      // Walk the page so lazy images load and AOS reveals each section, then force the rest.
      await page.evaluate(async () => {
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
        for (let y = 0; y < document.documentElement.scrollHeight; y += 500) {
          window.scrollTo(0, y)
          await sleep(120)
        }
        document.querySelectorAll('[data-aos]').forEach((el) => el.classList.add('aos-animate'))
        document.querySelector('#music')?.pause()
        await Promise.all(
          [...document.images].map(
            // Capped: an image that never starts loading (e.g. a lazy slide off to the side) must not hang the run.
            (img) => img.complete || Promise.race([new Promise((r) => (img.onload = img.onerror = r)), sleep(5000)]),
          ),
        )
        window.scrollTo(0, 0)
      })
      await page.addStyleTag({ content: '#music-btn,#toast{display:none!important}' })
      await page.waitForTimeout(1500)

      const height = await page.evaluate(() => document.documentElement.scrollHeight)
      const dir = flags.out || `${root}public/events/${slug}/assets`
      mkdirSync(dir, { recursive: true })
      const path = flags.out ? `${dir}/${slug}-${width}.jpg` : `${dir}/portfolio.jpg`
      await page.screenshot({
        path,
        type: 'jpeg',
        quality: 70,
        fullPage: true,
        clip: { x: 0, y: 0, width, height: Math.min(height, MAX_HEIGHT) },
      })
      if (errors.length) throw new Error(errors.join('\n'))
      console.log(`✓ ${slug} → ${path.replace(root, '')} (page ${height}px)`)
    } catch (e) {
      failed = true
      console.error(`✗ ${slug}: ${e.message}`)
    } finally {
      await page.close()
    }
  }
} finally {
  await browser.close()
  await server.close()
}
process.exit(failed ? 1 : 0)
