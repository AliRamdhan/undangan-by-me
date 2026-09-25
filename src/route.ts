import { createBrowserRouter, redirect } from 'react-router'
import { AppLayout } from '@/layouts/AppLayout'
import { Dashboard } from '@/pages/Dashboard'
import { EventPage } from '@/pages/Event'
import { Guests } from '@/pages/Guests'
import { NotFound } from '@/pages/NotFound'
import { Templates } from '@/pages/Templates'
import { PATHS } from '@/route.paths'

export const router = createBrowserRouter([
  {
    path: PATHS.root,
    Component: AppLayout,
    children: [
      // Init flow: the event is filled in first, then guests and templates.
      { index: true, loader: () => redirect(PATHS.event) },
      { path: PATHS.event, Component: EventPage },
      { path: PATHS.tamu, Component: Guests },
      { path: PATHS.template, Component: Templates },
      { path: `${PATHS.template}/:kode`, Component: Templates },
      { path: PATHS.dashboard, Component: Dashboard },
      { path: '*', Component: NotFound },
    ],
  },
])
