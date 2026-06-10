'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { ScrollText, CheckCircle2, XCircle, Settings, Bell, RefreshCw, ChevronDown } from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

type AuditLog = {
  id: string
  action: string
  performed_at: string
  details?: Record<string, unknown> | null
  shops?: { shop_name?: string; owner_phone?: string } | null
}

const ACTION_CONFIG: Record<string, { label: string; icon: LucideIcon; color: string }> = {
  activate_subscription: { label: 'Activated', icon: CheckCircle2, color: 'text-green-400' },
  reject_payment: { label: 'Rejected', icon: XCircle, color: 'text-red-400' },
  manual_plan_change: { label: 'Plan Changed', icon: Settings, color: 'text-blue-400' },
  shop_deactivated: { label: 'Shop Disabled', icon: XCircle, color: 'text-amber-400' },
  shop_activated: { label: 'Shop Enabled', icon: CheckCircle2, color: 'text-green-400' },
  reminder_sent: { label: 'Reminder Sent', icon: Bell, color: 'text-purple-400' },
  subscription_cancelled: { label: 'Cancelled', icon: XCircle, color: 'text-orange-400' },
  admin_login: { label: 'Admin Login', icon: Settings, color: 'text-slate-400' },
  refund_payment: { label: 'Refunded', icon: XCircle, color: 'text-blue-400' },
  shop_deleted: { label: 'Shop Deleted', icon: XCircle, color: 'text-red-400' },
  reset_owner_pin: { label: 'PIN Reset', icon: Settings, color: 'text-amber-400' },
  bulk_set_plan: { label: 'Bulk Plan', icon: Settings, color: 'text-purple-400' },
  bulk_extend_expiry: { label: 'Bulk Extend', icon: Settings, color: 'text-purple-400' },
  block_ip: { label: 'IP Blocked', icon: XCircle, color: 'text-red-400' },
  unblock_ip: { label: 'IP Unblocked', icon: CheckCircle2, color: 'text-green-400' },
  create_admin: { label: 'Admin Created', icon: Settings, color: 'text-blue-400' },
  verify_shop: { label: 'Shop Verified', icon: CheckCircle2, color: 'text-green-400' },
}

const PER_PAGE = 50

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [hasMore, setHasMore] = useState(true)
  const offsetRef = useRef(0)

  const load = useCallback(async (append = false) => {
    if (append) setLoadingMore(true); else setLoading(true)
    setError('')
    try {
      const offset = append ? offsetRef.current : 0
      const res = await fetch(`/api/admin/data?type=logs&limit=${PER_PAGE}&offset=${offset}`)
      if (res.status === 401) { window.location.href = '/admin/login'; return }
      const d = await res.json()
      if (d.error) throw new Error(d.error)
      const batch = (d.data ?? []) as AuditLog[]
      if (append) {
        setLogs(prev => [...prev, ...batch])
        offsetRef.current += batch.length
      } else {
        setLogs(batch)
        offsetRef.current = PER_PAGE
      }
      setHasMore(batch.length >= PER_PAGE)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false); setLoadingMore(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <ScrollText size={22} className="text-blue-400" />
            Audit Log
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {loading ? 'Loading...' : `${logs.length} entries`}
          </p>
        </div>
        <button
          onClick={() => load()}
          disabled={loading}
          className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700
                     text-slate-300 font-semibold px-3 py-2 rounded-xl text-sm
                     disabled:opacity-50 transition-colors"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-2xl p-4">
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden">
        {loading && (
          <div className="space-y-0 divide-y divide-slate-800">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse bg-slate-800/50" />
            ))}
          </div>
        )}

        {!loading && logs.length === 0 && (
          <div className="flex flex-col items-center py-16 px-4 text-center">
            <ScrollText size={40} className="text-slate-700 mb-4" />
            <p className="text-slate-500 font-semibold">No audit logs yet</p>
            <p className="text-slate-600 text-sm mt-1">Admin actions will appear here</p>
          </div>
        )}

        {!loading && logs.length > 0 && (
          <>
            <div className="divide-y divide-slate-800">
              {logs.map((log) => {
                const cfg = ACTION_CONFIG[log.action] ?? {
                  label: log.action.replace(/_/g, ' '),
                  icon: Settings,
                  color: 'text-slate-400',
                }
                const Icon = cfg.icon
                const shop = log.shops
                const performedAt = new Date(log.performed_at)

                return (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 px-3 py-4 transition-colors hover:bg-slate-800/50 sm:gap-4 sm:px-5"
                  >
                    <div className="w-8 h-8 bg-slate-800 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                      <Icon size={14} className={cfg.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-x-2 gap-y-1 flex-wrap">
                        <span className={cn('text-sm font-bold', cfg.color)}>
                          {cfg.label}
                        </span>
                        {shop?.shop_name && (
                          <span className="min-w-0 max-w-full truncate text-sm text-slate-400">
                            - {shop.shop_name}
                          </span>
                        )}
                      </div>
                      {shop?.owner_phone && (
                        <p className="text-slate-600 text-xs font-mono mt-0.5 break-all">
                          {shop.owner_phone}
                        </p>
                      )}
                      {log.details && Object.keys(log.details).length > 0 && (
                        <p className="mt-1 wrap-break-word font-mono text-[10px] text-slate-600">
                          {JSON.stringify(log.details).slice(0, 160)}
                        </p>
                      )}
                    </div>
                    <div className="hidden sm:block text-right shrink-0">
                      <p className="text-slate-500 text-xs">
                        {formatDistanceToNow(performedAt, { addSuffix: true })}
                      </p>
                      <p className="text-slate-700 text-[10px] mt-0.5">
                        {format(performedAt, 'd MMM, h:mm a')}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
            {hasMore && (
              <div className="flex justify-center py-4 border-t border-slate-800">
                <button
                  onClick={() => load(true)}
                  disabled={loadingMore}
                  className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600
                             text-slate-300 text-xs font-semibold px-4 py-2.5 rounded-xl
                             disabled:opacity-50 transition-colors"
                >
                  {loadingMore ? (
                    <RefreshCw size={12} className="animate-spin" />
                  ) : (
                    <ChevronDown size={12} />
                  )}
                  {loadingMore ? "Loading..." : "Load More"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
