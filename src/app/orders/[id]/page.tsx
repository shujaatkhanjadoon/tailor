// src/app/orders/[id]/page.tsx
'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { QuickPaymentSheet } from '@/components/payments/QuickPaymentSheet'
import { QRCodeDisplay } from '@/components/orders/QRCodeDisplay'
import {
  ArrowLeft, MessageCircle, Clock, Wallet,
  User2, QrCode, ChevronRight, Plus,
  Ruler, Image as ImageIcon, StickyNote, Phone, Trash2, X, Pencil,
} from 'lucide-react'
import { useOrder } from '@/hooks/useOrders'
import { useAuth } from '@/lib/auth/AuthContext'
import { paymentOps } from '@/lib/db/operations'
import { db, type CustomerRecord, type MeasurementRecord, type PhotoRecord, type ShopRecord } from '@/lib/db/schema'
import { ORDER_STATUS_CONFIG, GARMENT_LABELS, OrderStatus } from '@/types'
import { StatusUpdateSheet } from '@/components/orders/StatusUpdateSheet'
import { AssignSheet } from '@/components/orders/AssignSheet'
import { SpecialInstructionsSummary } from '@/components/orders/SpecialInstructionsSummary'
import { OrderPhotoSection } from '@/components/photos/OrderPhotoSection'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { usePlan } from '@/hooks/usePlan'
import { AccessNotice } from '@/components/billing/AccessNotice'
import { orderFinancialSummary, orderPaymentProgress } from '@/lib/payments/calculations'
import { deleteFromCloudinary, getOptimisedUrl, publicIdFromCloudinaryUrl } from '@/lib/photos/cloudinary'
import { supabase } from '@/lib/supabase/client'
import { mapCustomer, mapMeasurement, mapShop } from '@/lib/supabase/records'
import { isParentRelation, napOwnerLabel, recipientLabel } from '@/lib/order-recipient'
import { formatAmount } from '@/lib/format/currency'
import { AppFooter } from '@/components/layout/AppFooter'
import { deleteOrderPhotoEverywhere } from '@/lib/photos/delete-order-photo'

