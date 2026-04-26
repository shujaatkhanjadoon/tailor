// src/components/orders/StatusUpdateSheet.tsx
'use client'

import { useState } from 'react'
import { X, ArrowRight } from 'lucide-react'
import { OrderRecord } from '@/lib/db/schema'
import { orderOps } from '@/lib/db/operations'
import { ORDER_STATUS_CONFIG, OrderStatus } from '@/types'
import { useAuth } from '@/lib/auth/AuthContext'
import { cn } from '@/lib/utils'
import { toast } from "sonner"

// Valid next statuses from current
const NEXT_STATUSES: Record<OrderStatus, OrderStatus[]> = {
  received:  ['cutting',  'cancelled'],
  cutting:   ['stitching','received', 'cancelled'],
  stitching: ['finishing','cutting',  'cancelled'],
  finishing: ['ready',    'stitching','cancelled'],
  ready:     ['delivered','finishing'],
  delivered: [],
  cancelled: [],
}

interface StatusUpdateSheetProps {
  order:    OrderRecord
  onClose:  () => void
  onUpdate: () => void
}

export function StatusUpdateSheet({ order, onClose, onUpdate }: StatusUpdateSheetProps) {
  const { currentUser } = useAuth()
  const [saving, setSaving] = useState<OrderStatus | null>(null)

  const nextStatuses = NEXT_STATUSES[order.status as OrderStatus]
  const currentConfig = ORDER_STATUS_CONFIG[order.status as OrderStatus]

  const handleUpdate = async (newStatus: OrderStatus) => {
    if (!currentUser) return
    setSaving(newStatus)
    try {
      await orderOps.updateStatus(order.id, newStatus, currentUser.id)
      onUpdate()
      onClose()
    } finally {
      setSaving(null)
      toast.success('Status Update Ho Gaya', {
      description: `${status} → ${newStatus}`,
    })
    }
  }

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-end justify-center lg:items-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Sheet */}
      <div
        className="relative w-full max-w-107.5 bg-white rounded-t-3xl lg:rounded-2xl
                   px-5 pt-4 pb-8 lg:pb-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-5 lg:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-xs text-slate-400 font-medium">
              Order #{String(order.orderNumber).padStart(3,'0')}
            </p>
            <h3 className="text-base font-bold text-slate-800">Status Update Karein</h3>
          </div>
          <button
            aria-label="Close status sheet"
            onClick={onClose}
            className="w-11 h-11 flex items-center justify-center rounded-full bg-slate-100"
          >
            <X size={15} className="text-slate-500" />
          </button>
        </div>

        {/* Current status */}
        <div className={cn(
          'flex items-center gap-3 px-4 py-3 rounded-2xl border mb-4',
          currentConfig.bg, currentConfig.border
        )}>
          <span className="text-2xl">{currentConfig.emoji}</span>
          <div>
            <p className="text-xs text-slate-500">Abhi ka status</p>
            <p className={cn('font-bold text-sm', currentConfig.color)}>
              {currentConfig.label}
            </p>
          </div>
          <ArrowRight size={16} className="text-slate-400 ml-auto" />
        </div>

        {/* Next status options */}
        {nextStatuses.length === 0 ? (
          <div className="text-center py-4 text-slate-400 text-sm">
            Aur koi status nahi — order complete hai
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Aage kiya karna hai?
            </p>
            {nextStatuses.map(status => {
              const cfg     = ORDER_STATUS_CONFIG[status]
              const isSaving = saving === status
              const isBack  = NEXT_STATUSES[order.status as OrderStatus].indexOf(status) > 0
                              && status !== 'cancelled'

              return (
                <button
                  key={status}
                  onClick={() => handleUpdate(status)}
                  disabled={!!saving}
                  className={cn(
                    'w-full flex items-center gap-4 px-4 py-4 rounded-2xl border-2',
                    'transition-all active:scale-[0.98] text-left',
                    status === 'cancelled'
                      ? 'border-red-200 bg-red-50 hover:border-red-400'
                      : isBack
                      ? 'border-slate-200 bg-slate-50 hover:border-slate-300'
                      : `${cfg.border} ${cfg.bg} hover:border-opacity-80`,
                    saving ? 'opacity-60' : ''
                  )}
                >
                  <span className="text-2xl shrink-0">
                    {isSaving ? '⏳' : cfg.emoji}
                  </span>
                  <div className="flex-1">
                    <p className={cn(
                      'font-bold text-sm',
                      status === 'cancelled' ? 'text-red-700'
                      : isBack ? 'text-slate-600'
                      : cfg.color
                    )}>
                      {isSaving ? 'Update ho raha hai...' : cfg.label}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {status === 'delivered'  && 'Gahak ne le liya'}
                      {status === 'ready'      && 'Tayyar — gahak ko batao'}
                      {status === 'finishing'  && 'Aakhri kaam ho raha hai'}
                      {status === 'stitching'  && 'Silai shuru'}
                      {status === 'cutting'    && 'Katai shuru'}
                      {status === 'received'   && 'Wapas received par'}
                      {status === 'cancelled'  && 'Order band karo'}
                    </p>
                  </div>
                  {!isSaving && (
                    <ArrowRight size={16} className={cn(
                      'shrink-0',
                      status === 'cancelled' ? 'text-red-400' : 'text-slate-300'
                    )} />
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
