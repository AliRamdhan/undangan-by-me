/** Every URL the app routes to, in one place — used by route.ts and by links. */
export const PATHS = {
  root: '/',
  event: '/event',
  tamu: '/tamu',
  template: '/template',
  dashboard: '/dashboard',
} as const

export const templatePath = (kode: string) => `${PATHS.template}/${encodeURIComponent(kode)}`
