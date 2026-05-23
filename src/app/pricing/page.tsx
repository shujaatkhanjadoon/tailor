// src/app/pricing/page.tsx
import Link         from 'next/link'
import { ArrowRight, Check, X as XIcon } from 'lucide-react'
import { PricingCards }               from '@/components/pricing/PricingCards'
import { cn }                          from '@/lib/utils'
import Image from 'next/image'

const FEATURE_ROWS = [
  { label: 'Orders per month',  starter: '30',         pro: 'Unlimited',    biz: 'Unlimited'    },
  { label: 'Customers',         starter: '50',         pro: 'Unlimited',    biz: 'Unlimited'    },
  { label: 'Karigar accounts',  starter: 'None',       pro: 'Up to 3',      biz: 'Unlimited'    },
  { label: 'Order tracking URL',starter: false,        pro: true,           biz: true           },
  { label: 'QR Code',           starter: false,        pro: true,           biz: true           },
  { label: 'Photo attachments', starter: false,        pro: '1GB',          biz: '10GB'         },
  { label: 'Cloud sync',        starter: false,        pro: true,           biz: true           },
  { label: 'Multi-device login',starter: false,        pro: true,           biz: true           },
  { label: 'Reports & analytics',starter: false,       pro: true,           biz: true           },
  { label: 'WhatsApp notify',   starter: 'Manual',     pro: 'Auto',         biz: 'Auto'         },
  { label: 'Karigar pay reports',starter: false,       pro: false,          biz: true           },
  { label: 'Custom branding',   starter: false,        pro: false,          biz: true           },
  { label: 'Priority support',  starter: false,        pro: false,          biz: true           },
]

function FeatureValue({ value }: { value: boolean | string }) {
  if (value === true)  return <Check size={16} className="text-green-500 mx-auto" />
  if (value === false) return <XIcon size={16} className="text-slate-200 mx-auto" />
  return <span className="text-xs text-slate-600 font-medium">{value}</span>
}

export default function PricingPage() {

  return (
    <div className="min-h-screen bg-white">

      {/* Nav */}
      <nav className="border-b border-slate-200 px-6 py-4 flex items-center
                      justify-between max-w-7xl mx-auto">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 flex items-center justify-center">
            <Image
              src="/icon.svg"
              alt="MeraDarzi"
              width={32}
              height={32}
              loading="eager"
            />
          </div>
          <span className="font-bold text-slate-800 text-lg">MeraDarzi</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/auth" className="text-sm font-semibold text-slate-600 hover:text-slate-800">
            Sign In
          </Link>
          <Link
            href="/auth"
            className="text-sm font-semibold bg-blue-600 text-white px-4 py-2 rounded-xl"
          >
            Free Trial Shuru Karein
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 py-16 text-center">
        <h1 className="text-4xl font-bold text-slate-900 mb-3">
          Simple, Honest Pricing
        </h1>
        <p className="text-slate-500 text-lg mb-3">
          14 din ka free Professional trial — koi card nahi chahiye
        </p>
        <p className="text-sm text-slate-400 mb-10">
          Baad mein jo plan suit kare le lein. Data hamesha aapka.
        </p>

        <PricingCards />
      </section>

      {/* Pricing details */}
      <section className="max-w-5xl mx-auto px-6 pb-16">

        {/* Feature comparison table */}
        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100">
            <h2 className="text-xl font-bold text-slate-800">Full Feature Comparison</h2>
          </div>

          {/* Header row */}
          <div className="grid grid-cols-4 gap-0 border-b border-slate-100">
            <div className="px-6 py-4" />
            {['Starter', 'Professional', 'Business'].map((name, i) => (
              <div
                key={name}
                className={cn(
                  'px-4 py-4 text-center font-bold text-sm',
                  i === 1 ? 'bg-blue-600 text-white' : 'text-slate-800'
                )}
              >
                {name}
              </div>
            ))}
          </div>

          {/* Feature rows */}
          {FEATURE_ROWS.map((row, i) => (
            <div
              key={row.label}
              className={cn(
                'grid grid-cols-4 gap-0 border-b border-slate-100 last:border-0',
                i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
              )}
            >
              <div className="px-6 py-3.5 text-sm text-slate-600 font-medium">
                {row.label}
              </div>
              {[row.starter, row.pro, row.biz].map((val, j) => (
                <div
                  key={j}
                  className={cn(
                    'px-4 py-3.5 text-center',
                    j === 1 ? 'bg-blue-50' : ''
                  )}
                >
                  <FeatureValue value={val} />
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Payment info */}
        <div className="mt-8 bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center">
          <h3 className="font-bold text-slate-800 mb-2">Pakistan Ka Apna Payment 🇵🇰</h3>
          <p className="text-slate-500 text-sm mb-4">
            Raast ID, Raast QR, Easypaisa, JazzCash ya Bank Transfer — jo aapko suit kare
          </p>
          <div className="flex justify-center gap-6 text-sm text-slate-500">
            {['⚡ Zero fee on Raast', '🔒 Secure payment', '✓ 24hr activation', '7 din refund'].map(f => (
              <span key={f} className="font-medium">{f}</span>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-8 grid md:grid-cols-2 gap-4">
          {[
            { q:'Trial mein card chahiye?',          a:'Bilkul nahi — 14 din free, koi info nahi' },
            { q:'Raast payment kab verify hogi?',    a:'2-4 ghante, maximum 24 business hours' },
            { q:'Kya data delete hoga downgrade par?', a:'Nahi — data safe, sirf features band' },
            { q:'Refund milega?',                    a:'7 din ke andar poora refund guarantee' },
          ].map(({ q, a }) => (
            <div key={q} className="bg-white border border-slate-200 rounded-2xl p-5">
              <p className="font-semibold text-slate-800 text-sm mb-1.5">{q}</p>
              <p className="text-slate-500 text-xs leading-relaxed">{a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-blue-600 py-16 text-center">
        <h2 className="text-3xl font-bold text-white mb-3">
          Aaj Hi Shuru Karein
        </h2>
        <p className="text-blue-200 mb-8">14 din ka free Professional trial â€” no card required</p>
        <Link
          href="/auth"
          className="inline-flex items-center gap-2 bg-white text-blue-600
                     font-bold px-10 py-4 rounded-2xl hover:bg-blue-50 transition-colors"
        >
          Free Trial Shuru Karein <ArrowRight size={18} />
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-8 text-center text-sm text-slate-400">
        © {new Date().getFullYear()} MeraDarzi • Made with ❤️ for Pakistan 🇵🇰
      </footer>
    </div>
  )
}
