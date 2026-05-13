// src/components/orders/wizard/Step1Customer.tsx
'use client'

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Search, UserPlus, Phone, ChevronRight, Check, Loader2 } from 'lucide-react'
import { db, CustomerRecord } from '@/lib/db/schema'
import { customerOps } from '@/lib/db/operations'
import { useAuth } from '@/lib/auth/AuthContext'
import { cn } from '@/lib/utils'

interface Step1Props {
  data: {
    customerId?:    string
    customerName?:  string
    customerPhone?: string
  }
  onUpdate: (d: {
    customerId:    string
    customerName:  string
    customerPhone: string
  }) => void
  onNext: () => void
}

export function Step1Customer({ data, onUpdate, onNext }: Step1Props) {
  const { shopId }           = useAuth()
  const [query, setQuery]    = useState('')
  const [showNewForm, setShowNewForm] = useState(false)
  const [newName,  setNewName]  = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newGender, setNewGender] = useState<'male'|'female'|'child'>('male')
  const [saving, setSaving]  = useState(false)
  const [saveError, setSaveError] = useState('')

  // ── Live query from real IndexedDB ─────────────────────────────
  const allCustomers = useLiveQuery(
    async (): Promise<CustomerRecord[]> => {
      if (!shopId) return []
      return db.customers
        .where({ shopId, _deleted: 0 })
        .toArray()
    },
    [shopId]
  )

  const isLoading = allCustomers === undefined
  const safe      = allCustomers ?? []

  // Filter by search query
  const filtered = query.trim()
    ? safe.filter(c =>
        c.name.toLowerCase().includes(query.toLowerCase()) ||
        c.phone.includes(query)
      )
    : safe.sort((a, b) => {
        // Sort by last order date, then name
        if (a.lastOrderAt && b.lastOrderAt)
          return b.lastOrderAt.localeCompare(a.lastOrderAt)
        if (a.lastOrderAt) return -1
        if (b.lastOrderAt) return 1
        return a.name.localeCompare(b.name)
      })

  const selectCustomer = (c: CustomerRecord) => {
    onUpdate({ customerId: c.id, customerName: c.name, customerPhone: c.phone })
  }

  const handleNewCustomer = async () => {
    if (!newName.trim() || newPhone.length < 10) return
    if (!shopId) {
      setSaveError('Shop setup nahi hua. Setup page par jayein.')
      return
    }
    setSaving(true)
    setSaveError('')
    try {
      const customer = await customerOps.add(shopId, {
        name:    newName.trim(),
        phone:   newPhone,
        gender:  newGender,
        whatsapp: newPhone,
      })
      // Auto-select the newly created customer
      onUpdate({
        customerId:    customer.id,
        customerName:  customer.name,
        customerPhone: customer.phone,
      })
      setShowNewForm(false)
      setNewName('')
      setNewPhone('')
    } catch (e) {
      console.error(e)
      setSaveError('Save nahi hua. Dobara try karein.')
    } finally {
      setSaving(false)
    }
  }

  const selectedId = data.customerId

  return (
    <div className="space-y-4 mb-16 lg:mb-0">

      {/* Search bar */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Naam ya number se dhundein..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-3 bg-slate-100 rounded-xl text-sm
                     border-2 border-transparent focus:border-blue-500 focus:bg-white
                     outline-none transition-all"
        />
      </div>

      {/* Add new customer toggle */}
      <button
        onClick={() => setShowNewForm(v => !v)}
        className="w-full flex items-center justify-center gap-2 border-2 border-dashed
                   border-slate-300 text-slate-500 text-sm font-medium py-3 rounded-xl
                   hover:border-blue-400 hover:text-blue-600 transition-colors"
      >
        <UserPlus size={16} />
        Naya Gahak Banayein
      </button>

      {/* New customer inline form */}
      {showNewForm && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
          <p className="text-sm font-semibold text-slate-700">Naya Gahak</p>

          {/* Gender quick pick */}
          <div className="grid grid-cols-3 gap-2">
            {(['male','female','child'] as const).map(g => (
              <button
                key={g}
                onClick={() => setNewGender(g)}
                className={cn(
                  'py-2.5 rounded-xl border-2 text-xs font-semibold transition-colors',
                  newGender === g
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-600'
                )}
              >
                {g === 'male' ? '👨 Mard' : g === 'female' ? '👩 Aurat' : '👦 Bachcha'}
              </button>
            ))}
          </div>

          <input
            type="text"
            placeholder="Poora naam *"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl
                       text-sm outline-none focus:border-blue-500 transition-colors"
          />

          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-3">
            <Phone size={14} className="text-slate-400 shrink-0" />
            <input
              type="tel"
              placeholder="Phone number *"
              value={newPhone}
              onChange={e => setNewPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
              className="flex-1 text-sm outline-none font-mono"
            />
            {newPhone.length >= 10 && (
              <span className="text-green-500 text-xs">✓</span>
            )}
          </div>

          {saveError && (
            <p className="text-xs text-red-500 font-medium">{saveError}</p>
          )}

          <button
            onClick={handleNewCustomer}
            disabled={!newName.trim() || newPhone.length < 10 || saving}
            className="w-full bg-blue-600 disabled:bg-slate-300 text-white font-semibold
                       py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
          >
            {saving ? (
              <><Loader2 size={14} className="animate-spin" /> Save ho raha hai...</>
            ) : (
              'Gahak Save Karein ✓'
            )}
          </button>
        </div>
      )}

      {/* Customer list */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">
          {query ? `"${query}" ke natayij` : `${safe.length} Gahak`}
        </p>

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-10 text-slate-400">
            <Loader2 size={20} className="animate-spin mr-2" />
            <span className="text-sm">Load ho raha hai...</span>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && safe.length === 0 && !showNewForm && (
          <div className="text-center py-10">
            <p className="text-2xl mb-3">👥</p>
            <p className="text-sm font-medium text-slate-500">Koi gahak nahi</p>
            <p className="text-xs text-slate-400 mt-1">
              Upar "Naya Gahak Banayein" se add karein
            </p>
          </div>
        )}

        {/* No search results */}
        {!isLoading && safe.length > 0 && filtered.length === 0 && (
          <div className="text-center py-8 text-slate-400">
            <p className="text-sm">Koi gahak nahi mila</p>
            <button
              onClick={() => setQuery('')}
              className="text-xs text-blue-500 mt-1 font-medium"
            >
              Search hatayein
            </button>
          </div>
        )}

        {/* Customer cards */}
        {!isLoading && filtered.map(c => {
          const isSelected = c.id === selectedId
          return (
            <button
              key={c.id}
              onClick={() => selectCustomer(c)}
              className={cn(
                'w-full flex items-center gap-3 p-4 rounded-2xl border-2 text-left',
                'transition-all active:scale-[0.98]',
                isSelected
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-slate-100 bg-white hover:border-slate-300'
              )}
            >
              {/* Avatar */}
              <div className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-sm font-bold',
                isSelected ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
              )}>
                {isSelected
                  ? <Check size={16} />
                  : c.name.charAt(0).toUpperCase()
                }
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800 truncate">{c.name}</p>
                <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                  <Phone size={10} />
                  {c.phone}
                </p>
                {c.totalOrders > 0 && (
                  <p className="text-[10px] text-blue-500 mt-0.5">
                    {c.totalOrders} purane order
                  </p>
                )}
              </div>

              <ChevronRight
                size={16}
                className={isSelected ? 'text-blue-500' : 'text-slate-300'}
              />
            </button>
          )
        })}
      </div>

      {/* Sticky Next button */}
      <div className="fixed inset-x-0 bottom-0 z-10 w-full bg-white border-t border-slate-100 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]
                      lg:static lg:max-w-none lg:pb-4 mb-16 lg:mb-0">
        <button
          onClick={onNext}
          disabled={!selectedId}
          className="w-full bg-blue-600 disabled:bg-slate-300 disabled:cursor-not-allowed
                     text-white font-bold py-4 rounded-2xl text-base
                     transition-colors active:scale-[0.98]"
        >
          {selectedId
            ? `${data.customerName} — Aage Barein →`
            : 'Pehle Gahak Chunein'
          }
        </button>
      </div>
      <div className="h-24 lg:h-0" />
    </div>
  )
}
