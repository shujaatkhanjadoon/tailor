'use client'

import Link from 'next/link'
import { useTranslation } from 'react-i18next'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const { t } = useTranslation()

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
      <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mb-5">
        <span className="text-2xl">😕</span>
      </div>
      <h1 className="text-xl font-bold text-slate-800 mb-2">{t('error.title')}</h1>
      <p className="text-slate-500 text-sm mb-8 max-w-xs">
        {t('error.desc')}
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="bg-blue-600 text-white font-semibold px-6 py-3 rounded-xl hover:bg-blue-700 transition-colors"
        >
          {t('error.retry')}
        </button>
        <Link
          href="/"
          className="bg-slate-100 text-slate-700 font-semibold px-6 py-3 rounded-xl hover:bg-slate-200 transition-colors"
        >
          {t('error.home')}
        </Link>
      </div>
    </div>
  )
}
