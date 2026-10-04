/*
 * Invitation page template. For a new event, copy this folder and change
 * <body data-event> (01_Event.ID) and data-slug in index.html. Event data comes
 * from the Apps Script Web App, so edits on /admin/events/{ID}/event show here:
 * see docs/URL-CONTRACT.md § 7 (Public invitation read).
 *
 * Guest link: /events/{slug}/?to={nama}&pin={pin}
 */

const CONFIG = {
  // Apps Script /exec URL, set by ../config.js (Vite, from VITE_APPS_SCRIPT_URL).
  // Public by design — never put an admin token here.
  // Empty → the page shows its load error: event data only comes from the API.
  API_URL: window.INVITATION_API || '',
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

// Every number on the page is bold.
const num = (s) => esc(s).replace(/\d+/g, '<b class="font-bold">$&</b>')

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

// ---------- render ----------

function render({ event: ev, guest }, params) {
  const tz = ev.timezone || 'WIB'
  const { pria, wanita } = ev.couple
  const sesi = (ev.sesi || [])
    .filter((s) => s.tanggal)
    .sort((a, b) => instant(a.tanggal, a.mulai, tz) - instant(b.tanggal, b.mulai, tz))
  const utama = ev.tanggal_utama || sesi[0]?.tanggal

  document.title = `The Wedding of ${wanita.panggilan} & ${pria.panggilan}`

  const { y, m } = utama ? ymd(utama) : {}
  fill(document.body, {
    ...ev,
    $tanggalTitik: fmtTitik(utama),
    $bulan: utama ? `${BULAN[m - 1]} ${y}` : '',
    $ortuPria: pria.ortu ? `Putra dari ${pria.ortu}` : '',
    $ortuWanita: wanita.ortu ? `Putri dari ${wanita.ortu}` : '',
  })

  const nama = guest ? [guest.gelar, guest.nama].filter(Boolean).join(' ') : params.get('to')
  if (nama) put($('#guest-name'), nama)

  renderCountdown(ev, utama, sesi, tz)
  renderVenue(sesi, tz)
  renderGift(ev.gift || {})
  renderGallery((ev.gallery || []).map(safeUrl).filter(Boolean))
  setupMusic(safeUrl(ev.media?.musik))
}

// Calendar strip: the day before, the day (in a heart), the day after.
function renderCalendar(date) {
  const { y, m, d } = ymd(date)
  const days = [-1, 0, 1].map((off) => {
    const t = new Date(Date.UTC(y, m - 1, d + off))
    return { hari: HARI[t.getUTCDay()], tgl: t.getUTCDate(), main: off === 0 }
  })
  const strip = $('#cal-strip')
  days.forEach(({ hari }, i) => {
    const el = document.createElement('div')
    el.className = `pt-2 pb-1 text-sm font-semibold text-pink-deep ${i < 2 ? 'border-r-2 border-olive/70' : ''}`
    el.textContent = hari
    strip.append(el)
  })
  days.forEach(({ tgl, main }, i) => {
    const el = document.createElement('div')
    el.className = `relative flex h-20 items-center justify-center border-t-2 border-olive/70 ${i < 2 ? 'border-r-2' : ''}`
    el.innerHTML = main
      ? `<svg class="heart-beat absolute h-20 w-20 text-pink-deep" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z"/></svg>
         <b class="relative -mt-2 text-3xl font-bold italic text-white">${tgl}</b>`
      : `<b class="text-3xl font-bold italic text-pink-deep">${tgl}</b>`
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
    text: `Pernikahan ${ev.couple.wanita.panggilan} & ${ev.couple.pria.panggilan}`,
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

  // Sessions at the same venue share one "Lokasi" block.
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
    const $judul = venues.length > 1 ? `Lokasi ${v.labels.join(' & ')}` : 'Lokasi'
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
    btn.className = 'aspect-[3/4] overflow-hidden rounded-md shadow-sm'
    btn.setAttribute('aria-label', `Buka foto ${i + 1}`)
    // Tiles pop in left to right, one row at a time.
    btn.dataset.aos = 'zoom-in'
    btn.dataset.aosDelay = (i % 3) * 120
    const img = document.createElement('img')
    img.src = src
    img.alt = ''
    img.loading = 'lazy'
    img.className = 'h-full w-full object-cover transition duration-500 hover:scale-105'
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

async function init() {
  const params = new URLSearchParams(location.search)
  const btn = $('#open-btn')
  try {
    const { event: eventId, slug } = document.body.dataset
    const data = await load(eventId, slug, params.get('pin') || '')
    render(data, params)
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
