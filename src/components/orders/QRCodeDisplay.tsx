// src/components/orders/QRCodeDisplay.tsx
'use client'

import { useState, useCallback } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import {
  X, Share2, Copy, Check,
  ExternalLink, QrCode,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface QRCodeDisplayProps {
  orderNumber: number
  customerName: string
  customerPhone?: string
  onClose: () => void
}

export function QRCodeDisplay({ orderNumber, customerName, onClose, customerPhone, }: QRCodeDisplayProps) {
  const [copied, setCopied] = useState(false)

  // Build the tracking URL
  const trackingUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/track/${orderNumber}`
    : `/track/${orderNumber}`

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(trackingUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const el = document.createElement('textarea')
      el.value = trackingUrl
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [trackingUrl])

  const handleShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Order #${String(orderNumber).padStart(3,'0')} Tracking`,
          text:  `${customerName} — apna order track karein`,
          url:   trackingUrl,
        })
      } catch {
        // User cancelled share
      }
    } else {
      handleCopy()
    }
  }, [trackingUrl, orderNumber, customerName, handleCopy])

  const cleanPhone = customerPhone
    ? `92${customerPhone.replace(/^0/, '').replace(/\D/g, '')}`
    : null

  const whatsappHref = cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(
        `Assalam o Alaikum ${customerName}!\n\n` +
        `Aapka order #${String(orderNumber).padStart(3,'0')} track karne ke liye:\n` +
        `${trackingUrl}\n\n` +
        `Is link ko bookmark kar lein — status update hota rahega. 🙏`
      )}`
    : `https://wa.me/?text=${encodeURIComponent(
        `Order #${String(orderNumber).padStart(3,'0')} tracking:\n${trackingUrl}`
      )}`

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center lg:items-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-[430px] bg-white rounded-t-3xl lg:rounded-2xl
                   px-5 pt-4 pb-8 shadow-2xl z-10"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-5 lg:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-bold text-slate-800">Order Tracking QR</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              #{String(orderNumber).padStart(3,'0')} · {customerName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100"
          >
            <X size={15} className="text-slate-500" />
          </button>
        </div>

        {/* QR Code */}
        <div className="flex justify-center mb-6">
          <div className="bg-white p-4 rounded-2xl border-2 border-slate-200 shadow-sm">
            <QRCodeSVG
              value={trackingUrl}
              size={200}
              level="M"
              includeMargin={false}
              imageSettings={{
                src:    '/icons/icon-96.png',
                x:      undefined,
                y:      undefined,
                height: 32,
                width:  32,
                excavate: true,
              }}
            />
          </div>
        </div>

        {/* Instruction */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 mb-5 text-center">
          <p className="text-xs text-blue-700 font-medium">
            📱 Gahak is QR ko scan kare ya link share karein —
            wo apna order khud track kar sakta hai
          </p>
        </div>

        {/* URL display */}
        <div className="flex items-center gap-2 bg-slate-100 rounded-2xl px-4 py-3 mb-4">
          <p className="flex-1 text-xs text-slate-600 font-mono truncate">
            {trackingUrl}
          </p>
          <button
            onClick={handleCopy}
            className={cn(
              'flex-shrink-0 flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl transition-all',
              copied
                ? 'bg-green-500 text-white'
                : 'bg-white text-slate-700 border border-slate-200'
            )}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-3 gap-2">
          {/* Share via WhatsApp */}
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-1.5 py-3.5 bg-green-50
                       border border-green-200 rounded-2xl text-green-700
                       text-xs font-semibold transition-colors active:scale-95"
          >
            <span className="text-xl">💬</span>
            WhatsApp
          </a>

          {/* Native share */}
          <button
            onClick={handleShare}
            className="flex flex-col items-center gap-1.5 py-3.5 bg-blue-50
                       border border-blue-200 rounded-2xl text-blue-700
                       text-xs font-semibold transition-colors active:scale-95"
          >
            <Share2 size={20} />
            Share
          </button>

          {/* Open in browser */}
          <a
            href={trackingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-1.5 py-3.5 bg-slate-50
                       border border-slate-200 rounded-2xl text-slate-700
                       text-xs font-semibold transition-colors active:scale-95"
          >
            <ExternalLink size={20} />
            Preview
          </a>
        </div>
      </div>
    </div>
  )
}