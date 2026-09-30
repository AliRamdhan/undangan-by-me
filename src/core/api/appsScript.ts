import type { Issue } from '@/core/domain/checks'
import { withEventDefaults } from '@/core/domain/event'
import type { ImportRow } from '@/core/domain/csv'
import type { RenderResult } from '@/core/domain/template'
import type { EventInfo, Guest, GuestInput, Meta, Template, TemplateTipe } from '@/core/domain/types'
import { RestClient } from '@/core/api/http'
import type {
  AppApi,
  AuthUser,
  DeletedEvent,
  EventSummary,
  LinkResult,
  ManagedUser,
  NewUser,
  Preview,
  Session,
  TemplateReport,
  UndanganApi,
  UserPatch,
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
  deleteEvent(id: string) {
    return this.rest.request<DeletedEvent>('DELETE', `event/${encodeURIComponent(id)}`)
  }
  forEvent(id: string): UndanganApi {
    return new AppsScriptEventApi(this.rest, id)
  }
  listUsers() {
    return this.rest.request<ManagedUser[]>('GET', 'users')
  }
  createUser(user: NewUser) {
    return this.rest.request<ManagedUser>('POST', 'users', { body: { ...user } })
  }
  updateUser(id: string, patch: UserPatch) {
    return this.rest.request<ManagedUser>('PATCH', `users/${encodeURIComponent(id)}`, { body: { ...patch } })
  }
  async resetPassword(id: string, password: string) {
    await this.rest.request('POST', `users/${encodeURIComponent(id)}/reset-password`, { body: { password } })
  }
  async deleteUser(id: string) {
    await this.rest.request('DELETE', `users/${encodeURIComponent(id)}`)
  }
}

/**
 * Everything under `/event/:code` (the event ID). Every render call goes to
 * the server so renderTemplate_() stays the only renderer.
 */
export class AppsScriptEventApi implements UndanganApi {
  readonly eventId: string
  private readonly rest: RestClient
  private readonly base: string

  constructor(rest: RestClient, eventId: string) {
    this.rest = rest
    this.eventId = eventId
    this.base = `event/${encodeURIComponent(eventId)}`
  }

  private guest(id: string, suffix = '') {
    return `${this.base}/guests/${encodeURIComponent(id)}${suffix}`
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
  saveGuest(id: string | null, fields: Partial<GuestInput>) {
    if (!id) return this.rest.request<Guest>('POST', `${this.base}/guests`, { body: { fields } })
    return this.rest.request<Guest>('PATCH', this.guest(id), { body: { fields } })
  }
  async deleteGuests(ids: string[]) {
    if (ids.length === 1) {
      await this.rest.request('DELETE', this.guest(ids[0]))
      return 1
    }
    return this.rest.request<number>('POST', `${this.base}/guests/bulk-delete`, { body: { ids } })
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
  saveTemplate(template: Template) {
    if (!template.ID) return this.rest.request<Template>('POST', `${this.base}/templates`, { body: { template } })
    return this.rest.request<Template>('PUT', `${this.base}/templates/${encodeURIComponent(template.ID)}`, { body: { template } })
  }
  async deleteTemplate(id: string) {
    await this.rest.request('DELETE', `${this.base}/templates/${encodeURIComponent(id)}`)
  }
  validateTemplates() {
    return this.rest.request<TemplateReport[]>('GET', `${this.base}/templates/validate`)
  }
  previewMessage(guestId: string, tipe: TemplateTipe) {
    return this.rest.request<Preview>('GET', this.guest(guestId, '/preview'), { query: { tipe } })
  }
  renderDraft(body: string, guestId: string | null) {
    return this.rest.request<RenderResult>('POST', `${this.base}/render/draft`, { body: { body, id: guestId } })
  }
  generateLinks(ids: string[] | null, tipe: TemplateTipe) {
    return this.rest.request<LinkResult>('POST', `${this.base}/guests/links`, { body: { ids, tipe } })
  }
}
