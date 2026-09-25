import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { blankGuest } from '@/core/api/seed'
import { parseImportTable } from '@/core/domain/csv'
import { IMPORT_COLUMNS, SHEET_COLUMNS } from '@/core/domain/schema'
import { cellText, exportGuestsXlsx, importTemplateXlsx, readSheetTable } from '@/core/domain/xlsx'

const bytes = async (blob: Blob) => blob.arrayBuffer()

describe('xlsx', () => {
  it('reads the import template back as a valid, empty import', async () => {
    const table = await readSheetTable(await bytes(await importTemplateXlsx()))
    expect(table).toEqual([[...IMPORT_COLUMNS]])
    expect(parseImportTable(table)).toEqual({ rows: [], errors: [] })
  })

  it('imports a filled sheet, keeping text PINs and numeric HP recoverable', async () => {
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('02_Tamu_import')
    ws.addRow([...IMPORT_COLUMNS])
    ws.addRow(['012345', 'Bapak', 'Budi', 81234567890, '', 'vip', 'Kantor', 'pria', 1, 2])
    ws.addRow([])
    ws.addRow(['', '', { richText: [{ text: 'Ani ' }, { text: 'Rahma' }] }, '0812 3456 789', null, '', '', '', null, null])
    const table = await readSheetTable((await wb.xlsx.writeBuffer()) as ArrayBuffer)
    const { rows, errors } = parseImportTable(table)
    expect(errors).toEqual([])
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ PIN: '012345', HP: '81234567890', Akses: 'VIP', Sisi: 'PRIA', Q_S1: 1, Q_S2: 2 })
    expect(rows[1]).toMatchObject({ Nama: 'Ani Rahma', HP: '0812 3456 789', Q_S1: 0, Q_S2: 0 })
  })

  it('rejects a sheet whose header was changed', async () => {
    const wb = new ExcelJS.Workbook()
    wb.addWorksheet('x').addRow(['Nama', 'HP'])
    const { errors } = parseImportTable(await readSheetTable((await wb.xlsx.writeBuffer()) as ArrayBuffer))
    expect(errors[0]).toMatch(/Header harus persis/)
  })

  it('exports all 28 columns, formulas as plain text', async () => {
    const g = { ...blankGuest(), Nama: '=HYPERLINK("x")', HP: '+628123456789', Q_S1: 2 }
    const table = await readSheetTable(await bytes(await exportGuestsXlsx([g])))
    expect(table[0]).toEqual([...SHEET_COLUMNS])
    const row = table[1]
    expect(row[SHEET_COLUMNS.indexOf('Nama')]).toBe('=HYPERLINK("x")')
    expect(row[SHEET_COLUMNS.indexOf('HP')]).toBe('+628123456789')
    expect(row[SHEET_COLUMNS.indexOf('Q_S1')]).toBe('2')
  })

  it('converts cell values to strings', () => {
    expect(cellText(null)).toBe('')
    expect(cellText(new Date(Date.UTC(2026, 10, 1)))).toBe('2026-11-01')
    expect(cellText({ formula: 'A1+1', result: 3 })).toBe('3')
    expect(cellText({ text: 'link', hyperlink: 'https://x.y' })).toBe('link')
  })
})
