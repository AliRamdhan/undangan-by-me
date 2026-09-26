// Writes ../sheet-templates/undangan-db-sample.xlsx — the sample database for
// the Apps Script backend. The builder lives in src/ (sampleWorkbook.ts) so it
// shares the seed and schema with the app; Vite's SSR loader resolves the `@/`
// aliases and TypeScript without an extra runner.
import { createHash, randomBytes } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ExcelJS from 'exceljs'
import { createServer } from 'vite'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const out = resolve(root, '../sheet-templates/undangan-db-sample.xlsx')

const server = await createServer({ root, logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' })
try {
  const { buildSampleWorkbook } = await server.ssrLoadModule('/src/core/domain/sampleWorkbook.ts')
  const wb = buildSampleWorkbook({
    ExcelJS,
    sha256Hex: (s) => createHash('sha256').update(s, 'utf8').digest('hex'),
    randomSalt: () => randomBytes(8).toString('hex'),
    now: new Date(),
  })
  await mkdir(dirname(out), { recursive: true })
  await wb.xlsx.writeFile(out)
  console.log(`wrote ${out}`)
  for (const ws of wb.worksheets) console.log(`  ${ws.name}: ${ws.actualRowCount - 1} rows × ${ws.actualColumnCount} cols`)
} finally {
  await server.close()
}
