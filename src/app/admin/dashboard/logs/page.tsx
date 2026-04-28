// src/app/admin/dashboard/logs/page.tsx
import { getAuditLog } from '@/lib/admin/audit'
import { ScrollText, CheckCircle2, XCircle, Settings, Bell } from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'

const ACTION_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  activate_subscription: { label: 'Activated',     icon: CheckCircle2, color: 'text-green-400' },
  reject_payment:        { label: 'Rejected',       icon: XCircle,      color: 'text-red-400'   },
  manual_plan_change:    { label: 'Plan Changed',   icon: Settings,     color: 'text-blue-400'  },
  shop_deactivated:      { label: 'Shop Disabled',  icon: XCircle,      color: 'text-amber-400' },
  shop_activated:        { label: 'Shop Enabled',   icon: CheckCircle2, color: 'text-green-400' },
  reminder_sent:         { label: 'Reminder Sent',  icon: Bell,         color: 'text-purple-400' },
  subscription_cancelled:{ label: 'Cancelled',      icon: XCircle,      color: 'text-orange-400' },
  admin_login:           { label: 'Admin Login',    icon: Settings,     color: 'text-slate-400'  },
}

export default async function AuditLogPage() {
  const logs = await getAuditLog(200)

  return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ScrollText size={22} className="text-blue-400" />
            Audit Log
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            All admin actions — last 200 entries
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden">
          {logs.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <ScrollText size={40} className="text-slate-700 mb-4" />
              <p className="text-slate-500 font-semibold">No audit logs yet</p>
              <p className="text-slate-600 text-sm mt-1">
                Admin actions will appear here
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {logs.map((log: any) => {
                const cfg    = ACTION_CONFIG[log.action] ?? {
                  label: log.action, icon: Settings, color: 'text-slate-400'
                }
                const Icon   = cfg.icon
                const shop   = log.shops

                return (
                  <div key={log.id} className="flex items-start gap-4 px-5 py-4
                                               hover:bg-slate-800/50 transition-colors">
                    <div className="w-8 h-8 bg-slate-800 rounded-xl flex items-center
                                    justify-center shrink-0 mt-0.5">
                      <Icon size={14} className={cfg.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn('text-sm font-bold', cfg.color)}>
                          {cfg.label}
                        </span>
                        {shop?.shop_name && (
                          <span className="text-slate-400 text-sm">
                            — {shop.shop_name}
                          </span>
                        )}
                      </div>
                      {shop?.owner_phone && (
                        <p className="text-slate-600 text-xs font-mono mt-0.5">
                          {shop.owner_phone}
                        </p>
                      )}
                      {log.details && Object.keys(log.details).length > 0 && (
                        <p className="text-slate-600 text-[10px] mt-1 font-mono">
                          {JSON.stringify(log.details).slice(0, 120)}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-slate-500 text-xs">
                        {formatDistanceToNow(new Date(log.performed_at), { addSuffix: true })}
                      </p>
                      <p className="text-slate-700 text-[10px] mt-0.5">
                        {format(new Date(log.performed_at), 'd MMM, h:mm a')}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
  )
}
