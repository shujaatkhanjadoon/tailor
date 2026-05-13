// src/app/(marketing)/page.tsx
'use client'

import { useState, useEffect, useRef} from 'react'
import Link from 'next/link'
import {
  Scissors, Package, Users, CreditCard, Wifi, QrCode,
  BarChart2, Star, CheckCircle2, ArrowRight,
  ChevronDown, ChevronUp, Smartphone, Shield, Zap,
  Clock, TrendingUp, Heart, MessageCircle, Mail, Globe,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Intersection Observer Hook ────────────────────────────────────
function useInView(threshold = 0.15) {
  const ref      = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true) },
      { threshold }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])

  return { ref, inView }
}

// ── Animated Counter ──────────────────────────────────────────────
function AnimatedCounter({
  end, suffix = '', prefix = '', duration = 2000
}: {
  end: number; suffix?: string; prefix?: string; duration?: number
}) {
  const [count, setCount]     = useState(0)
  const { ref, inView }       = useInView()

  useEffect(() => {
    if (!inView) return
    const start    = 0
    const step     = end / (duration / 16)
    let current    = start
    const timer    = setInterval(() => {
      current += step
      if (current >= end) { setCount(end); clearInterval(timer) }
      else setCount(Math.floor(current))
    }, 16)
    return () => clearInterval(timer)
  }, [inView, end, duration])

  return (
    <span ref={ref}>
      {prefix}{count.toLocaleString()}{suffix}
    </span>
  )
}

// ── Section Wrapper ───────────────────────────────────────────────
function Section({
  id, children, className,
}: {
  id?: string; children: React.ReactNode; className?: string
}) {
  const { ref, inView } = useInView()
  return (
    <section
      id={id}
      ref={ref}
      className={cn(
        'transition-all duration-700',
        inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6',
        className
      )}
    >
      {children}
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────
// DATA
// ─────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon:  Package,
    title: 'Smart Order Tracking',
    desc:  'Har order ka real-time status. QR code se customers khud track kar sakte hain.',
    color: 'text-blue-600', bg: 'bg-blue-50',
  },
  {
    icon:  QrCode,
    title: 'Customer QR Tracking',
    desc:  'Har order ka unique QR code. Customer scan kare aur status khud dekhe.',
    color: 'text-purple-600', bg: 'bg-purple-50',
  },
  {
    icon:  Users,
    title: 'Karigar Management',
    desc:  'Karigars ko orders assign karein. Unka kaam track karein real-time mein.',
    color: 'text-green-600', bg: 'bg-green-50',
  },
  {
    icon:  CreditCard,
    title: 'Payment Tracking',
    desc:  'Cash, Easypaisa, JazzCash — sab payments track. Baaki automatically dekhein.',
    color: 'text-amber-600', bg: 'bg-amber-50',
  },
  {
    icon:  Wifi,
    title: 'Offline Support',
    desc:  'Internet band ho to bhi kaam jari rahega. Data automatically sync hoga.',
    color: 'text-teal-600', bg: 'bg-teal-50',
  },
  {
    icon:  BarChart2,
    title: 'Reports & Analytics',
    desc:  'Monthly income, popular garments, best customers — sab ek jagah.',
    color: 'text-red-600', bg: 'bg-red-50',
  },
  {
    icon:  MessageCircle,
    title: 'WhatsApp Integration',
    desc:  'Customer ko order ready hone par WhatsApp message directly bhejein.',
    color: 'text-green-600', bg: 'bg-green-50',
  },
  {
    icon:  Shield,
    title: 'Secure & Private',
    desc:  'Aapka data sirf aapka hai. Bank-level encryption. Kabhi share nahi hota.',
    color: 'text-slate-600', bg: 'bg-slate-50',
  },
]

const STEPS = [
  {
    num:   '01',
    icon:  Smartphone,
    title: 'Free Account Banayein',
    desc:  'Phone number daalein, dukaan ka naam likhein. 2 minute mein ready.',
    color: 'from-blue-500 to-blue-600',
  },
  {
    num:   '02',
    icon:  Package,
    title: 'Orders Add Karein',
    desc:  'Gahak ki nap, kapra details, delivery date — sab ek form mein.',
    color: 'from-purple-500 to-purple-600',
  },
  {
    num:   '03',
    icon:  Users,
    title: 'Karigar Ko Assign Karein',
    desc:  'Kaunsa karigar kya karega? Assign karein aur track karein.',
    color: 'from-amber-500 to-amber-600',
  },
  {
    num:   '04',
    icon:  CheckCircle2,
    title: 'Deliver Karein & Earn Karein',
    desc:  'Order deliver ho, payment record ho, customer happy ho. Shukriya!',
    color: 'from-green-500 to-green-600',
  },
]

