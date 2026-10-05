# Apps Script backend

The REST backend for the admin UI (`client/`). One Google Sheet holds every
event; this script exposes it as a Web App. The full contract is
[`docs/ADMIN-API.md`](../docs/ADMIN-API.md).

| File | What it holds |
|---|---|
| `00_Config.gs` | Tab names, header rows, enums, limits (mirrors `client/src/core/domain/sheetSchema.ts`) |
| `01_Http.gs` | `doGet` / `doPost`, request parsing, `_method` override, envelope, `ApiError_` |
| `02_Router.gs` | Route table and middleware (auth → role → client event scope → event loader → lock) |
| `03_SheetIO.gs` | Every cell read and write |
| `04_Auth.gs` | `_Users`, `_Sessions`, login / logout / me / change-password, `setupAdmin()` |
| `05_Event.gs` | `01_Event` + `01_Sesi` ↔ `EventInfo`, event CRUD by event ID |
| `06_Guests.gs` | Guest routes (by guest ID), `refreshDerived_()` |
| `07_Templates.gs` | Template CRUD and validation |
| `08_Render.gs` | The one renderer, plus preview / links / draft |
| `09_Domain.gs` | Pure ports of the client's phone / pin / checks / derive / event rules |
| `10_Setup.gs` | `setup()`: tabs, headers, formats, dropdowns, hidden `_` tabs, legacy `_Users` and `ID` migrations |
| `11_Users.gs` | `/users`: account CRUD, reset password, self / last-SUPER_ADMIN guards |
| `12_Reset.gs` | `cekResetProduksi()` / `resetProduksi()`: clear the demo data for production (editor only) |

`client/src/core/api/gasParity.test.ts` loads these files in Node and checks
them against the client's TypeScript domain code. It also runs every handler
against an in-memory sheet. Run it after any change:

```sh
cd client && npx vitest run src/core/api/gasParity.test.ts
```

## Deploy

1. **Create the database.** Upload `sheet-templates/undangan-db-sample.xlsx` to
   Google Drive, then open it with Google Sheets (**File → Save as Google Sheets**
   if it opens in Office mode).
