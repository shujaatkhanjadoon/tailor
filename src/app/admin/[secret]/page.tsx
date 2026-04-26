// src/app/admin/[secret]/page.tsx
import { notFound }     from 'next/navigation'
import Link             from 'next/link'
import { Scissors, ShoppingBag, Users, CreditCard, Clock, TrendingUp } from 'lucide-react'
import { getRevenueSummary, getPendingPayments } from '@/lib/billing/admin'

export default async function AdminDashboard({
  params,
}: {
  params: Promise<{ secret: string }>
}) {
  const { secret } = await params

  // Double-check secret server-side (middleware handles first check)
  if (secret !== process.env.ADMIN_SECRET) notFound()

  const [summary, pending] = await Promise.all([
    getRevenueSummary(),
    getPendingPayments(),
  ])

  const stats = [
    {
      label:    'Total Revenue',
      value:    `Rs. ${summary.total.toLocaleString()}`,
      icon:     TrendingUp,
      bg:       'bg-green-50',
      iconBg:   'bg-green-100',
      iconCol:  'text-green-600',
      valCol:   'text-green-800',
    },
    {
      label:    'This Month',
      value:    `Rs. ${summary.thisMonthRevenue.toLocaleString()}`,
      icon:     CreditCard,
      bg:       'bg-blue-50',
      iconBg:   'bg-blue-100',
      iconCol:  'text-blue-600',
      valCol:   'text-blue-800',
    },
    {
      label:    'Active Subs',
      value:    summary.activeSubscriptions,
      icon:     Users,
      bg:       'bg-purple-50',
      iconBg:   'bg-purple-100',
      iconCol:  'text-purple-600',
      valCol:   'text-purple-800',
    },
    {
      label:    'On Trial',
      value:    summary.trialing,
      icon:     Clock,
      bg:       'bg-amber-50',
      iconBg:   'bg-amber-100',
      iconCol:  'text-amber-600',
      valCol:   'text-amber-800',
    },
    {
      label:    'Pending',
      value:    pending.length,
      icon:     ShoppingBag,
      bg:       pending.length > 0 ? 'bg-red-50' : 'bg-slate-50',
      iconBg:   pending.length > 0 ? 'bg-red-100' : 'bg-slate-100',
      iconCol:  pending.length > 0 ? 'text-red-600' : 'text-slate-500',
      valCol:   pending.length > 0 ? 'text-red-700' : 'text-slate-700',
    },
  ]

  return (
    <div className="min-h-screen bg-slate-900 text-white">

      {/* Header */}
      <header className="border-b border-slate-700 px-6 py-4 flex items-center gap-3">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
          <Scissors size={16} className="text-white" />
        </div>
        <div>
          <h1 className="font-bold text-white">Darzi Manager — Super Admin</h1>
          <p className="text-slate-400 text-xs">Platform management dashboard</p>
        </div>
        <div className="ml-auto">
          <span className="text-xs text-slate-500 font-mono bg-slate-800 px-3 py-1.5 rounded-lg">
            🔒 Secure Admin Session
          </span>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {stats.map(s => (
            <div key={s.label} className={`${s.bg} rounded-2xl p-4`}>
              <div className={`w-9 h-9 ${s.iconBg} rounded-xl flex items-center justify-center mb-3`}>
                <s.icon size={17} className={s.iconCol} />
              </div>
              <p className={`text-xl font-bold ${s.valCol}`}>{s.value}</p>
              <p className="text-xs text-slate-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Pending payments alert */}
        {pending.length > 0 && (
          <div className="bg-amber-900/30 border border-amber-600 rounded-2xl px-5 py-4
                          flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock size={20} className="text-amber-400" />
              <div>
                <p className="font-bold text-amber-300">
                  {pending.length} payment{pending.length > 1 ? 's' : ''} pending verification
                </p>
                <p className="text-amber-400/70 text-xs mt-0.5">
                  Shop owners are waiting — verify ASAP
                </p>
              </div>
            </div>
            <Link
              href={`/admin/${secret}/payments`}
              className="bg-amber-500 hover:bg-amber-400 text-amber-900 font-bold
                         px-5 py-2.5 rounded-xl text-sm transition-colors"
            >
              Verify Now →
            </Link>
          </div>
        )}

        {/* Quick nav */}
        <div className="grid lg:grid-cols-2 gap-4">
          {[
            {
              href:     `/admin/${secret}/payments`,
              title:    'Payment Verification',
              desc:     'Pending payments verify karein aur plans activate karein',
              badge:    pending.length > 0 ? `${pending.length} pending` : null,
              color:    'border-amber-600 bg-amber-900/20 hover:bg-amber-900/40',
            },
            {
              href:     `/admin/${secret}/shops`,
              title:    'All Shops',
              desc:     'Sare shops dekhein, plans manage karein',
              badge:    null,
              color:    'border-blue-600 bg-blue-900/20 hover:bg-blue-900/40',
            },
          ].map(card => (
            <Link
              key={card.href}
              href={card.href}
              className={`block border-2 ${card.color} rounded-2xl px-6 py-5 transition-colors`}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-white text-lg">{card.title}</h3>
                {card.badge && (
                  <span className="bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                    {card.badge}
                  </span>
                )}
              </div>
              <p className="text-slate-400 text-sm">{card.desc}</p>
              <p className="text-blue-400 text-sm font-semibold mt-3">Open →</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}