const STATS = [
  { label: 'Registered Shops',  value: 500,   suffix: '+',  icon: Scissors  },
  { label: 'Orders Managed',    value: 25000, suffix: '+',  icon: Package   },
  { label: 'Happy Karigars',    value: 1500,  suffix: '+',  icon: Users     },
  { label: 'Customer Rating',   value: 4.8,   suffix: '/5', icon: Star      },
]

const BENEFITS = [
  {
    icon:  Clock,
    title: 'Waqt Bachayein',
    desc:  'Diary aur register ki zaroorat nahi. Orders aur payments digital ho jayein.',
    color: 'text-blue-600', bg: 'bg-blue-100',
  },
  {
    icon:  TrendingUp,
    title: 'Business Grow Karein',
    desc:  'Data se samjhein kya popular hai, kaun best karigar hai, kab income zyada hoti hai.',
    color: 'text-green-600', bg: 'bg-green-100',
  },
  {
    icon:  Heart,
    title: 'Customers Ko Khush Rakhein',
    desc:  'QR tracking se customers khud status check karein. Calls km, trust zyada.',
    color: 'text-red-600', bg: 'bg-red-100',
  },
  {
    icon:  Zap,
    title: 'Kabhi Data Loss Nahi',
    desc:  'Phone kho jaye to bhi naya phone pe sab data wapas. Cloud backup always on.',
    color: 'text-amber-600', bg: 'bg-amber-100',
  },
]

const TESTIMONIALS = [
  {
    name:   'Ahmed Raza',
    role:   'Owner, Ahmed Tailor House, Lahore',
    avatar: 'A',
    color:  'bg-blue-500',
    rating: 5,
    text:   'Pehle roz subah diary dhundta tha. Ab sab phone pe hai. Customers bhi khush hain — QR se khud status check karte hain.',
  },
  {
    name:   'Muhammad Rashid',
    role:   'Master Darzi, Karachi',
    avatar: 'R',
    color:  'bg-green-500',
    rating: 5,
    text:   'Meri dukaan mein 5 karigar hain. Pehle confusion hoti thi kaun kya kar raha hai. Ab sab clear hai. Highly recommended!',
  },
  {
    name:   'Asif Tailors',
    role:   'Boutique, Faisalabad',
    avatar: 'T',
    color:  'bg-purple-500',
    rating: 5,
    text:   'Professional plan mein reports dekhna shuru kiya to pata chala Sherwani sabse zyada order hoti hai. Business strategy change kar li.',
  },
  {
    name:   'Khalid Bhai',
    role:   'Solo Tailor, Rawalpindi',
    avatar: 'K',
    color:  'bg-amber-500',
    rating: 5,
    text:   'Free plan hi mera kaam chal jata hai. 30 orders per month, sab track. Internet nahi hota to offline bhi kaam karta hai. Bohat acha hai!',
  },
]

const FAQS = [
  {
    q: 'Kya yeh app bilkul free hai?',
    a: 'Haan! Starter plan hamesha free hai — 30 orders/month, unlimited customers, basic tracking. Zyada features ke liye Professional ya Business plan lein.',
  },
  {
    q: 'Agar internet nahi ho to kya hoga?',
    a: 'App offline bhi kaam karta hai. Sab data locally save hota hai. Jab internet aaye, automatically sync ho jata hai.',
  },
  {
    q: 'Customers order kaise track karte hain?',
    a: 'Har order ka unique QR code hota hai. Customer QR scan kare ya tracking link khole — real-time status dikhe ga without any login.',
  },
  {
    q: 'Kya ek se zyada device pe use kar sakte hain?',
    a: 'Professional aur Business plan mein multi-device support hai. Ghar pe laptop, dukaan pe phone — dono sync.',
  },
  {
    q: 'Data safe hai? Koi aur dekh to nahi sakta?',
    a: 'Bilkul safe. Aapka data sirf aapka hai. Bank-level encryption, Supabase secure servers. Hum kabhi data share nahi karte.',
  },
  {
    q: 'Pakistan mein payment kaise karein?',
    a: 'Raast ID se payment karein — bilkul free transaction. HBL, MCB, Easypaisa, JazzCash sab se pay kar sakte hain.',
  },
  {
    q: 'Play Store pe kab aayega?',
    a: 'Abhi browser se install ho jata hai (PWA). Android ya iPhone pe Add to Home Screen karein — same as native app, no Play Store needed.',
  },
]

