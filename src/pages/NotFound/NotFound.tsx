import { Link } from 'react-router'
import { buttonVariants } from '@/components/ui/button'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { PATHS } from '@/route.paths'

export function NotFound() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>Halaman tidak ditemukan</EmptyTitle>
        <EmptyDescription>Alamat ini tidak ada di aplikasi.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Link to={PATHS.tamu} className={buttonVariants({ variant: 'outline' })}>
          Kembali ke daftar tamu
        </Link>
      </EmptyContent>
    </Empty>
  )
}
