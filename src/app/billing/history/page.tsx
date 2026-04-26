// src/app/billing/history/page.tsx
'use client'

import { useRouter }     from 'next/navigation'
import { ArrowLeft }     from 'lucide-react'
import { BillingHistory } from '@/components/billing/BillingHistory'

export default function BillingHistoryPage() {
  const router = useRouter()
  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <header className="bg-white border-b border-slate-100 px-4 pt-12 lg:pt-6 pb-4
                         flex items-center gap-3">
        <button
          aria-label="Go back"
          onClick={() => router.back()}
          className="w-11 h-11 flex items-center justify-center rounded-full bg-slate-100">
          <ArrowLeft size={18} className="text-slate-600" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-slate-800">Payment History</h1>
          <p className="text-xs text-slate-400">Aapki sari payments</p>
        </div>
      </header>
      <div className="px-4 pt-5">
        <BillingHistory />
      </div>
    </div>
  )
}
