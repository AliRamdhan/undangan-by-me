import { createBrowserRouter, redirect } from 'react-router'
import { AppLayout } from '@/layouts/AppLayout'
import { Dashboard } from '@/pages/Dashboard'
import { Guests } from '@/pages/Guests'
import { NotFound } from '@/pages/NotFound'
import { Settings } from '@/pages/Settings'
import { Templates } from '@/pages/Templates'
import { PATHS } from '@/route.paths'

export const router = createBrowserRouter([
  {
    path: PATHS.root,
    Component: AppLayout,
    children: [
      { index: true, loader: () => redirect(PATHS.tamu) },
      { path: PATHS.tamu, Component: Guests },
      { path: PATHS.template, Component: Templates },
      { path: `${PATHS.template}/:kode`, Component: Templates },
      { path: PATHS.dashboard, Component: Dashboard },
      { path: PATHS.pengaturan, Component: Settings },
      { path: '*', Component: NotFound },
    ],
  },
])
