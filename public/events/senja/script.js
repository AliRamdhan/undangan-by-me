/*
 * Invitation page template. For a new event, copy this folder and change
 * <body data-event> (01_Event.ID) and data-slug in index.html. Event data comes
 * from the Apps Script Web App, so edits on /admin/events/{ID}/event show here:
 * see docs/URL-CONTRACT.md § 7 (Public invitation read).
 *
 * Guest link: /events/{slug}/{pin} (or /events/{slug}/?to={nama}&pin={pin})
 *
 * Portfolio demo: /events/{slug}/?demo=1 renders assets/demo.json (same shape as
 * the § 7 `data`) instead of calling the API. Delete assets/demo.json when this
 * folder becomes a real event.
 *
 * Only the LOOK block differs between template folders; keep the rest of this
 * file identical in every copy so a fix can be copied as a whole file.
 */

const CONFIG = {
  // Apps Script /exec URL, set by ../config.js (Vite, from VITE_APPS_SCRIPT_URL).
  // Public by design — never put an admin token here.
  // Empty → the page shows its load error: event data only comes from the API.
  API_URL: window.INVITATION_API || '',
}

// ---------- look: the only block that differs between template folders ----------

const LOOK = {
  // The bride leads in this design: "Maya & Arga".
  title: (wanita, pria) => `The Wedding of ${wanita} & ${pria}`,
  calendarTitle: (wanita, pria) => `Pernikahan ${wanita} & ${pria}`,
  sonOf: 'Putra dari',
  daughterOf: 'Putri dari',
  venue: 'Lokasi',
  // Numbers keep the text's weight; Fraunces figures already sit level.
  numClass: 'font-medium',
  // Calendar strip (renderCalendar): the weekday row, then the date row. No grid lines, just air.
  calLabel: (i) =>
    `pb-3 font-sans text-[10px] font-bold uppercase tracking-[0.25em] ${i === 1 ? 'text-terra' : 'text-bark/45'}`,
  calCell: () => 'relative flex h-24 items-center justify-center',
  // The wedding day sits in a slowly turning sun (the #g-sunburst sprite in index.html).
  calDay: (tgl, main) =>
    main
      ? `<svg class="sun-spin absolute h-[5.6rem] w-[5.6rem] text-terra" viewBox="-40 -40 80 80" aria-hidden="true"><use href="#g-sunburst"/></svg>
         <b class="relative font-display text-[1.9rem] font-semibold leading-none text-linen">${tgl}</b>`
      : `<b class="font-display text-3xl font-light italic text-bark/40">${tgl}</b>`,
  // Gallery tile (button) and its photo; i is the photo's index. Every six tiles:
  // a wide print, an arch and a pill, then a pill and an arch, then a wide print.
  galleryTile: (i) =>
    `${[
      'col-span-2 aspect-[16/10] rounded-[1.5rem]',
      'aspect-[3/4] rounded-t-full rounded-b-2xl',
      'aspect-[3/4] rounded-full',
      'aspect-[3/4] rounded-full',
      'aspect-[3/4] rounded-t-full rounded-b-2xl',
      'col-span-2 aspect-[16/10] rounded-[1.5rem]',
    ][i % 6]} block w-full overflow-hidden bg-sand shadow-md ring-1 ring-terra/35 ring-offset-[5px] ring-offset-linen`,
  galleryImg: 'warm h-full w-full object-cover transition duration-700 hover:scale-105',
}

const TZ_OFFSET = { WIB: 7, WITA: 8, WIT: 9 }
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
const BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

// ---------- helpers ----------

const $ = (sel, root = document) => root.querySelector(sel)
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)]

const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj)
const pad2 = (n) => String(n).padStart(2, '0')

// Text context only, so & < > are enough (no digits in the entities, see num()).
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])

const num = (s) => esc(s).replace(/\d+/g, `<b class="${LOOK.numClass}">$&</b>`)

function put(el, value) {
  el.innerHTML = num(value ?? '').replace(/\n/g, '<br />')
}

// http(s) URLs, or plain relative paths such as assets/foto.jpg. Nothing else
// (javascript:, data:) from the sheet ends up in href/src.
function safeUrl(u) {
  const s = String(u || '').trim()
  return /^https?:\/\//i.test(s) || /^\w[\w./-]*$/.test(s) ? s : ''
}

function ymd(s) {
  const [y, m, d] = String(s).split('-').map(Number)
  return { y, m, d }
}

