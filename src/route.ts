import { createBrowserRouter, redirect } from 'react-router'
import { HomeRedirect, RequireAuth, RequireSuperAdmin } from '@/core/auth'
import { AppLayout } from '@/layouts/AppLayout'
import { EventLayout } from '@/layouts/EventLayout'
import { Dashboard } from '@/pages/Dashboard'
import { EventCreatePage, EventPage } from '@/pages/Event'
import { Events } from '@/pages/Events'
import { Guests } from '@/pages/Guests'
import { Login } from '@/pages/Login'
import { NotFound } from '@/pages/NotFound'
import { Templates } from '@/pages/Templates'
import { Users } from '@/pages/Users'
import { eventPaths, PATHS } from '@/route.paths'

export const router = createBrowserRouter([
  { path: PATHS.login, Component: Login },
  {
    Component: RequireAuth,
    children: [
      {
        path: PATHS.root,
        Component: AppLayout,
        children: [
          { index: true, Component: HomeRedirect },
          {
            // A CLIENT only ever sees its own event; these send it back there.
            Component: RequireSuperAdmin,
            children: [
              { path: PATHS.events, Component: Events },
              { path: PATHS.newEvent, Component: EventCreatePage },
              { path: PATHS.users, Component: Users },
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
