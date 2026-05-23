// src/lib/db/schema.ts
import Dexie, { Table } from 'dexie'

// ─── Table Interfaces ──────────────────────────────────────────────

export interface ShopRecord {
  id: string
  shopName: string
  ownerName?: string
  ownerPhone: string
  whatsappNumber?: string
  stateProvince?: string
  city?: string
  addressLine?: string
  postalCode?: string
  brandName?: string
  brandColor?: string
  brandLogoUrl?: string
  isActive?: 0 | 1
  createdAt: string
  updatedAt: string
  _synced: 0 | 1        // 0 = needs sync, 1 = synced
  _deleted: 0 | 1       // soft delete flag
}

export interface TeamMemberRecord {
  id: string
  shopId: string
  name: string
  phone: string
  role: 'owner' | 'karigar'
  pin: string             // 4-digit PIN (hashed in prod)
  speciality?: string     // e.g. "Shalwar Kameez", "Coat"
  payRateType?: 'daily' | 'per_order' | 'monthly'
  payRate?: number        // amount in PKR
  isActive: 0 | 1
  joinedAt: string
  createdAt: string
  _synced: 0 | 1
  _deleted: 0 | 1
}

export interface CustomerRecord {
  id: string
  shopId: string
  name: string
  phone: string
  whatsapp?: string
  gender: 'male' | 'female' | 'child'
  notes?: string
  photoUrl?: string
  totalOrders: number
  createdAt: string
  updatedAt: string
  lastOrderAt?: string
  _synced: 0 | 1
  _deleted: 0 | 1
}

export interface MeasurementRecord {
  id: string
  customerId: string
  shopId: string
  orderForRelation?: 'self' | 'wife' | 'husband' | 'son' | 'daughter' | 'brother' | 'sister' | 'father' | 'mother' | 'other'
  orderForName?: string
  recipientGender?: 'male' | 'female' | 'child'
  garmentType: string
  values: Record<string, string>   // { length: "42", chest: "38", ... }
  notes?: string
  takenAt: string
  _synced: 0 | 1
  _deleted: 0 | 1
}

export interface OrderRecord {
  id: string
  shopId: string
  orderNumber: number
  trackingCode: string
  customerId: string
  customerName: string
  customerPhone: string
  orderForRelation?: 'self' | 'wife' | 'husband' | 'son' | 'daughter' | 'brother' | 'sister' | 'father' | 'mother' | 'other'
  orderForName?: string
  recipientGender?: 'male' | 'female' | 'child'
  measurementId?: string
  garmentType: string
  status: 'received' | 'cutting' | 'stitching' | 'finishing' | 'ready' | 'delivered' | 'cancelled'
  assignedTo?: string             // TeamMember.id
  assignedToName?: string         // denormalized for display speed
  totalPrice: number
  amountPaid: number
  isUrgent: 0 | 1
  dueDate: string                 // YYYY-MM-DD
  specialInstructions?: string
  fabricPhotoUrl?: string
  stylePhotoUrl?: string
  createdAt: string
  updatedAt: string
  deliveredAt?: string
  _synced: 0 | 1
  _deleted: 0 | 1
}

export interface PaymentRecord {
  id: string
  shopId: string
  orderId: string
  amount: number
  appliedToBalance?: number
  kind?: 'order_payment' | 'tip' | 'overpayment'
  method: 'cash' | 'easypaisa' | 'jazzcash' | 'bank' | 'other'
  recordedBy: string              // TeamMember.id (owner only)
  paidAt: string
  notes?: string
  _synced: 0 | 1
  _deleted: 0 | 1
}

export interface OrderStatusHistoryRecord {
  id: string
  orderId: string
  oldStatus: string
  newStatus: string
  shopId: string
  changedBy: string               // TeamMember.id
  changedAt: string
}

export interface PhotoRecord {
  id:           string
  orderId:      string
  shopId:       string
  type:         'fabric' | 'style' | 'reference'
  base64:       string           // always stored locally
  cloudUrl?:    string           // Cloudinary delivery URL
  publicId?:    string           // Cloudinary public_id (for deletion)
  cloudSizeKB?: number           // size after Cloudinary processing
  sizeKB:       number           // local compressed size
  takenAt:      string
  _synced:      0 | 1
  _deleted?:    0 | 1
}

export class TailorDB extends Dexie {
  photos!: Table<PhotoRecord>

  constructor() {
    super('DarziManagerDB')
    this.version(8).stores({
      photos: 'id, orderId, shopId, type, _synced, _deleted',
    })
  }
}

// Single instance — import this everywhere
export const db = new TailorDB()
