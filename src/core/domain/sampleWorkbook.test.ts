/// <reference types="node" />
import { createHash } from 'node:crypto'
import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { SEED_USERS } from '@/core/api/seed'
import { cellText } from '@/core/domain/xlsx'
import { buildSampleWorkbook } from '@/core/domain/sampleWorkbook'
import * as schema from '@/core/domain/sheetSchema'

const sha256Hex = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex')

async function roundTrip() {
  let n = 0
  const wb = buildSampleWorkbook({ ExcelJS, sha256Hex, randomSalt: () => `salt${n++}`, now: new Date('2026-09-26T00:00:00Z') })
  const back = new ExcelJS.Workbook()
  await back.xlsx.load(await wb.xlsx.writeBuffer())
  return back
}

function rows(ws: ExcelJS.Worksheet): Record<string, string>[] {
  const header = (ws.getRow(1).values as ExcelJS.CellValue[]).slice(1).map(cellText)
  const out: Record<string, string>[] = []
  ws.eachRow((row, i) => {
    if (i > 1) out.push(Object.fromEntries(header.map((h, c) => [h, cellText(row.getCell(c + 1).value)])))
  })
  return out
}

const header = (ws: ExcelJS.Worksheet) => (ws.getRow(1).values as ExcelJS.CellValue[]).slice(1).map(cellText)

describe('sample database workbook', () => {
  it('has every tab, each with the header the Apps Script expects', async () => {
    const wb = await roundTrip()
    expect(wb.worksheets.map((w) => w.name)).toEqual(Object.values(schema.SHEETS))
    const expected: [string, readonly string[]][] = [
      [schema.SHEETS.event, schema.EVENT_COLUMNS],
      [schema.SHEETS.sesi, schema.SESI_COLUMNS],
      [schema.SHEETS.tamu, schema.TAMU_SHEET_COLUMNS],
      [schema.SHEETS.template, schema.TEMPLATE_SHEET_COLUMNS],
      [schema.SHEETS.config, schema.CONFIG_COLUMNS],
      [schema.SHEETS.enum, schema.ENUM_COLUMNS],
      [schema.SHEETS.users, schema.USER_COLUMNS],
      [schema.SHEETS.sessions, schema.SESSION_COLUMNS],
    ]
    for (const [name, cols] of expected) expect(header(wb.getWorksheet(name)!), name).toEqual([...cols])
  })

  it('gives every row an ID and scopes it to an existing event ID, numbering guests per event', async () => {
    const wb = await roundTrip()
    const events = rows(wb.getWorksheet(schema.SHEETS.event)!)
    expect(events.map((r) => r.Slug)).toEqual(['fidaeno'])
    const ids = events.map((r) => r.ID)
    // 03_Template ships master templates only: a blank Event, shared by every event.
    expect(new Set(rows(wb.getWorksheet(schema.SHEETS.template)!).map((r) => r.Event ?? ''))).toEqual(new Set(['']))
    for (const tab of [schema.SHEETS.sesi, schema.SHEETS.tamu]) {
      expect(new Set(rows(wb.getWorksheet(tab)!).map((r) => r.Event))).toEqual(new Set(ids))
    }
    for (const tab of [schema.SHEETS.event, schema.SHEETS.sesi, schema.SHEETS.tamu, schema.SHEETS.template, schema.SHEETS.users]) {
      const tabIds = rows(wb.getWorksheet(tab)!).map((r) => r.ID)
      expect(tabIds.every((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(String(id))), tab).toBe(true)
      expect(new Set(tabIds).size, tab).toBe(tabIds.length)
    }
    const fida = rows(wb.getWorksheet(schema.SHEETS.tamu)!).filter((r) => r.Event === ids[0])
    expect(fida.map((r) => r.No)).toEqual(['1', '2', '3', '4'])
    expect(fida[0].Link_Undangan).toBe('https://undangan.by.me/fidaeno/104729')
    // PINs are text cells, so a leading zero would survive.
    const tamu = wb.getWorksheet(schema.SHEETS.tamu)!
    expect(tamu.getCell(2, header(tamu).indexOf('PIN') + 1).value).toBe('104729')
  })

  it('binds every CLIENT account to an existing event', async () => {
    const wb = await roundTrip()
    const ids = rows(wb.getWorksheet(schema.SHEETS.event)!).map((r) => r.ID)
    const users = rows(wb.getWorksheet(schema.SHEETS.users)!)
    expect(users.map((u) => [u.Role, u.Event])).toEqual(SEED_USERS.map((u) => [u.role, u.event]))
    for (const u of users.filter((x) => x.Role === 'CLIENT')) expect(ids).toContain(u.Event)
  })

  it('stores demo passwords only as salted hashes', async () => {
    const users = rows((await roundTrip()).getWorksheet(schema.SHEETS.users)!)
    expect(users.map((u) => u.Email)).toEqual(SEED_USERS.map((u) => u.email))
    users.forEach((u, i) => {
      expect(u.Password_Hash).not.toContain(SEED_USERS[i].password)
      expect(u.Password_Hash).toBe(schema.hashPassword(SEED_USERS[i].password, u.Salt, sha256Hex))
    })
  })
})
