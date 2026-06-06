import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { sbUpsertById, sbUpsertByShopId, sbPost } from '@/lib/supabase/service'

const NOW = new Date()
const KARACHI_OFFSET = '+05:00'

function isoNow(): string {
  return NOW.toISOString().replace('Z', KARACHI_OFFSET)
}

function dateStr(daysAgo: number): string {
  const d = new Date(NOW.getTime() - daysAgo * 86400000)
  return d.toISOString().slice(0, 10)
}

function pastDate(daysAgo: number): string {
  const d = new Date(NOW.getTime() - daysAgo * 86400000)
  return d.toISOString().replace('Z', KARACHI_OFFSET)
}

function uuid(): string {
  return crypto.randomUUID()
}

function hashPin(pin: string): string {
  return bcrypt.hashSync(pin, 10)
}

const DEMO_OWNER_PHONE = '923001234567'
const DEMO_OWNER_PIN = '1234'
const DEMO_SHOP_NAME = 'Demo Tailor Shop'
const DEMO_SHOP_ID = uuid()
const DEMO_OWNER_ID = uuid()

const STATUSES = [
  'pending', 'in_progress', 'ready_for_fitting',
  'fitted', 'ready', 'delivered', 'cancelled',
] as const

const GARMENTS = [
  'Shalwar Kameez', 'Kurta', 'Waistcoat', 'Sherwani',
  'Suit', 'Trouser', 'Shirt', 'Pajama',
] as const

