// src/components/orders/QRCodeDisplay.tsx
'use client'

import { useState, useCallback } from 'react'
import { QRCodeSVG }             from 'qrcode.react'
import { X, Share2, Copy, Check, ExternalLink, QrCode } from 'lucide-react'
import { cn } from '@/lib/utils'

interface QRCodeDisplayProps {
  orderNumber:   number
  customerName:  string
  customerPhone?: string
  trackingCode?: string    // preferred — globally unique
  brandName?:     string
  brandColor?:    string
  brandLogoUrl?:  string
  onClose:       () => void
}

export function QRCodeDisplay({
  orderNumber,
  customerName,
  customerPhone,
  trackingCode,
  brandName,
  brandColor = '#2563eb',
  brandLogoUrl,
  onClose,
}: QRCodeDisplayProps) {
  const [copied, setCopied] = useState(false)

  // Always use trackingCode if available — globally unique across all shops
  // Fall back to orderNumber only for legacy orders without a tracking code
  const trackPath  = trackingCode
    ? `/track/${trackingCode}`
    : `/track/${orderNumber}`

  const trackingUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${trackPath}`
    : trackPath

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(trackingUrl)
    } catch {
      // Fallback for older browsers
      const el  = document.createElement('textarea')
      el.value  = trackingUrl
      el.style.position = 'fixed'
      el.style.opacity  = '0'
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }, [trackingUrl])

  const handleShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Order #${String(orderNumber).padStart(3,'0')} Tracking`,
          text:  `${customerName} — apna order track karein`,
          url:   trackingUrl,
        })
        return
      } catch { /* user cancelled */ }
    }
    // Fallback: copy
    handleCopy()
  }, [trackingUrl, orderNumber, customerName, handleCopy])

  // WhatsApp message — sent directly to customer if phone available
  const cleanPhone = customerPhone
    ? `92${customerPhone.replace(/^0/, '').replace(/\D/g, '')}`
    : null

  const waMessage = encodeURIComponent(
    `Assalam o Alaikum ${customerName}!\n\n` +
    `Aapka order #${String(orderNumber).padStart(3,'0')} track karne ke liye:\n` +
    `${trackingUrl}\n\n` +
    `Status real-time update hota rehta hai. 🙏`
  )

  const whatsappHref = cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${waMessage}`
    : `https://wa.me/?text=${waMessage}`

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center lg:items-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Sheet */}
      <div
        className="relative w-full max-w-107.5 bg-white rounded-t-3xl lg:rounded-2xl
                   px-5 pt-4 pb-8 shadow-2xl z-10"
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-5 lg:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center text-white overflow-hidden shrink-0"
              style={{ background: brandColor }}
            >
              {brandLogoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={brandLogoUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <QrCode size={18} />
              )}
            </div>
            <div className="min-w-0">
              {brandName && <p className="text-xs font-bold text-slate-500 truncate">{brandName}</p>}
            <h3 className="font-bold text-slate-800">Order Tracking</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              #{String(orderNumber).padStart(3,'0')} · {customerName}
            </p>
            </div>
          </div>
          <button
            aria-label="Close QR code"
            onClick={onClose}
            className="w-11 h-11 flex items-center justify-center rounded-full bg-slate-100"
          >
            <X size={15} className="text-slate-500" />
          </button>
        </div>

        {/* Tracking code badge */}
        {trackingCode && (
          <div className="flex items-center justify-center mb-5">
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200
                            rounded-full px-4 py-1.5">
              <QrCode size={13} className="text-blue-600" />
              <span className="text-sm font-bold text-blue-700 font-mono tracking-widest">
                {trackingCode}
              </span>
            </div>
          </div>
        )}

        {/* QR Code */}
        <div className="flex justify-center mb-5">
          <div className="bg-white p-4 rounded-2xl border-2 border-slate-200 shadow-sm">
            <QRCodeSVG
              value={trackingUrl}
              size={190}
              level="M"
              includeMargin={false}
              imageSettings={{
                src:      '/icons/icon-96.png',
                x:        undefined,
                y:        undefined,
                height:   30,
                width:    30,
                excavate: true,
              }}
            />
          </div>
        </div>

        {/* Instruction */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 mb-4 text-center">
          <p className="text-xs text-blue-700 font-medium leading-relaxed">
            📱 Gahak is QR ko scan kare ya link share karein —
            status real-time update hota rehta hai
          </p>
        </div>

        {/* URL strip */}
        <div className="flex items-center gap-2 bg-slate-100 rounded-2xl px-4 py-3 mb-4">
          <p className="flex-1 text-xs text-slate-600 font-mono truncate">
            {trackingUrl}
          </p>
          <button
            onClick={handleCopy}
            className={cn(
              'shrink-0 flex items-center gap-1.5 text-xs font-bold',
              'px-3 py-1.5 rounded-xl transition-all active:scale-95',
              copied
                ? 'bg-green-500 text-white'
                : 'bg-white text-slate-700 border border-slate-200 hover:border-slate-300'
            )}
          >
            {copied
              ? <><Check size={12} /> Copied!</>
              : <><Copy size={12} /> Copy</>
            }
          </button>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-3 gap-2">
          {/* WhatsApp — sends directly to customer */}
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-1.5 py-3.5 bg-green-50
                       border border-green-200 rounded-2xl text-green-700 text-xs
                       font-semibold transition-colors active:scale-95"
          >
            <span className="text-xl">💬</span>
            {cleanPhone ? 'Send Karein' : 'WhatsApp'}
          </a>

          {/* Native share */}
          <button
            onClick={handleShare}
            className="flex flex-col items-center gap-1.5 py-3.5 bg-blue-50
                       border border-blue-200 rounded-2xl text-blue-700 text-xs
                       font-semibold transition-colors active:scale-95"
          >
            <Share2 size={20} />
            Share
          </button>

          {/* Open tracking page */}
          <a
            href={trackingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-1.5 py-3.5 bg-slate-50
                       border border-slate-200 rounded-2xl text-slate-700 text-xs
                       font-semibold transition-colors active:scale-95"
          >
            <ExternalLink size={20} />
            Preview
          </a>
        </div>
      </div>
    </div>
  )
}
