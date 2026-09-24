import type { Issue } from '../domain/checks'
import type { ImportRow } from '../domain/csv'
import type { RenderResult } from '../domain/template'
import type { Guest, GuestInput, Meta, Template, TemplateTipe } from '../domain/types'
import {
  ApiError,
  type GuestRef,
  type LinkResult,
  type Preview,
  type TemplateReport,
  type UndanganApi,
} from './types'

interface Envelope<T> {
  v: number
  ok: boolean
  code: string
  message?: string
  data?: T
}

/**
 * Talks to the Apps Script Web App (docs/ADMIN-API.md). Every render call
 * goes to the server so renderTemplate_() stays the only renderer.
 */
export class AppsScriptApi implements UndanganApi {
  readonly kind = 'appsscript' as const
  private readonly url: string
  private readonly key: string

  constructor(url: string, key: string) {
    this.url = url
    this.key = key
  }

  private async call<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
    let res: Response
    try {
      res = await fetch(this.url, {
        method: 'POST',
        // text/plain keeps this a "simple" request: Apps Script cannot answer
        // a CORS preflight, so application/json would never arrive.
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ v: 1, action, key: this.key, ...params }),
        redirect: 'follow',
      })
    } catch {
      throw new ApiError('NETWORK', 'Tidak bisa menghubungi Apps Script. Cek URL /exec dan koneksi.')
    }
    let env: Envelope<T>
    try {
      env = (await res.json()) as Envelope<T>
    } catch {
      throw new ApiError('BAD_RESPONSE', 'Respons bukan JSON — deployment salah atau belum di-redeploy?')
    }
    if (!env.ok) throw new ApiError(env.code, env.message || env.code)
    return env.data as T
  }

  getMeta() {
    return this.call<Meta>('meta')
  }
  listGuests() {
    return this.call<Guest[]>('guests.list')
  }
  saveGuest(ref: GuestRef | null, fields: Partial<GuestInput>) {
    return this.call<Guest>('guests.save', { ref, fields })
  }
  deleteGuests(refs: GuestRef[]) {
    return this.call<number>('guests.delete', { refs })
  }
  importGuests(rows: ImportRow[]) {
    return this.call<number>('guests.import', { rows })
  }
  generatePins() {
    return this.call<number>('guests.generatePins')
  }
  normalizePhones() {
    return this.call<number>('guests.normalizePhones')
  }
  checkGuests() {
    return this.call<Issue[]>('guests.check')
  }
  listTemplates() {
    return this.call<Template[]>('templates.list')
  }
  async saveTemplate(template: Template, originalKode?: string) {
    await this.call('templates.save', { template, originalKode })
  }
  async deleteTemplate(kode: string) {
    await this.call('templates.delete', { kode })
  }
  validateTemplates() {
    return this.call<TemplateReport[]>('templates.validate')
  }
  previewMessage(ref: GuestRef, tipe: TemplateTipe) {
    return this.call<Preview>('render.preview', { ref, tipe })
  }
  renderDraft(body: string, ref: GuestRef | null) {
    return this.call<RenderResult>('render.draft', { body, ref })
  }
  generateLinks(refs: GuestRef[] | null, tipe: TemplateTipe) {
    return this.call<LinkResult>('render.links', { refs, tipe })
  }
}
