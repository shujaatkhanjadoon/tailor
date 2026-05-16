// src/components/layout/VerificationBanner.tsx
'use client'

import { useState, useEffect }  from 'react'
import { ShieldAlert, X, ShieldX, MessageCircle } from 'lucide-react'
import { useAuth }              from '@/lib/auth/AuthContext'
import { supabase }             from '@/lib/supabase/client'

type VerifStatus = 'pending' | 'approved' | 'rejected' | null

const ADMIN_WA = process.env.NEXT_PUBLIC_ADMIN_WHATSAPP ?? ''

export function VerificationBanner() {
  const { shopId }                  = useAuth()
  const [status, setStatus]         = useState<VerifStatus>(null)
  const [dismissed, setDismissed]   = useState(false)

  useEffect(() => {
    if (!shopId) return

    ;(supabase as any)
      .from('shops')
      .select('verification_status')
      .eq('id', shopId)
      .maybeSingle()
      .then(({ data }: { data: any }) => {
        if (data?.verification_status) {
          setStatus(data.verification_status as VerifStatus)
        }
      })
      .catch(console.error)
  }, [shopId])

  // Already approved — show nothing
  if (!status || status === 'approved') return null
  if (dismissed && status === 'pending') return null

  // ── REJECTED — non-dismissible, full block ───────────────────
  if (status === 'rejected') {
    const waLink = ADMIN_WA
      ? `https://wa.me/${ADMIN_WA}?text=${encodeURIComponent(
          'Assalam o Alaikum, mera Meradarzi account reject ho gaya hai. Kripaya help karein.'
        )}`
      : null

    return (
      <div className="bg-red-600 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-start gap-3">
          <ShieldX size={18} className="text-red-200 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold text-white text-sm">
              Account Verify Nahi Hua
            </p>
            <p className="text-red-200 text-xs mt-0.5 leading-relaxed">
              Aapka account verify nahi ho saka. Kripaya admin se contact karein.
            </p>
          </div>
          {waLink && (
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 flex items-center gap-1.5 bg-white/20
                         hover:bg-white/30 text-white text-xs font-bold
                         px-3 py-2 rounded-xl transition-colors"
            >
              <MessageCircle size={13} />
              WhatsApp
            </a>
          )}
        </div>
      </div>
    )
  }

  // ── PENDING — dismissible notice ─────────────────────────────
  return (
    <div className="bg-amber-500 px-4 py-2.5">
      <div className="max-w-2xl mx-auto flex items-center gap-3">
        <ShieldAlert size={16} className="text-amber-100 shrink-0" />
        <p className="flex-1 text-amber-900 text-xs font-medium">
          ⏳ Aapka account verification pending hai — 24 ghante mein complete hogi.
          Tab tak sab features available hain.
        </p>
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 w-6 h-6 flex items-center justify-center
                     rounded-full hover:bg-amber-600/30 transition-colors"
        >
          <X size={13} className="text-amber-900" />
        </button>
      </div>
    </div>
  )
}