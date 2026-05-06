// src/components/billing/ExpiryReminderBanner.tsx
'use client';

import { useState } from 'react';
import { X, Zap } from 'lucide-react';
import { usePlan } from '@/hooks/usePlan';
import { cn } from '@/lib/utils';

export function ExpiryReminderBanner() {
  const plan = usePlan();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;
  if (plan.isLoading) return null;
  if (!plan.isTrial && !plan.inGrace && !plan.isExpired) return null;
  if (plan.isTrial && (plan.daysLeft ?? 99) > 7) return null;

  const config = plan.isExpired ? {
    bg:     'bg-red-600',
    text:   'Plan expire ho gaya — features band hain',
    sub:    'Upgrade karein data backup ke liye',
    urgent: true,
  } : plan.inGrace ? {
    bg:     'bg-orange-500',
    text:   `Grace period — ${plan.daysLeft} din baaki`,
    sub:    'Abhi renew karein taake features na bandein',
    urgent: true,
  } : plan.daysLeft !== null && plan.daysLeft <= 3 ? {
    bg:     'bg-red-500',
    text:   `Trial sirf ${plan.daysLeft} din mein khatam!`,
    sub:    'Upgrade karein features band hone se pehle',
    urgent: true,
  } : {
    bg:     'bg-blue-600',
    text:   `Trial: ${plan.daysLeft} din baaki`,
    sub:    'Upgrade kar ke sab features rakhhein',
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
        Upgrade →
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