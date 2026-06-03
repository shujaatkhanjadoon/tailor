'use client'

import { useTranslation } from 'react-i18next'

export function AppFooter({ className = '' }: { className?: string }) {
  const { t } = useTranslation()
  return (
    <footer className={`px-4 pb-3 pt-4 text-center text-xs text-slate-400 ${className}`}>
      © {new Date().getFullYear()} MeraDarzi • {t('app.footer')}
    </footer>
  )
}
