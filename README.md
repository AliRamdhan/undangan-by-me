# client — guest management UI

A web front end for `02_Tamu`, `03_Template` and `06_Dashboard`. It follows the
same rules as the sheet (see `../docs/`): one column, one writer; PIN as the key;
one renderer.

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # vitest: domain logic + mock backend invariants
npm run lint
npm run build
```

## Data source

- **Data contoh** (default) — a seeded event kept in `localStorage`, including
  every planted fault from `02_Tamu_test_dirty.csv`. Reset it from ⚙ Pengaturan.
- **Google Sheet** — the Apps Script Web App, speaking `../docs/ADMIN-API.md`.
  Set the `/exec` URL and the admin key in ⚙ Pengaturan, or set
  `VITE_API_MODE` / `VITE_APPS_SCRIPT_URL` (see `.env.example`). The key is
  entered at runtime and never built into the bundle.

## Layout

```
src/domain/     pure logic — phone, PIN, checks, strict {{ns.token}} renderer, CSV, stats
src/api/        UndanganApi interface · mock adapter + seed · Apps Script adapter
src/state/      store: load, run(action) → refetch, toasts
src/features/   guests (table, drawer, import, issues) · templates · dashboard · settings
```

The TS renderer in `domain/template.ts` runs only inside the mock adapter. With
the Apps Script adapter, every preview, draft render and link generation goes to
`renderTemplate_()` on the server.
