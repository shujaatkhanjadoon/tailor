// src/components/billing/TrialBanner.tsx
'use client'

import { X }         from 'lucide-react'
import { useState }  from 'react'
import { usePlan }   from '@/hooks/usePlan'
import { cn }        from '@/lib/utils'
import { useTranslation } from 'react-i18next'

export function TrialBanner() {
  const plan            = usePlan()
  const [dismissed, setDismissed] = useState(false)
  const { t } = useTranslation()

  if (dismissed)                    return null
  if (!plan.isTrial && !plan.inGrace && !plan.isExpired) return null

  const isUrgent = (plan.daysLeft !== null && plan.daysLeft <= 3) || plan.inGrace || plan.isExpired

  return (
    <div className={cn(
      'mx-4 rounded-2xl px-4 py-3.5 flex items-center gap-3',
      plan.isExpired
        ? 'bg-red-50 border border-red-200'
        : plan.inGrace
        ? 'bg-orange-50 border border-orange-200'
        : isUrgent
        ? 'bg-amber-50 border border-amber-200'
        : 'bg-blue-50 border border-blue-200'
    )}>
      <span className="text-xl shrink-0">
        {plan.isExpired ? '🔴' : plan.inGrace ? '⚠️' : '✨'}
      </span>

      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-sm font-bold',
          plan.isExpired ? 'text-red-800' : plan.inGrace ? 'text-orange-800' : 'text-blue-800'
        )}>
          {plan.isExpired
            ? t('billing.expired')
            : plan.inGrace
            ? t('billing.gracePeriod', { days: plan.daysLeft })
            : plan.isTrial
            ? t('billing.freeTrial', { days: plan.daysLeft })
            : t('billing.expiringSoon')
          }
        </p>
        <p className={cn(
          'text-xs mt-0.5',
          plan.isExpired ? 'text-red-600' : plan.inGrace ? 'text-orange-600' : 'text-blue-600'
        )}>
          {plan.isExpired
            ? t('billing.expiredDesc')
            : t('billing.freeTrialDesc')
          }
        </p>
      </div>

      <button
        onClick={() => plan.upgrade()}
        className={cn(
          'shrink-0 font-bold text-xs px-4 py-2.5 rounded-xl transition-colors',
          plan.isExpired || plan.inGrace
            ? 'bg-red-600 text-white'
            : 'bg-blue-600 text-white'
        )}
      >
        {t('billing.upgrade')}
      </button>

      {!plan.isExpired && (
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 w-7 h-7 flex items-center justify-center
                     rounded-full bg-white/60"
        >
          <X size={13} className="text-slate-500" />
        </button>
      )}
    </div>
  )
}
