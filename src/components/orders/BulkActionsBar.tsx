'use client'

import { useState } from 'react'
import { X, CheckCheck, UserPlus, UserMinus, Loader2 } from 'lucide-react'
import { ORDER_STATUS_CONFIG, OrderStatus } from '@/types'
import { cn } from '@/lib/utils'

interface BulkActionsBarProps {
  selectedCount: number
  totalCount: number
  onClear: () => void
  onSelectAll: () => void
  onUpdateStatus: (status: string) => Promise<void>
  onAssign: () => void
  onUnassign: () => Promise<void>
  disabled?: boolean
}

export function BulkActionsBar({
  selectedCount,
  totalCount,
  onClear,
  onSelectAll,
  onUpdateStatus,
  onAssign,
  onUnassign,
  disabled = false,
}: BulkActionsBarProps) {
  const [showStatusPicker, setShowStatusPicker] = useState(false)
  const [busy, setBusy] = useState(false)

  if (selectedCount === 0) return null

  const statuses = Object.entries(ORDER_STATUS_CONFIG).filter(
    ([key]) => !['delivered', 'cancelled'].includes(key)
  )

  const handleStatus = async (status: string) => {
    setBusy(true)
    setShowStatusPicker(false)
    try {
      await onUpdateStatus(status)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed bottom-24 lg:bottom-4 left-1/2 -translate-x-1/2 z-40
      bg-slate-900 text-white rounded-2xl shadow-2xl px-4 py-3
      flex items-center gap-2 flex-wrap justify-center
      border border-slate-700 backdrop-blur-sm bg-slate-900/95
      max-w-[95vw] animate-in slide-in-from-bottom-2"
    >
      {/* Selection count */}
      <span className="text-xs font-bold text-slate-300 whitespace-nowrap mr-1">
        {selectedCount} / {totalCount}
      </span>

      {/* Select all shortcut */}
      {selectedCount < totalCount && (
        <button
          onClick={onSelectAll}
          disabled={disabled}
          className="text-[10px] font-semibold text-blue-400 hover:text-blue-300 px-1.5"
        >
          All
        </button>
      )}

      <div className="w-px h-5 bg-slate-600 mx-1" />

      {/* Status button */}
      <div className="relative">
        <button
          onClick={() => setShowStatusPicker(v => !v)}
          disabled={disabled || busy}
          className={cn(
            'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold',
            'bg-blue-600 hover:bg-blue-500 transition-colors',
            busy && 'opacity-50'
          )}
        >
          {busy ? <Loader2 size={12} className="animate-spin" /> : <CheckCheck size={12} />}
          Status
        </button>

        {showStatusPicker && (
          <div className="absolute bottom-full left-0 mb-2 bg-white rounded-xl shadow-xl
            border border-slate-200 overflow-hidden min-w-36">
            {statuses.map(([key, cfg]) => (
              <button
                key={key}
                onClick={() => handleStatus(key as OrderStatus)}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium
                  text-slate-700 hover:bg-slate-50 transition-colors text-left"
              >
                <span>{cfg.emoji}</span>
                <span>{cfg.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Assign button */}
      <button
        onClick={onAssign}
        disabled={disabled || busy}
        className={cn(
          'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold',
          'bg-green-600 hover:bg-green-500 transition-colors',
          busy && 'opacity-50'
        )}
      >
        <UserPlus size={12} />
        Assign
      </button>

      {/* Unassign button */}
      <button
        onClick={onUnassign}
        disabled={disabled || busy}
        className={cn(
          'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold',
          'bg-amber-600 hover:bg-amber-500 transition-colors',
          busy && 'opacity-50'
        )}
      >
        <UserMinus size={12} />
        Unassign
      </button>

      <div className="w-px h-5 bg-slate-600 mx-1" />

      {/* Clear */}
      <button
        onClick={onClear}
        disabled={busy}
        className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold
          text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
      >
        <X size={12} />
        Clear
      </button>
    </div>
  )
}
