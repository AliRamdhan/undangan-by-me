import { useState, type ReactNode } from 'react'
import { refOf } from '../../api/types'
import { Button, Dialog, EmptyState, fieldBase } from '../../components/ui'
import type { Issue } from '../../domain/checks'
import { exportGuestsCsv } from '../../domain/csv'
import { TAMU_COLUMNS } from '../../domain/schema'
import { AKSES, SISI, type Guest, type GuestKey } from '../../domain/types'
import { useStore } from '../../state/store'
import { LinksDialog } from '../templates/LinksDialog'
import { PreviewDialog } from '../templates/PreviewDialog'
import { downloadText } from './download'
import { GuestDrawer } from './GuestDrawer'
import { GuestTable, type SortState } from './GuestTable'
import { ImportDialog } from './ImportDialog'
import { IssuesPanel } from './IssuesPanel'
// import { KIRIM_META, RSVP_META } from './statusMeta'

interface Filters {
  q: string
  akses: string
  sisi: string
  grup: string
  rsvp: string
  kirim: string
  masalah: boolean
}

const NO_FILTERS: Filters = { q: '', akses: '', sisi: '', grup: '', rsvp: '', kirim: '', masalah: false }

function matches(g: Guest, f: Filters): boolean {
  if (f.q) {
    const q = f.q.toLowerCase()
    const hay = `${g.Nama} ${g.PIN} ${g.HP} ${g.Grup} ${g.Email} ${g.Meja}`.toLowerCase()
    if (!hay.includes(q) && !g.HP.replace(/\D/g, '').includes(q.replace(/\D/g, '') || '\0')) return false
  }
  if (f.akses && g.Akses !== f.akses) return false
  if (f.sisi && g.Sisi !== f.sisi) return false
  if (f.grup && g.Grup !== f.grup) return false
  // if (f.rsvp && g.Status_RSVP !== f.rsvp) return false
  // if (f.kirim && g.Status_Kirim !== f.kirim) return false
  if (f.masalah) {
    const bad =
      !g.Nama.trim() ||
      !g.PIN ||
      // HIDDEN(sementara): g.HP_Valid !== '✅' ||
      !(AKSES as readonly string[]).includes(g.Akses)
      // HIDDEN(sementara):
      // || g.RSVP_S1 > g.Q_S1 ||
      // g.RSVP_S2 > g.Q_S2 ||
      // g.Status_Kirim === 'GAGAL'
    if (!bad) return false
  }
  return true
}

