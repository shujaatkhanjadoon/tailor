// src/components/layout/PWAInstallPrompt.tsx
'use client'

import { useState, useEffect } from 'react'
import { Download, X, Smartphone } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showBanner,     setShowBanner]     = useState(false)
  const [isIOS,          setIsIOS]          = useState(false)
  const [isInstalled,    setIsInstalled]    = useState(false)

  useEffect(() => {
    // Already installed as PWA
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
      return
    }

    // Already dismissed
    if (localStorage.getItem('pwa-install-dismissed')) return

    // iOS detection (no beforeinstallprompt event on iOS)
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
    setIsIOS(ios)

    if (ios) {
      // Show iOS instructions after 30 seconds
      const t = setTimeout(() => setShowBanner(true), 30000)
      return () => clearTimeout(t)
    }

    // Android / Chrome
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setShowBanner(true)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setIsInstalled(true)
    setShowBanner(false)
    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    setShowBanner(false)
    localStorage.setItem('pwa-install-dismissed', '1')
  }

  if (!showBanner || isInstalled) return null

  return (
    // Bottom banner — sits above BottomNav
    <div className="fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2
                    w-[calc(100%-2rem)] max-w-[400px] z-40">
      <div className="bg-slate-900 text-white rounded-2xl px-4 py-4 shadow-2xl
                      flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
          <Smartphone size={20} className="text-white" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold">App Install Karein</p>
          {isIOS ? (
            <p className="text-xs text-slate-300 mt-0.5">
              Safari mein Share → "Add to Home Screen" tap karein
            </p>
          ) : (
            <p className="text-xs text-slate-300 mt-0.5">
              Phone par install karein
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {!isIOS && (
            <button
              onClick={handleInstall}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500
                         text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors"
            >
              <Download size={13} />
              Install
            </button>
          )}
          <button
            onClick={handleDismiss}
            className="w-7 h-7 flex items-center justify-center rounded-full
                       bg-white/10 hover:bg-white/20 transition-colors"
          >
            <X size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}
