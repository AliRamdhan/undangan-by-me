import { checkMedia, type MediaField } from '@/core/domain/media'

/** The upload endpoint lives in the Vite dev server (vite.config.ts → mediaUpload). */
export const canUploadMedia = import.meta.env.DEV

/** Saves `file` to `public/events/{slug}/assets/media/` → the relative path to store. */
export async function uploadMedia(slug: string, field: MediaField, file: File): Promise<string> {
  const invalid = checkMedia(slug, field, file.name, file.size)
  if (invalid) throw new Error(invalid)
  const query = new URLSearchParams({ slug, field, name: file.name })
  let res: Response
  try {
    res = await fetch(`/__media/upload?${query}`, { method: 'POST', body: file })
  } catch {
    throw new Error('Server dev tidak bisa dihubungi')
  }
  const body = (await res.json().catch(() => ({}))) as { path?: string; message?: string }
  if (!res.ok || !body.path) throw new Error(body.message || `Unggah gagal (HTTP ${res.status})`)
  return body.path
}
