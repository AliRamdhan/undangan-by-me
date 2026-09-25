import { Download04Icon, Upload04Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { importTemplateCsv, parseImport, parseImportTable, type ImportResult } from '@/core/domain/csv'
import { IMPORT_COLUMNS } from '@/core/domain/schema'
import { importTemplateXlsx, readSheetTable, XLSX_MIME } from '@/core/domain/xlsx'
import { useStore } from '@/core/store'
import { downloadBlob, downloadText } from '@/utils/download'

/** Bulk import of 02_Tamu_import.csv / .xlsx (columns B–K, sheet-templates/README.md). */
export function ImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { run, busy } = useStore()
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState('')
  /** First sheet of an uploaded .xlsx; `null` while the source is CSV text. */
  const [table, setTable] = useState<string[][] | null>(null)
  const result: ImportResult | null = table ? parseImportTable(table) : text.trim() ? parseImport(text) : null

  const reset = () => {
    setText('')
    setFileName('')
    setTable(null)
  }

  const pickFile = async (f: File) => {
    setFileName(f.name)
    if (!/\.xlsx$/i.test(f.name)) {
      setTable(null)
      setText(await f.text())
      return
    }
    try {
      setText('')
      setTable(await readSheetTable(await f.arrayBuffer()))
    } catch {
      reset()
      toast.error('File Excel tidak bisa dibaca. Pastikan formatnya .xlsx.')
    }
  }

  const downloadXlsxTemplate = async () => {
    downloadBlob('02_Tamu_import.xlsx', await importTemplateXlsx())
  }

  const submit = async () => {
    if (!result?.rows.length) return
    const n = await run('Import', (api) => api.importGuests(result.rows))
    if (n) {
      toast.success(`${n} tamu diimpor. Lanjut: Generate PIN → Normalisasi HP → Cek Duplikat.`)
      reset()
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import Tamu dari CSV / Excel</DialogTitle>
          <DialogDescription>
            Header harus persis dan berurutan: <span className="font-mono text-foreground">{IMPORT_COLUMNS.join(', ')}</span>.
            Kosongkan <b>PIN</b> — dibuat lewat Generate PIN. Akses: VIP / KELUARGA / REGULAR / PUBLIC.
          </DialogDescription>
        </DialogHeader>
        <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto">
          <label className="flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed px-4 py-6 text-center hover:border-primary">
            <HugeiconsIcon icon={Upload04Icon} strokeWidth={2} className="size-5 text-muted-foreground" />
            <span className="font-medium">{fileName || 'Pilih file .csv atau .xlsx'}</span>
            <span className="text-muted-foreground">atau tempel isi CSV di bawah</span>
            <input
              type="file"
              accept={`.csv,text/csv,.xlsx,${XLSX_MIME}`}
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (f) void pickFile(f)
              }}
            />
          </label>
          <Textarea
            aria-label="Isi CSV"
            rows={5}
            className="font-mono"
            placeholder={`${IMPORT_COLUMNS.join(',')}\n,Bapak,Budi Santoso,0812 3456 789,,REGULAR,Teman Kantor,PRIA,0,2`}
            value={text}
            onChange={(e) => {
              setFileName('')
              setTable(null)
              setText(e.target.value)
            }}
          />
          {result?.errors.length ? (
            <ul role="alert" className="flex flex-col gap-1 rounded-lg tint-critical p-3 text-critical-ink">
              {result.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          ) : null}
          {result && result.rows.length > 0 && (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {IMPORT_COLUMNS.map((c) => (
                      <TableHead key={c}>{c}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.rows.slice(0, 8).map((r, i) => (
                    <TableRow key={i}>
                      {IMPORT_COLUMNS.map((c) => (
                        <TableCell key={c} className={c === 'PIN' || c === 'HP' ? 'font-mono' : ''}>
                          {String(r[c])}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {result.rows.length > 8 && (
                <p className="border-t px-2 py-1.5 text-muted-foreground">…dan {result.rows.length - 8} baris lagi</p>
              )}
            </div>
          )}
        </div>
        <DialogFooter className="sm:justify-between">
          <div className="flex gap-1">
            <Button variant="ghost" onClick={() => downloadText('02_Tamu_import.csv', importTemplateCsv())}>
              <HugeiconsIcon icon={Download04Icon} strokeWidth={2} data-icon="inline-start" />
              Template CSV
            </Button>
            <Button variant="ghost" onClick={downloadXlsxTemplate}>
              <HugeiconsIcon icon={Download04Icon} strokeWidth={2} data-icon="inline-start" />
              Template Excel
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Batal
            </Button>
            <Button onClick={submit} disabled={!result?.rows.length || !!result.errors.length || !!busy}>
              {result?.rows.length ? `Impor ${result.rows.length} tamu` : 'Impor'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
