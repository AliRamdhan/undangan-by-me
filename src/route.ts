import { createBrowserRouter, redirect } from 'react-router'
import { HomeRedirect, RequireAuth, RequireSuperAdmin } from '@/core/auth'
import { AppLayout } from '@/layouts/AppLayout'
import { EventLayout } from '@/layouts/EventLayout'
import { PublicLayout } from '@/layouts/PublicLayout'
import { Dashboard } from '@/pages/Dashboard'
import { EventCreatePage, EventPage } from '@/pages/Event'
import { Events } from '@/pages/Events'
import { Guests } from '@/pages/Guests'
import { Landing } from '@/pages/Landing'
import { Login } from '@/pages/Login'
import { MasterTemplates } from '@/pages/MasterTemplates'
import { NotFound } from '@/pages/NotFound'
import { Portfolio } from '@/pages/Portfolio'
import { Templates } from '@/pages/Templates'
import { Users } from '@/pages/Users'
import { eventPaths, PATHS } from '@/route.paths'

export const router = createBrowserRouter([
  { path: PATHS.login, Component: Login },
  {
    // The public site: landing page and design catalogue, no login.
    Component: PublicLayout,
    children: [
      { path: PATHS.root, Component: Landing },
      { path: PATHS.portfolio, Component: Portfolio },
    ],
  },
  {
    Component: RequireAuth,
    children: [
      {
        Component: AppLayout,
        children: [
          { path: PATHS.admin, Component: HomeRedirect },
          {
            // A CLIENT only ever sees its own event; these send it back there.
            Component: RequireSuperAdmin,
            children: [
              { path: PATHS.events, Component: Events },
              { path: PATHS.newEvent, Component: EventCreatePage },
              { path: PATHS.users, Component: Users },
              { path: PATHS.templates, Component: MasterTemplates },
              { path: `${PATHS.templates}/:templateId`, Component: MasterTemplates },
            ],
          },
          {
            // One event's pages; EventLayout mounts the store for :eventId.
            path: `${PATHS.events}/:eventId`,
            Component: EventLayout,
            children: [
              // Init flow: the event is filled in first, then guests and templates.
              { index: true, loader: ({ params }) => redirect(eventPaths(params.eventId!).event) },
              { path: 'event', Component: EventPage },
              { path: 'tamu', Component: Guests },
              { path: 'template', Component: Templates },
              { path: 'template/:templateId', Component: Templates },
              { path: 'dashboard', Component: Dashboard },
            ],
          },
          { path: '*', Component: NotFound },
        ],
      },
    ],
  },
])
