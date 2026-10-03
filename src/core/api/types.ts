import type { Issue } from '@/core/domain/checks'
import type { ImportRow } from '@/core/domain/csv'
import type { RenderResult } from '@/core/domain/template'
import type { EventInfo, GatewayMode, Guest, GuestInput, Meta, Template, TemplateTipe } from '@/core/domain/types'

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
  /** _Users.ID (UUID) — `/users/:id`. */
  id: string
  email: string
  nama: string
  role: Role
  /** The CLIENT's event ID (01_Event.ID); '' for SUPER_ADMIN. */
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
  id: string
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
  /** SUPER_ADMIN only. Rejects a taken slug with DUPLICATE_SLUG; the server assigns `event.id`. */
  createEvent(event: EventInfo): Promise<Meta>
  /** SUPER_ADMIN only. Also removes the event's sessions, guests, templates and CLIENT accounts. */
  deleteEvent(id: string): Promise<DeletedEvent>
  /** By event ID. A CLIENT asking for another event gets NOT_FOUND on every call. */
  forEvent(id: string): UndanganApi
  // SUPER_ADMIN only — /users.
  listUsers(): Promise<ManagedUser[]>
  createUser(user: NewUser): Promise<ManagedUser>
  /** By user ID. A change of role, event or aktif ends that user's sessions. */
  updateUser(id: string, patch: UserPatch): Promise<ManagedUser>
  /** Ends that user's sessions. */
  resetPassword(id: string, password: string): Promise<void>
  deleteUser(id: string): Promise<void>
}

/**
 * One method per `📨 Undangan` menu action (UIUX.md). The API writes only
 * manual columns; script/formula columns come back computed by the backend.
 */
export interface UndanganApi {
  /** The ID of the event every call is scoped to (`/event/:code`). */
  readonly eventId: string
  getMeta(): Promise<Meta>
  /**
   * Writes the 01_Event row and its 01_Sesi rows; the ID stays, so a new slug only changes the invitation links.
   * Rejects an event that fails Validasi Data Event; a CLIENT changing slug/domain gets FORBIDDEN.
   */
  saveEvent(event: EventInfo): Promise<Meta>
  listGuests(): Promise<Guest[]>
  /** `id: null` appends a new guest; the backend assigns its ID and PIN. */
  saveGuest(id: string | null, fields: Partial<GuestInput>): Promise<Guest>
  deleteGuests(ids: string[]): Promise<number>
  /**
   * Upserts by HP (normalised): a matching guest takes the row's non-blank
   * Gelar/Nama/Email, other rows are appended. `updated` counts guests that changed.
   */
  importGuests(rows: ImportRow[]): Promise<{ added: number; updated: number }>
  /** Tamu → Generate PIN (yang kosong). Returns how many were filled. */
  generatePins(): Promise<number>
  /** Tamu → Normalisasi Nomor HP. Returns how many changed. */
  normalizePhones(): Promise<number>
  /** Tamu → Cek Duplikat & Error. */
  checkGuests(): Promise<Issue[]>
  listTemplates(): Promise<Template[]>
  /** Creates when `t.ID` is empty (the backend assigns it); otherwise updates that template, Kode included. */
  saveTemplate(t: Template): Promise<Template>
  deleteTemplate(id: string): Promise<void>
  /** Template → Validasi Template. */
  validateTemplates(): Promise<TemplateReport[]>
  /** Blast → Preview Pesan: what THIS guest will receive. */
  previewMessage(guestId: string, tipe: TemplateTipe): Promise<Preview>
  /** Unsaved editor content rendered against one guest (by ID). Never throws on bad tokens. */
  renderDraft(body: string, guestId: string | null): Promise<RenderResult>
  /** Template → Generate Link Manual. `ids: null` means every guest. */
  generateLinks(ids: string[] | null, tipe: TemplateTipe): Promise<LinkResult>
}
