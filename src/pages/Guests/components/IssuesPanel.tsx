import { Badge } from '@/components/Badge'
import { Dialog } from '@/components/Dialog'
import { ISSUE_LABEL, ISSUE_SEVERITY, type Issue, type IssueKind } from '@/core/domain/checks'

/** Result of Tamu → Cek Duplikat & Error, grouped by fault, each row one click from the table. */
export function IssuesPanel({
  issues,
  onClose,
  onJump,
}: {
  issues: Issue[] | null
  onClose: () => void
  onJump: (no: number) => void
}) {
  const groups = new Map<IssueKind, Issue[]>()
  for (const i of issues ?? []) groups.set(i.kind, [...(groups.get(i.kind) ?? []), i])
  const ordered = [...groups.entries()].sort(
    ([a], [b]) => Number(ISSUE_SEVERITY[a] === 'warning') - Number(ISSUE_SEVERITY[b] === 'warning'),
  )
  const errors = (issues ?? []).filter((i) => ISSUE_SEVERITY[i.kind] === 'error').length

  return (
    <Dialog open={issues !== null} onClose={onClose} wide title="Cek Duplikat & Error">
      {issues?.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <span className="text-3xl" aria-hidden>
            ✅
          </span>
          <p className="font-medium">Tidak ada masalah</p>
          <p className="text-sm text-ink-2">Semua nama, PIN, HP, akses, dan kuota lolos pemeriksaan.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <p className="text-sm text-ink-2">
            <b className="text-critical-ink">{errors} error</b> harus diperbaiki sebelum blast;{' '}
            <b className="text-warning-ink">{(issues?.length ?? 0) - errors} peringatan</b> sebaiknya dicek. Klik baris
            untuk melompat ke tamu.
          </p>
          {ordered.map(([kind, list]) => (
            <section key={kind}>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Badge tone={ISSUE_SEVERITY[kind] === 'error' ? 'critical' : 'warning'}>
                  {ISSUE_SEVERITY[kind] === 'error' ? '! Error' : '⚠ Peringatan'}
                </Badge>
                {ISSUE_LABEL[kind]}
                <span className="font-normal text-ink-3">({list.length})</span>
              </h3>
              <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line">
                {list.map((i) => (
                  <li key={`${i.no}-${i.field}`}>
                    <button
                      type="button"
                      onClick={() => onJump(i.no)}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-surface-2"
                    >
                      <span className="w-10 shrink-0 text-ink-3 tabular-nums">#{i.no}</span>
                      <span className="w-40 shrink-0 truncate font-medium">{i.nama || '(tanpa nama)'}</span>
                      <span className="min-w-0 flex-1 truncate text-ink-2">{i.message}</span>
                      <span aria-hidden className="text-ink-3">
                        →
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Dialog>
  )
}