const CUSTOMER_NAMES = [
  'Ahmed Khan', 'Sara Ali', 'Mohammed Iqbal', 'Fatima Hassan',
  'Usman Sheikh', 'Ayesha Malik', 'Bilal Ahmed', 'Zainab Khan',
  'Tariq Mehmood', 'Hina Riaz', 'Kamran Abbas', 'Saima Batool',
  'Rashid Minhas', 'Nadia Hussain', 'Javed Iqbal', 'Samina Karim',
]

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export async function seedDemoData() {
  console.log('[seed] Starting demo data seed...')

  const ownerPinHash = hashPin(DEMO_OWNER_PIN)

  // 1. Create demo shop
  console.log('[seed] Creating demo shop...')
  await sbUpsertById('shops', {
    id: DEMO_SHOP_ID,
    shop_name: DEMO_SHOP_NAME,
    owner_name: 'Demo Owner',
    owner_phone: DEMO_OWNER_PHONE,
    whatsapp_number: DEMO_OWNER_PHONE,
    owner_email: 'demo@tailor.com',
    state_province: 'Sindh',
    city: 'Karachi',
    address_line: '123 Demo Street, Saddar',
    postal_code: '74000',
    brand_name: 'Demo Tailors',
    plan: 'pro',
    is_active: true,
    verification_status: 'verified',
    created_at: isoNow(),
    updated_at: isoNow(),
  })

  // 2. Create owner team member
  console.log('[seed] Creating owner team member...')
  await sbUpsertById('team_members', {
    id: DEMO_OWNER_ID,
    shop_id: DEMO_SHOP_ID,
    name: 'Demo Owner',
    phone: DEMO_OWNER_PHONE,
    role: 'owner',
    pin_hash: ownerPinHash,
    email: 'demo@tailor.com',
    email_verified: true,
    is_active: true,
    speciality: null,
    joined_at: dateStr(90),
    created_at: isoNow(),
  })

  // 3. Create karigar team members
  const karigars = [
    { name: 'Rafiq Tailor', phone: '923001234568', speciality: 'Shalwar Kameez', payRateType: 'per_order', payRate: 300 },
    { name: 'Javed Master', phone: '923001234569', speciality: 'Sherwani', payRateType: 'per_order', payRate: 500 },
    { name: 'Shafiq Bhai', phone: '923001234570', speciality: 'Suiting', payRateType: 'daily', payRate: 800 },
  ]
  const karigarIds: string[] = []
  for (const k of karigars) {
    const id = uuid()
    karigarIds.push(id)
    console.log(`[seed] Creating karigar: ${k.name}...`)
    await sbUpsertById('team_members', {
      id,
      shop_id: DEMO_SHOP_ID,
      name: k.name,
      phone: k.phone,
      role: 'karigar',
      pin_hash: hashPin('0000'),
      is_active: true,
      speciality: k.speciality,
      pay_rate_type: k.payRateType,
      pay_rate: k.payRate,
      joined_at: dateStr(randInt(30, 80)),
      created_at: pastDate(randInt(30, 80)),
    })
  }

  // 4. Create subscription
  console.log('[seed] Creating subscription...')
  await sbUpsertByShopId('subscriptions', {
    shop_id: DEMO_SHOP_ID,
    plan: 'pro',
    status: 'active',
    trial_ends_at: null,
    expires_at: dateStr(-30),
    billing_cycle: 'monthly',
    amount_pkr: 1500,
    updated_at: isoNow(),
  })

  // 5. Create usage stats
  await sbUpsertByShopId('shop_usage', {
    shop_id: DEMO_SHOP_ID,
    orders_this_month: randInt(10, 25),
    customers_total: CUSTOMER_NAMES.length,
    karigar_count: karigars.length,
    storage_used_kb: randInt(5000, 15000),
    month_year: `${NOW.getFullYear()}-${String(NOW.getMonth() + 1).padStart(2, '0')}`,
    updated_at: isoNow(),
  })

  // 6. Create customers with measurements
  const customerIds: string[] = []
  const measurementIds: string[] = []

  for (let i = 0; i < CUSTOMER_NAMES.length; i++) {
    const cId = uuid()
    customerIds.push(cId)
    const gender = i < 8 ? 'male' : 'female'
    const phone = `92300${String(1000000 + i).slice(0, 7)}`
    const name = CUSTOMER_NAMES[i]

    await sbUpsertById('customers', {
      id: cId,
      shop_id: DEMO_SHOP_ID,
      name,
      phone,
      whatsapp: phone,
      gender,
      total_orders: randInt(0, 5),
      notes: i % 3 === 0 ? 'Regular customer' : null,
      created_at: pastDate(randInt(1, 60)),
      updated_at: pastDate(randInt(0, 5)),
      last_order_at: i % 4 === 0 ? pastDate(randInt(0, 10)) : null,
    })

    // Measurement for each customer
    const mId = uuid()
    measurementIds.push(mId)
    await sbUpsertById('measurements', {
      id: mId,
      customer_id: cId,
      shop_id: DEMO_SHOP_ID,
      order_for_relation: 'self',
      order_for_name: name,
      recipient_gender: gender,
      garment_type: pick(GARMENTS),
      values: {
        'Qala': String(randInt(30, 48)),
        'Sina': String(randInt(32, 44)),
        'Kamar': String(randInt(28, 40)),
        'Kulhay': String(randInt(34, 48)),
        'Moonh': String(randInt(18, 26)),
        'Bazu': String(randInt(6, 10)),
        'Paina': String(randInt(14, 22)),
        'Golai': String(randInt(14, 18)),
      },
      notes: null,
      taken_at: pastDate(randInt(0, 60)),
    })

    console.log(`[seed] Created customer: ${name}`)
  }

  // 7. Create orders with payments and status history
  const orderIds: string[] = []
  for (let i = 0; i < 15; i++) {
    const oId = uuid()
    orderIds.push(oId)
    const customerIdx = i % CUSTOMER_NAMES.length
    const cId = customerIds[customerIdx]
    const customerName = CUSTOMER_NAMES[customerIdx]
    const status = STATUSES[i % STATUSES.length]
    const totalPrice = randInt(1500, 8000)
    const amountPaid = status === 'delivered' ? totalPrice : status === 'cancelled' ? 0 : randInt(0, totalPrice)
    const isUrgent = i % 5 === 0
    const orderAge = randInt(1, 45)
    const assignedTo = i % 4 === 0 ? karigarIds[i % karigarIds.length] : null
    const assignedToName = assignedTo ? karigars.find((_, idx) => karigarIds[idx] === assignedTo)?.name ?? null : null

    await sbUpsertById('orders', {
      id: oId,
      shop_id: DEMO_SHOP_ID,
      order_number: 1001 + i,
      tracking_code: `DM-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
      customer_id: cId,
      customer_name: customerName,
      customer_phone: `92300${String(1000000 + customerIdx).slice(0, 7)}`,
      order_for_relation: 'self',
      recipient_gender: customerIdx < 8 ? 'male' : 'female',
      garment_type: pick(GARMENTS),
      status,
      total_price: totalPrice,
      amount_paid: amountPaid,
      is_urgent: isUrgent,
      due_date: dateStr(orderAge - randInt(2, 10)),
      assigned_to: assignedTo,
      assigned_to_name: assignedToName,
      special_instructions: i % 3 === 0 ? 'Jaldi chahiye' : null,
      created_at: pastDate(orderAge),
      updated_at: pastDate(randInt(0, 3)),
      delivered_at: status === 'delivered' ? pastDate(randInt(0, orderAge)) : null,
    })

    // Status history
    await sbPost('order_status_history', {
      id: uuid(),
      order_id: oId,
      shop_id: DEMO_SHOP_ID,
      old_status: 'pending',
      new_status: status,
      changed_by: DEMO_OWNER_ID,
      changed_at: pastDate(orderAge),
    })

    // Payment for delivered/in_progress orders
    if (amountPaid > 0) {
      await sbPost('payments', {
        id: uuid(),
        shop_id: DEMO_SHOP_ID,
        order_id: oId,
        amount: amountPaid,
        kind: 'order_payment',
        method: randInt(0, 3) === 0 ? 'easypaisa' : 'cash',
        recorded_by: assignedTo ?? DEMO_OWNER_ID,
        paid_at: pastDate(randInt(0, orderAge)),
        notes: null,
      })
    }

    console.log(`[seed] Created order #${1001 + i}: ${customerName} - ${status}`)
  }

  // 8. Create sample order_photos for first 3 orders
  for (let i = 0; i < 3 && i < orderIds.length; i++) {
    await sbPost('order_photos', {
      id: uuid(),
      order_id: orderIds[i],
      shop_id: DEMO_SHOP_ID,
      type: 'fabric',
      cloud_url: 'https://res.cloudinary.com/demo/image/upload/v1/tailor/demo-fabric.jpg',
      public_id: `tailor/demo-fabric-${i}`,
      cloud_size_kb: 120,
      taken_at: pastDate(randInt(1, 10)),
    })
    console.log(`[seed] Added photo for order #${1001 + i}`)
  }

  // 9. Create email verification for demo owner
  await sbUpsertById('email_verifications', {
    phone: DEMO_OWNER_PHONE,
    email: 'demo@tailor.com',
    verified_at: isoNow(),
  })

  console.log('[seed] Demo data seed complete!')
  console.log(`[seed] Shop ID: ${DEMO_SHOP_ID}`)
  console.log(`[seed] Owner PIN: ${DEMO_OWNER_PIN}`)
  console.log(`[seed] Owner Phone: ${DEMO_OWNER_PHONE}`)
  console.log(`[seed] Customers: ${customerIds.length}`)
  console.log(`[seed] Orders: ${orderIds.length}`)
  console.log(`[seed] Karigars: ${karigarIds.length}`)

  return {
    shopId: DEMO_SHOP_ID,
    ownerId: DEMO_OWNER_ID,
    ownerPhone: DEMO_OWNER_PHONE,
    ownerPin: DEMO_OWNER_PIN,
    customerCount: customerIds.length,
    orderCount: orderIds.length,
  }
}
