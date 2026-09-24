import type { Issue } from '../domain/checks'
import type { ImportRow } from '../domain/csv'
import type { RenderResult } from '../domain/template'
import type { Guest, GuestInput, Meta, Template, TemplateTipe } from '../domain/types'

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
  | 'AUTH'
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
 * One method per `📨 Undangan` menu action (UIUX.md). The API writes only
 * manual columns; script/formula columns come back computed by the backend.
 */
export interface UndanganApi {
  readonly kind: 'mock' | 'appsscript'
  getMeta(): Promise<Meta>
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