function weekday(y, m, d) {
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

function fmtTanggal(s) {
  if (!s) return ''
  const { y, m, d } = ymd(s)
  return `${HARI[weekday(y, m, d)]}, ${d} ${BULAN[m - 1]} ${y}`
}

// 2026-11-01 → 01.11.2026
function fmtTitik(s) {
  if (!s) return ''
  const { y, m, d } = ymd(s)
  return `${pad2(d)}.${pad2(m)}.${y}`
}

// Times are wall-clock in the event timezone (URL-CONTRACT § 2) → epoch ms.
function instant(date, time, tz) {
  const { y, m, d } = ymd(date)
  const [h = 0, mi = 0] = String(time || '00:00').split(':').map(Number)
  return Date.UTC(y, m - 1, d, h, mi) - (TZ_OFFSET[tz] ?? 7) * 3600e3
}

// 09:00 → 09.00, the Indonesian way.
const jam = (t) => String(t).replace(':', '.')

function fmtJam(s, tz) {
  if (!s.mulai) return ''
  return s.selesai ? `${jam(s.mulai)} - ${jam(s.selesai)} ${tz}` : `${jam(s.mulai)} ${tz}`
}

function clone(id) {
  return $(`#${id}`).content.firstElementChild.cloneNode(true)
}

// Fill elements under root from data-bind / data-f / data-opt / data-href / data-src.
function fill(root, obj) {
  $$('[data-bind]', root).forEach((el) => put(el, get(obj, el.dataset.bind)))
  $$('[data-f]', root).forEach((el) => put(el, get(obj, el.dataset.f)))
  $$('[data-opt]', root).forEach((el) => {
    el.hidden = !get(obj, el.dataset.opt)
  })
  $$('[data-href]', root).forEach((el) => {
    const url = safeUrl(get(obj, el.dataset.href))
    if (url) el.href = url
    else el.hidden = true
  })
  $$('[data-src]', root).forEach((el) => {
    const url = safeUrl(get(obj, el.dataset.src))
    // A blank keeps the image hardcoded in the HTML, if any (the cover).
    if (url) el.src = url
    else if (!el.getAttribute('src')) el.hidden = true
  })
  return root
}

function toast(text) {
  const el = $('#toast')
  el.textContent = text
  el.hidden = false
  clearTimeout(toast.t)
  toast.t = setTimeout(() => (el.hidden = true), 2000)
}

// ---------- data ----------

async function load(eventId, slug, pin) {
  if (!CONFIG.API_URL) throw new Error('NO_API_URL')
  const url = new URL(CONFIG.API_URL)
  // By ID first: it survives a slug rename in the admin.
  const by = eventId ? { id: eventId } : { slug }
  url.search = new URLSearchParams({ path: 'invitation', ...by, pin }).toString()
  // GET keeps this a simple request: Apps Script cannot answer a CORS preflight.
  const res = await fetch(url, { redirect: 'follow' })
  const env = await res.json()
  if (!env.ok) throw new Error(env.code)
  return env.data
}

// A guest's wish (POST /wishes). text/plain keeps it a simple request: Apps Script has no CORS preflight.
async function sendWish(eventId, slug, pin, pesan) {
  if (!CONFIG.API_URL) throw new Error('NO_API_URL')
  const url = new URL(CONFIG.API_URL)
  url.searchParams.set('path', 'wishes')
  const by = eventId ? { id: eventId } : { slug }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ v: 1, ...by, pin, pesan }),
    redirect: 'follow',
  })
  const env = await res.json()
  if (!env.ok) throw new Error(env.message || env.code)
  return env.data.wish
}

// Portfolio preview (?demo=1): bundled sample data, never the API.
async function loadDemo() {
  const res = await fetch('assets/demo.json', { cache: 'no-cache' })
  if (!res.ok) throw new Error('NO_DEMO')
  return res.json()
}

// ---------- render ----------

