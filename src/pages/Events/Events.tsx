import { Add01Icon, Calendar03Icon, Delete02Icon, UserMultipleIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
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
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import type { EventSummary } from '@/core/api/types'
import { useAuth } from '@/core/auth'
import { EVENT_TIPE } from '@/core/domain/types'
import { formatTanggal } from '@/core/domain/template'
import { errorText, useEventList } from '@/core/store'
import { eventPaths, PATHS } from '@/route.paths'

const tipeLabel = (v: string) => EVENT_TIPE.find((t) => t.value === v)?.label ?? v

/** GET /event — every event in the spreadsheet (SUPER_ADMIN only). */
export function Events() {
  const { app } = useAuth()
  const { events, error, reload } = useEventList()
  const [toDelete, setToDelete] = useState<EventSummary | null>(null)
  const [deleting, setDeleting] = useState(false)

  const remove = async () => {
    if (!toDelete) return
    setDeleting(true)
    try {
      const r = await app.deleteEvent(toDelete.slug)
      toast.success(`Event dihapus — ${r.tamu} tamu, ${r.template} template, ${r.sesi} sesi, ${r.akun} akun klien ikut terhapus`)
      setToDelete(null)
      await reload()
    } catch (e) {
      toast.error(`Hapus event: ${errorText(e)}`)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="mr-auto">
          <h1 className="text-lg font-semibold tracking-wide text-primary uppercase">Event</h1>
          <p className="text-muted-foreground">Pilih event untuk mengelola data, tamu dan template-nya.</p>
        </div>
        <Link to={PATHS.newEvent} className={buttonVariants({ size: 'lg' })}>
          <HugeiconsIcon icon={Add01Icon} strokeWidth={2} data-icon="inline-start" />
          Buat event
        </Link>
      </div>
      <Separator />

      {error ? (
        <Empty role="alert" className="mt-16">
          <EmptyHeader>
            <EmptyTitle>Gagal memuat event</EmptyTitle>
            <EmptyDescription>{error}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" onClick={() => void reload()}>
              Coba lagi
            </Button>
          </EmptyContent>
        </Empty>
      ) : !events ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-36 rounded-xl" />
          <Skeleton className="h-36 rounded-xl" />
        </div>
      ) : events.length === 0 ? (
        <Empty className="mt-16">
          <EmptyHeader>
            <EmptyTitle>Belum ada event</EmptyTitle>
            <EmptyDescription>Buat event pertama untuk mulai.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {events.map((ev) => (
            <Card key={ev.slug} className="transition-colors hover:border-primary/40">
              <CardHeader>
                <CardTitle>
                  <Link to={eventPaths(ev.slug).event} className="hover:underline">
                    {ev.nama_event || ev.slug}
                  </Link>
                </CardTitle>
                <CardDescription className="flex flex-col gap-1">
                  <span className="font-mono text-xs">/{ev.slug}</span>
                  <span className="flex items-center gap-1.5">
                    <HugeiconsIcon icon={Calendar03Icon} strokeWidth={2} className="size-3.5" />
                    {ev.tanggal_utama ? formatTanggal(ev.tanggal_utama) : 'Tanggal belum diisi'} · {tipeLabel(ev.tipe)}
                  </span>
                </CardDescription>
                <CardAction>
                  <Button variant="ghost" size="icon" aria-label={`Hapus ${ev.nama_event}`} onClick={() => setToDelete(ev)}>
                    <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
                  </Button>
                </CardAction>
              </CardHeader>
              <CardFooter className="flex-wrap gap-2 text-xs text-muted-foreground">
                <Link to={eventPaths(ev.slug).tamu} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                  {ev.jumlah_tamu} tamu
                </Link>
                <Link to={eventPaths(ev.slug).template} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                  {ev.jumlah_template} template
                </Link>
                <Link to={`${PATHS.users}?event=${encodeURIComponent(ev.slug)}`} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
                  <HugeiconsIcon icon={UserMultipleIcon} strokeWidth={2} data-icon="inline-start" />
                  Akun klien
                </Link>
                <span className="ml-auto font-mono">{ev.mode}</span>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus {toDelete?.nama_event || toDelete?.slug}?</AlertDialogTitle>
            <AlertDialogDescription>
              Semua data event ini ikut terhapus dari spreadsheet: {toDelete?.jumlah_tamu} tamu dan {toDelete?.jumlah_template} template,
              beserta sesinya dan akun klien event ini. Link undangan yang sudah terkirim tidak berlaku lagi. Tindakan ini tidak bisa dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={remove} disabled={deleting}>
              Hapus event
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