const PLANS = [
  {
    name:    'Starter',
    price:   'Free',
    period:  'hamesha',
    color:   'border-slate-200',
    badge:   null,
    features: [
      '30 orders/month',
      'Unlimited customers',
      'Basic order tracking',
      'Payment recording',
      'Offline support',
    ],
    cta: 'Free Mein Shuru Karein',
    ctaStyle: 'bg-slate-900 text-white hover:bg-slate-700',
  },
  {
    name:    'Professional',
    price:   'Rs. 999',
    period:  'per month',
    color:   'border-blue-500 ring-2 ring-blue-500',
    badge:   'Most Popular',
    features: [
      'Unlimited orders',
      '3 karigar accounts',
      'QR order tracking',
      'WhatsApp integration',
      'Multi-device sync',
      'Analytics & reports',
    ],
    cta: 'Professional Lein',
    ctaStyle: 'bg-blue-600 text-white hover:bg-blue-700',
  },
  {
    name:    'Business',
    price:   'Rs. 2,499',
    period:  'per month',
    color:   'border-purple-300',
    badge:   'Best Value',
    features: [
      'Unlimited everything',
      'Unlimited karigars',
      'Cloud photo storage',
      'Priority support',
      'Custom branding',
      'Advanced analytics',
    ],
    cta: 'Business Lein',
    ctaStyle: 'bg-purple-600 text-white hover:bg-purple-700',
  },
]

// ─────────────────────────────────────────────────────────────────
// SECTIONS
// ─────────────────────────────────────────────────────────────────