function compare(a: Guest, b: Guest, key: GuestKey): number {
  const x = a[key]
  const y = b[key]
  if (typeof x === 'number' && typeof y === 'number') return x - y
  return String(x).localeCompare(String(y), 'id', { numeric: true, sensitivity: 'base' })
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: readonly (string | { value: string; label: string })[]
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${fieldBase} h-9 w-auto min-w-0 pr-7 ${value ? 'border-accent text-accent' : 'text-ink-2'}`}
    >
      <option value="">{label}: semua</option>
      {options.map((o) => {
        const v = typeof o === 'string' ? o : o.value
        const l = typeof o === 'string' ? o : o.label
        return (
          <option key={v} value={v}>
            {label}: {l}
          </option>
        )
      })}
    </select>
  )
}

function ToolGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-1.5">
      <span className="mr-0.5 hidden text-[11px] font-semibold tracking-wide text-ink-3 uppercase lg:inline">{label}</span>
      {children}
    </div>
  )
}

export function GuestsPage() {
  const { guests, run, busy, toast, loading } = useStore()
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)
  const [compact, setCompact] = useState(true)
  const [sort, setSort] = useState<SortState>(null)
  // Selection is tied to the snapshot it was made on: any reload clears it,
  // so a bulk action can never hit rows that moved underneath.
  const [sel, setSel] = useState<{ src: Guest[]; ids: Set<number> }>({ src: guests, ids: new Set() })
  const selected = sel.src === guests ? sel.ids : new Set<number>()
  const [drawer, setDrawer] = useState<{ guest: Guest | null; isNew: boolean } | null>(null)
  const [preview, setPreview] = useState<Guest | null>(null)
  const [issues, setIssues] = useState<Issue[] | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [linksOpen, setLinksOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [flashNo, setFlashNo] = useState<number | null>(null)

  const columns = TAMU_COLUMNS.filter((c) => !compact || c.compact)
  const groups = [...new Set(guests.map((g) => g.Grup).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'id'))
  let visible = guests.filter((g) => matches(g, filters))
  if (sort) visible = [...visible].sort((a, b) => compare(a, b, sort.key) * sort.dir)
  const selectedGuests = guests.filter((g) => selected.has(g.No))
  const activeFilters = Object.entries(filters).filter(([, v]) => v !== '' && v !== false).length

  const setF = <K extends keyof Filters>(k: K) => (v: Filters[K]) => setFilters((f) => ({ ...f, [k]: v }))
  const setIds = (ids: Set<number>) => setSel({ src: guests, ids })

  const toggle = (no: number) => {
    const next = new Set(selected)
    if (next.has(no)) next.delete(no)
    else next.add(no)
    setIds(next)
  }
  const toggleAll = (on: boolean) => {
    const next = new Set(selected)
    for (const g of visible) {
      if (on) next.add(g.No)
      else next.delete(g.No)
    }
    setIds(next)
  }

  const onSort = (key: GuestKey) =>
    setSort((s) => (s?.key !== key ? { key, dir: 1 } : s.dir === 1 ? { key, dir: -1 } : null))

  const jumpTo = (no: number) => {
    setIssues(null)
    setFilters(NO_FILTERS)
    setFlashNo(no)
    requestAnimationFrame(() =>
      document.getElementById(`row-${no}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }),
    )
    setTimeout(() => setFlashNo(null), 1800)
  }

  const genPins = async () => {
    const n = await run('Generate PIN', (api) => api.generatePins())
    if (n !== undefined) toast(n ? 'ok' : 'info', n ? `${n} PIN baru dibuat` : 'Semua tamu sudah punya PIN')
  }
  const normalize = async () => {
    const n = await run('Normalisasi HP', (api) => api.normalizePhones())
    if (n !== undefined) toast(n ? 'ok' : 'info', n ? `${n} nomor dinormalisasi ke +62…` : 'Semua nomor sudah rapi')
  }
  const check = async () => {
    const r = await run('Cek Duplikat & Error', (api) => api.checkGuests())
    // HIDDEN(sementara): quota is hidden, so its over-quota issues are too.
    if (r) setIssues(r.filter((i) => i.kind !== 'LEBIH_KUOTA'))
  }
  const exportCsv = () => {
    const rows = selectedGuests.length ? selectedGuests : visible
    downloadText(`02_Tamu_${new Date().toISOString().slice(0, 10)}.csv`, exportGuestsCsv(rows))
  }
  const deleteSelected = async () => {
    const n = await run('Hapus tamu', (api) => api.deleteGuests(selectedGuests.map(refOf)))
    setConfirmDelete(false)
    if (n) toast('ok', `${n} tamu dihapus`)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {/* Menu → Tamu, as buttons: discoverable on first open, no training needed. */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <Button variant="primary" onClick={() => setDrawer({ guest: null, isNew: true })}>
          + Tambah Tamu
        </Button>
        <ToolGroup label="Tamu">
          <Button size="sm" onClick={genPins} disabled={!!busy}>
            Generate PIN
          </Button>
          <Button size="sm" onClick={normalize} disabled={!!busy}>
            Normalisasi HP
          </Button>
          <Button size="sm" onClick={check} disabled={!!busy}>
            Cek Duplikat & Error
          </Button>
        </ToolGroup>
        <ToolGroup label="Data">
          <Button size="sm" onClick={() => setImportOpen(true)} disabled={!!busy}>
            Import CSV
          </Button>
          <Button size="sm" onClick={exportCsv} disabled={!visible.length}>
            Export CSV{selectedGuests.length ? ` (${selectedGuests.length})` : ''}
          </Button>
        </ToolGroup>
        <ToolGroup label="Pesan">
          <Button size="sm" onClick={() => setLinksOpen(true)} disabled={!!busy || !guests.length}>
            Generate Link Manual{selectedGuests.length ? ` (${selectedGuests.length})` : ''}
          </Button>
        </ToolGroup>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          aria-label="Cari tamu"
          placeholder="Cari nama, PIN, HP, grup…"
          value={filters.q}
          onChange={(e) => setF('q')(e.target.value)}
          className={`${fieldBase} h-9 w-full sm:w-64`}
        />
        <FilterSelect label="Akses" value={filters.akses} onChange={setF('akses')} options={AKSES} />
        <FilterSelect label="Sisi" value={filters.sisi} onChange={setF('sisi')} options={SISI} />
        <FilterSelect label="Grup" value={filters.grup} onChange={setF('grup')} options={groups} />
        {/* <FilterSelect
          label="RSVP"
          value={filters.rsvp}
          onChange={setF('rsvp')}
          options={STATUS_RSVP.map((s) => ({ value: s, label: RSVP_META[s].label }))}
        /> */}
        {/* <FilterSelect
          label="Kirim"
          value={filters.kirim}
          onChange={setF('kirim')}
          options={STATUS_KIRIM.map((s) => ({ value: s, label: KIRIM_META[s].label }))}
        /> */}
        <label className={`flex h-9 cursor-pointer items-center gap-2 rounded-lg border px-2.5 text-sm ${filters.masalah ? 'border-accent text-accent' : 'border-line text-ink-2'}`}>
          <input
            type="checkbox"
            checked={filters.masalah}
            onChange={(e) => setF('masalah')(e.target.checked)}
            className="size-4 accent-[var(--accent)]"
          />
          Bermasalah saja
        </label>
        {activeFilters > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setFilters(NO_FILTERS)}>
            Reset filter
          </Button>
        )}
        <div className="ml-auto flex items-center gap-1 rounded-lg border border-line p-0.5" role="group" aria-label="Kolom">
          {[
            { on: true, label: 'Ringkas' },
            { on: false, label: `Semua ${TAMU_COLUMNS.length} kolom` },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              aria-pressed={compact === o.on}
              onClick={() => setCompact(o.on)}
              className={`h-7 rounded-md px-2.5 text-[13px] ${compact === o.on ? 'bg-surface-2 font-medium text-ink' : 'text-ink-2 hover:text-ink'}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {selectedGuests.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-accent-soft px-3 py-2 text-sm">
          <b>{selectedGuests.length} tamu terpilih</b>
          <Button size="sm" variant="ghost" onClick={() => setIds(new Set())}>
            Batal pilih
          </Button>
          <Button size="sm" variant="danger" className="ml-auto" onClick={() => setConfirmDelete(true)} disabled={!!busy}>
            Hapus terpilih
          </Button>
        </div>
      )}

      <div className="relative max-h-[75dvh] min-h-[320px] flex-1 overflow-auto rounded-xl border border-line bg-surface lg:max-h-[calc(100dvh-230px)]">
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="h-8 animate-pulse rounded bg-surface-2" />
            ))}
          </div>
        ) : guests.length === 0 ? (
          <EmptyState title="Belum ada tamu">
            Tambah satu per satu, atau <b>Import CSV</b> dengan kolom PIN…Q_S2 lalu jalankan Generate PIN.
          </EmptyState>
        ) : visible.length === 0 ? (
          <EmptyState title="Tidak ada tamu yang cocok">Ubah kata kunci atau reset filter.</EmptyState>
        ) : (
          <GuestTable
            guests={visible}
            columns={columns}
            selected={selected}
            onToggle={toggle}
            onToggleAll={toggleAll}
            onOpen={(g) => setDrawer({ guest: g, isNew: false })}
            sort={sort}
            onSort={onSort}
            flashNo={flashNo}
          />
        )}
      </div>
      <p className="text-xs text-ink-3" aria-live="polite">
        {visible.length === guests.length ? `${guests.length} tamu` : `${visible.length} dari ${guests.length} tamu`}
        {' · '}Kolom abu-abu ⚙ diisi otomatis. Klik nama untuk mengedit.
      </p>

      {drawer && (
        <GuestDrawer
          key={drawer.isNew ? 'new' : `${drawer.guest?.No}-${drawer.guest?.PIN}`}
          open
          guest={drawer.guest}
          isNew={drawer.isNew}
          groups={groups}
          onClose={() => setDrawer(null)}
          onPreview={(g) => setPreview(g)}
        />
      )}
      <PreviewDialog guest={preview} onClose={() => setPreview(null)} />
      <IssuesPanel issues={issues} onClose={() => setIssues(null)} onJump={jumpTo} />
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
      <LinksDialog
        open={linksOpen}
        onClose={() => setLinksOpen(false)}
        selection={selectedGuests.length ? selectedGuests.map(refOf) : null}
      />
      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Hapus tamu terpilih?"
        footer={
          <>
            <Button onClick={() => setConfirmDelete(false)}>Batal</Button>
            <Button variant="danger" onClick={deleteSelected} disabled={!!busy}>
              Hapus {selectedGuests.length} tamu
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-2">
          Baris dihapus dari 02_Tamu. Riwayat di 04_Log dan 05_RSVP tetap ada. Tindakan ini tidak bisa dibatalkan.
        </p>
        <ul className="mt-3 max-h-48 overflow-y-auto text-sm">
          {selectedGuests.map((g) => (
            <li key={g.No} className="truncate">
              · {g.Nama || '(tanpa nama)'} <span className="font-mono text-ink-3">{g.PIN}</span>
            </li>
          ))}
        </ul>
      </Dialog>
    </div>
  )
}
