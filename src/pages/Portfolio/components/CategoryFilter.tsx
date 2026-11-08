import { ArrowDown01Icon, Cancel01Icon, FilterHorizontalIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { categoryLabel, type PortfolioCategory, type PortfolioCategoryId, type PortfolioFilter } from '@/core/domain/portfolio'

interface Props {
  categories: readonly PortfolioCategory[]
  value: PortfolioFilter
  onChange: (next: PortfolioCategoryId[]) => void
}

/** Multi-select category dropdown. The menu stays open while ticking, so several can be picked at once. */
export function CategoryFilter({ categories, value, onChange }: Props) {
  const toggle = (id: PortfolioCategoryId, on: boolean) =>
    onChange(categories.filter((c) => (c.id === id ? on : value.includes(c.id))).map((c) => c.id))

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="lg" className="rounded-full px-3.5" />}>
        <HugeiconsIcon icon={FilterHorizontalIcon} strokeWidth={2} data-icon="inline-start" />
        Kategori
        {value.length > 0 && (
          <span className="grid size-5 place-items-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
            {value.length}
          </span>
        )}
        <HugeiconsIcon icon={ArrowDown01Icon} strokeWidth={2} data-icon="inline-end" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {/* Base UI: a menu label is a GroupLabel and must live inside its group. */}
        <DropdownMenuGroup>
          <DropdownMenuLabel>Pilih kategori</DropdownMenuLabel>
          {categories.map((c) => (
            <DropdownMenuCheckboxItem key={c.id} checked={value.includes(c.id)} onCheckedChange={(on) => toggle(c.id, on)}>
              {c.label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={value.length === 0} onClick={() => onChange([])}>
          Hapus filter
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** The active selection as removable pills, so it stays visible after the menu closes. */
export function ActiveCategories({ value, onChange }: Omit<Props, 'categories'>) {
  if (value.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-2">
      {value.map((id) => (
        <button
          key={id}
          type="button"
          aria-label={`Hapus filter ${categoryLabel(id)}`}
          onClick={() => onChange(value.filter((v) => v !== id))}
          className="inline-flex h-7 items-center gap-1.5 rounded-full bg-primary-soft pr-2 pl-3 text-xs font-medium text-primary outline-none hover:bg-primary-soft/70 focus-visible:ring-2 focus-visible:ring-ring/30"
        >
          {categoryLabel(id)}
          <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="size-3" />
        </button>
      ))}
      <button
        type="button"
        onClick={() => onChange([])}
        className="h-7 rounded-full px-2 text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/30"
      >
        Hapus semua
      </button>
    </div>
  )
}
