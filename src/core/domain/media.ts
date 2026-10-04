/**
 * Files uploaded from Hadiah & Media (#A.4). They land in the event's template
 * folder, `public/events/{slug}/assets/media/`, and the field stores the
 * relative path, which the invitation page resolves against `/events/{slug}/`.
 * Shared by the dev upload endpoint (vite.config.ts) and the form, so it imports
 * only files without imports of their own.
 */
import { SLUG_PATTERN } from './slug.ts'

export type MediaField = 'qris' | 'cover' | 'musik' | 'gallery'

const MB = 1024 * 1024
const IMAGE = { exts: ['jpg', 'jpeg', 'png', 'webp', 'gif'], maxBytes: 5 * MB, kind: 'Gambar' }
const AUDIO = { exts: ['mp3', 'm4a', 'ogg', 'wav'], maxBytes: 15 * MB, kind: 'Musik' }

export const MEDIA_FIELDS: Record<MediaField, typeof IMAGE> = { qris: IMAGE, cover: IMAGE, musik: AUDIO, gallery: IMAGE }

/** Relative to the event's template folder. */
export const MEDIA_DIR = 'assets/media'

export const isMediaField = (f: string): f is MediaField => Object.hasOwn(MEDIA_FIELDS, f)

export const extOf = (name: string) => /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase() ?? ''

/** The `accept` attribute for a field's file input. */
export const mediaAccept = (field: MediaField) => MEDIA_FIELDS[field].exts.map((e) => `.${e}`).join(',')

/** Error text, or null when the upload may go ahead. `size` is optional (unknown while streaming). */
export function checkMedia(slug: string, field: string, name: string, size?: number): string | null {
  if (!SLUG_PATTERN.test(slug)) return 'Slug event belum valid — isi slug dulu'
  if (!isMediaField(field)) return 'Jenis media tidak dikenal'
  const rule = MEDIA_FIELDS[field]
  if (!rule.exts.includes(extOf(name))) return `${rule.kind} harus berformat ${rule.exts.join(', ')}`
  if (size !== undefined && size > rule.maxBytes) return `${rule.kind} maksimal ${rule.maxBytes / MB} MB`
  return null
}

/**
 * `cover-mgb2x1k3.jpg`: only [a-z0-9.-], so the page's safeUrl() accepts it, and a
 * new name per upload, so nothing is overwritten and no browser serves a stale copy.
 */
export function mediaFileName(field: MediaField, name: string, now = Date.now()) {
  return `${field}-${now.toString(36)}.${extOf(name)}`
}

/** Whether a stored value is a file in the template folder (not an http(s) URL). */
export const isLocalMedia = (value: string) => value.startsWith(`${MEDIA_DIR}/`) || value.startsWith('assets/')
