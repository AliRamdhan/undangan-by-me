/** Every URL the app routes to, in one place — used by route.ts and by links. */
export const PATHS = {
  root: '/',
  login: '/login',
  events: '/admin/events',
  newEvent: '/admin/events/new',
  users: '/admin/users',
  templates: '/admin/templates',
} as const

/** The pages of one event, all under `/admin/events/:eventId` (01_Event.ID, not the slug). */
export function eventPaths(eventId: string) {
  const root = `${PATHS.events}/${encodeURIComponent(eventId)}`
  return {
    root,
    event: `${root}/event`,
    tamu: `${root}/tamu`,
    template: `${root}/template`,
    dashboard: `${root}/dashboard`,
  } as const
}

/** A master template on the SUPER_ADMIN's Template page. */
export const masterTemplatePath = (templateId: string) => `${PATHS.templates}/${encodeURIComponent(templateId)}`

export const templatePath = (eventId: string, templateId: string) => `${eventPaths(eventId).template}/${encodeURIComponent(templateId)}`
