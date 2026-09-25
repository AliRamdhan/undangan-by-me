import { ComputerIcon, Moon02Icon, Sun03Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const OPTIONS = [
  { value: 'light', label: 'Terang', icon: Sun03Icon },
  { value: 'dark', label: 'Gelap', icon: Moon02Icon },
  { value: 'system', label: 'Ikuti sistem', icon: ComputerIcon },
] as const

/** Light / dark / system switch; next-themes persists the choice in localStorage. */
export function ThemeToggle() {
  const { theme = 'system', setTheme } = useTheme()
  const current = OPTIONS.find((o) => o.value === theme) ?? OPTIONS[2]
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={`Tema: ${current.label}`} />}>
        <HugeiconsIcon icon={current.icon} strokeWidth={2} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuRadioGroup value={theme} onValueChange={(v) => setTheme(String(v))}>
          {/* Base UI: a menu label is a GroupLabel and must live inside its group. */}
          <DropdownMenuLabel>Tema</DropdownMenuLabel>
          {OPTIONS.map((o) => (
            <DropdownMenuRadioItem key={o.value} value={o.value}>
              <HugeiconsIcon icon={o.icon} strokeWidth={2} />
              {o.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
