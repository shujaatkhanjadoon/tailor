// src/components/dashboard/DueOrdersAlert.tsx
'use client';

import { AlertTriangle, ChevronRight } from 'lucide-react';
import { OrderRecord } from '@/lib/db/schema';
import { useRouter } from 'next/navigation';

interface DueOrdersAlertProps {
  orders: OrderRecord[];
}

export function DueOrdersAlert({ orders }: DueOrdersAlertProps) {
  const router = useRouter();
  if (orders.length === 0) return null;

  return (
    <button
      onClick={() => router.push('/orders?filter=overdue')}
      className="w-full flex flex-wrap sm:flex-nowrap items-center gap-3 bg-red-50 border border-red-200 rounded-2xl p-4
                 text-left transition-transform active:scale-[0.98]"
    >
      <div className="relative shrink-0">
        <div className="absolute inset-0 bg-red-400 rounded-full animate-ping opacity-30" />
        <div className="relative w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
          <AlertTriangle size={18} className="text-red-600" strokeWidth={2.5} />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-red-700 text-sm">
          {orders.length} Order{orders.length > 1 ? 's' : ''} Late Ho Gaye!
        </p>
        <p className="text-xs text-red-500 mt-0.5 truncate">
          {orders.map(o => `#${o.orderNumber} ${o.customerName}`).join(', ')}
        </p>
      </div>
      <ChevronRight size={16} className="text-red-400 shrink-0" />
    </button>
  );
}