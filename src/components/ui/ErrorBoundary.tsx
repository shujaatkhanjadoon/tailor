// src/components/ui/ErrorBoundary.tsx
'use client'

import { Component, ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children:  ReactNode
  fallback?: ReactNode
  onError?:  (error: Error) => void
}

interface State {
  hasError:  boolean
  error?:    Error
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error) {
    console.error('[ErrorBoundary] Caught error:', error)
    this.props.onError?.(error)
  }

  reset = () => this.setState({ hasError: false, error: undefined })

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
          <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center
                          justify-center mb-5">
            <AlertTriangle size={24} className="text-red-600" />
          </div>
          <h3 className="font-bold text-slate-800 mb-2">Kuch Galat Ho Gaya</h3>
          <p className="text-slate-500 text-sm mb-5 max-w-xs leading-relaxed">
            {this.state.error?.message ?? 'Ek unexpected error aayi. Dobara try karein.'}
          </p>
          <button
            onClick={this.reset}
            className="flex items-center gap-2 bg-blue-600 text-white
                       font-semibold px-5 py-3 rounded-xl text-sm"
          >
            <RefreshCw size={15} />
            Dobara Try Karein
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

// ── Convenience wrapper for page-level errors ─────────────────────
export function PageErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="bg-white border border-slate-200 rounded-3xl p-8 mx-4
                          max-w-sm w-full text-center shadow-lg">
            <div className="text-4xl mb-4">😵</div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">
              Page Load Nahi Hui
            </h2>
            <p className="text-slate-500 text-sm mb-5 leading-relaxed">
              Kuch masla ho gaya. Page reload karein ya home page par jayein.
            </p>
            <div className="space-y-2">
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl text-sm"
              >
                Page Reload Karein
              </button>
              <a
                href="/dashboard"
                className="block w-full bg-slate-100 text-slate-700 font-bold
                           py-3 rounded-xl text-sm text-center"
              >
                Dashboard Par Jayein
              </a>
            </div>
          </div>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  )
}