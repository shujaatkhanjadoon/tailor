// src/components/billing/BillingHistory.tsx
'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Clock, XCircle, Receipt } from 'lucide-react'
import { useAuth }   from '@/lib/auth/AuthContext'
import { supabase }  from '@/lib/supabase/client'
import { PLANS, PlanId } from '@/lib/billing/plans'
import { cn }        from '@/lib/utils'
import { format }    from 'date-fns'

const STATUS_CONFIG = {
  completed: { label: 'Completed', icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50'  },
  pending:   { label: 'Pending',   icon: Clock,        color: 'text-amber-600', bg: 'bg-amber-50'  },
  failed:    { label: 'Failed',    icon: XCircle,      color: 'text-red-600',   bg: 'bg-red-50'    },
  refunded:  { label: 'Refunded',  icon: Receipt,      color: 'text-blue-600',  bg: 'bg-blue-50'   },
}

export function BillingHistory() {
  const { shopId }          = useAuth()
  const [payments, setPayments] = useState<any[]>([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    if (!shopId) return
    const load = async () => {
      const { data } = await (supabase as any)
        .from('subscription_payments')
        .select('id,shop_id,plan,billing_cycle,amount_pkr,status,paid_at,gateway_tx_id')
        .eq('shop_id', shopId)
        .order('paid_at', { ascending: false })
        .limit(20)
      setPayments(data ?? [])
      setLoading(false)
    }
    load()
  }, [shopId])

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center">
        <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full
                        animate-spin mx-auto" />
      </div>
    )
  }

  if (payments.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
        <Receipt size={32} className="text-slate-200 mx-auto mb-3" />
        <p className="text-slate-500 font-semibold text-sm">Koi payment history nahi</p>
        <p className="text-slate-400 text-xs mt-1">
          Jab aap koi plan lenge, payments yahan dikhenge
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h3 className="font-bold text-slate-800 text-sm">Payment History</h3>
      </div>

      <div className="divide-y divide-slate-100">
        {payments.map(payment => {
          const planDef  = PLANS[payment.plan as PlanId]
          const statusCfg = STATUS_CONFIG[payment.status as keyof typeof STATUS_CONFIG]
                          ?? STATUS_CONFIG.pending
          const StatusIcon = statusCfg.icon

          return (
            <div key={payment.id} className="px-5 py-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className={cn(
                    'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
                    statusCfg.bg
                  )}>
                    <StatusIcon size={16} className={statusCfg.color} />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 text-sm">
                      {planDef?.emoji} {planDef?.name ?? payment.plan}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5 capitalize">
                      {payment.billing_cycle} · {payment.method ?? 'Raast'}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {format(new Date(payment.paid_at), 'd MMM yyyy, h:mm a')}
                    </p>

                    {/* Pending notice */}
                    {payment.status === 'pending' && (
                      <p className="text-[10px] text-amber-600 font-semibold mt-1.5
                                    bg-amber-50 px-2 py-1 rounded-lg inline-block">
                        ⏳ Verification pending — 24 ghante mein activate hoga
                      </p>
                    )}

                    {/* TX ID */}
                    {payment.gateway_tx_id && (
                      <p className="text-[10px] text-slate-400 font-mono mt-1">
                        TxID: {payment.gateway_tx_id}
                      </p>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <p className="font-bold text-slate-800">
                    Rs. {Number(payment.amount_pkr).toLocaleString()}
                  </p>
                  <span className={cn(
                    'text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mt-1',
                    statusCfg.bg, statusCfg.color
                  )}>
                    {statusCfg.label}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}