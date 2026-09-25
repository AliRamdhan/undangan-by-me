import { Link } from 'react-router'
import { EmptyState } from '@/components/EmptyState'
import { PATHS } from '@/route.paths'

export function NotFound() {
  return (
    <EmptyState title="Halaman tidak ditemukan">
      <Link to={PATHS.tamu} className="text-accent hover:underline">
        Kembali ke daftar tamu
      </Link>
    </EmptyState>
  )
}
