import { cn } from 'cn'
import { buttonVariants } from '@/components/ui/button'

type Variant = 'default' | 'outline' | 'ghost'

/** Pill buttons of the public pages (landing, portfolio, login). `lg` is the hero / CTA size. */
export function cta(variant: Variant = 'default', size: 'md' | 'lg' = 'md') {
  return cn(buttonVariants({ variant, size: 'lg' }), 'rounded-full px-4 text-[15px]', size === 'lg' && 'h-11 px-6 text-base')
}
