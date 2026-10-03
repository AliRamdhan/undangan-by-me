import { describe, expect, it } from 'vitest'
import { checkMedia, isLocalMedia, mediaAccept, mediaFileName } from './media'

describe('media uploads', () => {
  it('names files safely and uniquely, keeping the extension', () => {
    const name = mediaFileName('cover', 'Foto Prewed (1).JPEG', 1_700_000_000_000)
    expect(name).toBe(`cover-${(1_700_000_000_000).toString(36)}.jpeg`)
    // The invitation page only renders relative paths matching this (script.js → safeUrl).
    expect(`assets/media/${name}`).toMatch(/^\w[\w./-]*$/)
  })

  it('checks slug, field, format and size', () => {
    expect(checkMedia('fidaeno', 'cover', 'a.jpg', 1000)).toBeNull()
    expect(checkMedia('fidaeno', 'musik', 'lagu.MP3')).toBeNull()
    expect(checkMedia('../x', 'cover', 'a.jpg')).toMatch(/Slug/)
    expect(checkMedia('', 'cover', 'a.jpg')).toMatch(/Slug/)
    expect(checkMedia('fidaeno', 'constructor', 'a.jpg')).toMatch(/tidak dikenal/)
    expect(checkMedia('fidaeno', 'cover', 'a.mp3')).toMatch(/format/)
    expect(checkMedia('fidaeno', 'musik', 'a.jpg')).toMatch(/format/)
    expect(checkMedia('fidaeno', 'qris', 'a.exe')).toMatch(/format/)
    expect(checkMedia('fidaeno', 'qris', 'a.png', 6 * 1024 * 1024)).toMatch(/maksimal 5 MB/)
    expect(checkMedia('fidaeno', 'musik', 'a.mp3', 14 * 1024 * 1024)).toBeNull()
  })

  it('tells template files from URLs and builds the accept list', () => {
    expect(isLocalMedia('assets/media/cover-x.jpg')).toBe(true)
    expect(isLocalMedia('https://x/y.jpg')).toBe(false)
    expect(mediaAccept('musik')).toBe('.mp3,.m4a,.ogg,.wav')
  })
})
