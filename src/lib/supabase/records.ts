import type {
  CustomerRecord,
  MeasurementRecord,
  OrderRecord,
  OrderStatusHistoryRecord,
  PaymentRecord,
  ShopRecord,
  TeamMemberRecord,
} from '@/lib/db/schema'

export function mapShop(row: any): ShopRecord {
  return {
    id: row.id,
    shopName: row.shop_name,
    ownerName: row.owner_name ?? undefined,
    ownerPhone: row.owner_phone,
    whatsappNumber: row.whatsapp_number ?? undefined,
    stateProvince: row.state_province ?? undefined,
    city: row.city ?? undefined,
    addressLine: row.address_line ?? undefined,
    postalCode: row.postal_code ?? undefined,
    brandName: row.brand_name ?? undefined,
    brandColor: row.brand_color ?? undefined,
    brandLogoUrl: row.brand_logo_url ?? undefined,
    isActive: row.is_active === false ? 0 : 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    _synced: 1,
    _deleted: row.deleted_at ? 1 : 0,
  }
}

export function mapTeamMember(row: any): TeamMemberRecord {
  return {
    id: row.id,
    shopId: row.shop_id,
    name: row.name,
    phone: row.phone,
    role: row.role,
    pin: row.pin_hash ?? '',
    speciality: row.speciality ?? undefined,
    payRateType: row.pay_rate_type ?? undefined,
    payRate: row.pay_rate ?? undefined,
    isActive: row.is_active === false ? 0 : 1,
    joinedAt: row.joined_at ?? row.created_at,
    createdAt: row.created_at,
    _synced: 1,
    _deleted: row.deleted_at ? 1 : 0,
  }
}

export function mapCustomer(row: any): CustomerRecord {
  return {
    id: row.id,
    shopId: row.shop_id,
    name: row.name,
    phone: row.phone,
    whatsapp: row.whatsapp ?? undefined,
    gender: row.gender,
    notes: row.notes ?? undefined,
    photoUrl: row.photo_url ?? undefined,
    totalOrders: row.total_orders ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastOrderAt: row.last_order_at ?? undefined,
    _synced: 1,
    _deleted: row.deleted_at ? 1 : 0,
  }
}

export function mapOrder(row: any): OrderRecord {
  return {
    id: row.id,
    shopId: row.shop_id,
    orderNumber: row.order_number,
    trackingCode: row.tracking_code,
    customerId: row.customer_id,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    orderForRelation: row.order_for_relation ?? 'self',
    orderForName: row.order_for_name ?? undefined,
    recipientGender: row.recipient_gender ?? undefined,
    measurementId: row.measurement_id ?? undefined,
    garmentType: row.garment_type,
    status: row.status,
    assignedTo: row.assigned_to ?? undefined,
    assignedToName: row.assigned_to_name ?? undefined,
    totalPrice: row.total_price ?? 0,
    amountPaid: row.amount_paid ?? 0,
    isUrgent: row.is_urgent ? 1 : 0,
    dueDate: row.due_date,
    specialInstructions: row.special_instructions ?? undefined,
    fabricPhotoUrl: row.fabric_photo_url ?? undefined,
    stylePhotoUrl: row.style_photo_url ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deliveredAt: row.delivered_at ?? undefined,
    _synced: 1,
    _deleted: row.deleted_at ? 1 : 0,
  }
}

export function mapMeasurement(row: any): MeasurementRecord {
  return {
    id: row.id,
    customerId: row.customer_id,
    shopId: row.shop_id,
    orderForRelation: row.order_for_relation ?? 'self',
    orderForName: row.order_for_name ?? undefined,
    recipientGender: row.recipient_gender ?? undefined,
    garmentType: row.garment_type,
    values: row.values ?? {},
    notes: row.notes ?? undefined,
    takenAt: row.taken_at,
    _synced: 1,
    _deleted: row.deleted_at ? 1 : 0,
  }
}

export function mapPayment(row: any): PaymentRecord {
  return {
    id: row.id,
    shopId: row.shop_id,
    orderId: row.order_id,
    amount: row.amount ?? 0,
    appliedToBalance: row.applied_to_balance ?? undefined,
    kind: row.kind ?? 'order_payment',
    method: row.method,
    recordedBy: row.recorded_by,
    paidAt: row.paid_at,
    notes: row.notes ?? undefined,
    _synced: 1,
    _deleted: row.deleted_at ? 1 : 0,
  }
}

export function mapStatusHistory(row: any): OrderStatusHistoryRecord {
  return {
    id:         row.id,
    orderId:    row.order_id,
    oldStatus:  row.old_status,
    newStatus:  row.new_status,
    shopId:     row.shop_id,
    changedBy:  row.changed_by,
    changedAt:  row.changed_at,
  }
}