function render({ event: ev, guest }, params) {
  const tz = ev.timezone || 'WIB'
  const { pria, wanita } = ev.couple
  const sesi = (ev.sesi || [])
    .filter((s) => s.tanggal)
    .sort((a, b) => instant(a.tanggal, a.mulai, tz) - instant(b.tanggal, b.mulai, tz))
  const utama = ev.tanggal_utama || sesi[0]?.tanggal

  document.title = LOOK.title(wanita.panggilan, pria.panggilan)

  const { y, m } = utama ? ymd(utama) : {}
  fill(document.body, {
    ...ev,
    $tanggalTitik: fmtTitik(utama),
    $bulan: utama ? `${BULAN[m - 1]} ${y}` : '',
    $ortuPria: pria.ortu ? `${LOOK.sonOf} ${pria.ortu}` : '',
    $ortuWanita: wanita.ortu ? `${LOOK.daughterOf} ${wanita.ortu}` : '',
  })

  const nama = guest ? [guest.gelar, guest.nama].filter(Boolean).join(' ') : params.get('to')
  if (nama) put($('#guest-name'), nama)

  renderCountdown(ev, utama, sesi, tz)
  renderVenue(sesi, tz)
  renderGift(ev.gift || {})
  renderGallery((ev.gallery || []).map(safeUrl).filter(Boolean))
  setupMusic(safeUrl(ev.media?.musik))
}

// Calendar strip: the day before, the day itself, the day after.
function renderCalendar(date) {
  const { y, m, d } = ymd(date)
  const days = [-1, 0, 1].map((off) => {
    const t = new Date(Date.UTC(y, m - 1, d + off))
    return { hari: HARI[t.getUTCDay()], tgl: t.getUTCDate(), main: off === 0 }
  })
  const strip = $('#cal-strip')
  days.forEach(({ hari }, i) => {
    const el = document.createElement('div')
    el.className = LOOK.calLabel(i)
    el.textContent = hari
    strip.append(el)
  })
  days.forEach(({ tgl, main }, i) => {
    const el = document.createElement('div')
    el.className = LOOK.calCell(i)
    el.innerHTML = LOOK.calDay(tgl, main)
    strip.append(el)
  })
}

function renderCountdown(ev, utama, sesi, tz) {
  if (!utama) return ($('#countdown').hidden = true)
  renderCalendar(utama)

  const first = sesi[0]
  const target = instant(first?.tanggal || utama, first?.mulai, tz)
  const cell = (k) => $(`[data-cd="${k}"]`)
  let timer
  const tick = () => {
    const left = Math.floor((target - Date.now()) / 1000)
    if (left <= 0) {
      clearInterval(timer)
      $('#cd').hidden = true
      $('#cd-done').hidden = false
      return false
    }
    cell('d').textContent = pad2(Math.floor(left / 86400))
    cell('h').textContent = pad2(Math.floor((left % 86400) / 3600))
    cell('m').textContent = pad2(Math.floor((left % 3600) / 60))
    cell('s').textContent = pad2(left % 60)
    return true
  }
  if (tick()) timer = setInterval(tick, 1000)

  const cal = $('#cal-link')
  if (!first) return (cal.hidden = true)
  const last = sesi[sesi.length - 1]
  const end = last.selesai ? instant(last.tanggal, last.selesai, tz) : instant(last.tanggal, last.mulai, tz) + 2 * 3600e3
  const stamp = (t) => new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: LOOK.calendarTitle(ev.couple.wanita.panggilan, ev.couple.pria.panggilan),
    dates: `${stamp(target)}/${stamp(end)}`,
    location: [first.tempat, first.alamat].filter(Boolean).join(', '),
  })
  cal.href = `https://calendar.google.com/calendar/render?${q}`
}

function renderVenue(sesi, tz) {
  if (!sesi.length) return ($('#location').hidden = true)

  const list = $('#session-list')
  sesi.forEach((s, i) => {
    const el = fill(clone('tpl-session'), { ...s, $tanggal: fmtTanggal(s.tanggal), $jam: fmtJam(s, tz) })
    el.dataset.aos = i % 2 ? 'fade-left' : 'fade-right'
    list.append(el)
  })

  // Sessions at the same venue share one venue block.
  const venues = []
  for (const s of sesi) {
    if (!s.tempat && !s.alamat && !s.maps) continue
    const key = `${s.tempat}|${s.alamat}|${s.maps}`
    const same = venues.find((v) => v.key === key)
    if (same) same.labels.push(s.label)
    else venues.push({ ...s, key, labels: [s.label] })
  }
  const vlist = $('#venue-list')
  venues.forEach((v) => {
    const $judul = venues.length > 1 ? `${LOOK.venue} ${v.labels.join(' & ')}` : LOOK.venue
    const el = fill(clone('tpl-venue'), { ...v, $judul })
    el.dataset.aos = 'fade-up'
    vlist.append(el)
  })
}

