import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { mapShop, mapTeamMember, mapCustomer, mapOrder, mapMeasurement, mapPayment, mapStatusHistory } from '../src/lib/supabase/records.ts'

describe('mapShop', () => {
  it('maps full shop row', () => {
    const r = mapShop({
      id: 's1', shop_name: 'My Shop', owner_name: 'Ali', owner_phone: '03001234567',
      whatsapp_number: '03001234567', state_province: 'Punjab', city: 'Lahore',
      address_line: '123 St', postal_code: '54000', brand_name: 'MeraDarzi',
      brand_color: '#000', brand_logo_url: 'https://logo.png',
      is_active: true, created_at: '2026-01-01', updated_at: '2026-01-02',
      deleted_at: null,
    })
    assert.equal(r.id, 's1')
    assert.equal(r.shopName, 'My Shop')
    assert.equal(r.ownerName, 'Ali')
    assert.equal(r.isActive, 1)
    assert.equal(r._deleted, 0)
  })
  it('maps minimal row', () => {
    const r = mapShop({
      id: 's1', shop_name: 'Shop', owner_phone: '03001234567',
      is_active: false, created_at: '2026-01-01',
    })
    assert.equal(r.isActive, 0)
  })
  it('detects deleted shop', () => {
    const r = mapShop({
      id: 's1', shop_name: 'S', owner_phone: '03',
      is_active: true, created_at: '2026-01-01', deleted_at: '2026-06-01',
    })
    assert.equal(r._deleted, 1)
  })
})

describe('mapTeamMember', () => {
  it('maps full team member', () => {
    const r = mapTeamMember({
      id: 'm1', shop_id: 's1', name: 'Karigar', phone: '03001234567',
      role: 'karigar', pin_hash: '$2a$10$hash', speciality: 'Shirt',
      pay_rate_type: 'per_piece', pay_rate: 100,
      is_active: true, joined_at: '2026-01-15', created_at: '2026-01-01',
      deleted_at: null,
    })
    assert.equal(r.name, 'Karigar')
    assert.equal(r.role, 'karigar')
    assert.equal(r.pin, '$2a$10$hash')
    assert.equal(r.speciality, 'Shirt')
    assert.equal(r.payRate, 100)
  })
  it('falls back joinedAt to createdAt', () => {
    const r = mapTeamMember({
      id: 'm1', shop_id: 's1', name: 'N', phone: '03', role: 'karigar',
      pin_hash: '', is_active: true, created_at: '2026-01-01',
    })
    assert.equal(r.joinedAt, '2026-01-01')
  })
})

describe('mapCustomer', () => {
  it('maps full customer', () => {
    const r = mapCustomer({
      id: 'c1', shop_id: 's1', name: 'Customer', phone: '03001234567',
      whatsapp: '03001234567', gender: 'male', notes: 'VIP',
      photo_url: 'https://photo.png', total_orders: 5,
      created_at: '2026-01-01', updated_at: '2026-01-02',
      last_order_at: '2026-05-01', deleted_at: null,
    })
    assert.equal(r.name, 'Customer')
    assert.equal(r.totalOrders, 5)
    assert.equal(r.whatsapp, '03001234567')
  })
})

describe('mapOrder', () => {
  it('maps full order', () => {
    const r = mapOrder({
      id: 'o1', shop_id: 's1', order_number: 1, tracking_code: 'MDZ-ABC',
      customer_id: 'c1', customer_name: 'Cust', customer_phone: '03001234567',
      order_for_relation: 'self', order_for_name: null, recipient_gender: null,
      measurement_id: 'm1', garment_type: 'shirt', status: 'pending',
      assigned_to: null, assigned_to_name: null,
      total_price: 1000, amount_paid: 500,
      is_urgent: true, due_date: '2026-06-15',
      special_instructions: 'Urgent', fabric_photo_url: null, style_photo_url: null,
      created_at: '2026-01-01', updated_at: '2026-01-02', delivered_at: null,
      deleted_at: null,
    })
    assert.equal(r.orderNumber, 1)
    assert.equal(r.trackingCode, 'MDZ-ABC')
    assert.equal(r.garmentType, 'shirt')
    assert.equal(r.isUrgent, 1)
    assert.equal(r.measurementId, 'm1')
  })
})

describe('mapMeasurement', () => {
  it('maps measurement', () => {
    const r = mapMeasurement({
      id: 'm1', customer_id: 'c1', shop_id: 's1',
      order_for_relation: 'self', order_for_name: null, recipient_gender: null,
      garment_type: 'shirt', values: { length: 30 }, notes: 'Tight fit',
      taken_at: '2026-01-01', deleted_at: null,
    })
    assert.equal(r.garmentType, 'shirt')
    assert.deepEqual(r.values, { length: 30 })
  })
})

describe('mapPayment', () => {
  it('maps payment', () => {
    const r = mapPayment({
      id: 'p1', shop_id: 's1', order_id: 'o1',
      amount: 500, applied_to_balance: null,
      kind: 'order_payment', method: 'cash',
      recorded_by: 'owner', paid_at: '2026-01-01',
      notes: 'Half payment', deleted_at: null,
    })
    assert.equal(r.amount, 500)
    assert.equal(r.method, 'cash')
    assert.equal(r.kind, 'order_payment')
  })
})

describe('mapStatusHistory', () => {
  it('maps status history', () => {
    const r = mapStatusHistory({
      id: 'h1', order_id: 'o1', old_status: 'pending',
      new_status: 'cutting', shop_id: 's1', changed_by: 'owner',
      changed_at: '2026-01-01',
    })
    assert.equal(r.oldStatus, 'pending')
    assert.equal(r.newStatus, 'cutting')
  })
})
