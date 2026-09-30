# client — event & guest management UI

A web front end for many events in one spreadsheet: `01_Event`, `02_Tamu` and
`03_Template`, behind a login. It follows the same rules as the sheet (see
`../docs/`): one column, one writer; PIN as the key; one renderer.

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # vitest: domain logic, REST client, Apps Script parity (server end-to-end)
npm run lint
npm run build
npm run sample:xlsx  # regenerate ../sheet-templates/undangan-db-sample.xlsx
```

## Backend

Always the Apps Script Web App (`../apps-script/`), speaking the REST contract in
`../docs/ADMIN-API.md`. There is no mock or demo mode. Set its `/exec` URL at
build time — `VITE_APPS_SCRIPT_URL` in `.env` (dev) or `.env.production` (build),
see `.env.example` — then log in with an account from `_Users`. Without the URL
the login page says the server is not configured.

`src/core/api/seed.ts` is not used by the app: it is the data behind the sample
workbook (`npm run sample:xlsx`) and the test fixtures.

## Auth

`POST /auth/login` returns a session token, kept in `localStorage['undangan.session']`
until it expires. Every request carries it (query string on GET, body otherwise —
Apps Script cannot read headers). Any `AUTH` answer drops the session and
`RequireAuth` sends the user back to `/login`.

Two roles:

- **SUPER_ADMIN** — every event: `/events` (list, create, delete) and `/users`
  (accounts: create a client for an event, reset password, deactivate, delete).
- **CLIENT** — exactly one event (`_Users.Event`). Login lands on
  `/events/{its slug}/event`; it edits that event's data, guests and templates, but
  not the slug/domain. `/events`, `/users` and any other slug redirect back home.

The server enforces all of it (another event answers `NOT_FOUND`, a slug/domain
change `FORBIDDEN`); the UI only hides what a role cannot use.

## Layout

```
src/
├── core/            backend & data, no UI
│   ├── domain/        pure logic: types, schema, phone, PIN, checks, {{token}} renderer, CSV, stats
│   ├── api/           AppApi (auth, events) + UndanganApi (one event) · REST client for Apps Script · seed (sample/test data)
│   ├── auth/          AuthProvider (settings, session, login/logout), useAuth, RequireAuth
│   └── store/         StoreProvider per event slug, useStore, useEventList — load, run(action) → refetch
├── components/ui/   shadcn (base-mira, Base UI + hugeicons) — add more with `npx shadcn add <name>`
├── components/      app components built on ui/: SettingsSheet, StatusBadge, StatTile, ThemeToggle, WhatsAppBubble, dialogs
├── layouts/         AppLayout — header, settings, user menu · EventLayout — event switcher + tabs, mounts the store
├── pages/           route components (Login, Events, Users, Event, Guests, Templates, …); page-only parts live in pages/<Page>/components/
├── hooks/           useMediaQuery
├── utils/           download, format
├── route.ts         /login · /events · /events/new · /events/:slug/{event,tamu,template/:kode,dashboard}
├── route.paths.ts   URL constants shared by routes and links
└── App.tsx          ThemeProvider (next-themes) + AuthProvider + RouterProvider + sonner Toaster
```

Imports use the `@/` alias (`@/core/store`, `@/components/Button`). A deployed build
needs an SPA fallback to `index.html` so deep links such as `/events/fidaeno/template/UND-VIP` resolve.

Every preview, draft render and link generation goes to `renderTemplate_()` on
the server. The TS renderer in `domain/template.ts` is the reference that
`gasParity.test.ts` holds the server port to.