function renderGift(gift) {
  const qris = safeUrl(gift.qris)
  if (!gift.norek && !qris) return ($('#gift').hidden = true)

  $('#envelope').hidden = !gift.norek
  $('#copy-btn').addEventListener('click', async () => {
    const text = String(gift.norek).replace(/\s/g, '')
    try {
      await navigator.clipboard.writeText(text)
      toast('Nomor rekening disalin')
    } catch {
      toast(`Salin manual: ${text}`)
    }
  })

  if (qris) $('#qris').src = qris
  else $('#qris-wrap').hidden = true
}

function renderGallery(photos) {
  if (!photos.length) return ($('#gallery').hidden = true)

  const grid = $('#gallery-grid')
  photos.forEach((src, i) => {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = LOOK.galleryTile(i)
    btn.setAttribute('aria-label', `Buka foto ${i + 1}`)
    // Tiles pop in left to right, one row at a time.
    btn.dataset.aos = 'zoom-in'
    btn.dataset.aosDelay = (i % 3) * 120
    const img = document.createElement('img')
    img.src = src
    img.alt = ''
    img.loading = 'lazy'
    img.className = LOOK.galleryImg
    btn.append(img)
    btn.addEventListener('click', () => openLightbox(i))
    grid.append(btn)
  })

  const box = $('#lightbox')
  let index = 0
  const show = (i) => {
    index = (i + photos.length) % photos.length
    $('#lightbox-img').src = photos[index]
    $('#lb-count').innerHTML = num(`${index + 1} / ${photos.length}`)
  }
  function openLightbox(i) {
    show(i)
    box.hidden = false
    document.body.classList.add('locked')
    $('#lb-close').focus()
  }
  const close = () => {
    box.hidden = true
    document.body.classList.remove('locked')
  }

  $('#lb-close').addEventListener('click', close)
  $('#lb-prev').addEventListener('click', () => show(index - 1))
  $('#lb-next').addEventListener('click', () => show(index + 1))
  box.addEventListener('click', (e) => e.target === box && close())
  document.addEventListener('keydown', (e) => {
    if (box.hidden) return
    if (e.key === 'Escape') close()
    if (e.key === 'ArrowLeft') show(index - 1)
    if (e.key === 'ArrowRight') show(index + 1)
  })
  let startX = 0
  box.addEventListener('touchstart', (e) => (startX = e.touches[0].clientX), { passive: true })
  box.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - startX
    if (Math.abs(dx) > 40) show(index + (dx < 0 ? 1 : -1))
  })
}

function setupMusic(src) {
  if (!src) return ($('#player').hidden = true)
  const audio = $('#music')
  const floating = $('#music-btn')
  const toggle = $('#player-toggle')
  audio.src = src

  const mmss = (t) => (Number.isFinite(t) ? `${Math.floor(t / 60)}:${pad2(Math.floor(t % 60))}` : '0:00')
  const sync = () => {
    const playing = !audio.paused
    floating.classList.toggle('playing', playing)
    // SVG elements have no .hidden property, so toggle the attribute directly.
    $('[data-icon="play"]', toggle).toggleAttribute('hidden', playing)
    $('[data-icon="pause"]', toggle).toggleAttribute('hidden', !playing)
    toggle.setAttribute('aria-label', playing ? 'Jeda musik' : 'Putar musik')
  }
  audio.addEventListener('play', sync)
  audio.addEventListener('pause', sync)
  audio.addEventListener('timeupdate', () => {
    $('#progress').style.width = audio.duration ? `${(audio.currentTime / audio.duration) * 100}%` : '0'
    put($('#t-cur'), mmss(audio.currentTime))
  })
  audio.addEventListener('loadedmetadata', () => put($('#t-dur'), mmss(audio.duration)))

  const flip = () => (audio.paused ? audio.play().catch(() => toast('Musik belum tersedia')) : audio.pause())
  toggle.addEventListener('click', flip)
  floating.addEventListener('click', flip)
  setupMusic.ready = true
}

// ---------- wishes ----------

