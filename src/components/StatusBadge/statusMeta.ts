/** Badge variants from `components/ui/badge.tsx` used for status. */
export type Tone = 'good' | 'warning' | 'serious' | 'critical' | 'muted' | 'info' | 'plain'
import type { StatusKirim, StatusRSVP } from '@/core/domain/types'

export const RSVP_META: Record<StatusRSVP, { tone: Tone; label: string; icon: string }> = {
  BELUM: { tone: 'plain', label: 'Belum', icon: '·' },
  HADIR: { tone: 'good', label: 'Hadir', icon: '✓' },
  TIDAK_HADIR: { tone: 'muted', label: 'Tidak hadir', icon: '✕' },
  RAGU: { tone: 'warning', label: 'Ragu', icon: '?' },
}

export const KIRIM_META: Record<StatusKirim, { tone: Tone; label: string; icon: string }> = {
  BELUM: { tone: 'plain', label: 'Belum', icon: '·' },
  ANTRI: { tone: 'info', label: 'Antri', icon: '⏳' },
  TERKIRIM: { tone: 'good', label: 'Terkirim', icon: '✓' },
  DIBACA: { tone: 'good', label: 'Dibaca', icon: '✓✓' },
  GAGAL: { tone: 'critical', label: 'Gagal', icon: '!' },
}
