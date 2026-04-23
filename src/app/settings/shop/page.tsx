// src/app/settings/shop/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Store, Phone, MapPin, MessageCircle, CheckCircle2 } from 'lucide-react'
import { db } from '@/lib/db/schema'
import { useAuth } from '@/lib/auth/AuthContext'
import { cn } from '@/lib/utils'

const PAKISTAN_CITIES = [
  'Karachi','Lahore','Islamabad','Rawalpindi','Faisalabad',
  'Multan','Peshawar','Quetta','Sialkot','Gujranwala',
  'Hyderabad','Abbottabad','Bahawalpur','Sargodha','Sukkur',
]

export default function ShopSettingsPage() {
  const router     = useRouter()
  const { shopId } = useAuth()

  const [shopName,   setShopName]   = useState('')
  const [whatsapp,   setWhatsapp]   = useState('')
  const [city,       setCity]       = useState('')
  const [saving,     setSaving]     = useState(false)
  const [saved,      setSaved]      = useState(false)
  const [showCities, setShowCities] = useState(false)

  useEffect(() => {
    db.shop.toCollection().first().then(shop => {
      if (!shop) return
      setShopName(shop.shopName   ?? '')
      setWhatsapp(shop.whatsappNumber ?? '')
      setCity(shop.city           ?? '')
    })
  }, [])

  const handleSave = async () => {
    if (!shopName.trim()) return
    setSaving(true)
    try {
      const shop = await db.shop.toCollection().first()
      if (shop) {
        await db.shop.update(shop.id, {
          shopName:       shopName.trim(),
          whatsappNumber: whatsapp || undefined,
          city:           city     || undefined,
          updatedAt:      new Date().toISOString(),
          _synced:        0,
        })
      }
      setSaved(true)
      setTimeout(() => { setSaved(false); router.back() }, 1200)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col pb-8">
      <header className="px-4 pt-12 lg:pt-6 pb-4 border-b border-slate-100 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100"
        >
          <ArrowLeft size={18} className="text-slate-600" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-slate-800">Dukaan Edit Karein</h1>
          <p className="text-xs text-slate-400">Dukaan ki details update karein</p>
        </div>
      </header>

      <div className="flex-1 px-4 pt-6 space-y-5">

        {/* Shop name */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Dukaan Ka Naam *
          </label>
          <div className="flex items-center gap-2 bg-slate-50 border-2 border-slate-200
                          rounded-2xl px-4 py-4 focus-within:border-blue-500 focus-within:bg-white transition-all">
            <Store size={16} className="text-slate-400 flex-shrink-0" />
            <input
              type="text"
              value={shopName}
              onChange={e => setShopName(e.target.value)}
              placeholder="Jaise: Ahmed Tailor House"
              className="flex-1 text-sm font-medium text-slate-800 bg-transparent outline-none placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* WhatsApp */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Dukaan Ka WhatsApp (Optional)
          </label>
          <div className="flex items-center gap-2 bg-slate-50 border-2 border-slate-200
                          rounded-2xl px-4 py-4 focus-within:border-green-500 focus-within:bg-white transition-all">
            <MessageCircle size={16} className="text-green-500 flex-shrink-0" />
            <span className="text-slate-400 text-sm font-medium flex-shrink-0">+92</span>
            <div className="w-px h-4 bg-slate-300" />
            <input
              type="tel"
              inputMode="numeric"
              value={whatsapp}
              onChange={e => setWhatsapp(e.target.value.replace(/\D/g,'').slice(0,11))}
              placeholder="03XX-XXXXXXX"
              className="flex-1 text-sm font-mono text-slate-800 bg-transparent outline-none placeholder:text-slate-400"
            />
            {whatsapp.length >= 10 && (
              <span className="text-green-500 text-xs flex-shrink-0">✓</span>
            )}
          </div>
        </div>

        {/* City */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Sheher (Optional)
          </label>
          <div className="relative">
            <button
              onClick={() => setShowCities(v => !v)}
              className="w-full flex items-center gap-2 bg-slate-50 border-2 border-slate-200
                         rounded-2xl px-4 py-4 text-left transition-all hover:border-slate-300"
            >
              <MapPin size={16} className="text-slate-400 flex-shrink-0" />
              <span className={cn('flex-1 text-sm', city ? 'text-slate-800 font-medium' : 'text-slate-400')}>
                {city || 'Sheher chunein...'}
              </span>
              <span className="text-slate-400 text-xs">{showCities ? '▲' : '▼'}</span>
            </button>

            {showCities && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200
                              rounded-2xl shadow-xl z-20 max-h-52 overflow-y-auto">
                {/* Clear option */}
                <button
                  onClick={() => { setCity(''); setShowCities(false) }}
                  className="w-full px-4 py-3 text-left text-sm text-slate-400 border-b border-slate-100
                             hover:bg-slate-50"
                >
                  — Koi nahi
                </button>
                {PAKISTAN_CITIES.map(c => (
                  <button
                    key={c}
                    onClick={() => { setCity(c); setShowCities(false) }}
                    className={cn(
                      'w-full px-4 py-3 text-left text-sm transition-colors',
                      'border-b border-slate-100 last:border-0 hover:bg-slate-50',
                      city === c ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-700'
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Info box */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3">
          <p className="text-xs text-blue-700 font-medium">
            💡 WhatsApp number se gahak seedha aapse baat kar sakenge.
          </p>
        </div>
      </div>

      {/* Save */}
      <div className="px-4 pt-4">
        <button
          onClick={handleSave}
          disabled={!shopName.trim() || saving || saved}
          className={cn(
            'w-full font-bold py-4 rounded-2xl text-base transition-all active:scale-[0.98]',
            'flex items-center justify-center gap-2',
            saved
              ? 'bg-green-600 text-white'
              : 'bg-blue-600 disabled:bg-slate-300 text-white'
          )}
        >
          {saved ? (
            <><CheckCircle2 size={18} /> Save Ho Gaya!</>
          ) : saving ? (
            <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Saving...</>
          ) : (
            'Changes Save Karein ✓'
          )}
        </button>
      </div>
    </div>
  )
}