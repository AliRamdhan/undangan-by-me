import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import {
  Add01Icon,
  Delete02Icon,
  Download04Icon,
  FileSearchIcon,
  Link04Icon,
  Search01Icon,
  Upload04Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
// HIDDEN(sementara): import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'
import type { Issue } from '@/core/domain/checks'
import { exportGuestsCsv } from '@/core/domain/csv'
import { TAMU_COLUMNS } from '@/core/domain/schema'
import { /* HIDDEN(sementara): AKSES, SISI, */ type Guest, type GuestKey } from '@/core/domain/types'
import { exportGuestsXlsx } from '@/core/domain/xlsx'
import { useStore } from '@/core/store'
import { GenerateLinksDialog } from '@/components/GenerateLinksDialog'
import { MessagePreviewDialog } from '@/components/MessagePreviewDialog'
import { downloadBlob, downloadText } from '@/utils/download'
import { GuestDrawer } from '@/pages/Guests/components/GuestDrawer'
import { GuestTable, type SortState } from '@/pages/Guests/components/GuestTable'
import { ImportDialog } from '@/pages/Guests/components/ImportDialog'
import { IssuesPanel } from '@/pages/Guests/components/IssuesPanel'
// import { KIRIM_META, RSVP_META } from '@/components/StatusBadge'

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
    // HIDDEN(sementara): Grup dropped from search while segmentasi is hidden — was `${g.Grup} `
    const hay = `${g.Nama} ${g.PIN} ${g.HP} ${g.Email} ${g.Meja}`.toLowerCase()
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
      !g.PIN
      // HIDDEN(sementara): || g.HP_Valid !== '✅'
      // HIDDEN(sementara): || !(AKSES as readonly string[]).includes(g.Akses)
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

// HIDDEN(sementara): only the hidden segmentasi filters use this
// function FilterSelect({
//   label,
//   value,
//   onChange,
//   options,
// }: {
//   label: string
//   value: string
//   onChange: (v: string) => void
//   options: readonly (string | { value: string; label: string })[]
// }) {
//   return (
//     <NativeSelect
//       aria-label={label}
//       value={value}
//       onChange={(e) => onChange(e.target.value)}
//       className={cn('min-w-0 [&_select]:h-8', value && '[&_select]:border-primary [&_select]:text-primary')}
//     >
//       <NativeSelectOption value="">{label}: semua</NativeSelectOption>
//       {options.map((o) => {
//         const v = typeof o === 'string' ? o : o.value
//         const l = typeof o === 'string' ? o : o.label
//         return (
//           <NativeSelectOption key={v} value={v}>
//             {label}: {l}
//           </NativeSelectOption>
//         )
//       })}
//     </NativeSelect>
//   )
// }

function ToolGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-1.5">
      <span className="mr-0.5 hidden text-[0.625rem] font-semibold tracking-wide text-muted-foreground uppercase lg:inline">{label}</span>
      {children}
    </div>
  )
}

