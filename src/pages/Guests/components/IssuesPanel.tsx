import { Badge } from '@/components/ui/badge'
import { ArrowRight01Icon, CheckmarkCircle02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
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
    <Dialog open={issues !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Cek Duplikat & Error</DialogTitle>
        {issues?.length !== 0 && (
          <DialogDescription>
            <b className="text-critical-ink">{errors} error</b> harus diperbaiki sebelum blast;{' '}
            <b className="text-warning-ink">{(issues?.length ?? 0) - errors} peringatan</b> sebaiknya dicek. Klik baris
            untuk melompat ke tamu.
          </DialogDescription>
        )}
      </DialogHeader>
      {issues?.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} className="text-good-ink" />
            </EmptyMedia>
            <EmptyTitle>Tidak ada masalah</EmptyTitle>
            <EmptyDescription>Semua nama, PIN, HP, akses, dan kuota lolos pemeriksaan.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="flex max-h-[60vh] flex-col gap-5 overflow-y-auto">
          {ordered.map(([kind, list]) => (
            <section key={kind}>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Badge variant={ISSUE_SEVERITY[kind] === 'error' ? 'critical' : 'warning'}>
                  {ISSUE_SEVERITY[kind] === 'error' ? '! Error' : '⚠ Peringatan'}
                </Badge>
                {ISSUE_LABEL[kind]}
                <span className="font-normal text-muted-foreground">({list.length})</span>
              </h3>
              <ul className="divide-y overflow-hidden rounded-lg border">
                {list.map((i) => (
                  <li key={`${i.no}-${i.field}`}>
                    <button
                      type="button"
                      onClick={() => onJump(i.no)}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-muted"
                    >
                      <span className="w-10 shrink-0 text-muted-foreground tabular-nums">#{i.no}</span>
                      <span className="w-40 shrink-0 truncate font-medium">{i.nama || '(tanpa nama)'}</span>
                      <span className="min-w-0 flex-1 truncate text-muted-foreground">{i.message}</span>
                      <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="size-3.5 text-muted-foreground" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      </DialogContent>
    </Dialog>
  )
}
