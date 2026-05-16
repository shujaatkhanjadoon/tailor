// src/types/index.ts

export type OrderStatus =
  | 'received'
  | 'cutting'
  | 'stitching'
  | 'finishing'
  | 'ready'
  | 'delivered'
  | 'cancelled'

export type PaymentMethod = 'cash' | 'easypaisa' | 'jazzcash' | 'bank'

export type GarmentType =
  | 'shalwar_kameez'
  | 'kurta'
  | 'kurti'
  | 'shirt'
  | 'trouser'
  | 'pajama'
  | 'sherwani'
  | 'waistcoat'
  | 'prince_coat'
  | 'pant_coat'
  | 'lehenga'
  | 'maxi'
  | 'blazer'
  | 'jacket'
  | 'other'

export interface Customer {
  id: string
  name: string
  phone: string
  whatsapp?: string
  gender: 'male' | 'female' | 'child'
  createdAt: string
  lastOrderAt?: string
}

export interface Order {
  id: string
  orderNumber: number
  customerId: string
  customerName: string
  customerPhone: string
  garmentType: GarmentType
  status: OrderStatus
  dueDate: string               // ISO date string
  totalPrice: number
  amountPaid: number            // sum of all payments
  isUrgent: boolean
  createdAt: string
  updatedAt: string
  specialInstructions?: string
}

export interface Payment {
  id: string
  orderId: string
  amount: number
  method: PaymentMethod
  paidAt: string
  notes?: string
}

// Derived / computed
export interface DashboardStats {
  totalOrdersToday: number
  readyOrders: number
  overdueOrders: number
  incomeToday: number
  pendingBalance: number        // money owed across all orders
}

// Status display config — Roman Urdu labels + colors + emoji
export const ORDER_STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; emoji: string; color: string; bg: string; border: string}
> = {
  received: {
    label: 'Kapra Mila',
    emoji: '📋',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
  },
  cutting: {
    label: 'Katai',
    emoji: '✂️',
    color: 'text-orange-700',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
  },
  stitching: {
    label: 'Silai',
    emoji: '🧵',
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
  },
  finishing: {
    label: 'Finishing',
    emoji: '✨',
    color: 'text-purple-700',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
  },
  ready: {
    label: 'Tayyar',
    emoji: '✅',
    color: 'text-green-700',
    bg: 'bg-green-50',
    border: 'border-green-200',
  },
  delivered: {
    label: 'De Diya',
    emoji: '📦',
    color: 'text-slate-600',
    bg: 'bg-slate-100',
    border: 'border-slate-200',
  },
  cancelled: {
    label: 'Cancel',
    emoji: '❌',
    color: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-200',
  },
};

export const GARMENT_LABELS: Record<GarmentType, { label: string; emoji: string }> = {
  shalwar_kameez: { label: 'Shalwar Kameez', emoji: '👘' },
  kurta:          { label: 'Kurta',           emoji: '👕' },
  kurti:          { label: 'Kurti',           emoji: '👚' },
  shirt:          { label: 'Shirt',           emoji: '👕' },
  trouser:        { label: 'Trouser',         emoji: '👖' },
  pajama:         { label: 'Pajama',          emoji: '👖' },
  sherwani:       { label: 'Sherwani',        emoji: '🎩' },
  waistcoat:      { label: 'Waistcoat',       emoji: '🦺' },
  prince_coat:    { label: 'Prince Coat',     emoji: '🧥' },
  pant_coat:      { label: 'Pant Coat',       emoji: '🤵' },
  lehenga:        { label: 'Lehenga',         emoji: '💃' },
  maxi:           { label: 'Maxi',            emoji: '👗' },
  blazer:         { label: 'Blazer',          emoji: '🧥' },
  jacket:         { label: 'Jacket',          emoji: '🧥' },
  other:          { label: 'Aur',             emoji: '📌' },
}
