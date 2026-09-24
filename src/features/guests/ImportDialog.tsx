import { useState } from 'react'
import { Button, Dialog, fieldBase } from '../../components/ui'
import { importTemplateCsv, parseImport, type ImportResult } from '../../domain/csv'
import { IMPORT_COLUMNS } from '../../domain/schema'
import { useStore } from '../../state/store'
import { downloadText } from './download'

/** Bulk import of 02_Tamu_import.csv (columns B–K, sheet-templates/README.md). */
export function ImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { run, busy, toast } = useStore()
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState('')
  const result: ImportResult | null = text.trim() ? parseImport(text) : null

  const reset = () => {
    setText('')
    setFileName('')
  }

  const submit = async () => {
    if (!result?.rows.length) return
    const n = await run('Import CSV', (api) => api.importGuests(result.rows))
    if (n) {
      toast('ok', `${n} tamu diimpor. Lanjut: Generate PIN → Normalisasi HP → Cek Duplikat.`)
      reset()
      onClose()
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      wide
      title="Import Tamu dari CSV"
      footer={
        <>
          <Button variant="ghost" className="mr-auto" onClick={() => downloadText('02_Tamu_import.csv', importTemplateCsv())}>
            Unduh template CSV
          </Button>
          <Button onClick={onClose}>Batal</Button>
          <Button variant="primary" onClick={submit} disabled={!result?.rows.length || !!result.errors.length || !!busy}>
            {result?.rows.length ? `Impor ${result.rows.length} tamu` : 'Impor'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 text-sm">
        <p className="text-ink-2">
          Header harus persis dan berurutan:{' '}
          <span className="font-mono text-xs text-ink">{IMPORT_COLUMNS.join(', ')}</span>. Kosongkan <b>PIN</b> — dibuat
          lewat Generate PIN. Akses: VIP / KELUARGA / REGULAR / PUBLIC.
        </p>
        <label className="flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed border-line px-4 py-6 text-center hover:border-accent">
          <span className="font-medium">{fileName || 'Pilih file .csv'}</span>
          <span className="text-xs text-ink-3">atau tempel isinya di bawah</span>
          <input
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={async (e) => {
              const f = e.target.files?.[0]
              if (!f) return
              setFileName(f.name)
              setText(await f.text())
            }}
          />
        </label>
        <textarea
          aria-label="Isi CSV"
          rows={5}
          className={`${fieldBase} w-full py-2 font-mono text-xs`}
          placeholder={`${IMPORT_COLUMNS.join(',')}\n,Bapak,Budi Santoso,0812 3456 789,,REGULAR,Teman Kantor,PRIA,0,2`}
          value={text}
          onChange={(e) => {
            setFileName('')
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
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full text-xs">
              <thead className="bg-surface-2 text-left text-ink-2">
                <tr>
                  {IMPORT_COLUMNS.map((c) => (
                    <th key={c} className="px-2 py-1.5 font-medium whitespace-nowrap">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.slice(0, 8).map((r, i) => (
                  <tr key={i} className="border-t border-line">
                    {IMPORT_COLUMNS.map((c) => (
                      <td key={c} className={`px-2 py-1.5 whitespace-nowrap ${c === 'PIN' || c === 'HP' ? 'font-mono' : ''}`}>
                        {String(r[c])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {result.rows.length > 8 && (
              <p className="border-t border-line px-2 py-1.5 text-ink-3">…dan {result.rows.length - 8} baris lagi</p>
            )}
          </div>
        )}
      </div>
    </Dialog>
  )
}