const PAYMENT_METHODS = [
  { key: 'cash', label: 'Cash', emoji: '💵' },
  { key: 'easypaisa', label: 'Easypaisa', emoji: '📱' },
  { key: 'jazzcash', label: 'JazzCash', emoji: '📲' },
  { key: 'bank', label: 'Bank', emoji: '🏦' },
] as const

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { isOwner, currentUser } = useAuth()
  const plan = usePlan()
  const { order, payments, history, balance } = useOrder(id)
  const [shop, setShop] = useState<ShopRecord | undefined>()
  const [customer, setCustomer] = useState<CustomerRecord | undefined>()
  const [measurement, setMeasurement] = useState<MeasurementRecord | undefined>()
  const [photos, setPhotos] = useState<PhotoRecord[]>([])

  useEffect(() => {
    if (!order) return
    let cancelled = false
    const load = async () => {
      const [{ data: shopRow }, { data: customerRow }, { data: photoRows }] = await Promise.all([
        (supabase as any).from('shops').select('*').eq('id', order.shopId).maybeSingle(),
        (supabase as any).from('customers').select('*').eq('id', order.customerId).maybeSingle(),
        (supabase as any).from('order_photos').select('*').eq('order_id', order.id).is('deleted_at', null).order('taken_at', { ascending: false }),
      ])
      if (!cancelled) {
        setShop(shopRow ? mapShop(shopRow) : undefined)
        setCustomer(customerRow ? mapCustomer(customerRow) : undefined)
        const remotePhotos = (photoRows ?? []).map((p: any) => ({
          id: p.id,
          orderId: p.order_id,
          shopId: p.shop_id,
          type: p.type,
          base64: '',
          cloudUrl: p.cloud_url,
          publicId: p.public_id,
          cloudSizeKB: p.cloud_size_kb ?? undefined,
          sizeKB: p.size_kb ?? 0,
          takenAt: p.taken_at,
          _synced: 1 as const,
          _deleted: 0 as const,
        }))
        const localPhotos = await db.photos.where('orderId').equals(order.id).filter(p => p._deleted !== 1).toArray()
        setPhotos(remotePhotos.length > 0 ? remotePhotos : localPhotos)
      }
      let measurementRow: any
      if (!order) return undefined
      if (order.measurementId) {
        const { data } = await (supabase as any)
          .from('measurements')
          .select('*')
          .eq('id', order.measurementId)
          .is('deleted_at', null)
          .maybeSingle()
        measurementRow = data
      }
      if (!measurementRow) {
        const orderRelation = order.orderForRelation ?? 'self'
        const measurementRelation = isParentRelation(orderRelation) ? 'other' : orderRelation
        let query = (supabase as any)
          .from('measurements')
          .select('*')
          .eq('customer_id', order.customerId)
          .eq('garment_type', order.garmentType)
          .eq('order_for_relation', measurementRelation)
          .is('deleted_at', null)
          .order('taken_at', { ascending: false })
          .limit(1)
        if (isParentRelation(orderRelation)) query = query.eq('recipient_gender', order.recipientGender)
        if (orderRelation !== 'self' && order.orderForName?.trim()) query = query.eq('order_for_name', order.orderForName.trim())
        const { data } = await query
        measurementRow = data?.[0]
      }
      if (!cancelled) setMeasurement(measurementRow ? mapMeasurement(measurementRow) : undefined)
    }
    load()
    return () => { cancelled = true }
  }, [order])

  const [showStatusSheet, setShowStatusSheet] = useState(false)
  const [showAssignSheet, setShowAssignSheet] = useState(false)
  const [showPayForm, setShowPayForm] = useState(false)
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState<'cash' | 'easypaisa' | 'jazzcash' | 'bank'>('cash')
  const [savingPay, setSavingPay] = useState(false)
  const [showPaySheet, setShowPaySheet] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [deletingDisplayPhotoId, setDeletingDisplayPhotoId] = useState<string | null>(null)
  const [previewPhoto, setPreviewPhoto] = useState<{
    src: string
    label: string
  } | null>(null)

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (currentUser?.role === 'karigar' && order.assignedTo !== currentUser.id) {
    return (
      <AccessNotice
        icon="role"
        title="Order assigned nahi hai"
        message="Karigar sirf apne assigned orders ki complete details dekh sakta hai."
      />
    )
  }

  const sc = ORDER_STATUS_CONFIG[order.status as OrderStatus]
  const gc = GARMENT_LABELS[order.garmentType as keyof typeof GARMENT_LABELS]
  const isTerminal = ['delivered', 'cancelled'].includes(order.status)
  const today = new Date().toISOString().split('T')[0]
  const isOverdue = order.dueDate < today && !isTerminal
  const progress = order.totalPrice > 0
    ? orderPaymentProgress(order)
    : 0
  const finance = orderFinancialSummary(order, payments)
  const displayPhotos = photos.length > 0
    ? photos.map(photo => ({
        id: photo.id,
        src: photo.cloudUrl ? getOptimisedUrl(photo.cloudUrl, { width: 800 }) : photo.base64,
        label: `${photo.type} photo`,
        type: photo.type,
        publicId: photo.publicId,
        source: 'local' as const,
      }))
    : order.fabricPhotoUrl
      ? [{ id: 'fabric-photo-url', src: order.fabricPhotoUrl, label: 'fabric photo', type: 'fabric', source: 'order' as const }]
      : []

  const waLink = (() => {
    const phone = `92${order.customerPhone.replace(/^0/, '').replace(/\D/g, '')}`
    const msg = encodeURIComponent(
      `Assalam o Alaikum ${order.customerName}!\n\n` +
      `Aapka order #${String(order.orderNumber).padStart(3, '0')} tayyar ho gaya hai! ✅\n` +
      (balance > 0 ? `Baaki raqam: Rs.${balance.toLocaleString()}\n\n` : '\n') +
      `Jaldi tashreef laaein. Shukriya! 🙏`
    )
    return `https://wa.me/${phone}?text=${msg}`
  })()

  const handleAddPayment = async () => {
    const amt = parseInt(payAmount)
    if (!amt || amt <= 0 || !currentUser) return
    setSavingPay(true)
    try {
      await paymentOps.add(order.shopId, {
        orderId: order.id,
        amount: amt,
        method: payMethod,
        recordedBy: currentUser.id,
      })
      setPayAmount('')
      setShowPayForm(false)
    } finally {
      setSavingPay(false)
    }
  }

  const handleDeleteDisplayPhoto = async (photo: (typeof displayPhotos)[number]) => {
    setDeletingDisplayPhotoId(photo.id)
    try {
      if (photo.source === 'order') {
        const publicId = publicIdFromCloudinaryUrl(photo.src)
        if (publicId) {
          const deleted = await deleteFromCloudinary(publicId)
          if (!deleted) throw new Error('Cloudinary photo delete failed')
        }
        await (supabase as any)
          .from('orders')
          .update({ fabric_photo_url: null, updated_at: new Date().toISOString() })
          .eq('id', order.id)
      } else {
        await deleteOrderPhotoEverywhere({ id: photo.id, publicId: photo.publicId })
        setPhotos(prev => prev.filter(item => item.id !== photo.id))
      }
      if (previewPhoto?.src === photo.src) setPreviewPhoto(null)
    } finally {
      setDeletingDisplayPhotoId(null)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20 lg:pb-4">

      {/* Header */}
      <div className={cn(
        'px-4 pt-12 pb-5',
        isOverdue ? 'bg-red-700' : 'bg-linear-to-br from-blue-900 to-blue-700'
      )}>
        <div className="flex items-center justify-between mb-5">
          {plan.isLoading ? (
            <div className="h-9 w-20 rounded-xl bg-white/15" />
          ) : plan.canUseQR ? (
            <button
              onClick={() => setShowQR(true)}
              className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30
                 text-white text-sm font-semibold px-3 py-2 rounded-xl transition-colors"
            >
              <QrCode size={16} />
              QR
            </button>
          ) : (
            <button
              type="button"
              title="Online order tracking aur QR code Professional plan se unlock hotay hain."
              onClick={() => plan.upgrade('professional')}
              className="flex items-center gap-1.5 bg-white/15 text-white/80
                 text-sm font-semibold px-3 py-2 rounded-xl transition-colors"
            >
              <QrCode size={16} />
              Upgrade
            </button>
          )}
          <button
            aria-label="Go back"
            onClick={() => router.back()}
            className="w-11 h-11 flex items-center justify-center rounded-full bg-white/20"
          >
            <ArrowLeft size={16} className="text-white" />
          </button>
          {order.status === 'ready' && (
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 bg-green-500 text-white
                         text-sm font-semibold px-4 py-2 rounded-xl"
            >
              <MessageCircle size={14} />
              Gahak Ko Batao
            </a>
          )}
          {isOwner && (
            <button
              onClick={() => router.push(`/orders/${order.id}/edit`)}
              className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30
                         text-white text-sm font-semibold px-3 py-2 rounded-xl transition-colors"
            >
              <Pencil size={14} />
              Edit
            </button>
          )}
        </div>

        {/* Order title */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-white/70 text-sm">
              Order #{String(order.orderNumber).padStart(3, '0')}
              {order.isUrgent === 1 && (
                <span className="ml-2 text-orange-300 font-bold">⚡ URGENT</span>
              )}
            </p>
            <h1 className="text-xl font-bold text-white mt-0.5">{order.customerName}</h1>
            <p className="text-white/60 text-sm mt-0.5">
              {gc?.emoji} {gc?.label}
            </p>
          </div>

          {/* Status badge — tappable */}
          <button
            onClick={() => !isTerminal && setShowStatusSheet(true)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-bold',
              sc.bg, sc.color, sc.border,
              !isTerminal ? 'active:scale-95 transition-transform' : ''
            )}
          >
            {sc.emoji} {sc.label}
            {!isTerminal && <span className="text-[10px] opacity-60">▾</span>}
          </button>
        </div>
      </div>

      <div className="px-4 space-y-4 pt-4">

        {/* PAYMENT CARD */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                <Wallet size={15} className="text-blue-600" />
                Payment
              </h2>
              {isOwner && order.status !== 'cancelled' && balance > 0 && (
                <button
                  onClick={() => setShowPaySheet(true)}
                  className="text-xs font-semibold text-blue-600 flex items-center gap-1"
                >
                  <Plus size={12} />
                  Raqam Lo
                </button>
              )}

              {showPaySheet && (
                <QuickPaymentSheet
                  preOrder={order}
                  onClose={() => setShowPaySheet(false)}
                  onSaved={() => setShowPaySheet(false)}
                />
              )}
            </div>

            {/* Total / paid / balance row */}
            <div className="grid grid-cols-3 gap-3 mb-3">
              {[
                { label: 'Kul Qeemat', value: `Rs.${finance.totalAmount.toLocaleString()}`, color: 'text-slate-800' },
                { label: 'Received', value: `Rs.${finance.receivedAmount.toLocaleString()}`, color: 'text-green-700' },
                {
                  label: 'Baaki', value: finance.remainingBalance > 0 ? `Rs.${finance.remainingBalance.toLocaleString()}` : '—',
                  color: finance.remainingBalance > 0 ? 'text-red-600' : 'text-slate-400'
                },
              ].map(s => (
                <div key={s.label} className="text-center bg-slate-50 rounded-xl p-2.5">
                  <p className={cn('font-bold text-sm', s.color)}>{s.value}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
            {(finance.appliedAmount !== finance.receivedAmount || finance.tips > 0 || finance.overpayment > 0) && (
              <div className="mb-3 grid grid-cols-1 gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500 min-[420px]:grid-cols-3">
                <span>Applied: Rs.{finance.appliedAmount.toLocaleString()}</span>
                <span>Tips: Rs.{finance.tips.toLocaleString()}</span>
                <span>Overpay: Rs.{finance.overpayment.toLocaleString()}</span>
              </div>
            )}

            {/* Progress bar */}
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all', progress === 100 ? 'bg-green-500' : 'bg-blue-500')}
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-right text-xs text-slate-400 mt-1">{progress}%</p>

            {/* Payment form */}
            {showPayForm && isOwner && (
              <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                <div className="flex items-center gap-2 bg-slate-50 border-2 border-slate-200
                                rounded-xl px-4 py-3 focus-within:border-blue-500 transition-colors">
                  <span className="text-slate-400 font-medium text-sm shrink-0">Rs.</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder={`Max: ${balance.toLocaleString()}`}
                    value={payAmount}
                    onChange={e => setPayAmount(e.target.value)}
                    className="flex-1 text-lg font-bold text-slate-800 bg-transparent outline-none"
                  />
                </div>

                {/* Quick amounts */}
                <div className="flex gap-2">
                  {[500, 1000, balance].filter(a => a > 0).slice(0, 3).map(amt => (
                    <button
                      key={amt}
                      onClick={() => setPayAmount(String(amt))}
                      className={cn(
                        'flex-1 py-2 text-xs font-semibold rounded-xl border transition-colors',
                        parseInt(payAmount) === amt
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-slate-600 border-slate-200'
                      )}
                    >
                      {amt === balance ? 'Baaki Sab' : formatAmount(amt)}
                    </button>
                  ))}
                </div>

                {/* Payment method */}
                <div className="grid grid-cols-4 gap-2">
                  {PAYMENT_METHODS.map(({ key, label, emoji }) => (
                    <button
                      key={key}
                      onClick={() => setPayMethod(key)}
                      className={cn(
                        'flex flex-col items-center gap-1 py-2.5 rounded-xl border-2 transition-colors',
                        payMethod === key ? 'border-blue-500 bg-blue-50' : 'border-slate-200'
                      )}
                    >
                      <span className="text-base">{emoji}</span>
                      <span className="text-[10px] font-semibold text-slate-600">{label}</span>
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleAddPayment}
                  disabled={!payAmount || parseInt(payAmount) <= 0 || savingPay}
                  className="w-full bg-green-600 disabled:bg-slate-300 text-white
                             font-bold py-3.5 rounded-xl transition-colors"
                >
                  {savingPay ? 'Save ho raha hai...' : `Rs.${parseInt(payAmount || '0').toLocaleString()} Record Karein ✓`}
                </button>
              </div>
            )}

            {/* Payment history */}
            {payments.length > 0 && (
              <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Payment History
                </p>
                {payments.map(p => (
                  <div key={p.id} className="flex items-center justify-between py-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-base">
                        {p.method === 'cash' ? '💵' : p.method === 'easypaisa' ? '📱' : p.method === 'jazzcash' ? '📲' : '🏦'}
                      </span>
                      <div>
                        <p className="text-xs font-semibold text-slate-700 capitalize">{p.method}</p>
                        <p className="text-[10px] text-slate-400">
                          {format(new Date(p.paidAt), 'd MMM, h:mm a')}
                          {p.kind && p.kind !== 'order_payment'
                            ? ` · ${p.kind === 'tip' ? 'Tip' : 'Overpayment'}`
                            : ''}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-700 text-sm">
                        +Rs.{p.amount.toLocaleString()}
                      </p>
                      {p.appliedToBalance !== undefined && p.appliedToBalance !== p.amount && (
                        <p className="text-[10px] text-slate-400">
                          Rs.{p.appliedToBalance.toLocaleString()} balance par
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ORDER DETAILS CARD */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
          <h2 className="font-bold text-slate-800 text-sm">Order Details</h2>

          {[
            {
              icon: Clock,
              label: 'Due Date',
              value: format(new Date(order.dueDate), 'EEEE, d MMMM yyyy'),
              valueClass: isOverdue ? 'text-red-600 font-bold' : 'text-slate-700',
            },
            {
              icon: User2,
              label: 'Order For',
              value: order.orderForRelation && order.orderForRelation !== 'self'
                ? recipientLabel(order.orderForRelation, order.orderForName)
                : 'Self',
              valueClass: 'text-blue-700 font-medium',
            },
            {
              icon: User2,
              label: 'Assigned To',
              value: order.assignedToName || 'Kisi Ko Assign Nahi',
              valueClass: order.assignedToName ? 'text-blue-700 font-medium' : 'text-slate-400',
            },
          ].map(({ icon: Icon, label, value, valueClass }) => (
            <div key={label} className="flex items-center gap-3">
              <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center shrink-0">
                <Icon size={14} className="text-slate-500" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-slate-400">{label}</p>
                <p className={cn('text-sm', valueClass)}>{value}</p>
              </div>
            </div>
          ))}

          {/* Assign button */}
          {isOwner && !isTerminal && (
            <button
              onClick={() => setShowAssignSheet(true)}
              className="w-full flex items-center justify-between bg-blue-50 border
                         border-blue-200 rounded-xl px-4 py-3 mt-1 active:scale-[0.98] transition-transform"
            >
              <span className="text-sm font-semibold text-blue-700">
                {order.assignedToName ? 'Karigar Badlein' : 'Karigar Assign Karein'}
              </span>
              <ChevronRight size={16} className="text-blue-400" />
            </button>
          )}

          {/* Special instructions */}
          {order.specialInstructions && (
            <SpecialInstructionsSummary value={order.specialInstructions} className="mt-1" />
          )}
        </div>

        {/* CUSTOMER DETAILS */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
          <h2 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <User2 size={15} className="text-blue-600" />
            Customer Details
          </h2>

          {[
            { icon: User2, label: 'Naam', value: customer?.name ?? order.customerName },
            { icon: Phone, label: 'Phone', value: customer?.phone ?? order.customerPhone },
            customer?.whatsapp ? { icon: MessageCircle, label: 'WhatsApp', value: customer.whatsapp } : null,
            customer?.gender ? { icon: User2, label: 'Type', value: customer.gender } : null,
          ].filter(Boolean).map((item) => {
            const detail = item as { icon: typeof User2; label: string; value: string }
            return (
              <div key={detail.label} className="flex items-center gap-3">
                <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center shrink-0">
                  <detail.icon size={14} className="text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-400">{detail.label}</p>
                  <p className="text-sm text-slate-700 wrap-break-word">{detail.value}</p>
                </div>
              </div>
            )
          })}

          {customer?.notes && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <p className="text-xs font-semibold text-amber-700 mb-1 flex items-center gap-1">
                <StickyNote size={12} />
                Customer Notes
              </p>
              <p className="text-sm text-amber-800">{customer.notes}</p>
            </div>
          )}
        </div>

        {/* MEASUREMENTS */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
          <h2 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <Ruler size={15} className="text-blue-600" />
            Nap / Measurements
          </h2>

          <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-blue-500">
              Clothes Type
            </p>
            <p className="text-sm font-bold text-blue-800">
              {napOwnerLabel({ relation: order.orderForRelation, name: order.orderForName, garmentType: order.garmentType })}
            </p>
          </div>

          {measurement && Object.keys(measurement.values).length > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(measurement.values).map(([key, value]) => (
                  <div key={key} className="bg-slate-50 rounded-xl px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-slate-400">
                      {key.replace(/_/g, ' ')}
                    </p>
                    <p className="text-sm font-bold text-slate-800">{value}</p>
                  </div>
                ))}
              </div>
              {measurement.notes && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <p className="text-xs font-semibold text-amber-700 mb-1">Measurement Notes</p>
                  <p className="text-sm text-amber-800">{measurement.notes}</p>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-slate-400">Is order ke saath nap record attach nahi hai.</p>
          )}
        </div>

        {/* UPLOADED IMAGES */}
        {displayPhotos.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
            <h2 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <ImageIcon size={15} className="text-blue-600" />
              Uploaded Images
            </h2>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {displayPhotos.map(photo => (
                <div
                  key={photo.id}
                  className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
                >
                  <button
                    type="button"
                    onClick={() => setPreviewPhoto({
                      src: photo.src,
                      label: photo.label,
                    })}
                    className="block w-full text-left"
                  >
                    <img
                      src={photo.src}
                      alt={photo.label}
                      className="aspect-4/3 w-full object-cover"
                    />
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${photo.label}`}
                    title={`Delete ${photo.label}`}
                    onClick={() => handleDeleteDisplayPhoto(photo)}
                    disabled={deletingDisplayPhotoId === photo.id}
                    className="absolute right-2 top-2 flex min-h-10 min-w-10 items-center justify-center rounded-full bg-red-500 text-white shadow-lg shadow-red-950/20 active:scale-95 disabled:opacity-60"
                  >
                    {deletingDisplayPhotoId === photo.id ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <Trash2 size={18} />
                    )}
                  </button>
                  <p className="px-3 py-2 text-xs font-semibold capitalize text-slate-600">
                    {photo.type}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STATUS HISTORY */}
        {history.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <h2 className="font-bold text-slate-800 text-sm mb-3">Status History</h2>
            <div className="space-y-2">
              {history.map((h, i) => {
                const oldCfg = ORDER_STATUS_CONFIG[h.oldStatus as OrderStatus]
                const newCfg = ORDER_STATUS_CONFIG[h.newStatus as OrderStatus]
                return (
                  <div key={h.id} className="flex items-center gap-2 text-xs">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0 mt-0.5" />
                    <span className="text-slate-500">
                      {oldCfg?.emoji} {oldCfg?.label}
                    </span>
                    <span className="text-slate-300">→</span>
                    <span className={cn('font-semibold', newCfg?.color)}>
                      {newCfg?.emoji} {newCfg?.label}
                    </span>
                    <span className="text-slate-400 ml-auto shrink-0">
                      {format(new Date(h.changedAt), 'd MMM')}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <OrderPhotoSection orderId={id} />
        <AppFooter />

      </div>

      

      {/* Sheets */}
      {showStatusSheet && (
        <StatusUpdateSheet
          order={order}
          onClose={() => setShowStatusSheet(false)}
          onUpdate={() => setShowStatusSheet(false)}
        />
      )}
      {showAssignSheet && (
        <AssignSheet
          orderId={order.id}
          currentAssignee={order.assignedTo}
          onClose={() => setShowAssignSheet(false)}
          onAssigned={() => setShowAssignSheet(false)}
        />
      )}

      {showQR && plan.canUseQR && (
        <QRCodeDisplay
          orderNumber={order.orderNumber}
          customerName={order.customerName}
          customerPhone={order.customerPhone}
          trackingCode={order.trackingCode}
          brandName={shop?.brandName ?? shop?.shopName}
          brandColor={shop?.brandColor}
          brandLogoUrl={shop?.brandLogoUrl}
          onClose={() => setShowQR(false)}
        />
      )}

      {previewPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreviewPhoto(null)}
        >
          <div
            className="relative max-h-full w-full max-w-3xl"
            onClick={e => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label="Close image preview"
              onClick={() => setPreviewPhoto(null)}
              className="absolute right-2 top-2 z-10 flex h-10 w-10 items-center
                         justify-center rounded-full bg-black/60 text-white"
            >
              <X size={18} />
            </button>
            <img
              src={previewPhoto.src}
              alt={previewPhoto.label}
              className="max-h-[85vh] w-full rounded-2xl object-contain"
            />
          </div>
        </div>
      )}
    </div>
  )
}
