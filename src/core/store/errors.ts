import { ApiError } from '@/core/api/types'

export function errorText(e: unknown): string {
  if (e instanceof ApiError) return `${e.message}${e.code && !e.message.includes(e.code) ? ` (${e.code})` : ''}`
  return e instanceof Error ? e.message : String(e)
}