// ── HERO ─────────────────────────────────────────────────────────
function Hero() {
  return (
    <div className="relative min-h-screen bg-linear-to-br from-slate-900 via-blue-950
                    to-slate-900 flex items-center overflow-hidden pt-16">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10
                        rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-600/10
                        rounded-full blur-3xl animate-pulse delay-1000" />
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

          {/* Left: Content */}
          <div className="text-center lg:text-left">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20
                            text-blue-300 text-xs font-semibold px-4 py-2 rounded-full mb-6">
              🇵🇰 Made in Pakistan, for Pakistan
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white
                           leading-tight mb-6">
              Pakistan Ka{' '}
              <span className="text-transparent bg-clip-text bg-linear-to-r
                               from-blue-400 to-cyan-400">
                Sabse Smart
              </span>{' '}
              Tailor App
            </h1>

            <p className="text-lg sm:text-xl text-slate-300 mb-8 leading-relaxed max-w-xl
                          mx-auto lg:mx-0">
              Orders track karein, customers manage karein, karigars assign karein
              — sab ek jagah. <strong className="text-white">Offline bhi kaam karta hai.</strong>
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start mb-10">
              <Link
                href="/auth"
                className="flex items-center justify-center gap-2 bg-blue-600
                           hover:bg-blue-500 text-white font-bold px-8 py-4 rounded-2xl
                           text-base transition-all shadow-xl shadow-blue-900/50
                           hover:shadow-blue-600/40 active:scale-95"
              >
                Free Shuru Karein
                <ArrowRight size={18} />
              </Link>
              <a
                href="#how-it-works"
                className="flex items-center justify-center gap-2 bg-white/10
                           hover:bg-white/20 text-white font-semibold px-8 py-4
                           rounded-2xl text-base border border-white/20 transition-all
                           backdrop-blur-sm"
              >
                Demo Dekhein
              </a>
            </div>

            {/* Trust indicators */}
            <div className="flex flex-wrap items-center gap-4 justify-center lg:justify-start">
              {[
                { icon: '✓', text: 'Free forever plan'    },
                { icon: '✓', text: 'No credit card needed' },
                { icon: '✓', text: 'Offline support'       },
              ].map(t => (
                <div key={t.text}
                  className="flex items-center gap-1.5 text-slate-400 text-sm">
                  <span className="text-green-400 font-bold">{t.icon}</span>
                  {t.text}
                </div>
              ))}
            </div>
          </div>

          {/* Right: App Mockup */}
          <div className="flex justify-center lg:justify-end">
            <AppMockup />
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2
                        flex flex-col items-center gap-2 text-slate-500">
          <span className="text-xs">Scroll down</span>
          <div className="w-5 h-8 border-2 border-slate-600 rounded-full flex justify-center pt-1.5">
            <div className="w-1 h-2 bg-slate-500 rounded-full animate-bounce" />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── App Mockup (pure CSS) ─────────────────────────────────────────
function AppMockup() {
  return (
    <div className="relative w-72 sm:w-80">
      {/* Phone frame */}
      <div className="bg-slate-800 rounded-[3rem] p-3 shadow-2xl shadow-black/50
                      border border-slate-700">
        <div className="bg-slate-900 rounded-[2.5rem] overflow-hidden">

          {/* Status bar */}
          <div className="bg-slate-900 px-6 pt-3 pb-1 flex justify-between items-center">
            <span className="text-white text-xs font-semibold">9:41</span>
            <div className="w-24 h-5 bg-slate-800 rounded-full" />
            <div className="flex gap-1 items-center">
              {[3,2,1].map(i => (
                <div key={i} className={cn(
                  'w-1 rounded-sm bg-white',
                  i === 3 ? 'h-3' : i === 2 ? 'h-2' : 'h-1.5'
                )} />
              ))}
            </div>
          </div>

          {/* App content */}
          <div className="bg-linear-to-b from-slate-800 to-slate-900 px-4 pb-6 pt-2">

            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-slate-400 text-[10px]">Subah Bakhair 👋</p>
                <p className="text-white font-bold text-sm">Ahmed Tailor</p>
              </div>
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center
                              justify-center text-white text-xs font-bold">
                A
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {[
                { label: 'Active', value: '12', color: 'bg-blue-900/50 border-blue-800' },
                { label: 'Ready',  value: '4',  color: 'bg-green-900/50 border-green-800' },
                { label: 'Aaj',    value: 'Rs.2.5k', color: 'bg-amber-900/50 border-amber-800' },
              ].map(s => (
                <div key={s.label}
                  className={cn('rounded-xl p-2.5 border text-center', s.color)}>
                  <p className="text-white font-bold text-sm">{s.value}</p>
                  <p className="text-slate-400 text-[9px] mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Order cards */}
            <p className="text-slate-400 text-[10px] font-semibold uppercase
                          tracking-wide mb-2">
              Recent Orders
            </p>
            <div className="space-y-2">
              {[
                { name: 'Ahmad Khan',  status: 'Stitching', emoji: '🧵', color: 'text-blue-400' },
                { name: 'Bilal Bhai', status: 'Ready ✓',   emoji: '✅', color: 'text-green-400' },
                { name: 'Sara Ji',    status: 'Cutting',   emoji: '✂️', color: 'text-amber-400' },
              ].map(o => (
                <div key={o.name}
                  className="flex items-center justify-between bg-slate-800/50
                             rounded-xl px-3 py-2.5 border border-slate-700/50">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{o.emoji}</span>
                    <div>
                      <p className="text-white text-[11px] font-semibold">{o.name}</p>
                      <p className={cn('text-[9px] font-medium', o.color)}>{o.status}</p>
                    </div>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                </div>
              ))}
            </div>

            {/* Bottom nav */}
            <div className="flex justify-around mt-4 pt-3 border-t border-slate-700/50">
              {['🏠','📋','👥','💰','📊'].map((icon, i) => (
                <div key={icon}
                  className={cn(
                    'w-8 h-8 flex items-center justify-center rounded-xl text-base',
                    i === 0 ? 'bg-blue-600' : ''
                  )}>
                  {icon}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Floating badges */}
      <div className="absolute -right-4 top-12 bg-white rounded-2xl px-3 py-2
                      shadow-xl shadow-black/20 flex items-center gap-2">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        <span className="text-xs font-bold text-slate-700">Live Sync</span>
      </div>
      <div className="absolute -left-6 bottom-20 bg-white rounded-2xl px-3 py-2
                      shadow-xl shadow-black/20">
        <p className="text-xs font-bold text-slate-700">📱 Works Offline</p>
      </div>
    </div>
  )
}

// ── FEATURES ──────────────────────────────────────────────────────
function Features() {
  return (
    <Section id="features" className="py-20 lg:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-block bg-blue-100 text-blue-700 text-xs font-bold
                          px-4 py-2 rounded-full mb-4 uppercase tracking-wide">
            Features
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 mb-4">
            Sab Kuch Ek App Mein
          </h2>
          <p className="text-slate-500 text-lg max-w-2xl mx-auto">
            Jo features pehle sirf bade brands ke paas the, ab har tailor ke paas.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className={cn(
                'group p-6 rounded-3xl border-2 border-slate-100 hover:border-blue-200',
                'hover:shadow-xl hover:shadow-blue-50 transition-all duration-300',
                'hover:-translate-y-1'
              )}
            >
              <div className={cn(
                'w-12 h-12 rounded-2xl flex items-center justify-center mb-4',
                f.bg
              )}>
                <f.icon size={22} className={f.color} />
              </div>
              <h3 className="font-bold text-slate-800 text-base mb-2">{f.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </Section>
  )
}

// ── HOW IT WORKS ──────────────────────────────────────────────────
function HowItWorks() {
  return (
    <Section id="how-it-works"
      className="py-20 lg:py-28 bg-linear-to-b from-slate-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-block bg-purple-100 text-purple-700 text-xs font-bold
                          px-4 py-2 rounded-full mb-4 uppercase tracking-wide">
            How It Works
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 mb-4">
            4 Simple Steps
          </h2>
          <p className="text-slate-500 text-lg max-w-2xl mx-auto">
            2 minute mein shuru karein. Koi training nahi chahiye.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
          {/* Connector line (desktop) */}
          <div className="hidden lg:block absolute top-16 left-[12.5%] right-[12.5%]
                          h-0.5 bg-linear-to-r from-blue-200 via-purple-200 to-green-200 z-0" />

          {STEPS.map((step, i) => (
            <div key={step.title} className="relative z-10 text-center">
              {/* Number circle */}
              <div className={cn(
                'w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5',
                'shadow-lg text-white text-xl font-black',
                `bg-linear-to-br ${step.color}`
              )}>
                {step.num}
              </div>

              <div className="bg-white rounded-3xl p-6 shadow-lg shadow-slate-100/50
                              border border-slate-100 hover:shadow-xl hover:-translate-y-1
                              transition-all duration-300">
                <step.icon size={24} className="text-slate-600 mx-auto mb-3" />
                <h3 className="font-bold text-slate-800 text-base mb-2">{step.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  )
}

// ── STATS ─────────────────────────────────────────────────────────
function Stats() {
  return (
    <Section className="py-20 lg:py-24 bg-linear-to-br from-blue-600 to-blue-800 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full
                        blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-300 rounded-full
                        blur-3xl translate-y-1/2 -translate-x-1/2" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-3">
            Pakistan Bhar Mein Tailors Ka Bharosa
          </h2>
          <p className="text-blue-200 text-lg">
            Har roz naye darzi My Darzi ke saath join ho rahe hain
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {STATS.map(stat => (
            <div key={stat.label}
              className="bg-white/10 backdrop-blur rounded-3xl p-6 text-center
                         border border-white/20 hover:bg-white/15 transition-colors">
              <stat.icon size={28} className="text-blue-200 mx-auto mb-3" />
              <p className="text-4xl font-black text-white mb-1">
                <AnimatedCounter
                  end={Number(String(stat.value).replace('.', ''))}
                  suffix={stat.suffix}
                  prefix={stat.value < 10 ? '' : ''}
                  duration={stat.value < 10 ? 1500 : 2000}
                />
              </p>
              <p className="text-blue-200 text-sm font-medium">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </Section>
  )
}

// ── BENEFITS ──────────────────────────────────────────────────────
function Benefits() {
  return (
    <Section className="py-20 lg:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

          {/* Left */}
          <div>
            <div className="inline-block bg-green-100 text-green-700 text-xs font-bold
                            px-4 py-2 rounded-full mb-5 uppercase tracking-wide">
              Why My Darzi
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900
                           leading-tight mb-6">
              Aapki Dukaan,{' '}
              <span className="text-green-600">Aapki Growth</span>
            </h2>
            <p className="text-slate-500 text-lg leading-relaxed mb-8">
              Sirf ek app se apni dukaan ko professional banayein.
              Customers trust karein, karigars efficient ho jayein,
              aur aap chain se ghar jayein.
            </p>

            <div className="space-y-4">
              {BENEFITS.map(b => (
                <div key={b.title}
                  className="flex items-start gap-4 p-4 rounded-2xl
                             hover:bg-slate-50 transition-colors">
                  <div className={cn(
                    'w-11 h-11 rounded-2xl flex items-center justify-center shrink-0',
                    b.bg
                  )}>
                    <b.icon size={20} className={b.color} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 mb-1">{b.title}</h3>
                    <p className="text-slate-500 text-sm leading-relaxed">{b.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: comparison table */}
          <div className="bg-linear-to-br from-slate-50 to-blue-50/30 rounded-3xl p-6
                          border border-slate-200">
            <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide mb-5">
              My Darzi vs Purana Tarika
            </h3>
            <div className="space-y-3">
              {[
                { label: 'Order tracking',          old: '❌ Diary',       new: '✅ Digital + QR' },
                { label: 'Customer notification',   old: '❌ Phone call',  new: '✅ WhatsApp auto' },
                { label: 'Payment record',          old: '❌ Hisaab kitab',new: '✅ Auto calculate' },
                { label: 'Karigar management',      old: '❌ Zubaani',     new: '✅ Assign + track' },
                { label: 'Business analytics',      old: '❌ Andaaza',     new: '✅ Real reports'   },
                { label: 'Data backup',             old: '❌ Diary kho jaye', new: '✅ Cloud always' },
              ].map(row => (
                <div key={row.label}
                  className="grid grid-cols-3 gap-3 items-center py-2.5
                             border-b border-slate-200 last:border-0">
                  <p className="text-slate-600 text-xs font-medium">{row.label}</p>
                  <div className="bg-red-50 border border-red-100 rounded-xl px-2 py-1.5">
                    <p className="text-red-700 text-[10px] font-medium text-center">{row.old}</p>
                  </div>
                  <div className="bg-green-50 border border-green-100 rounded-xl px-2 py-1.5">
                    <p className="text-green-700 text-[10px] font-medium text-center">{row.new}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Section>
  )
}

// ── TESTIMONIALS ──────────────────────────────────────────────────
function Testimonials() {
  return (
    <Section className="py-20 lg:py-28 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <div className="inline-block bg-amber-100 text-amber-700 text-xs font-bold
                          px-4 py-2 rounded-full mb-4 uppercase tracking-wide">
            Reviews
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 mb-4">
            Darzi Kya Kehte Hain
          </h2>
          <p className="text-slate-500 text-lg">
            Pakistan ke 500+ tailors ka experience
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {TESTIMONIALS.map((t, i) => (
            <div
              key={t.name}
              className={cn(
                'bg-white rounded-3xl p-6 shadow-sm border border-slate-100',
                'hover:shadow-xl hover:-translate-y-1 transition-all duration-300',
                i === 1 && 'lg:mt-6',  // stagger effect
                i === 3 && 'lg:mt-4',
              )}
            >
              {/* Stars */}
              <div className="flex gap-0.5 mb-4">
                {Array.from({ length: t.rating }).map((_, j) => (
                  <Star key={j} size={14} className="text-amber-400 fill-amber-400" />
                ))}
              </div>

              <p className="text-slate-600 text-sm leading-relaxed mb-5 italic">
                "{t.text}"
              </p>

              <div className="flex items-center gap-3">
                <div className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center',
                  'text-white font-bold text-sm shrink-0',
                  t.color
                )}>
                  {t.avatar}
                </div>
                <div>
                  <p className="font-bold text-slate-800 text-sm">{t.name}</p>
                  <p className="text-slate-400 text-[10px] leading-tight">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  )
}

// ── PRICING ───────────────────────────────────────────────────────
function Pricing() {
  const [annual, setAnnual] = useState(false)

  return (
    <Section id="pricing" className="py-20 lg:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <div className="inline-block bg-blue-100 text-blue-700 text-xs font-bold
                          px-4 py-2 rounded-full mb-4 uppercase tracking-wide">
            Pricing
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 mb-4">
            Simple, Clear Pricing
          </h2>
          <p className="text-slate-500 text-lg mb-7">
            Har budget ke liye plan. Free se shuru, grow karte waqt upgrade karein.
          </p>

          {/* Annual toggle */}
          <div className="inline-flex items-center gap-3 bg-slate-100 p-1 rounded-full">
            <button
              onClick={() => setAnnual(false)}
              className={cn(
                'px-5 py-2 rounded-full text-sm font-semibold transition-all',
                !annual ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={cn(
                'px-5 py-2 rounded-full text-sm font-semibold transition-all',
                annual ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'
              )}
            >
              Yearly
              <span className="ml-1.5 bg-green-500 text-white text-[10px] font-bold
                               px-1.5 py-0.5 rounded-full">
                -20%
              </span>
            </button>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {PLANS.map((plan, i) => (
            <div
              key={plan.name}
              className={cn(
                'rounded-3xl p-7 border-2 relative transition-all hover:-translate-y-1',
                plan.color,
                i === 1 ? 'shadow-2xl shadow-blue-100' : 'shadow-sm'
              )}
            >
              {plan.badge && (
                <div className={cn(
                  'absolute -top-3 left-1/2 -translate-x-1/2',
                  'text-white text-[10px] font-black px-4 py-1.5 rounded-full',
                  i === 1 ? 'bg-blue-600' : 'bg-purple-600'
                )}>
                  {plan.badge}
                </div>
              )}

              <h3 className="font-black text-slate-900 text-xl mb-1">{plan.name}</h3>

              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-3xl font-black text-slate-900">
                  {plan.price === 'Free' ? plan.price :
                    annual ? plan.price.replace('999', '800').replace('2,499', '2,000') :
                    plan.price
                  }
                </span>
                {plan.price !== 'Free' && (
                  <span className="text-slate-400 text-sm">/{annual ? 'mo (billed yearly)' : plan.period}</span>
                )}
                {plan.price === 'Free' && (
                  <span className="text-slate-400 text-sm">{plan.period}</span>
                )}
              </div>

              <ul className="space-y-3 mb-7">
                {plan.features.map(f => (
                  <li key={f} className="flex items-center gap-2.5 text-slate-600 text-sm">
                    <CheckCircle2 size={15} className="text-green-500 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                href="/auth"
                className={cn(
                  'block w-full text-center font-bold py-3.5 rounded-2xl',
                  'text-sm transition-all active:scale-95',
                  plan.ctaStyle
                )}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        <p className="text-center text-slate-400 text-sm mt-8">
          Raast payment se bharein — zero transaction fee ⚡
        </p>
      </div>
    </Section>
  )
}

// ── FAQ ───────────────────────────────────────────────────────────
function FAQ() {
  const [openIdx, setOpenIdx] = useState<number | null>(null)

  return (
    <Section id="faq" className="py-20 lg:py-28 bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <div className="inline-block bg-slate-200 text-slate-700 text-xs font-bold
                          px-4 py-2 rounded-full mb-4 uppercase tracking-wide">
            FAQ
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-4">
            Aksar Pooche Jaane Wale Sawalat
          </h2>
        </div>

        <div className="space-y-3">
          {FAQS.map((faq, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-slate-200 overflow-hidden
                         transition-all hover:border-blue-200"
            >
              <button
                onClick={() => setOpenIdx(openIdx === i ? null : i)}
                className="w-full flex items-center justify-between px-5 py-4 text-left"
              >
                <span className="font-semibold text-slate-800 text-sm pr-4">
                  {faq.q}
                </span>
                {openIdx === i
                  ? <ChevronUp size={18} className="text-blue-600 shrink-0" />
                  : <ChevronDown size={18} className="text-slate-400 shrink-0" />
                }
              </button>
              {openIdx === i && (
                <div className="px-5 pb-4 border-t border-slate-100">
                  <p className="text-slate-500 text-sm leading-relaxed pt-3">{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </Section>
  )
}

// ── CTA BANNER ────────────────────────────────────────────────────
function CTABanner() {
  return (
    <Section className="py-20 bg-linear-to-br from-slate-900 via-blue-950 to-slate-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="text-6xl mb-6">✂️</div>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white mb-5">
          Aaj Hi Shuru Karein
        </h2>
        <p className="text-blue-200 text-lg max-w-2xl mx-auto mb-8 leading-relaxed">
          14 din free trial. Koi card nahi chahiye. Cancel kab bhi karein.
          Pakistan ke 500+ tailors already use kar rahe hain.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/auth"
            className="flex items-center justify-center gap-2 bg-white text-blue-700
                       font-bold px-10 py-4 rounded-2xl text-base shadow-2xl
                       hover:bg-blue-50 transition-all active:scale-95"
          >
            Free Account Banayein
            <ArrowRight size={18} />
          </Link>
          <Link
            href="/contact"
            className="flex items-center justify-center gap-2 border-2 border-white/30
                       text-white font-semibold px-10 py-4 rounded-2xl text-base
                       hover:bg-white/10 transition-all"
          >
            Support Se Baat Karein
          </Link>
        </div>
        <p className="text-slate-500 text-sm mt-6">
          Questions? WhatsApp:{' '}
          <a
            href={`https://wa.me/${process.env.NEXT_PUBLIC_ADMIN_WHATSAPP ?? '923000000000'}`}
            target="_blank" rel="noopener noreferrer"
            className="text-blue-400 hover:underline"
          >
            {process.env.NEXT_PUBLIC_ADMIN_WHATSAPP ?? '+92 300 0000000'}
          </a>
        </p>
      </div>
    </Section>
  )
}

// ── CONTACT SECTION ───────────────────────────────────────────────
function ContactSection() {
  const [form, setForm]     = useState({ name: '', email: '', message: '' })
  const [sent, setSent]     = useState(false)
  const [sending, setSending] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSending(true)
    // Simulate submission
    await new Promise(r => setTimeout(r, 1500))
    setSent(true)
    setSending(false)
  }

  return (
    <Section id="contact" className="py-20 lg:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16">

          {/* Info */}
          <div>
            <div className="inline-block bg-green-100 text-green-700 text-xs font-bold
                            px-4 py-2 rounded-full mb-5 uppercase tracking-wide">
              Contact
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-5">
              Koi Bhi Sawal Poochein
            </h2>
            <p className="text-slate-500 text-lg leading-relaxed mb-8">
              Hum yahan hain. WhatsApp, email, ya form — jaise aasaan lage.
            </p>

            <div className="space-y-5">
              {[
                {
                  icon: MessageCircle,
                  label: 'WhatsApp',
                  value: process.env.NEXT_PUBLIC_ADMIN_WHATSAPP ?? '+92 300 0000000',
                  href:  `https://wa.me/${process.env.NEXT_PUBLIC_ADMIN_WHATSAPP ?? '923000000000'}`,
                  color: 'bg-green-100 text-green-600',
                },
                {
                  icon: Mail,
                  label: 'Email',
                  value: 'support@mydarzi.app',
                  href:  'mailto:support@mydarzi.app',
                  color: 'bg-blue-100 text-blue-600',
                },
                {
                  icon: Globe,
                  label: 'Website',
                  value: 'mydarzi.vercel.app',
                  href:  'https://mydarzi.vercel.app',
                  color: 'bg-purple-100 text-purple-600',
                },
              ].map(c => (
                <a key={c.label} href={c.href} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-4 p-4 rounded-2xl border border-slate-100
                             hover:border-slate-300 hover:shadow-sm transition-all group">
                  <div className={cn('w-11 h-11 rounded-2xl flex items-center justify-center', c.color)}>
                    <c.icon size={20} />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-medium">{c.label}</p>
                    <p className="font-semibold text-slate-800 group-hover:text-blue-600
                                  transition-colors text-sm">
                      {c.value}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          </div>

          {/* Form */}
          <div className="bg-slate-50 rounded-3xl p-7 border border-slate-200">
            {sent ? (
              <div className="text-center py-10">
                <CheckCircle2 size={48} className="text-green-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-slate-800 mb-2">
                  Message Mil Gaya! 🙏
                </h3>
                <p className="text-slate-500 text-sm">
                  Hum 24 ghante mein reply karenge.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <h3 className="font-bold text-slate-800 text-lg mb-5">
                  Message Bhejein
                </h3>
                {[
                  { key: 'name',    label: 'Aapka Naam',   type: 'text',  placeholder: 'Ahmed Bhai' },
                  { key: 'email',   label: 'Email Address', type: 'email', placeholder: 'ahmed@email.com' },
                ].map(field => (
                  <div key={field.key}>
                    <label className="block text-xs font-semibold text-slate-500
                                       uppercase tracking-wide mb-1.5">
                      {field.label}
                    </label>
                    <input
                      type={field.type}
                      placeholder={field.placeholder}
                      required
                      value={(form as any)[field.key]}
                      onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl
                                 text-sm outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-semibold text-slate-500
                                     uppercase tracking-wide mb-1.5">
                    Message
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Kya sawal hai aapka?"
                    required
                    value={form.message}
                    onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl
                               text-sm outline-none focus:border-blue-500 transition-colors resize-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={sending}
                  className="w-full bg-blue-600 disabled:bg-slate-300 text-white font-bold
                             py-3.5 rounded-xl text-sm flex items-center justify-center gap-2
                             transition-all active:scale-[0.98]"
                >
                  {sending ? 'Bhej raha hai...' : 'Message Bhejein ✓'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </Section>
  )
}

// ─────────────────────────────────────────────────────────────────
// MAIN PAGE EXPORT
// ─────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="scroll-smooth">
      <Hero />
      <Features />
      <HowItWorks />
      <Stats />
      <Benefits />
      <Testimonials />
      <Pricing />
      <FAQ />
      <CTABanner />
      <ContactSection />
    </div>
  )
}