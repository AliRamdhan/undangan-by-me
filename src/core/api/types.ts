import type { Issue } from '@/core/domain/checks'
import type { ImportRow } from '@/core/domain/csv'
import type { RenderResult } from '@/core/domain/template'
import type { EventInfo, GatewayMode, Guest, GuestInput, Meta, Template, TemplateTipe } from '@/core/domain/types'

/**
 * Identifies a 02_Tamu row. PIN is the key (BLAST-FLOW.md: never the row
 * index). `rowHint` + `nama` only disambiguate rows that have no PIN yet, or
 * share one — the server revalidates them and refuses with STALE_ROW if the
 * sheet was sorted or edited underneath.
 */
export interface GuestRef {
  PIN: string
  rowHint: number
  nama: string
}

export const refOf = (g: Guest): GuestRef => ({ PIN: g.PIN, rowHint: g.No, nama: g.Nama })

/** The `:id` path segment for a guest: its PIN, or `row-{No}` while it has none. */
export const guestId = (ref: GuestRef): string => (ref.PIN ? encodeURIComponent(ref.PIN) : `row-${ref.rowHint}`)

export interface Preview {
  kode: string
  text: string
  waLink: string
}

export interface TemplateReport {
  kode: string
  tipe: TemplateTipe
  akses: string
  /** Guests this template was dry-rendered against. */
  rendered: number
  unknown: string[]
  malformed: boolean
  empty: string[]
}

export interface LinkResult {
  written: number
  skipped: { pin: string; nama: string; reason: string }[]
}

export type ApiErrorCode =
  /** Token missing, expired or revoked — the only code that ends the session. */
  | 'AUTH'
  | 'LOGIN_FAILED'
  | 'LOGIN_LOCKED'
  | 'FORBIDDEN'
  | 'ROUTE_NOT_FOUND'
  | 'DUPLICATE_SLUG'
  | 'INTERNAL'
  | 'NETWORK'
  | 'BAD_RESPONSE'
  | 'NOT_FOUND'
  | 'DUPLICATE_PIN'
  | 'STALE_ROW'
  | 'VALIDATION'
  | 'TEMPLATE'
  | 'NO_TEMPLATE'
  | 'BUSY'
  | string

export class ApiError extends Error {
  readonly code: ApiErrorCode
  constructor(code: ApiErrorCode, message: string) {
    super(message)
    this.name = 'ApiError'
    this.code = code
  }
}

/**
 * SUPER_ADMIN sees and manages every event and every account. CLIENT is bound
 * to exactly one event (`event`): it manages that event's data, guests and
 * templates — but not its slug/domain — and never sees any other event.
 */
export const ROLES = ['SUPER_ADMIN', 'CLIENT'] as const
export type Role = (typeof ROLES)[number]

export interface AuthUser {
  email: string
  nama: string
  role: Role
  /** The CLIENT's event slug; '' for SUPER_ADMIN. */
  event: string
}

/** A `_Users` row as SUPER_ADMIN sees it — never the hash or salt. */
export interface ManagedUser extends AuthUser {
  aktif: boolean
  dibuat: string
  loginTerakhir: string
}

export interface NewUser {
  email: string
  nama: string
  role: Role
  event: string
  password: string
}

export type UserPatch = Partial<Pick<ManagedUser, 'nama' | 'role' | 'event' | 'aktif'>>

export interface Session {
  token: string
  /** ISO timestamp; the client drops the session once it has passed. */
  expiresAt: string
  user: AuthUser
}

export interface EventSummary {
  slug: string
  nama_event: string
  tipe: string
  tanggal_utama: string
  mode: GatewayMode
  jumlah_tamu: number
  jumlah_template: number
}

/** Rows removed by `DELETE /event/:code`, per tab; `akun` = the event's CLIENT accounts. */
export interface DeletedEvent {
  tamu: number
  template: number
  sesi: number
  akun: number
}

/**
 * Everything that is not scoped to one event: auth and the event list.
 * `forEvent` hands out the per-event API.
 */
export interface AppApi {
  login(email: string, password: string): Promise<Session>
  logout(): Promise<void>
  me(): Promise<AuthUser>
  changePassword(oldPassword: string, newPassword: string): Promise<void>
  /** Every event for SUPER_ADMIN; only its own event for a CLIENT. */
  listEvents(): Promise<EventSummary[]>
  /** SUPER_ADMIN only. Rejects a taken slug with DUPLICATE_SLUG. */
  createEvent(event: EventInfo): Promise<Meta>
  /** SUPER_ADMIN only. Also removes the event's sessions, guests, templates and CLIENT accounts. */
  deleteEvent(slug: string): Promise<DeletedEvent>
  /** A CLIENT asking for another event gets NOT_FOUND on every call. */
  forEvent(slug: string): UndanganApi
  // SUPER_ADMIN only — /users.
  listUsers(): Promise<ManagedUser[]>
  createUser(user: NewUser): Promise<ManagedUser>
  /** A change of role, event or aktif ends that user's sessions. */
  updateUser(email: string, patch: UserPatch): Promise<ManagedUser>
  /** Ends that user's sessions. */
  resetPassword(email: string, password: string): Promise<void>
  deleteUser(email: string): Promise<void>
}

/**
 * One method per `📨 Undangan` menu action (UIUX.md). The API writes only
 * manual columns; script/formula columns come back computed by the backend.
 */
export interface UndanganApi {
  /** The event every call is scoped to (`/event/:code`). */
  readonly slug: string
  getMeta(): Promise<Meta>
  /**
   * Writes the 01_Event row and its 01_Sesi rows; a new slug renames the event everywhere.
   * Rejects an event that fails Validasi Data Event; a CLIENT changing slug/domain gets FORBIDDEN.
   */
  saveEvent(event: EventInfo): Promise<Meta>
  listGuests(): Promise<Guest[]>
  /** `ref: null` appends a new guest; the backend assigns its PIN. */
  saveGuest(ref: GuestRef | null, fields: Partial<GuestInput>): Promise<Guest>
  deleteGuests(refs: GuestRef[]): Promise<number>
  importGuests(rows: ImportRow[]): Promise<number>
  /** Tamu → Generate PIN (yang kosong). Returns how many were filled. */
  generatePins(): Promise<number>
  /** Tamu → Normalisasi Nomor HP. Returns how many changed. */
  normalizePhones(): Promise<number>
  /** Tamu → Cek Duplikat & Error. */
  checkGuests(): Promise<Issue[]>
  listTemplates(): Promise<Template[]>
  /** `originalKode` renames; omit it to create. */
  saveTemplate(t: Template, originalKode?: string): Promise<void>
  deleteTemplate(kode: string): Promise<void>
  /** Template → Validasi Template. */
  validateTemplates(): Promise<TemplateReport[]>
  /** Blast → Preview Pesan: what THIS guest will receive. */
  previewMessage(ref: GuestRef, tipe: TemplateTipe): Promise<Preview>
  /** Unsaved editor content rendered against one guest. Never throws on bad tokens. */
  renderDraft(body: string, ref: GuestRef | null): Promise<RenderResult>
  /** Template → Generate Link Manual. `refs: null` means every guest. */
  generateLinks(refs: GuestRef[] | null, tipe: TemplateTipe): Promise<LinkResult>
}