// Wishes wall + form. Only pages with a #wishes section use it. A guest needs their
// PIN link to write (one wish each, sending again replaces it); in demo mode a
// wish is only added on this page.
function setupWishes({ guest, wishes }, { eventId, slug, pin, demo, params }) {
  if (!$('#wishes')) return
  const items = [...(wishes || [])]
  const list = $('#wish-list')
  const draw = () => {
    // Newest first.
    list.replaceChildren(...items.map((w) => fill(clone('tpl-wish'), w)).reverse())
    $('#wish-empty').hidden = items.length > 0
    const count = $('#wish-count')
    if (count) put(count, items.length)
  }
  draw()

  const form = $('#wish-form')
  const canSend = demo || Boolean(guest && pin && CONFIG.API_URL)
  form.hidden = !canSend
  $('#wish-locked').hidden = canSend
  if (!canSend) return

  const name = guest ? [guest.gelar, guest.nama].filter(Boolean).join(' ') : params.get('to') || 'Tamu Undangan'
  put($('#wish-name'), name)
  const text = $('#wish-text')
  if (guest?.pesan) text.value = guest.pesan
  // The guest's earlier wish is replaced, not duplicated.
  let own = guest?.pesan ? items.findIndex((w) => w.nama === name && w.pesan === guest.pesan) : -1

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const pesan = text.value.trim()
    if (!pesan) return toast('Tulis ucapan terlebih dahulu')
    const btn = $('#wish-send')
    btn.disabled = true
    try {
      const wish = demo ? { nama: name, pesan } : await sendWish(eventId, slug, pin, pesan)
      if (own >= 0) items.splice(own, 1)
      items.push(wish)
      own = items.length - 1
      draw()
      toast('Terima kasih atas ucapannya')
    } catch (err) {
      toast(err.message === 'NO_API_URL' ? 'Ucapan belum bisa dikirim' : err.message)
    } finally {
      btn.disabled = false
    }
  })
}

// ---------- interactions ----------

function openInvitation() {
  startAnimations()
  const modal = $('#greeting')
  modal.classList.add('closing')
  document.body.classList.remove('locked')
  window.scrollTo(0, 0)
  setTimeout(() => (modal.hidden = true), 950)

  if (setupMusic.ready) {
    $('#music-btn').hidden = false
    $('#music').play().catch(() => {})
  }
}

// Starts scroll animations when the cover opens, so the header animates as the cover fades.
function startAnimations() {
  if (!window.AOS) {
    // CDN failed: aos.css may still hide [data-aos] elements, so show everything.
    $$('[data-aos]').forEach((el) => el.removeAttribute('data-aos'))
    return
  }
  AOS.init({
    once: true,
    duration: 900,
    easing: 'ease-out-cubic',
    offset: 60,
    disable: () => matchMedia('(prefers-reduced-motion: reduce)').matches,
  })
  // Photos without a fixed aspect ratio shift the layout when they load.
  $$('main img').forEach((img) => img.complete || img.addEventListener('load', () => AOS.refresh(), { once: true }))
}

/** The guest's PIN: the `/events/{slug}/{pin}` path segment, else `?pin=`. */
function pinFromUrl(params) {
  const seg = location.pathname.match(/\/events\/[^/]+\/(\d+)\/?$/)
  return seg ? seg[1] : params.get('pin') || ''
}

async function init() {
  const params = new URLSearchParams(location.search)
  const btn = $('#open-btn')
  try {
    const { event: eventId, slug } = document.body.dataset
    const demo = params.has('demo')
    const pin = pinFromUrl(params)
    const data = demo ? await loadDemo() : await load(eventId, slug, pin)
    render(data, params)
    setupWishes(data, { eventId, slug, pin, demo, params })
    await coverReady()
    btn.disabled = false
    btn.addEventListener('click', openInvitation, { once: true })
  } catch (err) {
    console.error('Invitation failed to load:', err)
    btn.hidden = true
    $('#load-error').hidden = false
  } finally {
    hideLoader()
  }
}

// Resolves when the cover photo has loaded (or failed), capped so a slow image can't hold the loader forever.
function coverReady(ms = 4000) {
  const img = $('#greeting img[data-src]')
  if (!img || img.hidden || !img.src || img.complete) return Promise.resolve()
  return new Promise((done) => {
    img.addEventListener('load', done, { once: true })
    img.addEventListener('error', done, { once: true })
    setTimeout(done, ms)
  })
}

// Fades the loader out; removing .loading lets the paused cover animations play.
function hideLoader() {
  const loader = $('#loader')
  loader.classList.add('done')
  loader.addEventListener('transitionend', () => (loader.hidden = true), { once: true })
  document.body.classList.remove('loading')
}

init()
