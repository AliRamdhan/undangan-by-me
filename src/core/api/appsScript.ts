import type { Issue } from '@/core/domain/checks'
import { withEventDefaults } from '@/core/domain/event'
import type { ImportRow } from '@/core/domain/csv'
import type { RenderResult } from '@/core/domain/template'
import type { EventInfo, Guest, GuestInput, Meta, Template, TemplateTipe } from '@/core/domain/types'
import { RestClient } from '@/core/api/http'
import {
  guestId,
  type AppApi,
  type AuthUser,
  type DeletedEvent,
  type EventSummary,
  type GuestRef,
  type LinkResult,
  type ManagedUser,
  type NewUser,
  type Preview,
  type Session,
  type TemplateReport,
  type UndanganApi,
  type UserPatch,
} from '@/core/api/types'

/** Auth and the event list against the Apps Script Web App (docs/ADMIN-API.md). */
export class AppsScriptApp implements AppApi {
  private readonly rest: RestClient

  constructor(url: string, token: string | null, onUnauthorized?: () => void) {
    this.rest = new RestClient(url, token, onUnauthorized)
  }

  login(email: string, password: string) {
    return this.rest.request<Session>('POST', 'auth/login', { body: { email, password } })
  }
  async logout() {
    await this.rest.request('POST', 'auth/logout')
  }
  me() {
    return this.rest.request<AuthUser>('GET', 'auth/me')
  }
  async changePassword(oldPassword: string, newPassword: string) {
    await this.rest.request('POST', 'auth/change-password', { body: { oldPassword, newPassword } })
  }
  listEvents() {
    return this.rest.request<EventSummary[]>('GET', 'event')
  }
  createEvent(event: EventInfo) {
    return this.rest.request<Meta>('POST', 'event', { body: { event } })
  }
  deleteEvent(slug: string) {
    return this.rest.request<DeletedEvent>('DELETE', `event/${encodeURIComponent(slug)}`)
  }
  forEvent(slug: string): UndanganApi {
    return new AppsScriptEventApi(this.rest, slug)
  }
  listUsers() {
    return this.rest.request<ManagedUser[]>('GET', 'users')
  }
  createUser(user: NewUser) {
    return this.rest.request<ManagedUser>('POST', 'users', { body: { ...user } })
  }
  updateUser(email: string, patch: UserPatch) {
    return this.rest.request<ManagedUser>('PATCH', `users/${encodeURIComponent(email)}`, { body: { ...patch } })
  }
  async resetPassword(email: string, password: string) {
    await this.rest.request('POST', `users/${encodeURIComponent(email)}/reset-password`, { body: { password } })
  }
  async deleteUser(email: string) {
    await this.rest.request('DELETE', `users/${encodeURIComponent(email)}`)
  }
}

/**
 * Everything under `/event/:code`. Every render call goes to the server so
 * renderTemplate_() stays the only renderer.
 */
export class AppsScriptEventApi implements UndanganApi {
  readonly slug: string
  private readonly rest: RestClient
  private readonly base: string

  constructor(rest: RestClient, slug: string) {
    this.rest = rest
    this.slug = slug
    this.base = `event/${encodeURIComponent(slug)}`
  }

  private guest(ref: GuestRef, suffix = '') {
    return `${this.base}/guests/${guestId(ref)}${suffix}`
  }

  async getMeta() {
    const meta = await this.rest.request<Meta>('GET', this.base)
    // A row written before the event form existed may lack the newer keys.
    return { ...meta, event: withEventDefaults(meta.event) }
  }
  saveEvent(event: EventInfo) {
    return this.rest.request<Meta>('PUT', this.base, { body: { event } })
  }
  listGuests() {
    return this.rest.request<Guest[]>('GET', `${this.base}/guests`)
  }
  saveGuest(ref: GuestRef | null, fields: Partial<GuestInput>) {
    if (!ref) return this.rest.request<Guest>('POST', `${this.base}/guests`, { body: { fields } })
    return this.rest.request<Guest>('PATCH', this.guest(ref), { body: { fields, rowHint: ref.rowHint, nama: ref.nama } })
  }
  async deleteGuests(refs: GuestRef[]) {
    if (refs.length === 1) {
      const [ref] = refs
      await this.rest.request('DELETE', this.guest(ref), { body: { rowHint: ref.rowHint, nama: ref.nama } })
      return 1
    }
    return this.rest.request<number>('POST', `${this.base}/guests/bulk-delete`, { body: { refs } })
  }
  importGuests(rows: ImportRow[]) {
    return this.rest.request<number>('POST', `${this.base}/guests/import`, { body: { rows } })
  }
  generatePins() {
    return this.rest.request<number>('POST', `${this.base}/guests/generate-pins`)
  }
  normalizePhones() {
    return this.rest.request<number>('POST', `${this.base}/guests/normalize-phones`)
  }
  checkGuests() {
    return this.rest.request<Issue[]>('GET', `${this.base}/guests/check`)
  }
  listTemplates() {
    return this.rest.request<Template[]>('GET', `${this.base}/templates`)
  }
  async saveTemplate(template: Template, originalKode?: string) {
    if (originalKode === undefined) {
      await this.rest.request('POST', `${this.base}/templates`, { body: { template } })
    } else {
      await this.rest.request('PUT', `${this.base}/templates/${encodeURIComponent(originalKode)}`, { body: { template } })
    }
  }
  async deleteTemplate(kode: string) {
    await this.rest.request('DELETE', `${this.base}/templates/${encodeURIComponent(kode)}`)
  }
  validateTemplates() {
    return this.rest.request<TemplateReport[]>('GET', `${this.base}/templates/validate`)
  }
  previewMessage(ref: GuestRef, tipe: TemplateTipe) {
    return this.rest.request<Preview>('GET', this.guest(ref, '/preview'), { query: { tipe, rowHint: ref.rowHint, nama: ref.nama } })
  }
  renderDraft(body: string, ref: GuestRef | null) {
    return this.rest.request<RenderResult>('POST', `${this.base}/render/draft`, { body: { body, ref } })
  }
  generateLinks(refs: GuestRef[] | null, tipe: TemplateTipe) {
    return this.rest.request<LinkResult>('POST', `${this.base}/guests/links`, { body: { refs, tipe } })
  }
}