2. **Add the script.** In the sheet, choose **Extensions → Apps Script**, then either:
   - paste each `.gs` file into a script file with the same name, and replace
     `appsscript.json` (turn on **Project Settings → Show "appsscript.json"**); or
   - use [clasp](https://github.com/google/clasp):
     ```sh
     npm i -g @google/clasp && clasp login
     cd apps-script
     clasp clone <scriptId>   # from Project Settings; keep the local files
     clasp push
     ```
3. **Run `setup()`** from the editor (select it in the toolbar, then Run) and
   accept the permission prompt. It is idempotent: it only creates missing tabs,
   headers, formats and dropdowns, then hides the `_` tabs. Check the log for
   header warnings.
4. **Deploy.** Choose **Deploy → New deployment → Web app**, with
   *Execute as: **Me*** and *Who has access: **Anyone***. Copy the `/exec` URL
   into the client's Settings (or `VITE_APPS_SCRIPT_URL`).
   After you change the code, use **Deploy → Manage deployments → Edit → New
   version**. The `/exec` URL stays the same.

### Roles

- **SUPER_ADMIN** sees every event, creates and deletes events, and manages
  accounts (`/users`, the *Pengguna* page in the UI).
- **CLIENT** is bound to one event, the event ID in `_Users.Event`. It can edit
  that event's data (not its slug or domain), guests, and the text / Aktif of
its templates (its own version of the SUPER_ADMIN's master templates), and never
  sees another event: those return `NOT_FOUND`.

The full permission matrix is in
[`docs/ADMIN-API.md`](../docs/ADMIN-API.md#roles).

**Upgrading an older sheet.** `_Users` now has an `Event` column after `Role`
(`Email | Nama | Role | Event | Password_Hash | Salt | Aktif | Dibuat | Login_Terakhir`).
Either re-import the regenerated `sheet-templates/undangan-db-sample.xlsx`, or
paste the new `.gs` files and run `setup()`: it inserts the `Event` column into
an old `_Users` and refreshes the `_Enum` Role values. Old `ADMIN` rows are read
as SUPER_ADMIN, so existing admins keep working. Old `OPERATOR` rows are read as
CLIENT and cannot log in until you fill in their `Event` (or change their role).

**Upgrading to master templates.** In `03_Template` a row with a blank
`Event` is now a master template that every event has; a row with an `Event` is
that event's own version. After pasting the new `.gs` files, run `setup()` once:
when no master exists yet, the first row of each `Kode` becomes the master (its
`Event` is blanked, its ID kept), and other events' rows with that Kode stay as
their own version unless they equal the master, in which case they are removed.
It is safe to run again. Until it runs, every event lists no templates.

**Upgrading to row IDs.** Every data tab (`01_Event`, `01_Sesi`, `02_Tamu`,
`03_Template`, `_Users`) now starts with an `ID` column (a UUID), and the
`Event` column holds `01_Event.ID` instead of the slug. After pasting the new
`.gs` files, run `setup()` once **before** using the API: it inserts `ID` as
column A in each of those tabs, fills every row, and rewrites `Event` cells that
still hold a slug to that event's ID. It is safe to run again. Until it runs,
the API answers `Kolom ID tidak ada — jalankan setup()`. Admin URLs change from
`/admin/events/{slug}/…` to `/admin/events/{ID}/…`; invitation links
(`{domain}/{slug}/{PIN}`) do not change.

### Change the demo logins

The sample workbook ships with three users:

| Email | Password | Role | Event |
|---|---|---|---|
| `admin@example.com` | `Admin#123` | SUPER_ADMIN | – |
| `klien.fidaeno@example.com` | `Klien#123` | CLIENT | `fidaeno` |

The sheet is public-by-URL once deployed, so **change every password before
you use it for real**. Either:

- log in and call `POST /auth/change-password` (the UI has *Ganti password*); or
- in the editor, add and run a one-off function:
  ```js
  function myAdmin() { setupAdmin('you@domain.com', 'a-long-password', 'Your Name') }
  ```
  `setupAdmin` creates the user or resets it, as SUPER_ADMIN, and revokes its
  sessions.

Then, as SUPER_ADMIN, manage the other accounts from the *Pengguna* page (or
`/users`): reset the demo clients' passwords, deactivate them, or delete them.
Editing `_Users` by hand also works (`Aktif` = `FALSE` disables a user), but
hand edits don't end open sessions until they expire.

### Mode produksi: hapus data demo

The sample workbook ships demo events, guests, CLIENT accounts and logins.
`12_Reset.gs` clears them in one go. It is run from the editor only and has no
API route.

| Removed | Kept |
|---|---|
| every row of `01_Event`, `01_Sesi`, `02_Tamu` | master templates (`03_Template` rows with a blank `Event`) |
| event versions of templates (`03_Template` rows with an `Event`) | SUPER_ADMIN accounts and their logins |
| CLIENT accounts (`_Users`), and their logins | `_Config`, `_Enum`, `00_Panduan`, every header, format and dropdown |

1. Push or paste the latest `.gs` files.
2. Select **`cekResetProduksi`** and click **Run**. Nothing is deleted. The log
   shows how many rows each tab would lose, and warns if a demo admin
   (`…@example.com`) is still a SUPER_ADMIN.
3. Add a one-off function, select it and click **Run**. Approve the
   authorization prompt the first time; the backup copy needs it.
   ```js
   function jalankanReset() { resetProduksi('HAPUS DATA DEMO') }
   ```
   It first saves a copy of the whole spreadsheet to your Drive as
   `BACKUP <name> <time>`. If that copy fails, nothing is deleted. Then it
   clears the rows and logs the counts.
4. Check that the backup is in Drive, then delete `jalankanReset` from the editor.
5. If the log warned about the demo admin, create your real account with
   `setupAdmin()` (see *Change the demo logins*), log in with it, and delete
   `admin@example.com` from the *Pengguna* page.

Without the exact confirmation text, `resetProduksi` throws and changes
nothing. No redeploy is needed for the reset itself. To restore, open the
backup copy or copy its tabs back.

## Endpoints

`E` = `/event/:code`, where `code` is the event's `ID` (never its slug). Every
`:id` is that row's `ID` column. Auth ✓ means a token is
required. SUPER_ADMIN means the role must be SUPER_ADMIN. For a CLIENT, every
`E` route answers only for its own event (`NOT_FOUND` otherwise), and `PUT E`
refuses a slug or domain change with `FORBIDDEN`.

| Method | Path | Auth | Body / query | `data` |
|---|---|---|---|---|
| GET | `/health` | – | – | `{ok, version}` |
| POST | `/auth/login` | – | `email, password` | `{token, expiresAt, user}` |
| POST | `/auth/logout` | ✓ | – | `null` |
| GET | `/auth/me` | ✓ | – | `{id, email, nama, role, event}` |
| POST | `/auth/change-password` | ✓ | `oldPassword, newPassword` | `null` |
| GET | `/event` | ✓ | – | `EventSummary[]` (a CLIENT: its own only) |
| POST | `/event` | SUPER_ADMIN | `event, mode?` | `Meta` |
| GET | `E` | ✓ | – | `Meta` |
| PUT | `E` | ✓ | `event, mode?` | `Meta` |
| DELETE | `E` | SUPER_ADMIN | – | `{tamu, template, sesi, akun}` |
| GET | `E/guests` | ✓ | – | `Guest[]` |
| POST | `E/guests` | ✓ | `fields` | `Guest` |
| GET | `E/guests/check` | ✓ | – | `Issue[]` |
| POST | `E/guests/import` | ✓ | `rows` | `{added, updated}` — same HP (normalised) updates the guest; blank cells keep its data |
| POST | `E/guests/normalize-phones` | ✓ | – | number |
| POST | `E/guests/bulk-delete` | ✓ | `ids` | number |
| POST | `E/guests/links` | ✓ | `ids \| null, tipe` | `{written, skipped[]}` |
| GET | `E/guests/:id` | ✓ | – | `Guest` |
| PATCH | `E/guests/:id` | ✓ | `fields` | `Guest` |
| DELETE | `E/guests/:id` | ✓ | – | `null` |
| GET | `E/guests/:id/preview` | ✓ | `tipe` | `{kode, text, waLink}` |
| GET | `E/templates` | ✓ | – | `Template[]` |
| GET | `E/templates/validate` | ✓ | – | `TemplateReport[]` |
| GET | `E/templates/:id` | ✓ | – | `Template` |
| PUT | `E/templates/:id` | ✓ | `template` (text, header, Aktif only; `:id` = master ID) | `Template` |
| POST | `E/templates/:id/reset` | ✓ | – | `Template` |
| GET | `/templates` | SUPER_ADMIN | – | `Template[]` (masters) |
| POST | `/templates` | SUPER_ADMIN | `template` | `{template, custom}` |
| PUT | `/templates/:id` | SUPER_ADMIN | `template` | `{template, custom}` |
| DELETE | `/templates/:id` | SUPER_ADMIN | – | `{custom}` |
| POST | `E/render/draft` | ✓ | `body, id \| null` | `RenderResult` |
| GET | `/users` | SUPER_ADMIN | – | `ManagedUser[]` |
| POST | `/users` | SUPER_ADMIN | `email, nama, role, event, password` | `ManagedUser` |
| PATCH | `/users/:id` | SUPER_ADMIN | `nama?, role?, event?, aktif?` | `ManagedUser` |
| POST | `/users/:id/reset-password` | SUPER_ADMIN | `password` | `null` |
| DELETE | `/users/:id` | SUPER_ADMIN | – | `null` |

## Try it with curl

The route goes in the `?path=` query parameter, on the bare `/exec` URL. Don't
append it as a path (`/exec/auth/login`): Google answers any URL with a segment
after `/exec` with its sign-in page (401) for anonymous callers, even when the
deployment is *Anyone*. Apps Script answers `/exec` with a 302 redirect, so
always pass `-L`. POST bodies are JSON sent as `text/plain`. PUT, PATCH and
DELETE are a POST with `_method` in the body.

```sh
EXEC='https://script.google.com/macros/s/XXXX/exec'

curl -L "$EXEC?path=health"

TOKEN=$(curl -sL -H 'Content-Type: text/plain' \
  -d '{"email":"admin@example.com","password":"Admin#123"}' \
  "$EXEC?path=auth/login" | sed -E 's/.*"token":"([0-9a-f]+)".*/\1/')

curl -L "$EXEC?path=event&token=$TOKEN"            # each event's `id`
EVENT='<event id from the list>'
curl -L "$EXEC?path=event/$EVENT/guests&token=$TOKEN"   # each guest's `ID`
GUEST='<guest ID from the list>'
curl -L "$EXEC?path=event/$EVENT/guests/$GUEST/preview&token=$TOKEN&tipe=UNDANGAN"

# Add a guest (the server generates its ID and PIN)
curl -L -H 'Content-Type: text/plain' \
  -d "{\"token\":\"$TOKEN\",\"fields\":{\"Nama\":\"Budi\",\"HP\":\"08123456789\"}}" \
  "$EXEC?path=event/$EVENT/guests"

# Edit a guest: PATCH via _method
curl -L -H 'Content-Type: text/plain' \
  -d "{\"token\":\"$TOKEN\",\"_method\":\"PATCH\",\"fields\":{\"Meja\":\"A-3\"}}" \
  "$EXEC?path=event/$EVENT/guests/$GUEST"

# SUPER_ADMIN: create a CLIENT account for one event (by event ID), then reset its password (by user ID)
curl -L -H 'Content-Type: text/plain' \
  -d "{\"token\":\"$TOKEN\",\"email\":\"klien@contoh.com\",\"nama\":\"Klien\",\"role\":\"CLIENT\",\"event\":\"$EVENT\",\"password\":\"Klien#12345\"}" \
  "$EXEC?path=users"                                  # the reply carries the new user's `id`
USER='<user id>'
curl -L -H 'Content-Type: text/plain' \
  -d "{\"token\":\"$TOKEN\",\"password\":\"Baru#12345\"}" \
  "$EXEC?path=users/$USER/reset-password"
```

## Notes

- **Locking.** Write routes take `LockService.getScriptLock()` and wait up to
  20 s. After that they return `BUSY`, which is safe to retry.
- **Derived columns.** `No`, `HP_Valid` and `Link_Undangan` in `02_Tamu` are
  written by the script after every guest write, per event. Do not put
  formulas in them. If you edit the sheet by hand, any API write to that event
  refreshes them.
- **IDs.** Never edit or copy an `ID` cell. A row typed into the sheet can
  leave `ID` empty: the API fills it the next time it reads that tab.
- **Text columns.** `setup()` formats ID, PIN, HP and the date and time columns as
  plain text, so a leading `0` and wall-clock times survive.
