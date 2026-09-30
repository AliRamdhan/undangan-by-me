import { Delete02Icon, LockKeyIcon, PencilEdit01Icon, UserAdd01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { ManagedUser } from '@/core/api/types'
import { useAuth } from '@/core/auth'
import { errorText, useEventList } from '@/core/store'
import { ResetPasswordDialog } from './components/ResetPasswordDialog'
import { UserDialog } from './components/UserDialog'

const when = (iso: string) => (iso ? new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '—')

type Editing = { kind: 'create' } | { kind: 'edit' | 'reset' | 'delete'; user: ManagedUser } | null

/** /users — SUPER_ADMIN manages every login; a CLIENT account is bound to one event. */
export function Users() {
  const { app, user: me } = useAuth()
  const { events } = useEventList()
  const [params, setParams] = useSearchParams()
  const filter = params.get('event') ?? ''
  const [users, setUsers] = useState<ManagedUser[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Editing>(null)

  const reload = useCallback(async () => {
    try {
      setUsers(await app.listUsers())
      setError(null)
    } catch (e) {
      setError(errorText(e))
    }
  }, [app])

  useEffect(() => {
    // Fetch on mount and whenever the session/backend changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload()
  }, [reload])

  const eventName = (id: string) => {
    const ev = events?.find((e) => e.id === id)
    return ev ? ev.nama_event || ev.slug : id
  }
  const shown = (users ?? []).filter((u) => !filter || u.event === filter)

  const remove = async (u: ManagedUser) => {
    try {
      await app.deleteUser(u.id)
      toast.success(`Akun ${u.email} dihapus`)
      setEditing(null)
      await reload()
    } catch (e) {
      toast.error(errorText(e))
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="mr-auto">
          <h1 className="text-lg font-semibold tracking-wide text-primary uppercase">Pengguna</h1>
          <p className="text-muted-foreground">Super admin melihat semua event; klien hanya event miliknya.</p>
        </div>
        <NativeSelect
          aria-label="Filter event"
          value={filter}
          onChange={(e) => setParams(e.target.value ? { event: e.target.value } : {}, { replace: true })}
        >
          <NativeSelectOption value="">Semua akun</NativeSelectOption>
          {(events ?? []).map((ev) => (
            <NativeSelectOption key={ev.id} value={ev.id}>
              {ev.nama_event || ev.slug}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <Button size="lg" onClick={() => setEditing({ kind: 'create' })} disabled={!events}>
          <HugeiconsIcon icon={UserAdd01Icon} strokeWidth={2} data-icon="inline-start" />
          Tambah akun
        </Button>
      </div>
      <Separator />

      {error ? (
        <Empty role="alert" className="mt-16">
          <EmptyHeader>
            <EmptyTitle>Gagal memuat akun</EmptyTitle>
            <EmptyDescription>{error}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" onClick={() => void reload()}>
              Coba lagi
            </Button>
          </EmptyContent>
        </Empty>
      ) : !users ? (
        <Skeleton className="h-48 rounded-xl" />
      ) : shown.length === 0 ? (
        <Empty className="mt-16">
          <EmptyHeader>
            <EmptyTitle>Belum ada akun{filter && ` untuk ${eventName(filter)}`}</EmptyTitle>
            <EmptyDescription>Tambah akun klien agar pasangan bisa mengelola tamunya sendiri.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama / Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Login terakhir</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((u) => {
                const self = u.email.toLowerCase() === me?.email.toLowerCase()
                return (
                  <TableRow key={u.email}>
                    <TableCell>
                      <p className="font-medium">
                        {u.nama}
                        {self && <span className="text-muted-foreground"> (Anda)</span>}
                      </p>
                      <p className="text-muted-foreground">{u.email}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.role === 'SUPER_ADMIN' ? 'default' : 'secondary'} className="font-mono">
                        {u.role}
                      </Badge>
                    </TableCell>
                    <TableCell>{u.role === 'CLIENT' ? eventName(u.event) : <span className="text-muted-foreground">Semua</span>}</TableCell>
                    <TableCell>{u.aktif ? 'Aktif' : <span className="text-destructive">Nonaktif</span>}</TableCell>
                    <TableCell className="text-muted-foreground">{when(u.loginTerakhir)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" aria-label={`Ubah ${u.email}`} onClick={() => setEditing({ kind: 'edit', user: u })}>
                          <HugeiconsIcon icon={PencilEdit01Icon} strokeWidth={2} />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label={`Reset password ${u.email}`} onClick={() => setEditing({ kind: 'reset', user: u })}>
                          <HugeiconsIcon icon={LockKeyIcon} strokeWidth={2} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Hapus ${u.email}`}
                          disabled={self}
                          title={self ? 'Tidak bisa menghapus akun sendiri' : undefined}
                          onClick={() => setEditing({ kind: 'delete', user: u })}
                        >
                          <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {(editing?.kind === 'create' || editing?.kind === 'edit') && (
        <UserDialog
          user={editing.kind === 'edit' ? editing.user : null}
          events={events ?? []}
          defaultEvent={filter}
          onClose={() => setEditing(null)}
          onSaved={() => void reload()}
        />
      )}
      {editing?.kind === 'reset' && <ResetPasswordDialog user={editing.user} onClose={() => setEditing(null)} />}
      <AlertDialog open={editing?.kind === 'delete'} onOpenChange={(o) => !o && setEditing(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus akun {editing?.kind === 'delete' && editing.user.email}?</AlertDialogTitle>
            <AlertDialogDescription>Akun tidak bisa login lagi dan sesinya diakhiri. Data event dan tamu tidak terhapus.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => editing?.kind === 'delete' && void remove(editing.user)}>
              Hapus akun
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
