/*
 * Tirta's gallery is a Swiper slider. script.js (shared by every template, so it
 * stays untouched) fills #gallery-grid with one <button class="swiper-slide"> per
 * photo, each already wired to the lightbox. #gallery-grid is the
 * .swiper-wrapper, so this file only waits for those slides and starts Swiper
 * once. Swiper 11's loop moves the real slides instead of cloning them, so every
 * click handler survives.
 */
;(() => {
  const grid = document.getElementById('gallery-grid')
  const root = grid && grid.closest('.swiper')
  if (!root) return

  let started = false

  function start() {
    const slides = grid.querySelectorAll('.swiper-slide')
    if (started || !slides.length) return
    started = true
    observer.disconnect()

    // The shared code gives each tile an AOS zoom; its transform would fight Swiper's.
    slides.forEach((s) => {
      delete s.dataset.aos
      delete s.dataset.aosDelay
    })
    // Slides off to the side are never scrolled into view, so lazy loading would leave them blank.
    // A native image drag would cancel Swiper's pointer drag, so photos are not draggable.
    grid.querySelectorAll('img').forEach((img) => {
      img.loading = 'eager'
      img.draggable = false
    })

    // No Swiper (CDN blocked): fall back to a native scroll-snap strip.
    if (!window.Swiper) {
      root.classList.add('swiper-fallback')
      return
    }

    const many = slides.length >= 3
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const swiper = new window.Swiper(root, {
      loop: many,
      centeredSlides: true,
      slidesPerView: 1.25,
      spaceBetween: 14,
      speed: 650,
      grabCursor: true,
      // Each slide is a <button> (it opens the lightbox). Swiper's defaults block dragging on buttons,
      // and a mouse press focuses the button, which Swiper then treats as a form control: drop both.
      noSwipingSelector: 'input, select, option, textarea, video, label',
      focusableElements: 'input, select, option, textarea, video, label',
      // A drag must not count as a tap that opens the lightbox.
      preventClicks: true,
      preventClicksPropagation: true,
      breakpointsBase: 'container',
      breakpoints: { 520: { slidesPerView: 1.6, spaceBetween: 18 } },
      autoplay: calm ? false : { delay: 4000, pauseOnMouseEnter: true, disableOnInteraction: false },
      keyboard: { enabled: true, onlyInViewport: true },
      pagination: { el: root.querySelector('.swiper-pagination'), clickable: true },
      navigation: {
        prevEl: root.parentElement.querySelector('.slider-prev'),
        nextEl: root.parentElement.querySelector('.slider-next'),
      },
      a11y: {
        enabled: true,
        slideRole: 'button',
        prevSlideMessage: 'Foto sebelumnya',
        nextSlideMessage: 'Foto berikutnya',
        firstSlideMessage: 'Ini foto pertama',
        lastSlideMessage: 'Ini foto terakhir',
        paginationBulletMessage: 'Ke foto {{index}}',
        slideLabelMessage: 'Buka foto {{index}} dari {{slidesLength}}',
      },
    })

    // While the lightbox is open it owns the arrow keys, and the slider holds still
    // (stop, not pause: the lightbox appearing under the cursor would resume a pause).
    const box = document.getElementById('lightbox')
    if (box) {
      new MutationObserver(() => {
        if (box.hidden) {
          swiper.keyboard.enable()
          if (swiper.params.autoplay?.enabled) swiper.autoplay.start()
        } else {
          swiper.keyboard.disable()
          if (swiper.params.autoplay?.enabled) swiper.autoplay.stop()
        }
      }).observe(box, { attributes: true, attributeFilter: ['hidden'] })
    }
  }

  const observer = new MutationObserver(start)
  observer.observe(grid, { childList: true })
  // Slides may already be there if this file ran late.
  start()
})()
