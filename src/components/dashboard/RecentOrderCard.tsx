// src/components/dashboard/RecentOrderCard.tsx
'use client';

import { useRouter } from 'next/navigation';
import { MessageCircle, Clock } from 'lucide-react';
import { OrderRecord } from '@/lib/db/schema';
import { ORDER_STATUS_CONFIG, GARMENT_LABELS } from '@/types';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface RecentOrderCardProps {
  order: OrderRecord;
}

function buildWhatsAppLink(order: OrderRecord): string {
  const phone = `92${order.customerPhone.replace(/^0/, '').replace(/\D/g, '')}`;
  const balance = order.totalPrice - order.amountPaid;
  const msg = encodeURIComponent(
    `Assalam o Alaikum ${order.customerName}! 🎉\n\n` +
    `Aapka order #${order.orderNumber} tayyar ho gaya hai!\n` +
    `${balance > 0 ? `Baaki raqam: Rs. ${balance.toLocaleString()}\n\n` : '\n'}` +
    `Jaldi tashreef laaein. Shukriya! 🙏`
  );
  return `https://wa.me/${phone}?text=${msg}`;
}

export function RecentOrderCard({ order }: RecentOrderCardProps) {
  const router = useRouter();

  const statusConfig = ORDER_STATUS_CONFIG[order.status as keyof typeof ORDER_STATUS_CONFIG];
  const garmentConfig = GARMENT_LABELS[order.garmentType as keyof typeof GARMENT_LABELS];

  const balance = order.totalPrice - order.amountPaid;
  const isOverdue = order.dueDate < new Date().toISOString().split('T')[0] &&
    !['delivered', 'cancelled'].includes(order.status);
  const paymentProgress = order.totalPrice > 0
    ? Math.round((order.amountPaid / order.totalPrice) * 100)
    : 0;

  if (!statusConfig) return null;

  return (
    <div
      className={cn(
        'bg-white border rounded-2xl p-4 transition-transform active:scale-[0.98]',
        isOverdue ? 'border-red-200 bg-red-50/30' : 'border-slate-200',
        order.isUrgent === 1 && !isOverdue ? 'border-orange-200 bg-orange-50/20' : ''
      )}
    >
      {/* Top row */}
      <div className="flex items-start justify-between mb-2">
        <button
          onClick={() => router.push(`/orders/${order.id}`)}
          className="flex items-center gap-2"
        >
          <span className="text-sm font-bold text-slate-700">
            #{String(order.orderNumber).padStart(3, '0')}
          </span>
          {order.isUrgent === 1 && (
            <span className="text-[10px] font-bold bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full">
              URGENT
            </span>
          )}
        </button>

        <span className={cn(
          'text-xs font-semibold px-2.5 py-1 rounded-full border flex items-center gap-1',
          statusConfig.bg, statusConfig.color, statusConfig.border
        )}>
          <span>{statusConfig.emoji}</span>
          <span>{statusConfig.label}</span>
        </span>
      </div>

      {/* Customer + garment */}
      <button
        onClick={() => router.push(`/orders/${order.id}`)}
        className="w-full text-left mb-3"
      >
        <p className="font-semibold text-slate-800 text-base leading-tight">
          {order.customerName}
        </p>
        {garmentConfig && (
          <p className="text-xs text-slate-400 mt-0.5">
            {garmentConfig.emoji} {garmentConfig.label}
          </p>
        )}
      </button>

      {/* Payment progress */}
      <div className="mb-3">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-slate-500">
            Diya:{' '}
            <span className="font-semibold text-slate-700">
              Rs. {order.amountPaid.toLocaleString()}
            </span>
          </span>
          <span className={cn('font-semibold', balance > 0 ? 'text-red-600' : 'text-green-600')}>
            {balance > 0 ? `Baaki: Rs. ${balance.toLocaleString()}` : 'Poora Mila ✓'}
          </span>
        </div>
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              paymentProgress === 100 ? 'bg-green-500' : 'bg-blue-500'
            )}
            style={{ width: `${paymentProgress}%` }}
          />
        </div>
      </div>

      {/* Bottom row — responsive shrink */}
      <div className="flex items-center justify-between">
        <div className={cn(
          'flex items-center gap-1 text-xs min-w-0',
          isOverdue ? 'text-red-600 font-semibold' : 'text-slate-400'
        )}>
          <Clock size={11} className="shrink-0" />
          <span className="truncate">
            {isOverdue
              ? `${formatDistanceToNow(new Date(order.dueDate))} late`
              : `Due: ${new Date(order.dueDate).toLocaleDateString('en-PK', {
                  day: 'numeric', month: 'short',
                })}`
            }
          </span>
        </div>

        {order.status === 'ready' && (
          <a
            href={buildWhatsAppLink(order)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600
                       text-white text-xs font-semibold px-3 py-1.5 rounded-full
                       transition-colors active:scale-95 shrink-0"
          >
            <MessageCircle size={12} />
            WhatsApp
          </a>
        )}
      </div>
    </div>
  );
}