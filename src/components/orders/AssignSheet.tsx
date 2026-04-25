// src/components/orders/AssignSheet.tsx
'use client'

import { useState, useEffect } from 'react'
import { X, Check, Scissors, UserX } from 'lucide-react'
import { TeamMemberRecord } from '@/lib/db/schema'
import { teamOps, orderOps } from '@/lib/db/operations'
import { useAuth } from '@/lib/auth/AuthContext'
import { cn } from '@/lib/utils'

interface AssignSheetProps {
  orderId:         string
  currentAssignee: string | undefined
  onClose:         () => void
  onAssigned:      () => void
}

export function AssignSheet({ orderId, currentAssignee, onClose, onAssigned }: AssignSheetProps) {
  const { shopId } = useAuth()
  const [members,  setMembers]  = useState<TeamMemberRecord[]>([])
  const [selected, setSelected] = useState<string | null>(currentAssignee ?? null)
  const [saving,   setSaving]   = useState(false)

  useEffect(() => {
    if (shopId) {
      teamOps.getAll(shopId).then(all =>
        setMembers(all.filter(m => m.role === 'karigar'))
      )
    }
  }, [shopId])

  const handleSave = async () => {
    if (selected === currentAssignee) { onClose(); return }
    setSaving(true)
    try {
      if (selected) {
        const member = members.find(m => m.id === selected)
        if (member) await orderOps.assign(orderId, selected, member.name)
      }
      onAssigned()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center lg:items-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-107.5 bg-white rounded-t-3xl lg:rounded-2xl
                   px-5 pt-4 pb-8 lg:pb-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-5 lg:hidden" />

        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-slate-800">Karigar Ko Assign Karein</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100">
            <X size={15} className="text-slate-500" />
          </button>
        </div>

        {members.length === 0 ? (
          <div className="text-center py-8">
            <Scissors size={32} className="text-slate-200 mx-auto mb-3" />
            <p className="text-slate-500 text-sm font-medium">Koi karigar nahi</p>
            <p className="text-slate-400 text-xs mt-1">Settings mein karigar add karein</p>
          </div>
        ) : (
          <>
            <div className="space-y-2 mb-4">
              {/* Unassign option */}
              <button
                onClick={() => setSelected(null)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 transition-all',
                  !selected
                    ? 'border-slate-400 bg-slate-50'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                )}
              >
                <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                  <UserX size={16} className="text-slate-500" />
                </div>
                <p className="font-semibold text-slate-700 text-sm flex-1 text-left">
                  Kisi Ko Assign Na Karein
                </p>
                {!selected && <Check size={16} className="text-slate-600 shrink-0" />}
              </button>

              {/* Team members */}
              {members.map(m => {
                const isSelected = selected === m.id
                return (
                  <button
                    key={m.id}
                    onClick={() => setSelected(m.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 transition-all text-left',
                      isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    )}
                  >
                    {/* Avatar */}
                    <div className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0',
                      isSelected ? 'bg-blue-600 text-white' : 'bg-green-100 text-green-700'
                    )}>
                      {isSelected ? <Check size={16} /> : m.name.charAt(0).toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 text-sm truncate">{m.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {m.speciality && (
                          <span className="text-[10px] text-blue-600 font-medium">
                            ✂️ {m.speciality}
                          </span>
                        )}
                        {m.payRate && m.payRate > 0 && (
                          <span className="text-[10px] text-green-600">
                            Rs.{m.payRate}/{m.payRateType === 'per_order' ? 'order' : m.payRateType}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-blue-600 disabled:bg-slate-300 text-white font-bold
                         py-4 rounded-2xl transition-colors active:scale-[0.98]"
            >
              {saving ? 'Assign ho raha hai...' : 'Assign Karein ✓'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}