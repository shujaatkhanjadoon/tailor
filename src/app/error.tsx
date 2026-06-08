'use client'

import * as Sentry from '@sentry/nextjs'

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  Sentry.captureException(error)

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 text-center">
      <div className="text-6xl mb-4">⚠️</div>
      <h1 className="text-2xl font-bold text-slate-800 mb-2">Kuch Masla Hai</h1>
      <p className="text-slate-500 mb-6">Koi technical issue aa gaya. Dobara try karein.</p>
      <button
        onClick={reset}
        className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
      >
        Dobara Koshish Karein
      </button>
    </div>
  )
}
