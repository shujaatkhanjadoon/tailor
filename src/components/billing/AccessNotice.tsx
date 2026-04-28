'use client'

import { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, ShieldAlert, ArrowUpRight } from 'lucide-react'
import { PlanId, PLANS } from '@/lib/billing/plans'

interface AccessNoticeProps {
  title: string
  message: string
  requiredPlan?: PlanId
  actionLabel?: string
  actionHref?: string
  icon?: 'lock' | 'role'
  children?: ReactNode
}

export function AccessNotice({
  title,
  message,
  requiredPlan,
  actionLabel,
  actionHref,
  icon = 'lock',
  children,
}: AccessNoticeProps) {
  const router = useRouter()
  const Icon = icon === 'role' ? ShieldAlert : Lock
  const href = actionHref ?? (requiredPlan ? `/billing/upgrade?plan=${requiredPlan}` : '/billing/upgrade')
  const label = actionLabel ?? (requiredPlan ? `${PLANS[requiredPlan].name} plan pe upgrade karein` : 'Upgrade karein')

  return (
    <div className="min-h-100 flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm text-center bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Icon size={22} className="text-blue-600" />
        </div>
        <h2 className="text-lg font-bold text-slate-800">{title}</h2>
        <p className="text-sm text-slate-500 mt-2 leading-relaxed">{message}</p>
        {children}
        {(requiredPlan || actionHref) && (
          <button
            onClick={() => router.push(href)}
            className="mt-5 w-full bg-blue-600 text-white font-bold py-3 rounded-xl text-sm
                       flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            {label}
            <ArrowUpRight size={14} />
          </button>
        )}
      </div>
    </div>
  )
}
