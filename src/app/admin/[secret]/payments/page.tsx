// src/app/admin/[secret]/payments/page.tsx
'use client'

import { use, useEffect, useState, useCallback } from 'react'
import { useRouter }   from 'next/navigation'
import { ArrowLeft, RefreshCw, CheckCircle2, Inbox } from 'lucide-react'
import { getPendingPayments } from '@/lib/billing/admin'
import { PaymentVerificationCard } from '@/components/billing/PaymentVerificationCard'
import { AdminShell } from '@/components/admin/AdminShell'

export default function AdminPaymentsPage({
  params,
}: {
  params: Promise<{ secret: string }>
}) {
  const { secret }           = use(params)
  const router               = useRouter()
  const [payments, setPayments] = useState<any[]>([])
  const [loading,  setLoading]  = useState(true)
  const [lastRefresh, setLastRefresh] = useState(new Date())

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getPendingPayments()
      setPayments(data)
      setLastRefresh(new Date())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <AdminShell secret={secret}>
    <div className="min-h-screen bg-slate-900">
      <header className="border-b border-slate-700 px-6 py-4 flex items-center gap-3 sticky top-0 bg-slate-900 z-10">
        <button
          onClick={() => router.push(`/admin/${secret}`)}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700"
        >
          <ArrowLeft size={16} className="text-slate-400" />
        </button>
        <div className="flex-1">
          <h1 className="font-bold text-white">Payment Verification</h1>
          <p className="text-slate-400 text-xs">
            Last refresh: {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300
                     font-semibold px-4 py-2 rounded-xl text-sm transition-colors"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8">

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw size={24} className="text-blue-500 animate-spin" />
          </div>
        ) : payments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 bg-green-900/30 rounded-full flex items-center
                            justify-center mb-4">
              <CheckCircle2 size={32} className="text-green-500" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Sab Clear!</h2>
            <p className="text-slate-400 text-sm">
              Koi pending payment nahi — sab verify ho gayi hain
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-6">
              <Inbox size={18} className="text-amber-400" />
              <p className="text-amber-300 font-semibold">
                {payments.length} payment{payments.length > 1 ? 's' : ''} pending verification
              </p>
            </div>

            {payments.map(payment => (
              <PaymentVerificationCard
                key={payment.id}
                payment={payment}
                onUpdated={load}
              />
            ))}
          </div>
        )}
      </div>
    </div>
    </AdminShell>
  )
}