import { cn } from 'cn'
import { thumbUrl } from '@/core/domain/portfolio'

/**
 * A phone frame showing the top of one portfolio design (its full-page
 * screenshot, cropped to the cover). Size it with a width class.
 */
export function PhoneMockup({ slug, className, alt = '' }: { slug: string; className?: string; alt?: string }) {
  return (
    <div
      className={cn(
        'relative aspect-[9/19] overflow-hidden rounded-[2.25rem] border-[6px] border-neutral-900 bg-neutral-900 shadow-2xl shadow-black/25 ring-1 ring-black/10 dark:border-neutral-800 dark:ring-white/10',
        className,
      )}
    >
      <img src={thumbUrl(slug)} alt={alt} decoding="async" className="size-full rounded-[1.85rem] object-cover object-top" />
      <span aria-hidden className="absolute top-2 left-1/2 h-4 w-14 -translate-x-1/2 rounded-full bg-neutral-900" />
    </div>
  )
}
