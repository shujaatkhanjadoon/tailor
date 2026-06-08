'use client'

import Link         from 'next/link'
import { ArrowRight, Check, X as XIcon } from 'lucide-react'
import { PricingCards }               from '@/components/pricing/PricingCards'
import { cn }                          from '@/lib/utils'
import Image from 'next/image'
import { useTranslation } from 'react-i18next'

const FEATURE_ROWS = [
  { labelKey: 'features.ordersPerMonth',  starter: '30',         pro: 'features.unlimited',    biz: 'features.unlimited'    },
  { labelKey: 'features.customers',       starter: '50',         pro: 'features.unlimited',    biz: 'features.unlimited'    },
  { labelKey: 'features.karigarAccounts', starter: 'features.none', pro: 'features.upTo3',      biz: 'features.unlimited'    },
  { labelKey: 'features.orderTracking',   starter: false,        pro: true,                     biz: true                     },
  { labelKey: 'features.qrCode',          starter: false,        pro: true,                     biz: true                     },
  { labelKey: 'features.photoAttachments',starter: false,        pro: 'features.1gb',           biz: 'features.10gb'          },
  { labelKey: 'features.cloudSync',       starter: false,        pro: true,                     biz: true                     },
  { labelKey: 'features.multiDevice',     starter: false,        pro: true,                     biz: true                     },
  { labelKey: 'features.reportsAnalytics',starter: false,        pro: true,                     biz: true                     },
  { labelKey: 'features.whatsappNotify',  starter: 'features.manual', pro: 'features.auto',     biz: 'features.auto'          },
  { labelKey: 'features.karigarPayReports',starter: false,       pro: false,                    biz: true                     },
  { labelKey: 'features.customBranding',  starter: false,        pro: false,                    biz: true                     },
  { labelKey: 'features.prioritySupport', starter: false,        pro: false,                    biz: true                     },
]

function FeatureValue({ value, t }: { value: boolean | string; t: (key: string) => string }) {
  if (value === true)  return <Check size={16} className="text-green-500 mx-auto" />
  if (value === false) return <XIcon size={16} className="text-slate-200 mx-auto" />
  return <span className="text-xs text-slate-600 font-medium">{typeof value === 'string' && value.startsWith('features.') ? t(value) : value}</span>
}

export function PricingContent() {
  const { t } = useTranslation()

  const resolveValue = (val: boolean | string): boolean | string => {
    if (typeof val === 'string' && val.startsWith('features.')) return t(val)
    return val
  }

  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b border-slate-200 px-6 py-4 flex items-center justify-between max-w-7xl mx-auto">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 flex items-center justify-center">
            <Image src="/icon.svg" alt="MeraDarzi" width={32} height={32} loading="eager" />
          </div>
          <span className="font-bold text-slate-800 text-lg">MeraDarzi</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/auth" className="text-sm font-semibold text-slate-600 hover:text-slate-800">
            {t('pricing.login')}
          </Link>
          <Link href="/auth" className="text-sm font-semibold bg-blue-600 text-white px-4 py-2 rounded-xl">
            {t('pricing.freeTrialBtn')}
          </Link>
        </div>
      </nav>

      <section className="max-w-4xl mx-auto px-6 py-16 text-center">
        <h1 className="text-4xl font-bold text-slate-900 mb-3">{t('pricing.title')}</h1>
        <p className="text-slate-500 text-lg mb-3">{t('pricing.subtitle')}</p>
        <p className="text-sm text-slate-400 mb-10">{t('pricing.description')}</p>
        <PricingCards />
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-16">
        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100">
            <h2 className="text-xl font-bold text-slate-800">{t('pricing.featureComparison')}</h2>
          </div>
          <div className="grid grid-cols-4 gap-0 border-b border-slate-100">
            <div className="px-6 py-4" />
            {[t('pricing.plans.starter'), t('pricing.plans.professional'), t('pricing.plans.business')].map((name, i) => (
              <div key={name} className={cn('px-4 py-4 text-center font-bold text-sm', i === 1 ? 'bg-blue-600 text-white' : 'text-slate-800')}>
                {name}
              </div>
            ))}
          </div>
          {FEATURE_ROWS.map((row, i) => (
            <div key={row.labelKey} className={cn('grid grid-cols-4 gap-0 border-b border-slate-100 last:border-0', i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50')}>
              <div className="px-6 py-3.5 text-sm text-slate-600 font-medium">{t(row.labelKey)}</div>
              {[row.starter, row.pro, row.biz].map((val, j) => (
                <div key={j} className={cn('px-4 py-3.5 text-center', j === 1 ? 'bg-blue-50' : '')}>
                  <FeatureValue value={resolveValue(val)} t={t} />
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="mt-8 bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center">
          <h3 className="font-bold text-slate-800 mb-2">{t('pricing.paymentInfoTitle')}</h3>
          <p className="text-slate-500 text-sm mb-4">{t('pricing.paymentInfoDesc')}</p>
          <div className="flex justify-center gap-6 text-sm text-slate-500">
            {[t('pricing.zeroFeeLabel'), t('pricing.secureLabel'), t('pricing.activationLabel'), t('pricing.refundLabel')].map(f => (
              <span key={f} className="font-medium">{f}</span>
            ))}
          </div>
        </div>

        <div className="mt-8 grid md:grid-cols-2 gap-4">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="bg-white border border-slate-200 rounded-2xl p-5">
              <p className="font-semibold text-slate-800 text-sm mb-1.5">{t(`pricing.faq.${i}.q`)}</p>
              <p className="text-slate-500 text-xs leading-relaxed">{t(`pricing.faq.${i}.a`)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-blue-600 py-16 text-center">
        <h2 className="text-3xl font-bold text-white mb-3">{t('pricing.ctaTitle')}</h2>
        <p className="text-blue-200 mb-8">{t('pricing.ctaDesc')}</p>
        <Link href="/auth"
          className="inline-flex items-center gap-2 bg-white text-blue-600 font-bold px-10 py-4 rounded-2xl hover:bg-blue-50 transition-colors">
          {t('pricing.ctaBtn')} <ArrowRight size={18} />
        </Link>
      </section>

      <footer className="border-t border-slate-200 py-8 text-center text-sm text-slate-400">
        {t('pricing.footer', { year: new Date().getFullYear() })}
      </footer>
    </div>
  )
}
