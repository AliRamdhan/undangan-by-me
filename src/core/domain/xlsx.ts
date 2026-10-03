import type { /* HIDDEN(sementara): Cell, */ CellValue, Workbook, Worksheet } from 'exceljs'
import { IMPORT_COLUMNS, SHEET_COLUMNS } from '@/core/domain/schema'
import { /* HIDDEN(sementara): AKSES, SISI, */ type Guest } from '@/core/domain/types'

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

/**
 * ExcelJS is ~1 MB, so it is loaded only when a user actually imports or
 * exports. The browser build is UMD (default export), Node's is CJS.
 */
async function loadExcel(): Promise<typeof import('exceljs')> {
  const m = await import('exceljs')
  return ('default' in m ? m.default : m) as typeof import('exceljs')
}

// HIDDEN(sementara): only used by the hidden Akses/Sisi/quota validations
// /** Rows the template pre-formats and validates. */
// const TEMPLATE_ROWS = 1000

/** Columns kept as text so Excel doesn't strip leading zeros (`0812…`, PIN `012345`). */
const TEXT_KEYS = new Set<string>(['PIN', 'Gelar', 'Nama', 'HP', 'Email', 'Grup'])

const pad = (n: number) => String(n).padStart(2, '0')

/** Any cell value as the string a CSV cell would hold. */
export function cellText(value: CellValue): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) {
    return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`
  }
  if (typeof value !== 'object') return String(value)
  if ('richText' in value) return value.richText.map((r) => r.text).join('')
  if ('formula' in value || 'sharedFormula' in value) return cellText((value.result ?? null) as CellValue)
  if ('hyperlink' in value) return cellText(value.text as CellValue)
  if ('error' in value) return ''
  return ''
}

/** The first worksheet as a table of strings, blank rows dropped (as `parseCsv`). */
export async function readSheetTable(data: ArrayBuffer): Promise<string[][]> {
  const ExcelJS = await loadExcel()
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(data)
  const ws = wb.worksheets[0]
  if (!ws) return []
  const width = ws.getRow(1).cellCount
  const rows: string[][] = []
  ws.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = []
    for (let c = 1; c <= Math.max(width, row.cellCount); c++) cells.push(cellText(row.getCell(c).value))
    if (cells.some((v) => v.trim() !== '')) rows.push(cells)
  })
  return rows
}

function styleHeader(ws: Worksheet) {
  const header = ws.getRow(1)
  header.font = { bold: true }
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFEF' } }
  ws.views = [{ state: 'frozen', ySplit: 1 }]
}

async function toBlob(wb: Workbook): Promise<Blob> {
  const buf = await wb.xlsx.writeBuffer()
  return new Blob([buf as ArrayBuffer], { type: XLSX_MIME })
}

/**
 * Every column A–AB, as `exportGuestsCsv`. No formula defusing needed: a
 * string value is written as a literal text cell, never as a formula.
 */
export async function exportGuestsXlsx(guests: readonly Guest[]): Promise<Blob> {
  const ExcelJS = await loadExcel()
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('02_Tamu')
  ws.columns = SHEET_COLUMNS.map((k) => ({
    header: k,
    key: k,
    width: Math.max(10, k.length + 2),
    style: TEXT_KEYS.has(k) ? { numFmt: '@' } : {},
  }))
  for (const g of guests) {
    ws.addRow(SHEET_COLUMNS.map((k) => (typeof g[k] === 'number' ? g[k] : String(g[k] ?? ''))))
  }
  styleHeader(ws)
  return toBlob(wb)
}

// HIDDEN(sementara): Akses/Sisi/quota validations — those columns are hidden
// const listValidation = (values: readonly string[]) => ({
//   type: 'list' as const,
//   allowBlank: true,
//   formulae: [`"${values.join(',')}"`],
//   showErrorMessage: true,
//   errorTitle: 'Nilai tidak dikenal',
//   error: `Pilih salah satu: ${values.join(', ')}`,
// })

// const QUOTA_VALIDATION = {
//   type: 'whole' as const,
//   operator: 'greaterThanOrEqual' as const,
//   allowBlank: true,
//   formulae: [0],
//   showErrorMessage: true,
//   errorTitle: 'Kuota tidak valid',
//   error: 'Isi bilangan bulat ≥ 0',
// }

const TEMPLATE_WIDTH: Partial<Record<(typeof IMPORT_COLUMNS)[number], number>> = {
  Nama: 28,
  HP: 18,
  // HIDDEN(sementara): Email: 26,
  // HIDDEN(sementara): Grup: 18,
}

/** An empty 02_Tamu_import.xlsx: same header as the CSV template, pre-formatted and validated. */
export async function importTemplateXlsx(): Promise<Blob> {
  const ExcelJS = await loadExcel()
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('02_Tamu_import')
  ws.columns = IMPORT_COLUMNS.map((k) => ({
    header: k,
    key: k,
    width: TEMPLATE_WIDTH[k] ?? 12,
    style: TEXT_KEYS.has(k) ? { numFmt: '@' } : {},
  }))
  styleHeader(ws)

  // HIDDEN(sementara): Akses/Sisi/quota columns are hidden
  // const validations: Partial<Record<(typeof IMPORT_COLUMNS)[number], Cell['dataValidation']>> = {
  //   Akses: listValidation(AKSES),
  //   Sisi: listValidation(SISI),
  //   Q_S1: QUOTA_VALIDATION,
  //   Q_S2: QUOTA_VALIDATION,
  // }
  // IMPORT_COLUMNS.forEach((k, i) => {
  //   const rule = validations[k]
  //   if (!rule) return
  //   for (let r = 2; r <= TEMPLATE_ROWS; r++) ws.getCell(r, i + 1).dataValidation = rule
  // })

  const help = wb.addWorksheet('Petunjuk')
  help.getColumn(1).width = 100
  for (const line of [
    'Petunjuk import tamu',
    '',
    `• Isi sheet "02_Tamu_import" mulai baris 2. Jangan ubah, hapus atau urutkan ulang header (${IMPORT_COLUMNS.join(', ')}).`,
    '• PIN tidak perlu diisi — dibuat otomatis saat import.',
    '• Jika HP sudah terdaftar, tamu itu diperbarui (bukan ditambah). Sel kosong tidak menimpa data lama.',
    '• HP boleh 08xx, 628xx atau +628xx; jalankan Normalisasi HP setelah import.',
    // HIDDEN(sementara): Akses/Sisi/quota columns are hidden
    // `• Akses: ${AKSES.join(' / ')}. Sisi: ${SISI.join(' / ')}.`,
    // '• Q_S1 / Q_S2: jumlah kursi per sesi, bilangan bulat ≥ 0 (kosong = 0).',
  ]) {
    help.addRow([line])
  }
  help.getRow(1).font = { bold: true }
  return toBlob(wb)
}
