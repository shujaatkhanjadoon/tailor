// src/app/(marketing)/home/page.tsx
import Link from 'next/link'
import {
  Scissors, CheckCircle, BarChart3, Smartphone,
  Wifi, Users, MessageCircle, Star, ArrowRight,
  Shield, Zap, Globe,
  ClipboardList
} from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white font-sans">

      {/* ── NAVBAR ── */}
      <nav className="border-b border-slate-200 px-6 py-4 flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Scissors size={16} className="text-white" />
          </div>
          <span className="font-bold text-slate-800 text-lg">Darzi Manager</span>
        </div>
        <div className="hidden md:flex items-center gap-8">
          {['Features', 'Pricing', 'About', 'Contact'].map(item => (
            <Link
              key={item}
              href={`/${item.toLowerCase()}`}
              className="text-sm text-slate-600 hover:text-slate-900 font-medium transition-colors"
            >
              {item}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm font-semibold text-slate-700 hover:text-slate-900">
            Sign In
          </Link>
          <Link
            href="/setup"
            className="text-sm font-semibold bg-blue-600 hover:bg-blue-700
                       text-white px-4 py-2 rounded-xl transition-colors"
          >
            Get Started Free
          </Link>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="max-w-7xl mx-auto px-6 py-20 text-center">
        <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200
                        text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
          <Zap size={12} />
          Built for Pakistani Tailors — Works Offline
        </div>
        <h1 className="text-4xl md:text-6xl font-bold text-slate-900 mb-6 leading-tight">
          Run Your Tailor Shop<br />
          <span className="text-blue-600">Smarter, Not Harder</span>
        </h1>
        <p className="text-lg text-slate-500 max-w-2xl mx-auto mb-10 leading-relaxed">
          Darzi Manager helps Pakistani tailors track orders, measurements, payments,
          and customers — all from your phone, even without internet.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/setup"
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700
                       text-white font-bold px-8 py-4 rounded-2xl text-base transition-colors"
          >
            Start Free — No Credit Card
            <ArrowRight size={18} />
          </Link>
          <Link
            href="/pricing"
            className="flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200
                       text-slate-700 font-semibold px-8 py-4 rounded-2xl text-base transition-colors"
          >
            View Pricing
          </Link>
        </div>
        <p className="text-slate-400 text-sm mt-4">Free forever plan available · No setup fees</p>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="bg-slate-50 py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-slate-900 mb-3">
              Everything Your Shop Needs
            </h2>
            <p className="text-slate-500 max-w-xl mx-auto">
              Designed specifically for small tailor shops in Pakistan.
              Simple enough for anyone to use.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: ClipboardList, title: 'Order Management',     color: 'bg-blue-100 text-blue-600',
                desc: 'Track every order from fabric received to delivery. Status updates in one tap.' },
              { icon: Users,         title: 'Customer Profiles',    color: 'bg-green-100 text-green-600',
                desc: 'Store measurements, contact details, and full order history for every customer.' },
              { icon: BarChart3,     title: 'Payment Tracking',     color: 'bg-amber-100 text-amber-600',
                desc: 'Record partial payments, track balances, and see your daily income at a glance.' },
              { icon: Smartphone,   title: 'Mobile First',          color: 'bg-purple-100 text-purple-600',
                desc: 'Designed for low-end Android phones. Fast, light, and easy to use.' },
              { icon: Wifi,         title: 'Works Offline',         color: 'bg-red-100 text-red-600',
                desc: 'No internet? No problem. All data is stored locally and syncs when online.' },
              { icon: MessageCircle,title: 'WhatsApp Integration',  color: 'bg-teal-100 text-teal-600',
                desc: 'Notify customers when orders are ready with one tap via WhatsApp.' },
            ].map(f => (
              <div key={f.title} className="bg-white rounded-2xl border border-slate-200 p-6">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${f.color}`}>
                  <f.icon size={20} />
                </div>
                <h3 className="font-bold text-slate-800 mb-2">{f.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING PREVIEW ── */}
      <section className="py-20 max-w-7xl mx-auto px-6 text-center">
        <h2 className="text-3xl font-bold text-slate-900 mb-3">Simple, Honest Pricing</h2>
        <p className="text-slate-500 mb-10">Start free. Upgrade when you need more.</p>
        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {[
            { name:'Starter', price:'Free',      period:'forever',     highlight:false, cta:'Get Started' },
            { name:'Professional', price:'Rs. 999', period:'/month',   highlight:true,  cta:'Start 14-Day Trial' },
            { name:'Enterprise', price:'Rs. 2,499', period:'/month',   highlight:false, cta:'Contact Us' },
          ].map(p => (
            <div
              key={p.name}
              className={`rounded-2xl border p-6 text-left ${
                p.highlight
                  ? 'border-blue-500 bg-blue-600 text-white'
                  : 'border-slate-200 bg-white'
              }`}
            >
              {p.highlight && (
                <div className="bg-white/20 text-white text-[10px] font-bold px-2 py-1
                                rounded-full inline-block mb-3 uppercase tracking-wide">
                  Most Popular
                </div>
              )}
              <p className={`text-sm font-semibold mb-1 ${p.highlight ? 'text-blue-200' : 'text-slate-400'}`}>
                {p.name}
              </p>
              <p className={`text-3xl font-bold mb-0.5 ${p.highlight ? 'text-white' : 'text-slate-900'}`}>
                {p.price}
              </p>
              <p className={`text-sm mb-6 ${p.highlight ? 'text-blue-200' : 'text-slate-400'}`}>
                {p.period}
              </p>
              <Link
                href="/pricing"
                className={`block text-center font-semibold py-3 rounded-xl text-sm transition-colors ${
                  p.highlight
                    ? 'bg-white text-blue-600 hover:bg-blue-50'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-slate-200 py-12 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
              <Scissors size={13} className="text-white" />
            </div>
            <span className="font-bold text-slate-700">Darzi Manager</span>
          </div>
          <div className="flex gap-6 text-sm text-slate-500">
            {['Privacy Policy','Terms of Service','Contact','About'].map(l => (
              <Link key={l} href={`/${l.toLowerCase().replace(' ','-')}`}
                    className="hover:text-slate-800 transition-colors">
                {l}
              </Link>
            ))}
          </div>
          <p className="text-sm text-slate-400">© 2026 Darzi Manager · Made for Pakistan 🇵🇰</p>
        </div>
      </footer>
    </div>
  )
}