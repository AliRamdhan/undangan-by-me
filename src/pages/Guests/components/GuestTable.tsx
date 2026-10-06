import { ArrowDown01Icon, ArrowUp01Icon, Copy01Icon, LinkSquare02Icon, Settings02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type { ReactNode } from 'react'
import { toast } from 'sonner'
import { Button, buttonVariants } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { linkLocal } from '@/core/domain/link'
import { FROZEN_COUNT, ZONE_LABEL, type Column, type Zone } from '@/core/domain/schema'
import { AKSES, type Guest, type GuestKey } from '@/core/domain/types'
import { useStore } from '@/core/store'
// HIDDEN(sementara): import { KirimBadge, RsvpBadge } from '@/components/StatusBadge'

export type SortState = { key: GuestKey; dir: 1 | -1 } | null

const CHECK_W = 40
const HEAD_H = 26

/** 6px band colour + a faint tint behind the header — the six zones of UIUX.md. */
const zoneStyle = (z: Zone) => ({
  borderTop: `3px solid var(--zone-${z})`,
  background: `color-mix(in oklab, var(--zone-${z}) 10%, var(--surface))`,
})

function hasData(g: Guest) {
  return [g.PIN, g.Gelar, g.HP, g.Email, g.Grup].some((v) => v.trim() !== '')
}

/** Row-level conditional formatting: GAGAL, or data present but Nama empty → red row. */
function rowCritical(g: Guest): boolean {
  // HIDDEN(sementara): g.Status_Kirim === 'GAGAL' ||
  return !g.Nama.trim() && hasData(g)
}

/** Cell-level conditional formatting (UIUX.md § Conditional formatting). */
function cellTint(g: Guest, key: GuestKey): string {
  switch (key) {
    // HIDDEN(sementara): orange HP tint comes from HP_Valid
    // case 'HP':
    // case 'HP_Valid':
    //   return g.HP_Valid !== '✅' ? 'tint-serious' : ''
    // case 'RSVP_S1':
    //   return g.RSVP_S1 > g.Q_S1 ? 'tint-critical text-critical-ink font-semibold' : ''
    // case 'RSVP_S2':
    //   return g.RSVP_S2 > g.Q_S2 ? 'tint-critical text-critical-ink font-semibold' : ''
    case 'Nama':
      return !g.Nama.trim() ? 'tint-critical' : ''
    case 'Akses':
      return g.Akses && !(AKSES as readonly string[]).includes(g.Akses) ? 'tint-critical' : ''
    default:
      return ''
  }
}

/** Copies the guest's invitation page on this app, e.g. `http://localhost:5173/events/fidaeno/104729`. */
async function copyLink(slug: string, pin: string) {
  const link = linkLocal(window.location.origin, slug, pin)
  if (!link) return toast.error('Slug event belum diisi — isi di Data Event')
  try {
    await navigator.clipboard.writeText(link)
    toast.success('Link undangan disalin', { description: link })
  } catch {
    toast.error('Tidak bisa menyalin — izin clipboard ditolak')
  }
}

/** Copies the same message Link_WA opens — for sharing outside WhatsApp. */
async function copyMessage(text: string) {
  if (!text.trim()) return toast.error('Pesan belum dibuat — jalankan Generate Link dulu')
  try {
    await navigator.clipboard.writeText(text)
    toast.success('Pesan disalin', { description: 'Tempel di medsos lain' })
  } catch {
    toast.error('Tidak bisa menyalin — izin clipboard ditolak')
  }
}

function renderCell(g: Guest, col: Column, onOpen: (g: Guest) => void, slug: string): ReactNode {
  const v = g[col.key]
  switch (col.key) {
    // case 'No':
    //   return <span className="text-ink-3 tabular-nums">{g.No}</span>
    case 'PIN':
      return g.PIN ? (
        <span className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => copyLink(slug, g.PIN)}
            title="Klik untuk menyalin link undangan"
            className="cursor-pointer font-mono hover:text-primary"
          >
            {g.PIN}
          </button>
          <button
            type="button"
            onClick={() => copyMessage(g.Preview_Pesan)}
            title={g.Preview_Pesan ? 'Salin pesan undangan (untuk medsos selain WA)' : 'Pesan belum dibuat — jalankan Generate Link'}
            aria-label="Salin pesan undangan"
            className={`shrink-0 cursor-pointer hover:text-primary ${g.Preview_Pesan ? 'text-ink-2' : 'text-ink-3 opacity-50'}`}
          >
            <HugeiconsIcon icon={Copy01Icon} strokeWidth={2} className="size-3.5" />
          </button>
        </span>
      ) : (
        <span className="text-ink-3 italic">kosong</span>
      )
    case 'HP':
      return <span className="font-mono">{g.HP || <span className="font-sans text-ink-3 italic">—</span>}</span>
    case 'Nama':
      return (
        <Button variant="link" onClick={() => onOpen(g)} className="h-auto max-w-full justify-start truncate p-0 text-[13px] text-foreground hover:text-primary">
          {g.Nama || <span className="text-critical-ink italic">(tanpa nama)</span>}
        </Button>
      )
    // case 'Status_RSVP':
    //   return <RsvpBadge status={g.Status_RSVP} />
    // case 'Status_Kirim':
    //   return <KirimBadge status={g.Status_Kirim} title={g.Kirim_Error || undefined} />
    case 'Link_Undangan':
      return g.Link_Undangan ? (
        <a href={g.Link_Undangan} target="_blank" rel="noreferrer" className="font-mono text-xs text-primary hover:underline">
          {g.Link_Undangan.replace(/^https?:\/\//, '')}
        </a>
      ) : null
    case 'Link_WA':
      return g.Link_WA ? (
        <a href={g.Link_WA} target="_blank" rel="noreferrer" className={buttonVariants({ variant: 'secondary', size: 'sm', className: 'text-good-ink' })}>
          Buka WA
          <HugeiconsIcon icon={LinkSquare02Icon} strokeWidth={2} data-icon="inline-end" />
        </a>
      ) : (
        <span className="text-xs text-ink-3">—</span>
      )
    // case 'Q_S1':
    // case 'Q_S2':
    // case 'RSVP_S1':
    // case 'RSVP_S2':
    // case 'Kirim_Count':
    //   return <span className="tabular-nums">{String(v)}</span>
    default:
      return <span title={String(v)}>{String(v)}</span>
  }
}

const NARROW = '(max-width: 640px)'

export function GuestTable({
  guests,
  columns,
  selected,
  onToggle,
  onToggleAll,
  onOpen,
  sort,
  onSort,
  flashNo,
}: {
  guests: Guest[]
  columns: Column[]
  selected: ReadonlySet<number>
  onToggle: (no: number) => void
  onToggleAll: (on: boolean) => void
  onOpen: (g: Guest) => void
  sort: SortState
  onSort: (key: GuestKey) => void
  flashNo: number | null
}) {
  // Desktop freezes A–D. A phone can't fit ~450px of frozen columns, so there
  // only Nama sticks (No/PIN/Gelar scroll underneath it) — the name stays visible.
  const narrow = useMediaQuery(NARROW)
  const slug = useStore().meta?.event.slug ?? ''
  const frozen = (i: number) => (narrow ? columns[i]?.key === 'Nama' : i < FROZEN_COUNT)
  const left: number[] = []
  let acc = CHECK_W
  columns.forEach((c, i) => {
    left.push(narrow ? CHECK_W : acc)
    if (frozen(i)) acc += c.width
  })
  const lastFrozen = narrow ? columns.findIndex((c) => c.key === 'Nama') : FROZEN_COUNT - 1

  // Consecutive visible columns sharing a zone become one band cell; a band never
  // straddles the frozen edge. Bands only stick horizontally on desktop.
  const bands: { zone: Zone; span: number; start: number }[] = []
  columns.forEach((c, i) => {
    const last = bands.at(-1)
    if (last && last.zone === c.zone && frozen(i) === frozen(i - 1)) last.span++
    else bands.push({ zone: c.zone, span: 1, start: i })
  })

  const allOn = guests.length > 0 && guests.every((g) => selected.has(g.No))
  const someOn = guests.some((g) => selected.has(g.No))
  const stickyShadow = 'shadow-[inset_-1px_0_0_var(--line),4px_0_6px_-4px_rgba(0,0,0,0.12)]'

  return (
    <Table containerClassName="overflow-visible" className="w-max min-w-full border-separate border-spacing-0 text-[13px]">
      <colgroup>
        <col style={{ width: CHECK_W }} />
        {columns.map((c) => (
          <col key={c.key} style={{ width: c.width }} />
        ))}
      </colgroup>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead
            className="sticky top-0 left-0 z-30 border-b border-line bg-surface"
            style={{ height: HEAD_H }}
            aria-hidden
          />
          {bands.map((b) => {
            const isFrozen = !narrow && frozen(b.start)
            return (
              <TableHead
                key={b.start}
                colSpan={b.span}
                scope="colgroup"
                className={`sticky top-0 border-b border-line px-2 text-left text-[11px] font-semibold tracking-wide whitespace-nowrap text-ink-2 uppercase ${isFrozen ? 'z-30' : 'z-20'} ${isFrozen && b.start + b.span - 1 === lastFrozen ? stickyShadow : ''}`}
                style={{ ...zoneStyle(b.zone), height: HEAD_H, left: isFrozen ? left[b.start] : undefined }}
              >
                {ZONE_LABEL[b.zone]}
              </TableHead>
            )
          })}
        </TableRow>
        <TableRow className="hover:bg-transparent">
          <TableHead
            className="sticky left-0 z-30 border-b border-line bg-surface px-2"
            style={{ top: HEAD_H }}
          >
            <Checkbox
              aria-label="Pilih semua baris yang tampil"
              checked={allOn}
              indeterminate={someOn && !allOn}
              onCheckedChange={(on) => onToggleAll(on)}
            />
          </TableHead>
          {columns.map((c, i) => {
            const active = sort?.key === c.key
            return (
              <TableHead
                key={c.key}
                scope="col"
                aria-sort={active ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}
                className={`sticky border-b border-line px-0 text-left font-semibold whitespace-nowrap ${frozen(i) ? 'z-30' : 'z-20'} ${c.owner !== 'manual' ? 'bg-surface-2 text-ink-2' : 'bg-surface text-ink'} ${i === lastFrozen ? stickyShadow : ''}`}
                style={{ top: HEAD_H, left: frozen(i) ? left[i] : undefined }}
              >
                <button
                  type="button"
                  onClick={() => onSort(c.key)}
                  className="flex h-9 w-full items-center gap-1 px-2 text-left hover:text-primary"
                  title={`Kolom ${c.col} · ${c.owner === 'manual' ? 'diisi manual' : c.owner === 'formula' ? 'formula (otomatis)' : 'diisi script (otomatis)'}`}
                >
                  <span className="text-[10px] font-normal text-ink-3">{c.col}</span>
                  <span className="truncate">{c.key}</span>
                  {c.owner !== 'manual' && (
                    <HugeiconsIcon icon={Settings02Icon} strokeWidth={2} aria-label="otomatis" className="size-3 shrink-0 text-ink-3" />
                  )}
                  <HugeiconsIcon
                    icon={active && sort.dir === -1 ? ArrowDown01Icon : ArrowUp01Icon}
                    strokeWidth={2}
                    aria-hidden
                    className={`ml-auto size-3 shrink-0 ${active ? 'text-primary' : 'text-transparent'}`}
                  />
                </button>
              </TableHead>
            )
          })}
        </TableRow>
      </TableHeader>
      <TableBody>
        {guests.map((g) => {
          const isSel = selected.has(g.No)
          const crit = rowCritical(g)
          return (
            <TableRow
              key={g.ID}
              id={`row-${g.No}`}
              className={`group ${flashNo === g.No ? 'row-flash' : ''}`}
            >
              <TableCell
                className={`sticky left-0 z-10 border-b border-line px-2 ${isSel ? 'bg-primary-soft' : crit ? 'tint-row-critical' : 'bg-surface'}`}
              >
                <Checkbox
                  aria-label={`Pilih ${g.Nama || `baris ${g.No}`}`}
                  checked={isSel}
                  onCheckedChange={() => onToggle(g.No)}
                />
              </TableCell>
              {columns.map((c, i) => {
                const tint = cellTint(g, c.key)
                // Cell tint beats row tint beats the grey "automatic column" base.
                const base = tint || (crit ? 'tint-row-critical' : c.owner !== 'manual' ? 'bg-surface-2' : 'bg-surface')
                return (
                  <TableCell
                    key={c.key}
                    className={`h-10 max-w-0 truncate border-b border-line px-2 ${base} ${frozen(i) ? 'sticky z-10' : ''} ${i === lastFrozen ? stickyShadow : ''} group-hover:brightness-[0.97] dark:group-hover:brightness-110`}
                    style={{ left: frozen(i) ? left[i] : undefined }}
                  >
                    {renderCell(g, c, onOpen, slug)}
                  </TableCell>
                )
              })}
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
