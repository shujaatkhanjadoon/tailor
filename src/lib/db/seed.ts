// src/lib/db/seed.ts
import { db } from './schema'

export async function seedDemoData() {
  const alreadySeeded = await db.appSettings.get('seeded')
  if (alreadySeeded) return

  const uuid  = () => crypto.randomUUID()
  const now   = () => new Date().toISOString()
  const today = () => new Date().toISOString().split('T')[0]
  const daysFrom = (n: number) =>
    new Date(Date.now() + n * 86400000).toISOString().split('T')[0]

  const shopId = uuid()

  // Direct DB writes — bypasses syncQueue entirely
  await db.shop.add({
    id: shopId, shopName: 'Ahmed Tailor House',
    ownerPhone: '03001234567',
    createdAt: now(), updatedAt: now(),
    _synced: 1,   // ← mark as already synced so banner stays clean
    _deleted: 0,
  })

  await db.appSettings.put({ key: 'shopId',  value: JSON.stringify(shopId) })
  await db.appSettings.put({ key: 'seeded',  value: 'true' })

  const ownerId = uuid()
  await db.teamMembers.add({
    id: ownerId, shopId, name: 'Ahmed (Ustad)',
    phone: '03001234567', role: 'owner', pin: '1234',
    isActive: 1, joinedAt: today(), createdAt: now(),
    _synced: 1, _deleted: 0,
  })

  const karigId = uuid()
  await db.teamMembers.add({
    id: karigId, shopId, name: 'Bilal Karigar',
    phone: '03111234567', role: 'karigar', pin: '5678',
    speciality: 'Shalwar Kameez', payRateType: 'per_order', payRate: 150,
    isActive: 1, joinedAt: today(), createdAt: now(),
    _synced: 1, _deleted: 0,
  })

  const c1id = uuid(), c2id = uuid(), c3id = uuid()
  await db.customers.bulkAdd([
    { id:c1id, shopId, name:'Ahmed Raza',  phone:'03001111111',
      whatsapp:'03001111111', gender:'male',   totalOrders:0,
      createdAt:now(), updatedAt:now(), _synced:1, _deleted:0 },
    { id:c2id, shopId, name:'Fatima Bibi', phone:'03002222222',
      whatsapp:'03002222222', gender:'female', totalOrders:0,
      createdAt:now(), updatedAt:now(), _synced:1, _deleted:0 },
    { id:c3id, shopId, name:'Hassan Khan', phone:'03003333333',
      gender:'male', totalOrders:0,
      createdAt:now(), updatedAt:now(), _synced:1, _deleted:0 },
  ])

  await db.orders.bulkAdd([
    { id:uuid(), shopId, orderNumber:1, customerId:c1id,
      customerName:'Ahmed Raza',  customerPhone:'03001111111',
      garmentType:'shalwar_kameez', status:'ready',
      totalPrice:2500, amountPaid:1000, isUrgent:0,
      dueDate:today(), createdAt:now(), updatedAt:now(),
      _synced:1, _deleted:0 },
    { id:uuid(), shopId, orderNumber:2, customerId:c2id,
      customerName:'Fatima Bibi', customerPhone:'03002222222',
      garmentType:'shalwar_kameez', status:'stitching',
      totalPrice:3200, amountPaid:1500, isUrgent:1,
      dueDate:daysFrom(-2), createdAt:now(), updatedAt:now(),
      assignedTo:karigId, assignedToName:'Bilal Karigar',
      _synced:1, _deleted:0 },
    { id:uuid(), shopId, orderNumber:3, customerId:c3id,
      customerName:'Hassan Khan', customerPhone:'03003333333',
      garmentType:'shirt', status:'cutting',
      totalPrice:800, amountPaid:400, isUrgent:0,
      dueDate:daysFrom(3), createdAt:now(), updatedAt:now(),
      _synced:1, _deleted:0 },
  ])
}