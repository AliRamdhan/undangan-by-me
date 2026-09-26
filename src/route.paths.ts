/** Every URL the app routes to, in one place — used by route.ts and by links. */
export const PATHS = {
  root: '/',
  login: '/login',
  events: '/events',
  newEvent: '/events/new',
  users: '/users',
} as const

/** The pages of one event, all under `/events/:slug`. */
export function eventPaths(slug: string) {
  const root = `${PATHS.events}/${encodeURIComponent(slug)}`
  return {
    root,
    event: `${root}/event`,
    tamu: `${root}/tamu`,
    template: `${root}/template`,
    dashboard: `${root}/dashboard`,
  } as const
}

export const templatePath = (slug: string, kode: string) => `${eventPaths(slug).template}/${encodeURIComponent(kode)}`
