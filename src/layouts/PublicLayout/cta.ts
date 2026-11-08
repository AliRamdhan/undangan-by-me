import { cn } from 'cn'
import { buttonVariants } from '@/components/ui/button'

type Variant = 'default' | 'outline' | 'ghost'

/** Pill buttons of the public pages (landing, portfolio, login). `lg` is the hero / CTA size. */
export function cta(variant: Variant = 'default', size: 'md' | 'lg' = 'md') {
  return cn(buttonVariants({ variant, size: 'lg' }), 'rounded-full px-3.5', size === 'lg' && 'h-10 px-5 text-sm')
}
