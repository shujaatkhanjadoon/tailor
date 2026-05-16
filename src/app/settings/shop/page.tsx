// src/app/settings/shop/page.tsx
'use client'

import { useState, useEffect, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  ArrowLeft, Store, MapPin, MessageCircle, CheckCircle2,
  Image as ImageIcon, Upload, Palette, Sparkles,
} from 'lucide-react'
import { db } from '@/lib/db/schema'
import { useAuth } from '@/lib/auth/AuthContext'
import { cn } from '@/lib/utils'
import { AccessNotice } from '@/components/billing/AccessNotice'
import { usePlan } from '@/hooks/usePlan'
import { syncService } from '@/lib/supabase/sync-service'
import { PAKISTAN_STATE_CITIES } from '@/lib/locations/pakistan'

export default function ShopSettingsPage() {
  const router     = useRouter()
  const { isOwner, shopId } = useAuth()
  const plan = usePlan()

  const [shopName,   setShopName]   = useState('')
  const [whatsapp,   setWhatsapp]   = useState('')
  const [stateProvince, setStateProvince] = useState('')
  const [city,       setCity]       = useState('')
  const [addressLine, setAddressLine] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [brandName,  setBrandName]  = useState('')
  const [brandColor, setBrandColor] = useState('#2563eb')
  const [brandLogoUrl, setBrandLogoUrl] = useState('')
  const [logoError, setLogoError] = useState('')
  const [saving,     setSaving]     = useState(false)
  const [saved,      setSaved]      = useState(false)
  const [showCities, setShowCities] = useState(false)

  const shop = useLiveQuery(
    async () => shopId ? db.shop.get(shopId) : undefined,
    [shopId]
  )

  useEffect(() => {
      if (!shop) return
      setShopName(shop.shopName   ?? '')
      setWhatsapp(shop.whatsappNumber ?? '')
      setStateProvince(shop.stateProvince ?? '')
      setCity(shop.city           ?? '')
      setAddressLine(shop.addressLine ?? '')
      setPostalCode(shop.postalCode ?? '')
      setBrandName(shop.brandName ?? '')
      setBrandColor(shop.brandColor ?? '#2563eb')
      setBrandLogoUrl(shop.brandLogoUrl ?? '')
  }, [shop])

  const isBusiness = plan.plan === 'business' && plan.isActive

  const handleLogoUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setLogoError('Logo image file hona chahiye.')
      return
    }

    if (file.size > 500 * 1024) {
      setLogoError('Logo 500KB se chota upload karein.')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setBrandLogoUrl(String(reader.result ?? ''))
      setLogoError('')
    }
    reader.onerror = () => setLogoError('Logo upload nahi ho saka.')
    reader.readAsDataURL(file)
  }

  if (!isOwner) {
    return (
      <AccessNotice
        icon="role"
        title="Owner access required"
        message="Dukaan ki settings sirf owner update kar sakta hai."
      />
    )
  }

  const handleSave = async () => {
    if (!shopName.trim() || !shopId) return
    setSaving(true)
    try {
      const currentShop = await db.shop.get(shopId)
      if (currentShop) {
        await db.shop.update(currentShop.id, {
          shopName:       shopName.trim(),
          whatsappNumber: whatsapp || undefined,
          stateProvince:  stateProvince || undefined,
          city:           city     || undefined,
          addressLine:    addressLine.trim() || undefined,
          postalCode:     postalCode.trim() || undefined,
          brandName:      isBusiness ? brandName.trim() || undefined : undefined,
          brandColor:     isBusiness ? brandColor || undefined : undefined,
          brandLogoUrl:   isBusiness ? brandLogoUrl || undefined : undefined,
          updatedAt:      new Date().toISOString(),
          _synced:        0,
        })
        await syncService.pushAll(currentShop.id).catch(console.error)
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
          aria-label="Go back"
          onClick={() => router.back()}
          className="w-11 h-11 flex items-center justify-center rounded-full bg-slate-100"
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
            <Store size={16} className="text-slate-400 shrink-0" />
            <input
              type="text"
              value={shopName}
              onChange={e => setShopName(e.target.value)}
              placeholder="Jaise: Ahmed Tailor House"
              className="flex-1 text-sm font-medium text-slate-800 bg-transparent outline-none placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Business branding */}
        <div className="border border-slate-200 bg-white rounded-2xl overflow-hidden">
          <div
            className="px-4 py-4 text-white"
            style={{ background: isBusiness ? brandColor : '#334155' }}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center overflow-hidden shrink-0">
                {brandLogoUrl && isBusiness ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={brandLogoUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Sparkles size={20} />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold">Custom Branding</p>
                <p className="text-xs text-white/75 truncate">
                  {isBusiness
                    ? 'Tracking page aur invoice/QR sharing par ye identity show hogi.'
                    : 'Custom branding only for business user.'}
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 space-y-3">
            {!isBusiness && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
                <p className="text-xs font-semibold text-amber-800">
                  Custom branding sirf Business plan users ke liye hai.
                </p>
              </div>
            )}

            <label className="block">
              <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Brand Display Name
              </span>
              <input
                type="text"
                value={brandName}
                disabled={!isBusiness}
                onChange={e => setBrandName(e.target.value)}
                placeholder="Jaise: Ahmed Bespoke"
                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-sm outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
              />
            </label>

            <div className="grid grid-cols-[auto_1fr] gap-3 items-center">
              <label className="w-14 h-12 rounded-2xl border-2 border-slate-200 bg-slate-50 flex items-center justify-center cursor-pointer">
                <Palette size={17} className="text-slate-500" />
                <input
                  type="color"
                  value={brandColor}
                  disabled={!isBusiness}
                  onChange={e => setBrandColor(e.target.value)}
                  className="sr-only"
                />
              </label>
              <div>
                <p className="text-xs font-semibold text-slate-700">Brand color</p>
                <p className="text-xs text-slate-400 font-mono">{brandColor}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                {brandLogoUrl && isBusiness ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={brandLogoUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon size={20} className="text-slate-400" />
                )}
              </div>
              <label className={cn(
                'flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold border',
                isBusiness
                  ? 'bg-slate-900 text-white border-slate-900 cursor-pointer'
                  : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
              )}>
                <Upload size={16} />
                Logo Upload
                <input
                  type="file"
                  accept="image/*"
                  disabled={!isBusiness}
                  onChange={handleLogoUpload}
                  className="sr-only"
                />
              </label>
            </div>

            {isBusiness && brandLogoUrl && (
              <button
                type="button"
                onClick={() => setBrandLogoUrl('')}
                className="text-xs font-semibold text-red-600"
              >
                Logo remove karein
              </button>
            )}
            {logoError && <p className="text-xs font-semibold text-red-600">{logoError}</p>}
          </div>
        </div>

        {/* WhatsApp */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Dukaan Ka WhatsApp (Optional)
          </label>
          <div className="flex items-center gap-2 bg-slate-50 border-2 border-slate-200
                          rounded-2xl px-4 py-4 focus-within:border-green-500 focus-within:bg-white transition-all">
            <MessageCircle size={16} className="text-green-500 shrink-0" />
            <span className="text-slate-400 text-sm font-medium shrink-0">+92</span>
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
              <span className="text-green-500 text-xs shrink-0">✓</span>
            )}
          </div>
        </div>

        {/* Address */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            State / City (Optional)
          </label>
          <div className="relative">
            <button
              onClick={() => setShowCities(v => !v)}
              className="w-full flex items-center gap-2 bg-slate-50 border-2 border-slate-200
                         rounded-2xl px-4 py-4 text-left transition-all hover:border-slate-300"
            >
              <MapPin size={16} className="text-slate-400 shrink-0" />
              <span className={cn('flex-1 text-sm', city ? 'text-slate-800 font-medium' : 'text-slate-400')}>
                {city ? `${city}${stateProvince ? `, ${stateProvince}` : ''}` : 'Sheher chunein...'}
              </span>
              <span className="text-slate-400 text-xs">{showCities ? '▲' : '▼'}</span>
            </button>

            {showCities && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200
                              rounded-2xl shadow-xl z-20 max-h-52 overflow-y-auto">
                {/* Clear option */}
                <button
                  onClick={() => { setStateProvince(''); setCity(''); setShowCities(false) }}
                  className="w-full px-4 py-3 text-left text-sm text-slate-400 border-b border-slate-100
                             hover:bg-slate-50"
                >
                  — Koi nahi
                </button>
                {PAKISTAN_STATE_CITIES.map(group => (
                  <div key={group.state}>
                    <p className="bg-slate-50 px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      {group.state}
                    </p>
                    {group.cities.map(c => (
                      <button
                        key={`${group.state}-${c}`}
                        onClick={() => { setStateProvince(group.state); setCity(c); setShowCities(false) }}
                        className={cn(
                          'w-full px-4 py-3 text-left text-sm transition-colors',
                          'border-b border-slate-100 last:border-0 hover:bg-slate-50',
                          city === c && stateProvince === group.state
                            ? 'bg-blue-50 text-blue-700 font-semibold'
                            : 'text-slate-700'
                        )}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 min-[520px]:grid-cols-[1fr_10rem]">
          <label>
            <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Address Line
            </span>
            <input
              type="text"
              value={addressLine}
              onChange={e => setAddressLine(e.target.value)}
              placeholder="Shop #, bazaar, road..."
              className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-blue-500"
            />
          </label>
          <label>
            <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Postal Code
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={postalCode}
              onChange={e => setPostalCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="54000"
              className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-blue-500"
            />
          </label>
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
