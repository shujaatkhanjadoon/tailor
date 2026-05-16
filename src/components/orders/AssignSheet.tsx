// src/components/orders/AssignSheet.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { X, Check, Scissors, UserX, Plus } from 'lucide-react'
import { db, TeamMemberRecord, OrderRecord } from '@/lib/db/schema'
import { teamOps, orderOps } from '@/lib/db/operations'
import { useAuth } from '@/lib/auth/AuthContext'
import { cn } from '@/lib/utils'
import { usePlan } from '@/hooks/usePlan'
import { getKarigarLimitMessage, getSelectableKarigarIds } from '@/lib/team/karigar-limits'
import { GARMENT_LABELS, GarmentType } from '@/types'

interface AssignSheetProps {
  orderId:         string
  currentAssignee: string | undefined
  onClose:         () => void
  onAssigned:      () => void
}

const SPECIALITY_TO_GARMENTS: Record<string, GarmentType[]> = {
  'Shalwar Kameez': ['shalwar_kameez'],
  'Kurta/Kurti': ['kurta', 'kurti'],
  Shirt: ['shirt'],
  'Trouser/Pajama': ['trouser', 'pajama'],
  Sherwani: ['sherwani'],
  Coat: ['waistcoat', 'prince_coat', 'pant_coat', 'blazer', 'jacket'],
  'Ladies Formal': ['lehenga', 'maxi', 'kurti'],
  'Sab Kuch': ['shalwar_kameez', 'kurta', 'kurti', 'shirt', 'trouser', 'pajama', 'sherwani', 'waistcoat', 'prince_coat', 'pant_coat', 'lehenga', 'maxi', 'blazer', 'jacket', 'other'],
}

function canKarigarHandleGarment(member: TeamMemberRecord, garmentType?: string) {
  if (!garmentType) return true
  const speciality = member.speciality ?? 'Sab Kuch'
  const allowed = speciality
    .split(',')
    .map(s => s.trim())
    .flatMap(s => SPECIALITY_TO_GARMENTS[s] ?? [])

  return allowed.length === 0 || allowed.includes(garmentType as GarmentType)
}

export function AssignSheet({ orderId, currentAssignee, onClose, onAssigned }: AssignSheetProps) {
  const router = useRouter()
  const { shopId } = useAuth()
  const plan = usePlan()
  const [members,  setMembers]  = useState<TeamMemberRecord[]>([])
  const [order,    setOrder]    = useState<OrderRecord | null>(null)
  const [selected, setSelected] = useState<string | null>(currentAssignee ?? null)
  const [saving,   setSaving]   = useState(false)

  useEffect(() => {
    if (shopId) {
      Promise.all([teamOps.getAll(shopId), db.orders.get(orderId)]).then(([all, orderRecord]) => {
        const karigars = all
          .filter(m => m.role === 'karigar')
          .sort((a, b) => {
            const joined = a.joinedAt.localeCompare(b.joinedAt)
            if (joined !== 0) return joined
            return a.createdAt.localeCompare(b.createdAt)
          })
        setMembers(karigars)
        setOrder(orderRecord ?? null)
      })
    }
  }, [shopId, orderId])

  const selectableIds = getSelectableKarigarIds(members, plan.karigarLimit)
  const selectedMember = selected ? members.find(m => m.id === selected) : null
  const selectedIsDisabled = selected !== null && (
    !selectableIds.has(selected) ||
    (selectedMember ? !canKarigarHandleGarment(selectedMember, order?.garmentType) : false)
  )
  const garmentLabel = order?.garmentType
    ? GARMENT_LABELS[order.garmentType as GarmentType]?.label ?? order.garmentType
    : null

  const handleSave = async () => {
    if (selected === currentAssignee) { onClose(); return }
    if (selectedIsDisabled) return
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
        className="relative max-h-[92dvh] w-full max-w-[min(100vw,34rem)] overflow-y-auto bg-white px-5 pt-4 pb-8 shadow-2xl rounded-t-3xl lg:rounded-2xl lg:pb-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-5 lg:hidden" />

        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-slate-800">Karigar Ko Assign Karein</h3>
          <button
            aria-label="Close assign sheet"
            onClick={onClose}
            className="w-11 h-11 flex items-center justify-center rounded-full bg-slate-100"
          >
            <X size={15} className="text-slate-500" />
          </button>
        </div>

        {members.length === 0 ? (
          <div className="text-center py-8">
            <Scissors size={32} className="text-slate-200 mx-auto mb-3" />
            <p className="text-slate-500 text-sm font-medium">Koi karigar nahi</p>
            <p className="text-slate-400 text-xs mt-1">
              Pehle karigar add karein, phir order assign ho sake ga.
            </p>
            <button
              onClick={() => {
                onClose()
                router.push('/settings/team')
              }}
              className="mt-4 inline-flex items-center gap-2 bg-blue-600 text-white
                         text-sm font-bold px-4 py-2.5 rounded-xl"
            >
              <Plus size={14} />
              Naya Karigar Add Karein
            </button>
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
                const specialityMatch = canKarigarHandleGarment(m, order?.garmentType)
                const canSelect = selectableIds.has(m.id) && specialityMatch
                return (
                  <button
                    key={m.id}
                    onClick={() => {
                      if (canSelect) setSelected(m.id)
                    }}
                    disabled={!canSelect}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 transition-all text-left',
                      !canSelect
                        ? 'border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed'
                        : isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    )}
                  >
                    {/* Avatar */}
                    <div className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0',
                      !canSelect
                        ? 'bg-slate-200 text-slate-400'
                        : isSelected ? 'bg-blue-600 text-white' : 'bg-green-100 text-green-700'
                    )}>
                      {isSelected ? <Check size={16} /> : m.name.charAt(0).toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 text-sm truncate">{m.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {!canSelect && (
                          <span className="text-[10px] text-slate-500 font-semibold">
                            {!selectableIds.has(m.id)
                              ? 'Plan limit'
                              : `${garmentLabel ?? 'Order'} ka kaam nahi`}
                          </span>
                        )}
                        {m.speciality && (
                          <span className="text-[10px] text-blue-600 font-medium">
                            ✂️ {m.speciality}
                          </span>
                        )}
                        {plan.plan === 'business' && plan.isActive && m.payRate && m.payRate > 0 && (
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
              disabled={saving || selectedIsDisabled}
              className="w-full bg-blue-600 disabled:bg-slate-300 text-white font-bold
                         py-4 rounded-2xl transition-colors active:scale-[0.98]"
            >
              {selectedIsDisabled
                ? selectedMember && !canKarigarHandleGarment(selectedMember, order?.garmentType)
                  ? `${selectedMember.name} ${garmentLabel ?? 'is order'} ke liye select nahi ho sakta`
                  : getKarigarLimitMessage(plan.karigarLimit)
                : saving ? 'Assign ho raha hai...' : 'Assign Karein ✓'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
