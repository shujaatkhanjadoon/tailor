// src/components/billing/ExpiryReminderBanner.tsx
'use client';

import { useState } from 'react';
import { X, Zap } from 'lucide-react';
import { usePlan } from '@/hooks/usePlan';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

export function ExpiryReminderBanner() {
  const plan = usePlan();
  const [dismissed, setDismissed] = useState(false);
  const { t } = useTranslation();

  if (dismissed) return null;
  if (plan.isLoading) return null;
  if (!plan.isTrial && !plan.inGrace && !plan.isExpired && plan.status !== 'cancelled') return null;
  if (plan.isTrial && (plan.daysLeft ?? 99) > 7) return null;

  // Show banner for cancelled-but-active subscriptions approaching expiry
  if (plan.status === 'cancelled' && plan.isActive && plan.expiresAt) {
    const daysLeft = Math.max(0, Math.ceil((plan.expiresAt.getTime() - Date.now()) / 86400000))
    if (daysLeft > 7) return null
    return (
      <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 px-4 py-3 mx-4 rounded-2xl mb-1 bg-slate-600">
        <Zap size={16} className="text-white shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-sm leading-tight">
            Subscription ending soon — {daysLeft} day{daysLeft !== 1 ? 's' : ''} left
          </p>
          <p className="text-white/80 text-xs mt-0.5">Reactivate to keep your current plan features.</p>
        </div>
        <button
          onClick={() => plan.upgrade()}
          className="shrink-0 bg-white text-slate-700 font-bold text-xs px-3 py-2 rounded-xl transition-colors hover:bg-slate-50 active:scale-95 whitespace-nowrap"
        >
          Reactivate
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors"
        >
          <X size={13} className="text-white" />
        </button>
      </div>
    )
  }

  const config = plan.isExpired ? {
    bg:     'bg-red-600',
    text:   t('billing.expiryReminder.expired'),
    sub:    t('billing.expiryReminder.expiredSub'),
    urgent: true,
  } : plan.inGrace ? {
    bg:     'bg-orange-500',
    text:   t('billing.expiryReminder.grace', { days: plan.daysLeft }),
    sub:    t('billing.expiryReminder.graceSub'),
    urgent: true,
  } : plan.daysLeft !== null && plan.daysLeft <= 3 ? {
    bg:     'bg-red-500',
    text:   t('billing.expiryReminder.ending', { days: plan.daysLeft }),
    sub:    t('billing.expiryReminder.endingSub'),
    urgent: true,
  } : {
    bg:     'bg-blue-600',
    text:   t('billing.expiryReminder.remaining', { days: plan.daysLeft }),
    sub:    t('billing.expiryReminder.remainingSub'),
    urgent: false,
  };

  return (
    <div className={cn(
      'flex flex-wrap sm:flex-nowrap items-center gap-3 px-4 py-3 mx-4 rounded-2xl mb-1',
      config.bg
    )}>
      <Zap size={16} className="text-white shrink-0" />

      <div className="flex-1 min-w-0">
        <p className="text-white font-bold text-sm leading-tight">{config.text}</p>
        <p className="text-white/80 text-xs mt-0.5">{config.sub}</p>
      </div>

      <button
        onClick={() => plan.upgrade()}
        className="shrink-0 bg-white text-blue-700 font-bold text-xs
                   px-3 py-2 rounded-xl transition-colors hover:bg-blue-50 active:scale-95 whitespace-nowrap"
      >
        {t('billing.upgrade')}
      </button>

      {!config.urgent && (
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 w-7 h-7 flex items-center justify-center
                     rounded-full bg-white/20 hover:bg-white/30 transition-colors"
        >
          <X size={13} className="text-white" />
        </button>
      )}
    </div>
  );
}
