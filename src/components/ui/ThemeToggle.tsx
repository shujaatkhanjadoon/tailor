'use client'

import { useTheme } from 'next-themes'
import { Sun, Moon } from 'lucide-react'
import { useEffect, useState } from 'react'

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted) {
    return <div className="w-9 h-9" /> // placeholder to prevent layout shift
  }

  const isDark = theme === 'dark'

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={`w-9 h-9 flex items-center justify-center rounded-xl
        bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400
        hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors
        ${className ?? ''}`}
      aria-label={isDark ? 'Light mode' : 'Dark mode'}
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  )
}
