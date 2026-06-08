'use client'

import Link from 'next/link'
import * as Sentry from '@sentry/nextjs'

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  Sentry.captureException(error)
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
      <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center mb-4">
        <span className="text-xl">😕</span>
      </div>
      <h1 className="text-lg font-bold text-slate-800 mb-1.5">Dashboard load nahi ho sakka</h1>
      <p className="text-slate-500 text-sm mb-6 max-w-xs">
        Yeh hamari taraf se hai. Dubara try karein.
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="bg-blue-600 text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-colors text-sm"
        >
          Dubara Try Karein
        </button>
        <Link
          href="/admin/dashboard"
          className="bg-slate-100 text-slate-700 font-semibold px-5 py-2.5 rounded-xl hover:bg-slate-200 transition-colors text-sm"
        >
          Dashboard
        </Link>
      </div>
    </div>
  )
}
