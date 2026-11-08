import { ArrowUpRight01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Badge } from '@/components/ui/badge'
import { categoryLabel, demoUrl, thumbUrl, type PortfolioCategoryId, type PortfolioItem } from '@/core/domain/portfolio'

/**
 * One design. The card image is a full-page screenshot that scrolls through the
 * whole invitation on hover (or keyboard focus); the card opens the live demo.
 * The overlay ignores the pointer, except for the category badges, which filter.
 */
export function PortfolioCard({ item, onCategory }: { item: PortfolioItem; onCategory: (id: PortfolioCategoryId) => void }) {
  return (
    <article className="group relative h-[28rem] overflow-hidden rounded-xl border bg-muted shadow-sm transition-shadow hover:shadow-lg">
      <a
        href={demoUrl(item.slug)}
        target="_blank"
        rel="noreferrer"
        aria-label={`Buka demo ${item.title} (${item.couple})`}
        className="absolute inset-0 block rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <img
          src={thumbUrl(item.slug)}
          alt=""
          loading="lazy"
          decoding="async"
          className="w-full transition-transform duration-700 ease-out motion-safe:group-focus-within:translate-y-[calc(-100%_+_28rem)] motion-safe:group-focus-within:duration-[10s] motion-safe:group-focus-within:ease-linear motion-safe:group-hover:translate-y-[calc(-100%_+_28rem)] motion-safe:group-hover:duration-[10s] motion-safe:group-hover:ease-linear"
        />
      </a>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-2.5 bg-linear-to-t from-black/85 via-black/50 to-transparent p-4 pt-24 text-white">
        <div className="pointer-events-auto flex flex-wrap gap-1.5">
          {item.categories.map((id) => (
            <Badge
              key={id}
              variant="outline"
              render={<button type="button" onClick={() => onCategory(id)} />}
              className="h-6 cursor-pointer border-white/40 bg-white/10 px-2.5 text-xs text-white backdrop-blur hover:bg-white/25"
            >
              {categoryLabel(id)}
            </Badge>
          ))}
        </div>
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-xl leading-tight font-semibold">{item.title}</h3>
            <p className="truncate text-sm text-white/75">{item.couple}</p>
          </div>
          <span
            aria-hidden
            className="flex shrink-0 items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium backdrop-blur transition-colors group-hover:bg-white group-hover:text-black"
          >
            Lihat demo
            <HugeiconsIcon icon={ArrowUpRight01Icon} strokeWidth={2} className="size-3.5" />
          </span>
        </div>
      </div>
    </article>
  )
}
