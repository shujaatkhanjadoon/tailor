// src/lib/db/schema.ts
import Dexie, { Table } from 'dexie'

// ─── Table Interfaces ──────────────────────────────────────────────

export interface ShopRecord {
  id: string
  shopName: string
  ownerPhone: string
  whatsappNumber?: string
  city?: string
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
  _synced: 0 | 1
}

export interface SyncQueueRecord {
  id?: number                     // auto-increment
  operation: 'create' | 'update' | 'delete'
  table: string
  recordId: string
  payload: string                 // JSON stringified
  createdAt: string
  retries: number
  lastError?: string
}

export interface AppSettingRecord {
  key: string                     // primary key
  value: string                   // JSON stringified
}

// ─── The Database Class ────────────────────────────────────────────

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
  shop!: Table<ShopRecord>
  teamMembers!: Table<TeamMemberRecord>
  customers!: Table<CustomerRecord>
  measurements!: Table<MeasurementRecord>
  orders!: Table<OrderRecord>
  payments!: Table<PaymentRecord>
  orderStatusHistory!: Table<OrderStatusHistoryRecord>
  syncQueue!: Table<SyncQueueRecord>
  appSettings!: Table<AppSettingRecord>
  photos!: Table<PhotoRecord>          // ← ADD

  constructor() {
    super('DarziManagerDB')
    this.version(6).stores({
      shop: 'id, ownerPhone, _synced',
      teamMembers: 'id, shopId, phone, role, isActive, _synced, [shopId+isActive]',
      customers: 'id, shopId, phone, name, _synced, _deleted, lastOrderAt',
      measurements: 'id, customerId, shopId, garmentType, _synced',
      orders: 'id, shopId, orderNumber, trackingCode, customerId, status, assignedTo, dueDate, isUrgent, _synced, _deleted, createdAt',
      payments: 'id, shopId, orderId, paidAt, kind, _synced',
      orderStatusHistory: 'id, orderId, shopId, changedAt, _synced',
      syncQueue: '++id, table, recordId, createdAt, retries',
      appSettings: 'key',
      photos: 'id, orderId, shopId, type, _synced, _deleted',
    })
  }
}

// Single instance — import this everywhere
export const db = new TailorDB()
