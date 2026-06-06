'use client'

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

export function AppFooter({ className = '' }: { className?: string }) {
  const { t } = useTranslation()
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  return (
    <footer className={`px-4 pb-3 pt-4 text-center text-xs text-slate-400 ${className}`}>
      © {mounted ? new Date().getFullYear() : ''} MeraDarzi • {t('app.footer')}
    </footer>
  )
}