export function Guests() {
  const { guests, run, busy, loading } = useStore()
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
    if (n === undefined) return
    if (n) toast.success(`${n} PIN baru dibuat`)
    else toast.info('Semua tamu sudah punya PIN')
  }
  const normalize = async () => {
    const n = await run('Normalisasi HP', (api) => api.normalizePhones())
    if (n === undefined) return
    if (n) toast.success(`${n} nomor dinormalisasi ke +62…`)
    else toast.info('Semua nomor sudah rapi')
  }
  const check = async () => {
    const r = await run('Cek Duplikat & Error', (api) => api.checkGuests())
    // HIDDEN(sementara): quota is hidden, so its over-quota issues are too.
    // HIDDEN(sementara): Akses is hidden too, so its issues are as well.
    if (r) setIssues(r.filter((i) => i.kind !== 'LEBIH_KUOTA' && i.kind !== 'AKSES_INVALID'))
  }
  const exportRows = () => (selectedGuests.length ? selectedGuests : visible)
  const exportName = (ext: string) => `02_Tamu_${new Date().toISOString().slice(0, 10)}.${ext}`
  const exportCsv = () => downloadText(exportName('csv'), exportGuestsCsv(exportRows()))
  const exportXlsx = async () => downloadBlob(exportName('xlsx'), await exportGuestsXlsx(exportRows()))
  const deleteSelected = async () => {
    const n = await run('Hapus tamu', (api) => api.deleteGuests(selectedGuests.map((g) => g.ID)))
    setConfirmDelete(false)
    if (n) toast.success(`${n} tamu dihapus`)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {/* Menu → Tamu, as buttons: discoverable on first open, no training needed. */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <Button size="lg" onClick={() => setDrawer({ guest: null, isNew: true })}>
          <HugeiconsIcon icon={Add01Icon} strokeWidth={2} data-icon="inline-start" />
          Tambah Tamu
        </Button>
        <ToolGroup label="Tamu">
          <Button variant="outline" onClick={genPins} disabled={!!busy}>
            Generate PIN
          </Button>
          <Button variant="outline" onClick={normalize} disabled={!!busy}>
            Normalisasi HP
          </Button>
          <Button variant="outline" onClick={check} disabled={!!busy}>
            <HugeiconsIcon icon={FileSearchIcon} strokeWidth={2} data-icon="inline-start" />
            Cek Duplikat & Error
          </Button>
        </ToolGroup>
        <Separator orientation="vertical" className="hidden h-6 lg:block" />
        <ToolGroup label="Data">
          <Button variant="outline" onClick={() => setImportOpen(true)} disabled={!!busy}>
            <HugeiconsIcon icon={Upload04Icon} strokeWidth={2} data-icon="inline-start" />
            Import
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" disabled={!visible.length} />}>
              <HugeiconsIcon icon={Download04Icon} strokeWidth={2} data-icon="inline-start" />
              Export{selectedGuests.length ? ` (${selectedGuests.length})` : ''}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
              <DropdownMenuItem onClick={exportCsv}>CSV (.csv)</DropdownMenuItem>
              <DropdownMenuItem onClick={exportXlsx}>Excel (.xlsx)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </ToolGroup>
        <Separator orientation="vertical" className="hidden h-6 lg:block" />
        <ToolGroup label="Pesan">
          <Button variant="outline" onClick={() => setLinksOpen(true)} disabled={!!busy || !guests.length}>
            <HugeiconsIcon icon={Link04Icon} strokeWidth={2} data-icon="inline-start" />
            Generate Link Manual{selectedGuests.length ? ` (${selectedGuests.length})` : ''}
          </Button>
        </ToolGroup>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <HugeiconsIcon
            icon={Search01Icon}
            strokeWidth={2}
            className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            aria-label="Cari tamu"
            placeholder="Cari nama, PIN, HP…"
            value={filters.q}
            onChange={(e) => setF('q')(e.target.value)}
            className="h-8 pl-7"
          />
        </div>
        {/* HIDDEN(sementara): segmentasi filters
        <FilterSelect label="Akses" value={filters.akses} onChange={setF('akses')} options={AKSES} />
        <FilterSelect label="Sisi" value={filters.sisi} onChange={setF('sisi')} options={SISI} />
        <FilterSelect label="Grup" value={filters.grup} onChange={setF('grup')} options={groups} />
        */}
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
        <Label
          className={cn(
            'h-8 cursor-pointer rounded-md border px-2.5 font-normal',
            filters.masalah ? 'border-primary text-primary' : 'text-muted-foreground',
          )}
        >
          <Checkbox checked={filters.masalah} onCheckedChange={(on) => setF('masalah')(on)} />
          Bermasalah saja
        </Label>
        {activeFilters > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setFilters(NO_FILTERS)}>
            Reset filter
          </Button>
        )}
        <ToggleGroup
          aria-label="Kolom"
          variant="outline"
          spacing={0}
          className="ml-auto"
          value={[compact ? 'ringkas' : 'semua']}
          onValueChange={(v) => v.length && setCompact(v[0] === 'ringkas')}
        >
          <ToggleGroupItem value="ringkas">Ringkas</ToggleGroupItem>
          <ToggleGroupItem value="semua">Semua {TAMU_COLUMNS.length} kolom</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {selectedGuests.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-primary-soft px-3 py-2 text-sm">
          <b>{selectedGuests.length} tamu terpilih</b>
          <Button variant="ghost" onClick={() => setIds(new Set())}>
            Batal pilih
          </Button>
          <Button variant="destructive" className="ml-auto" onClick={() => setConfirmDelete(true)} disabled={!!busy}>
            <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} data-icon="inline-start" />
            Hapus terpilih
          </Button>
        </div>
      )}

      <div className="relative max-h-[75dvh] min-h-80 flex-1 overflow-auto rounded-lg border bg-card lg:max-h-[calc(100dvh-230px)]">
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-8" />
            ))}
          </div>
        ) : guests.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Belum ada tamu</EmptyTitle>
              <EmptyDescription>
                Tambah satu per satu, atau <b>Import</b> CSV/Excel dengan kolom Gelar, Nama, HP. PIN dibuat otomatis.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : visible.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Tidak ada tamu yang cocok</EmptyTitle>
              <EmptyDescription>Ubah kata kunci atau reset filter.</EmptyDescription>
            </EmptyHeader>
          </Empty>
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
        {' · '}Kolom abu-abu bertanda ⚙ diisi otomatis. Klik nama untuk mengedit.
      </p>

      {drawer && (
        <GuestDrawer
          key={drawer.isNew ? 'new' : drawer.guest?.ID}
          open
          guest={drawer.guest}
          isNew={drawer.isNew}
          groups={groups}
          onClose={() => setDrawer(null)}
          onPreview={(g) => setPreview(g)}
        />
      )}
      <MessagePreviewDialog guest={preview} onClose={() => setPreview(null)} />
      <IssuesPanel issues={issues} onClose={() => setIssues(null)} onJump={jumpTo} />
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
      <GenerateLinksDialog
        open={linksOpen}
        onClose={() => setLinksOpen(false)}
        selection={selectedGuests.length ? selectedGuests.map((g) => g.ID) : null}
      />
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus {selectedGuests.length} tamu terpilih?</AlertDialogTitle>
            <AlertDialogDescription>
              Baris dihapus dari 02_Tamu. Riwayat di 04_Log dan 05_RSVP tetap ada. Tindakan ini tidak bisa dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="max-h-48 overflow-y-auto text-sm">
            {selectedGuests.map((g) => (
              <li key={g.No} className="truncate">
                · {g.Nama || '(tanpa nama)'} <span className="font-mono text-muted-foreground">{g.PIN}</span>
              </li>
            ))}
          </ul>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={deleteSelected} disabled={!!busy}>
              Hapus {selectedGuests.length} tamu
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
