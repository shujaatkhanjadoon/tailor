'use client'

import { cn } from '@/lib/utils'

interface ToggleSwitchProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  label?: string
  size?: 'sm' | 'md'
  activeClassName?: string
}

export function ToggleSwitch({
  checked,
  onCheckedChange,
  disabled = false,
  label,
  size = 'md',
  activeClassName = 'bg-blue-600',
}: ToggleSwitchProps) {
  const dims = size === 'sm'
    ? 'h-6 w-11 p-0.5'
    : 'h-7 w-13 p-0.5'
  const knob = size === 'sm' ? 'h-5 w-5' : 'h-6 w-6'
  const move = size === 'sm' ? 'translate-x-5' : 'translate-x-6'

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => !disabled && onCheckedChange(!checked)}
      className={cn(
        'relative inline-flex shrink-0 items-center rounded-full border border-transparent',
        'transition-colors duration-200 ease-out focus:outline-none focus-visible:ring-2',
        'focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        dims,
        checked ? activeClassName : 'bg-slate-300',
      )}
    >
      <span
        className={cn(
          'block rounded-full bg-white shadow-sm ring-1 ring-black/5',
          'transition-transform duration-200 ease-out',
          knob,
          checked ? move : 'translate-x-0',
        )}
      />
    </button>
  )
}
