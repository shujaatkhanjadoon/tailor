'use client'

import { useState, useEffect } from 'react'
import { Trash2, RotateCcw, AlertTriangle, RefreshCw, User, ShoppingBag } from 'lucide-react'
import { toast } from 'sonner'
import { customerOps, orderOps } from '@/lib/db/operations'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { formatDistanceToNow } from 'date-fns'

interface TrashCustomer {
  id: string
  name: string
  phone: string
  deleted_at: string
}

interface TrashOrder {
  id: string
  order_number: number
  customer_name: string
  status: string
  amount: number
  deleted_at: string
}

const DAYS_UNTIL_PURGE = 30

function daysRemaining(deletedAt: string): number {
  const deleted = new Date(deletedAt).getTime()
  const deadline = deleted + DAYS_UNTIL_PURGE * 86400000
  const remaining = Math.ceil((deadline - Date.now()) / 86400000)
  return Math.max(0, remaining)
}

export default function TrashPage() {
  const [customers, setCustomers] = useState<TrashCustomer[]>([])
  const [orders, setOrders] = useState<TrashOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pending, setPending] = useState<string | null>(null)
  const [dialog, setDialog] = useState<{ type: 'customer' | 'order'; id: string; action: 'recover' | 'purge'; name: string } | null>(null)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/trash')
      if (res.status === 401) { window.location.href = '/auth'; return }
      const d = await res.json()
      if (d.error) throw new Error(d.error)
      setCustomers(d.customers ?? [])
      setOrders(d.orders ?? [])
    } catch (e) { setError(String(e)) } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleRecover = async (type: 'customer' | 'order', id: string) => {
    setPending(id)
    setDialog(null)
    try {
      if (type === 'customer') {
        await customerOps.recover(id)
        setCustomers(prev => prev.filter(c => c.id !== id))
      } else {
        await orderOps.recover(id)
        setOrders(prev => prev.filter(o => o.id !== id))
      }
      toast.success('Record recovered successfully')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Recover failed')
    } finally { setPending(null) }
  }

  const handlePurge = async (type: 'customer' | 'order', id: string) => {
    setPending(id)
    setDialog(null)
    try {
      if (type === 'customer') {
        await customerOps.purge(id)
        setCustomers(prev => prev.filter(c => c.id !== id))
      } else {
        await orderOps.purge(id)
        setOrders(prev => prev.filter(o => o.id !== id))
      }
      toast.success('Record permanently deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Permanent delete failed')
    } finally { setPending(null) }
  }

  const totalItems = customers.length + orders.length
  const isEmpty = !loading && totalItems === 0

  return (
    <div className="min-h-screen bg-slate-50 pb-24 lg:pb-10">
    <div className="mx-auto px-4 pt-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Trash</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {totalItems > 0
              ? `${totalItems} item(s) delete kiye gaye. Auto-purge ${DAYS_UNTIL_PURGE} days baad.`
              : 'Deleted records appear here'}
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold px-3 py-2 rounded-xl transition-colors disabled:opacity-50"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm">
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-16">
          <RefreshCw size={24} className="animate-spin text-slate-300" />
        </div>
      )}

      {isEmpty && (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <Trash2 size={40} className="mb-3 opacity-40" />
          <p className="text-sm font-medium">Trash empty</p>
          <p className="text-xs mt-1">Deleted customers aur orders yahan aayenge</p>
        </div>
      )}

      {/* Deleted Customers */}
      {customers.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
            <User size={14} /> Customers ({customers.length})
          </h2>
          <div className="space-y-2">
            {customers.map(c => {
              const remain = daysRemaining(c.deleted_at)
              return (
                <div key={c.id} className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                    <User size={14} className="text-red-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{c.name}</p>
                    <p className="text-[11px] text-slate-500">
                      Deleted {formatDistanceToNow(new Date(c.deleted_at), { addSuffix: true })}
                      {remain > 0 ? ` · Auto-purge in ${remain}d` : <span className="text-red-500 font-medium"> · Auto-purge pending</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setDialog({ type: 'customer', id: c.id, action: 'recover', name: c.name })}
                      disabled={pending === c.id}
                      className="flex items-center gap-1 bg-green-50 hover:bg-green-100 text-green-700 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <RotateCcw size={12} /> Recover
                    </button>
                    <button
                      onClick={() => setDialog({ type: 'customer', id: c.id, action: 'purge', name: c.name })}
                      disabled={pending === c.id}
                      className="flex items-center gap-1 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Deleted Orders */}
      {orders.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
            <ShoppingBag size={14} /> Orders ({orders.length})
          </h2>
          <div className="space-y-2">
            {orders.map(o => {
              const remain = daysRemaining(o.deleted_at)
              return (
                <div key={o.id} className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                    <ShoppingBag size={14} className="text-red-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      #{o.order_number} — {o.customer_name}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Deleted {formatDistanceToNow(new Date(o.deleted_at), { addSuffix: true })}
                      {remain > 0 ? ` · Auto-purge in ${remain}d` : <span className="text-red-500 font-medium"> · Auto-purge pending</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setDialog({ type: 'order', id: o.id, action: 'recover', name: `#${o.order_number} — ${o.customer_name}` })}
                      disabled={pending === o.id}
                      className="flex items-center gap-1 bg-green-50 hover:bg-green-100 text-green-700 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <RotateCcw size={12} /> Recover
                    </button>
                    <button
                      onClick={() => setDialog({ type: 'order', id: o.id, action: 'purge', name: `#${o.order_number} — ${o.customer_name}` })}
                      disabled={pending === o.id}
                      className="flex items-center gap-1 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>

      <ConfirmDialog
        open={dialog !== null}
        onOpenChange={(open) => { if (!open) setDialog(null) }}
        title={dialog ? `${dialog.action === 'recover' ? 'Recover' : 'Permanently Delete'} ${dialog.name}?` : ''}
        description={dialog?.action === 'recover'
          ? 'Yeh record wapas aa jayega aur aap isay dobara use kar sakenge.'
          : 'Yeh record permanently delete ho jayega aur wapas nahi aayega.'}
        confirmLabel={dialog?.action === 'recover' ? 'Recover' : 'Delete Forever'}
        cancelLabel="Cancel"
        variant={dialog?.action === 'purge' ? 'danger' : 'default'}
        onConfirm={() => {
          if (!dialog) return
          if (dialog.action === 'recover') handleRecover(dialog.type, dialog.id)
          else handlePurge(dialog.type, dialog.id)
        }}
        loading={pending !== null}
      />
    </div>
  )
}
