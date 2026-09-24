import { useSyncExternalStore, type ReactNode } from 'react'
import { FROZEN_COUNT, ZONE_LABEL, type Column, type Zone } from '../../domain/schema'
import { AKSES, type Guest, type GuestKey } from '../../domain/types'
// HIDDEN(sementara): import { KirimBadge, RsvpBadge } from './status'

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

function renderCell(g: Guest, col: Column, onOpen: (g: Guest) => void): ReactNode {
  const v = g[col.key]
  switch (col.key) {
    case 'No':
      return <span className="text-ink-3 tabular-nums">{g.No}</span>
    case 'PIN':
      return g.PIN ? <span className="font-mono">{g.PIN}</span> : <span className="text-ink-3 italic">kosong</span>
    case 'HP':
      return <span className="font-mono">{g.HP || <span className="font-sans text-ink-3 italic">—</span>}</span>
    case 'Nama':
      return (
        <button
          type="button"
          onClick={() => onOpen(g)}
          className="max-w-full truncate text-left font-medium text-ink underline-offset-2 hover:text-accent hover:underline"
        >
          {g.Nama || <span className="text-critical-ink italic">(tanpa nama)</span>}
        </button>
      )
    // case 'Status_RSVP':
    //   return <RsvpBadge status={g.Status_RSVP} />
    // case 'Status_Kirim':
    //   return <KirimBadge status={g.Status_Kirim} title={g.Kirim_Error || undefined} />
    case 'Link_Undangan':
      return g.Link_Undangan ? (
        <a href={g.Link_Undangan} target="_blank" rel="noreferrer" className="font-mono text-xs text-accent hover:underline">
          {g.Link_Undangan.replace(/^https?:\/\//, '')}
        </a>
      ) : null
    case 'Link_WA':
      return g.Link_WA ? (
        <a
          href={g.Link_WA}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-6 items-center rounded-md bg-[#25d366]/15 px-2 text-xs font-medium text-good-ink hover:bg-[#25d366]/25"
        >
          Buka WA ↗
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
function useNarrow(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(NARROW)
      m.addEventListener('change', cb)
      return () => m.removeEventListener('change', cb)
    },
    () => window.matchMedia(NARROW).matches,
  )
}

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
  const narrow = useNarrow()
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
    <table className="w-max min-w-full border-separate border-spacing-0 text-[13px]">
      <colgroup>
        <col style={{ width: CHECK_W }} />
        {columns.map((c) => (
          <col key={c.key} style={{ width: c.width }} />
        ))}
      </colgroup>
      <thead>
        <tr>
          <th
            className="sticky top-0 left-0 z-30 border-b border-line bg-surface"
            style={{ height: HEAD_H }}
            aria-hidden
          />
          {bands.map((b) => {
            const isFrozen = !narrow && frozen(b.start)
            return (
              <th
                key={b.start}
                colSpan={b.span}
                scope="colgroup"
                className={`sticky top-0 border-b border-line px-2 text-left text-[11px] font-semibold tracking-wide whitespace-nowrap text-ink-2 uppercase ${isFrozen ? 'z-30' : 'z-20'} ${isFrozen && b.start + b.span - 1 === lastFrozen ? stickyShadow : ''}`}
                style={{ ...zoneStyle(b.zone), height: HEAD_H, left: isFrozen ? left[b.start] : undefined }}
              >
                {ZONE_LABEL[b.zone]}
              </th>
            )
          })}
        </tr>
        <tr>
          <th
            className="sticky left-0 z-30 border-b border-line bg-surface px-2"
            style={{ top: HEAD_H }}
          >
            <input
              type="checkbox"
              aria-label="Pilih semua baris yang tampil"
              checked={allOn}
              ref={(el) => {
                if (el) el.indeterminate = someOn && !allOn
              }}
              onChange={(e) => onToggleAll(e.target.checked)}
              className="size-4 accent-[var(--accent)]"
            />
          </th>
          {columns.map((c, i) => {
            const active = sort?.key === c.key
            return (
              <th
                key={c.key}
                scope="col"
                aria-sort={active ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}
                className={`sticky border-b border-line px-0 text-left font-semibold whitespace-nowrap ${frozen(i) ? 'z-30' : 'z-20'} ${c.owner !== 'manual' ? 'bg-surface-2 text-ink-2' : 'bg-surface text-ink'} ${i === lastFrozen ? stickyShadow : ''}`}
                style={{ top: HEAD_H, left: frozen(i) ? left[i] : undefined }}
              >
                <button
                  type="button"
                  onClick={() => onSort(c.key)}
                  className="flex h-9 w-full items-center gap-1 px-2 text-left hover:text-accent"
                  title={`Kolom ${c.col} · ${c.owner === 'manual' ? 'diisi manual' : c.owner === 'formula' ? 'formula (otomatis)' : 'diisi script (otomatis)'}`}
                >
                  <span className="text-[10px] font-normal text-ink-3">{c.col}</span>
                  <span className="truncate">{c.key}</span>
                  {c.owner !== 'manual' && (
                    <span aria-label="otomatis" className="text-[10px] text-ink-3">
                      ⚙
                    </span>
                  )}
                  <span aria-hidden className={`ml-auto text-[10px] ${active ? 'text-accent' : 'text-transparent'}`}>
                    {active && sort.dir === -1 ? '▼' : '▲'}
                  </span>
                </button>
              </th>
            )
          })}
        </tr>
      </thead>
      <tbody>
        {guests.map((g) => {
          const isSel = selected.has(g.No)
          const crit = rowCritical(g)
          return (
            <tr
              key={`${g.No}-${g.PIN}`}
              id={`row-${g.No}`}
              className={`group ${flashNo === g.No ? 'row-flash' : ''}`}
            >
              <td
                className={`sticky left-0 z-10 border-b border-line px-2 ${isSel ? 'bg-accent-soft' : crit ? 'tint-row-critical' : 'bg-surface'}`}
              >
                <input
                  type="checkbox"
                  aria-label={`Pilih ${g.Nama || `baris ${g.No}`}`}
                  checked={isSel}
                  onChange={() => onToggle(g.No)}
                  className="size-4 accent-[var(--accent)]"
                />
              </td>
              {columns.map((c, i) => {
                const tint = cellTint(g, c.key)
                // Cell tint beats row tint beats the grey "automatic column" base.
                const base = tint || (crit ? 'tint-row-critical' : c.owner !== 'manual' ? 'bg-surface-2' : 'bg-surface')
                return (
                  <td
                    key={c.key}
                    className={`h-10 max-w-0 truncate border-b border-line px-2 ${base} ${frozen(i) ? 'sticky z-10' : ''} ${i === lastFrozen ? stickyShadow : ''} group-hover:brightness-[0.97] dark:group-hover:brightness-110`}
                    style={{ left: frozen(i) ? left[i] : undefined }}
                  >
                    {renderCell(g, c, onOpen)}
                  </td>
                )
              })}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
